// Registro de eventos en disco (contrato con TecnoCircuito, sección 6.1). Solo lo usa el proceso principal: la
// página nunca toca el disco. Guarda la configuración del instructor (encendido y PIN) y escribe una línea JSON
// por evento en <carpeta>/registros/<equipo>-<fecha>.jsonl. Se prueba con Node: test/registro.js.
//
// Si el disco falla (lleno, sin permiso…), nada se pierde en silencio (AUD-02): la línea espera en una cola en
// memoria, en orden, y el registro queda «en falla» hasta que se puede escribir otra vez. Se reintenta con cada evento
// nuevo, cada `reintentoMs` y cuando el instructor lo pide. Al recuperarse escribe lo que esperaba y, por cada sesión
// afectada, el evento registro_interrumpido (desde, hasta, recuperados, perdidos, motivo): así el análisis sabe que
// hubo una falla. Lo que no cabe en la cola, o lo que espera cuando se cierra la app, se pierde; el aviso lo mostró.
//
// Un evento que no se puede guardar (más largo que LINEA_MAX, o que no se puede convertir a texto) tampoco se pierde en
// silencio (AUD-07): en su lugar va el evento evento_descartado, la cuenta sube y la app lo avisa (alDescartar).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { codigoParaArchivo, fechaArchivo } = require('../src/registro.js');

// Una línea con el circuito y el código completos cabe de sobra. Se cuenta en caracteres del JSON (unidades de texto de
// JavaScript, como la cola), sin el salto de línea; en bytes UTF-8 puede ser hasta tres veces más.
const LINEA_MAX = 2 * 1024 * 1024;
const INTENTOS = 5; // PIN equivocado: después de 5 seguidos, espera un minuto
const ESPERA_MS = 60000;
const COLA_LINEAS = 5000; // lo que puede esperar mientras el disco falla
const COLA_BYTES = 20 * 1024 * 1024;

/**
 * `alCambiar(falla, fin)` avisa cuando el registro entra en falla (con su resumen) o cuando la falla termina (null),
 * con `fin`: 'escrito' si lo que esperaba quedó en el disco, 'apagado' si el instructor apagó el registro.
 * `alDescartar(descartados)` avisa cada vez que un evento no se pudo guardar (AUD-07), con la cuenta desde que se abrió.
 * `version`: la de TecnoBloques, para el exportacion.json de cada exportación (AUD-08).
 */
function crearRegistroDisco({ carpeta, ahora = () => Date.now(), alCambiar = () => {}, alDescartar = () => {}, reintentoMs = 30000, version = null }) {
  const archivoConfig = path.join(carpeta, 'registro-config.json');
  // Mientras la carpeta dañada está movida aparte y la nueva todavía no quedó en su lugar, existe esta marca: si el
  // reemplazo no termina ni se puede deshacer, la app sabe al abrir que la recuperación quedó a medias (AUD-02-V4).
  const marcaRecuperando = archivoConfig + '.recuperando';
  const registros = path.join(carpeta, 'registros');
  let fallidos = 0;
  let bloqueadoHasta = 0;
  let cola = []; // [{ nombre, texto, sobre }] en orden; mientras el disco funciona, cada línea sale enseguida
  let bytesCola = 0;
  let falla = null; // { motivo, desde, sesiones: Map(equipo y sesión → { sobre, recuperados, perdidos }) }
  let reloj = null;
  let avisado = null; // lo último que se avisó con alCambiar, para avisar solo los cambios
  let comoTermino = null; // 'escrito' o 'apagado': cómo terminó la última falla
  const pendientesDeCortar = new Map(); // archivo → tamaño: una escritura falló a medias y no se pudo cortar todavía
  const revisados = new Set(); // archivos que ya se revisó que terminan en una línea completa
  let ilegibleDesde = null; // cuándo se vio por primera vez la configuración ilegible
  // Los eventos que no se pudieron guardar desde que se abrió la app (AUD-07), para el aviso y el panel del instructor:
  // cuántos; cuántos quedaron anotados con su evento_descartado escrito en el disco; cuántos no se pudieron anotar (sin
  // sobre válido, el marcador no cupo en la cola o el registro se apagó antes de escribirlo); el último; y lo mismo por
  // sesión, porque la esquina avisa solo los del equipo que está trabajando (decisión de Efraín, 21 oct). Los demás
  // esperan en la cola a que el disco funcione: no se llaman «anotados» hasta que están escritos (AUD-07, F05).
  const descartados = { cantidad: 0, anotados: 0, sinAnotar: 0, ultimo: null, sesiones: new Map() };
  function contarDescarte(sesion, campo) {
    descartados[campo]++;
    if (typeof sesion !== 'string' || !sesion) return;
    if (!descartados.sesiones.has(sesion)) descartados.sesiones.set(sesion, { cantidad: 0, anotados: 0, sinAnotar: 0 });
    descartados.sesiones.get(sesion)[campo]++;
  }

  /** Sin configuración y con la marca, un reemplazo quedó a medias: es ilegible, no recién instalado. */
  const sinConfigPorRecuperar = () => fs.existsSync(marcaRecuperando);
  const quitarMarca = () => { try { fs.rmSync(marcaRecuperando, { force: true }); } catch (e) { /* solo cuenta sin configuración */ } };
  /**
   * La configuración. Sin archivo: recién instalado (apagado, sin PIN). Si existe y no se puede leer, `ilegible`: no se
   * sabe si estaba encendido ni cuál es el PIN, y la app lo muestra (AUD-02-V2); no es lo mismo que recién instalado.
   * Sin archivo pero con la marca de un reemplazo a medias, también es `ilegible` (AUD-02-V4).
   */
  function leer() {
    try {
      const c = JSON.parse(fs.readFileSync(archivoConfig, 'utf8'));
      if (!configValida(c)) throw new Error('configuración mal formada');
      return c;
    } catch (e) {
      if (e.code === 'ENOENT' && !sinConfigPorRecuperar()) return { activo: false, pin: null };
      return { activo: false, pin: null, ilegible: true };
    }
  }
  /**
   * Una configuración que se puede usar (AUD-11): un objeto con `activo` booleano y, si hay PIN, su sal (16 bytes en
   * hexadecimal) y su resumen scrypt (32 bytes). Encendido exige PIN: sin él nadie podría apagarlo. Que el archivo sea JSON
   * no basta: `null`, `[]`, `{ activo: true }` o un PIN roto son una configuración ilegible, igual que un JSON roto.
   */
  function configValida(c) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || typeof c.activo !== 'boolean') return false;
    if (c.pin === undefined || c.pin === null) return !c.activo;
    return typeof c.pin === 'object' && !Array.isArray(c.pin) && typeof c.pin.sal === 'string' && /^[0-9a-f]{32}$/.test(c.pin.sal) &&
      typeof c.pin.hash === 'string' && /^[0-9a-f]{64}$/.test(c.pin.hash);
  }
  /** Para escribir: sin archivo, el registro está apagado; si existe y no se puede usar (o quedó a medias), es una falla. */
  function leerParaEscribir() {
    const c = leer();
    if (c.ilegible) throw Object.assign(new Error('No se pudo leer la configuración del registro'), { code: 'CONFIG' });
    return c;
  }
  /**
   * Guarda la configuración entera o nada: la escribe en un temporal y después la pone en su lugar. `aparte` corre entre
   * los dos pasos (guardar aparte la dañada) y devuelve cómo deshacerlo. Si algo falla, se deshace lo hecho y la
   * configuración que había queda igual (AUD-02-V4). Si ni deshacer se puede, queda la marca y la app sigue mostrando la
   * configuración como ilegible. Devuelve false si el disco no dejó.
   */
  function guardar(c, aparte) {
    const temporal = archivoConfig + '.tmp';
    let deshacer = null;
    try {
      fs.mkdirSync(carpeta, { recursive: true });
      fs.writeFileSync(temporal, JSON.stringify(c, null, 1));
      if (aparte) deshacer = aparte();
      fs.renameSync(temporal, archivoConfig);
      quitarMarca(); // la configuración nueva ya está en su lugar
      return true;
    } catch (e) {
      if (deshacer) try { deshacer(); } catch (e2) { /* la marca se queda: la recuperación sigue pendiente y visible */ }
      try { fs.rmSync(temporal, { force: true }); } catch (e2) { /* se sobrescribe la próxima vez */ }
      return false;
    }
  }
  const resumenPin = (pin) => {
    const sal = crypto.randomBytes(16).toString('hex');
    return { sal, hash: crypto.scryptSync(String(pin), sal, 32).toString('hex') };
  };
  const pinValido = (pin) => typeof pin === 'string' && /^\d{4,8}$/.test(pin);
  function comprobar(pin) {
    const c = leer();
    if (c.ilegible) return { ok: false, motivo: 'config-ilegible' };
    if (!c.pin) return { ok: false, motivo: 'sin-pin' };
    if (ahora() < bloqueadoHasta) return { ok: false, motivo: 'espera', segundos: Math.ceil((bloqueadoHasta - ahora()) / 1000) };
    const esperado = Buffer.from(c.pin.hash, 'hex');
    const dado = crypto.scryptSync(String(pin || ''), c.pin.sal, 32);
    if (esperado.length === dado.length && crypto.timingSafeEqual(esperado, dado)) { fallidos = 0; return { ok: true, config: c }; }
    if (++fallidos >= INTENTOS) { fallidos = 0; bloqueadoHasta = ahora() + ESPERA_MS; }
    return { ok: false, motivo: 'pin' };
  }

  /* ---- La falla del disco: la cola, el aviso y la recuperación ---- */
  // Una hora que Date puede representar; si no, la del momento (el archivo nunca se llama «NaN-NaN-NaN»)
  const horaValida = (t) => (Number.isFinite(t) && t >= 0 && t <= 8.64e15 ? Math.round(t) : null);
  const nombreDe = (linea) => `${codigoParaArchivo(linea.equipo)}-${fechaArchivo(horaValida(linea.t) ?? ahora())}.jsonl`;
  const sobreDe = (linea) => ({ equipo: linea.equipo, sesion: linea.sesion, version_tb: linea.version_tb, version_tc: linea.version_tc });
  function deSesion(sobre) {
    const clave = `${sobre.equipo}\u0000${sobre.sesion}`;
    if (!falla.sesiones.has(clave)) falla.sesiones.set(clave, { sobre, recuperados: 0, perdidos: 0 });
    return falla.sesiones.get(clave);
  }
  /** Lo que puede saber el instructor de la falla: motivo, desde cuándo, cuántas líneas esperan y cuántas se perdieron. */
  function resumenFalla() {
    if (!falla) return null;
    let perdidos = 0;
    for (const s of falla.sesiones.values()) perdidos += s.perdidos;
    return { motivo: falla.motivo, desde: falla.desde, pendientes: cola.length, perdidos };
  }
  function avisarSiCambio() {
    const r = resumenFalla();
    const clave = r && `${r.motivo}|${r.desde}`;
    if (clave === avisado) return;
    avisado = clave;
    try { alCambiar(r, r ? null : comoTermino); } catch (e) { /* avisar nunca debe impedir escribir */ }
  }
  function fallar(e) {
    const motivo = String((e && e.code) || 'DESCONOCIDO');
    if (falla) { falla.motivo = motivo; return; }
    falla = { motivo, desde: ahora(), sesiones: new Map() };
    reloj = setInterval(() => { vaciar(); avisarSiCambio(); }, reintentoMs);
    if (reloj.unref) reloj.unref();
  }
  function terminarFalla(como) {
    clearInterval(reloj);
    reloj = null;
    comoTermino = como;
    const f = falla;
    falla = null;
    return f;
  }
  /** Los .jsonl de la carpeta de registros, ordenados. Una carpeta que todavía no existe no tiene registros; cualquier
   * otro error (sin permiso, EIO) se lanza: no es lo mismo que no tener registros (AUD-14). */
  function listar() {
    try { return fs.readdirSync(registros, { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith('.jsonl')).map((d) => d.name).sort(); } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }
  const tamano = (archivo) => { try { return fs.statSync(archivo).size; } catch (e) { if (e.code === 'ENOENT') return 0; throw e; } };
  /**
   * Agrega una línea entera o nada (AUD-02-V1). Si la escritura falla a medias (el disco se llenó en la mitad), corta
   * el archivo al tamaño que tenía; si ni eso se puede, no se vuelve a escribir en él hasta cortarlo. La primera vez que
   * se usa un archivo, si termina en un pedazo de línea (la app se cerró en la mitad de una escritura), se corta ese
   * pedazo: no es JSON y pegado a la línea siguiente la dañaría.
   */
  function anexarEntera(archivo, texto) {
    if (pendientesDeCortar.has(archivo)) {
      fs.truncateSync(archivo, pendientesDeCortar.get(archivo));
      pendientesDeCortar.delete(archivo);
    }
    if (!revisados.has(archivo)) {
      cortarPedazoFinal(archivo);
      revisados.add(archivo);
    }
    const antes = tamano(archivo);
    try {
      fs.appendFileSync(archivo, texto);
    } catch (e) {
      try { if (tamano(archivo) > antes) fs.truncateSync(archivo, antes); } catch (e2) { pendientesDeCortar.set(archivo, antes); }
      throw e;
    }
  }
  function cortarPedazoFinal(archivo) {
    let fd;
    try { fd = fs.openSync(archivo, 'r'); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    let corte = -1;
    try {
      const tam = fs.fstatSync(fd).size;
      if (!tam) return;
      const ultimo = Buffer.alloc(1);
      fs.readSync(fd, ultimo, 0, 1, tam - 1);
      if (ultimo[0] === 10) return;
      // El último salto, buscado hacia atrás por bloques y sin límite: el tope de una línea se cuenta en caracteres y
      // en bytes puede ser hasta tres veces más largo (AUD-02-V3). Sin ningún salto, todo el archivo es el pedazo.
      corte = 0;
      for (let fin = tam; fin > 0;) {
        const n = Math.min(64 * 1024, fin);
        const bloque = Buffer.alloc(n);
        fs.readSync(fd, bloque, 0, n, fin - n);
        const salto = bloque.lastIndexOf(10);
        if (salto >= 0) { corte = fin - n + salto + 1; break; }
        fin -= n;
      }
    } finally { fs.closeSync(fd); }
    if (corte >= 0) fs.truncateSync(archivo, corte);
  }
  /**
   * Pone una línea al final de la cola y devuelve true; si ya no cabe, cuenta como perdida para su sesión y devuelve
   * false. Un evento_descartado que no cabe tampoco quedó anotado (AUD-07, F05).
   */
  function encolar(item) {
    if (cola.length >= COLA_LINEAS || bytesCola + item.texto.length > COLA_BYTES) {
      if (falla && item.sobre) deSesion(item.sobre).perdidos++;
      if (item.descarte !== undefined) { contarDescarte(item.descarte, 'sinAnotar'); descartesCambiaron = true; }
      return false;
    }
    cola.push(item);
    bytesCola += item.texto.length;
    return true;
  }
  let descartesCambiaron = false; // la cuenta cambió y hay que avisar (avisarDescartes)
  function avisarDescartes() {
    if (!descartesCambiaron) return;
    descartesCambiaron = false;
    try { alDescartar(resumenDescartados()); } catch (e) { /* avisar nunca debe impedir escribir */ }
  }
  /**
   * Un evento que no se puede guardar (AUD-07): en su lugar, y con su mismo sobre, va evento_descartado (contrato 6.1),
   * por el camino de siempre (si el disco falla, espera como cualquier línea; cuenta como anotado solo cuando se escribe).
   * Lleva la hora del evento perdido, si la traía, para quedar en su lugar y en el archivo de su día. Si el sobre no sirve
   * para armarlo, solo se cuenta como «sin anotar». Nunca lanza: guardar el registro no debe detener el trabajo.
   */
  function descartar(linea, motivo, largo) {
    const sesion = typeof linea.sesion === 'string' ? linea.sesion : null;
    try {
      const t = horaValida(linea.t) ?? Math.round(ahora());
      contarDescarte(sesion, 'cantidad');
      descartesCambiaron = true;
      // El tipo del perdido, si lo tiene, y corto aunque el del perdido no lo sea
      const tipo = typeof linea.tipo === 'string' && linea.tipo ? linea.tipo.slice(0, 64) : null;
      descartados.ultimo = { tipo, motivo, t: Math.round(ahora()) };
      const sobre = sobreDe(linea);
      if (['equipo', 'sesion', 'version_tb', 'version_tc'].every((k) => typeof sobre[k] === 'string' && sobre[k].length > 0 && sobre[k].length <= 1000)) {
        const datos = { motivo, limite: LINEA_MAX };
        if (tipo) datos.tipo = tipo;
        if (typeof linea.origen === 'string' && linea.origen) datos.origen = linea.origen.slice(0, 64);
        if (Number.isInteger(linea.corrida) && linea.corrida >= 1) datos.corrida = linea.corrida;
        if (Number.isInteger(largo)) datos.largo = largo;
        const aviso = { v: 1, t, origen: 'editor', tipo: 'evento_descartado', ...sobre, datos };
        encolar({ nombre: nombreDe(aviso), texto: JSON.stringify(aviso), sobre, descarte: sesion });
        vaciar();
      } else contarDescarte(sesion, 'sinAnotar');
      avisarSiCambio();
    } catch (e) { /* ya se contó */ }
    avisarDescartes();
  }
  /** La cuenta para el aviso y el panel: total, por estado, el último y por sesión. null si no se perdió nada. */
  const resumenDescartados = () => {
    if (!descartados.cantidad) return null;
    const { cantidad, anotados, sinAnotar } = descartados;
    return { cantidad, anotados, sinAnotar, pendientes: cantidad - anotados - sinAnotar, ultimo: { ...descartados.ultimo },
      sesiones: Object.fromEntries([...descartados.sesiones].map(([s, c]) => [s, { ...c, pendientes: c.cantidad - c.anotados - c.sinAnotar }])) };
  };
  /**
   * Escribe lo que espera, en orden. Si el disco falla, la línea se queda primera en la cola. Cuando todo lo de una falla
   * quedó escrito, agrega el registro_interrumpido de cada sesión afectada y la falla termina.
   */
  function vaciar() {
    while (cola.length) {
      let config;
      try { config = leerParaEscribir(); } catch (e) { fallar(e); return; }
      if (!config.activo) {
        // El instructor lo apagó: lo que esperaba ya no se guarda (un evento_descartado que esperaba no quedó anotado), y
        // la falla termina con el registro.
        for (const item of cola) if (item.descarte !== undefined) { contarDescarte(item.descarte, 'sinAnotar'); descartesCambiaron = true; }
        cola = [];
        bytesCola = 0;
        if (falla) terminarFalla('apagado');
        avisarDescartes();
        return;
      }
      try {
        fs.mkdirSync(registros, { recursive: true });
        while (cola.length) {
          const item = cola[0];
          anexarEntera(path.join(registros, item.nombre), item.texto + '\n');
          cola.shift();
          bytesCola -= item.texto.length;
          if (falla && item.sobre) deSesion(item.sobre).recuperados++;
          if (item.descarte !== undefined) { contarDescarte(item.descarte, 'anotados'); descartesCambiaron = true; }
        }
      } catch (e) { fallar(e); avisarDescartes(); return; }
      avisarDescartes();
      if (falla) {
        const f = terminarFalla('escrito');
        const hasta = ahora();
        for (const s of f.sesiones.values()) {
          const linea = { v: 1, t: hasta, origen: 'editor', tipo: 'registro_interrumpido', ...s.sobre,
            datos: { desde: f.desde, hasta, recuperados: s.recuperados, perdidos: s.perdidos, motivo: f.motivo } };
          encolar({ nombre: nombreDe(linea), texto: JSON.stringify(linea), sobre: null });
        }
      }
    }
  }

  return {
    carpeta: registros,
    /**
     * Lo que puede saber la página sin PIN: si el registro está encendido, si ya hay PIN, si está en falla y si la
     * configuración existe pero no se puede leer (`configIlegible`).
     */
    estado() {
      const c = leer();
      if (!c.ilegible) ilegibleDesde = null;
      else if (ilegibleDesde === null) ilegibleDesde = ahora();
      // La configuración ilegible es una falla aunque todavía no haya llegado ningún evento (AUD-02-V2).
      const falla = resumenFalla() || (c.ilegible ? { motivo: 'CONFIG', desde: ilegibleDesde, pendientes: cola.length, perdidos: 0 } : null);
      return { activo: !!c.activo, tienePin: !!c.pin, falla, configIlegible: !!c.ilegible, descartados: resumenDescartados() };
    },
    /**
     * Lo que pide el instructor. accion: 'crear-pin' (solo si no hay), 'entrar', 'activar' ({activo}),
     * 'cambiar-pin' ({nuevoPin}), 'reintentar' (escribir ya lo que espera). Todas menos 'crear-pin' piden el PIN.
     * Con la configuración ilegible, 'crear-pin' pide además `reemplazarIlegible: true` (el instructor lo confirmó): la
     * dañada se guarda aparte, como evidencia, y el registro vuelve apagado (decisión de Efraín, 18 oct).
     */
    instructor({ accion, pin, nuevoPin, activo, reemplazarIlegible } = {}) {
      if (accion === 'crear-pin') {
        const c = leer();
        if (c.pin) return { ok: false, motivo: 'ya-hay-pin' };
        if (c.ilegible && reemplazarIlegible !== true) return { ok: false, motivo: 'config-ilegible' };
        if (!pinValido(pin)) return { ok: false, motivo: 'pin-invalido' };
        // Con la dañada, primero se escribe la nueva, después se copia la dañada aparte y al final la nueva la reemplaza.
        // Si un reemplazo anterior quedó a medias (sin configuración y con la marca), la dañada ya está aparte: solo
        // falta escribir la nueva, y al quedar en su lugar se quita la marca.
        let aparte = null;
        if (c.ilegible && fs.existsSync(archivoConfig)) {
          const d = new Date(ahora());
          const sello = `${fechaArchivo(ahora())}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
          // Un nombre libre: nunca se pisa la evidencia de un reemplazo anterior (ni en el mismo segundo).
          aparte = path.join(carpeta, `registro-config-ilegible-${sello}.json`);
          for (let n = 2; fs.existsSync(aparte); n++) aparte = path.join(carpeta, `registro-config-ilegible-${sello}-${n}.json`);
        }
        // Un archivo se copia aparte (deshacer: borrar la copia); la principal nunca falta. Una carpeta no se puede copiar:
        // se mueve para dejar el nombre libre (deshacer: devolverla a su lugar, y la configuración sigue ilegible y
        // visible). Antes de moverla se escribe la marca; si no se puede, no se mueve nada. Si tampoco se puede devolver
        // la carpeta, la marca se queda: al abrir, la app sigue mostrando la configuración como ilegible.
        const guardarAparte = () => {
          if (fs.statSync(archivoConfig).isDirectory()) {
            fs.writeFileSync(marcaRecuperando, JSON.stringify({ aparte: path.basename(aparte), desde: ahora() }));
            try { fs.renameSync(archivoConfig, aparte); } catch (e) { quitarMarca(); throw e; }
            return () => { fs.renameSync(aparte, archivoConfig); quitarMarca(); };
          }
          fs.copyFileSync(archivoConfig, aparte);
          return () => fs.rmSync(aparte, { force: true });
        };
        if (!guardar({ activo: false, pin: resumenPin(pin) }, aparte && guardarAparte)) return { ok: false, motivo: 'disco' };
        if (c.ilegible) { vaciar(); avisarSiCambio(); } // queda apagado: lo que esperaba se descarta y el aviso se quita
        return { ok: true, ...this.estado() };
      }
      const r = comprobar(pin);
      if (!r.ok) return r;
      if (accion === 'activar') {
        if (!guardar({ ...r.config, activo: !!activo })) return { ok: false, motivo: 'disco' };
        if (!activo) { vaciar(); avisarSiCambio(); } // apagado: lo que esperaba se descarta y el aviso se quita
      } else if (accion === 'cambiar-pin') {
        if (!pinValido(nuevoPin)) return { ok: false, motivo: 'pin-invalido' };
        if (!guardar({ ...r.config, pin: resumenPin(nuevoPin) })) return { ok: false, motivo: 'disco' };
      } else if (accion === 'reintentar') this.reintentar();
      else if (accion !== 'entrar') return { ok: false, motivo: 'accion' };
      return { ok: true, ...this.estado(), archivos: this.archivos().length };
    },
    /**
     * Escribe una línea; si el disco falla, la deja esperando. Nunca lanza: devuelve false si no es para escribir
     * (registro apagado, o una línea que no es un evento con equipo) y true si se escribió o quedó esperando. Una línea
     * del registro encendido que no se puede guardar (demasiado larga o que no se puede convertir a texto) devuelve false,
     * pero no en silencio: queda su evento_descartado y la app lo avisa (AUD-07).
     */
    escribir(linea) {
      if (!linea || typeof linea !== 'object' || typeof linea.equipo !== 'string' || !linea.equipo.trim()) return false;
      let config = null;
      try { config = leerParaEscribir(); } catch (e) { /* lo resuelve vaciar(): la línea espera y queda la falla */ }
      if (config && !config.activo) return false;
      if (typeof linea.tipo !== 'string' || !linea.tipo) { descartar(linea, 'sin_tipo', null); return false; }
      let texto;
      try { texto = JSON.stringify(linea); } catch (e) { texto = undefined; } // un ciclo o un BigInt
      if (typeof texto !== 'string') { descartar(linea, 'no_serializable', null); return false; }
      if (texto.length > LINEA_MAX) { descartar(linea, 'tamano', texto.length); return false; }
      // El evento_descartado de la página (uno que no llegó hasta aquí) también se cuenta, y queda anotado al escribirse
      const descarte = linea.tipo === 'evento_descartado' ? (typeof linea.sesion === 'string' ? linea.sesion : null) : undefined;
      if (descarte !== undefined) {
        const d = linea.datos && typeof linea.datos === 'object' ? linea.datos : {};
        contarDescarte(descarte, 'cantidad');
        descartesCambiaron = true;
        descartados.ultimo = { tipo: typeof d.tipo === 'string' ? d.tipo.slice(0, 64) : null, motivo: typeof d.motivo === 'string' ? d.motivo.slice(0, 32) : 'no_serializable', t: Math.round(ahora()) };
      }
      encolar({ nombre: nombreDe(linea), texto, sobre: sobreDe(linea), ...(descarte !== undefined ? { descarte } : {}) });
      vaciar();
      avisarSiCambio();
      avisarDescartes();
      return true;
    },
    /** Intenta escribir ya lo que espera (el botón del instructor, y al cerrar la app). Devuelve la falla o null. */
    reintentar() {
      vaciar();
      avisarSiCambio();
      return resumenFalla();
    },
    /** Los .jsonl de la carpeta de registros (solo archivos: una carpeta con ese nombre no se copia). [] si no se puede leer. */
    archivos() {
      try { return listar(); } catch (e) { return []; }
    },
    /**
     * Copia los .jsonl a una carpeta nueva dentro de `destino`. Pide el PIN. Lo que espera en la cola no va.
     * Cada exportación tiene su propia carpeta, aunque haya otra del mismo minuto (AUD-08): se reserva con mkdir sin
     * `recursive`, que falla si ya existe, y se prueba con -2, -3… Ningún archivo se copia encima de otro. Al final va
     * exportacion.json, con el nombre, los bytes y el sha256 de cada archivo copiado y `completa: true`; si una copia
     * falla a mitad, el pedazo copiado se borra, `completa: false`, el error y la lista `faltan` de lo que no se copió.
     * Una carpeta sin exportacion.json completa no es una exportación entera, y así la lee la historia (AUD-09).
     * Los errores dicen de qué lado fueron (`donde`: 'origen', los registros de este PC; 'destino', la USB) y su código
     * (AUD-14): una carpeta de registros que no se puede leer no es lo mismo que no tener registros.
     */
    exportar({ pin, destino }) {
      const r = comprobar(pin);
      if (!r.ok) return r;
      const noSePudo = (donde, e, extra) => ({ ok: false, motivo: 'disco', donde, codigo: String((e && e.code) || 'DESCONOCIDO'), mensaje: e && e.message, ...extra });
      let archivos;
      try { archivos = listar(); } catch (e) { return noSePudo('origen', e); }
      if (!archivos.length) return { ok: false, motivo: 'sin-archivos' };
      const momento = ahora(); // una sola hora para el nombre y el manifiesto
      const d = new Date(momento);
      const sello = `${fechaArchivo(momento)}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      let carpetaDestino = null;
      for (let n = 1; n <= 1000 && !carpetaDestino; n++) {
        const c = path.join(destino, `TecnoBloques-registros-${sello}${n > 1 ? `-${n}` : ''}`);
        try { fs.mkdirSync(c); carpetaDestino = c; } catch (e) {
          if (e.code !== 'EEXIST') return noSePudo('destino', e);
        }
      }
      if (!carpetaDestino) return noSePudo('destino', { code: 'TOPE', message: 'ya hay 1000 exportaciones de ese minuto en esa carpeta' });
      const copiados = [];
      let error = null;
      for (const f of archivos) {
        const origen = path.join(registros, f);
        const destinoArchivo = path.join(carpetaDestino, f);
        try {
          const tamano = fs.statSync(origen).size;
          fs.copyFileSync(origen, destinoArchivo, fs.constants.COPYFILE_EXCL);
          const contenido = fs.readFileSync(destinoArchivo); // lo que quedó en la copia
          if (contenido.length !== tamano) throw Object.assign(new Error(`la copia tiene ${contenido.length} bytes y el original ${tamano}`), { code: 'TAMANO' });
          copiados.push({ archivo: f, bytes: contenido.length, sha256: crypto.createHash('sha256').update(contenido).digest('hex') });
        } catch (e) {
          error = { archivo: f, codigo: String(e.code || 'DESCONOCIDO'), mensaje: e.message, donde: fs.existsSync(origen) ? 'destino' : 'origen' };
          // El pedazo que alcanzó a copiarse no se deja: terminaría en .jsonl y parecería un registro entero
          if (e.code !== 'EEXIST') try { fs.rmSync(destinoArchivo, { force: true }); } catch (e2) { /* lo dice exportacion.json */ }
          break;
        }
      }
      const faltan = archivos.filter((f) => !copiados.some((c) => c.archivo === f));
      const manifiesto = { formato: 1, app: 'TecnoBloques', version_tb: version || null, t: Math.round(momento), completa: !error,
        total: archivos.length, archivos: copiados, pendientes: cola.length,
        ...(error ? { faltan, error: { archivo: error.archivo, codigo: error.codigo, donde: error.donde } } : {}) };
      try { fs.writeFileSync(path.join(carpetaDestino, 'exportacion.json'), JSON.stringify(manifiesto, null, 1), { flag: 'wx' }); } catch (e) {
        if (!error) error = { archivo: 'exportacion.json', codigo: String(e.code || 'DESCONOCIDO'), mensaje: e.message, donde: 'destino' };
      }
      if (error) {
        return { ok: false, motivo: 'copia-incompleta', carpeta: carpetaDestino, copiados: copiados.length, total: archivos.length,
          archivo: error.archivo, codigo: error.codigo, donde: error.donde, mensaje: `${error.archivo}: ${error.mensaje}` };
      }
      return { ok: true, carpeta: carpetaDestino, archivos: archivos.length, pendientes: cola.length };
    },
  };
}

module.exports = { crearRegistroDisco };
