// Registro de eventos en disco (contrato con TecnoCircuito, sección 6.1). Solo lo usa el proceso principal: la
// página nunca toca el disco. Guarda la configuración del instructor (encendido y PIN) y escribe una línea JSON
// por evento en <carpeta>/registros/<equipo>-<fecha>.jsonl. Se prueba con Node: test/registro.js.
//
// Si el disco falla (lleno, sin permiso…), nada se pierde en silencio (AUD-02): la línea espera en una cola en
// memoria, en orden, y el registro queda «en falla» hasta que se puede escribir otra vez. Se reintenta con cada evento
// nuevo, cada `reintentoMs` y cuando el instructor lo pide. Al recuperarse escribe lo que esperaba y, por cada sesión
// afectada, el evento registro_interrumpido (desde, hasta, recuperados, perdidos, motivo): así el análisis sabe que
// hubo una falla. Lo que no cabe en la cola, o lo que espera cuando se cierra la app, se pierde; el aviso lo mostró.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { codigoParaArchivo, fechaArchivo } = require('../src/registro.js');

const LINEA_MAX = 2 * 1024 * 1024; // una línea con el circuito y el código completos cabe de sobra
const INTENTOS = 5; // PIN equivocado: después de 5 seguidos, espera un minuto
const ESPERA_MS = 60000;
const COLA_LINEAS = 5000; // lo que puede esperar mientras el disco falla
const COLA_BYTES = 20 * 1024 * 1024;

/**
 * `alCambiar(falla, fin)` avisa cuando el registro entra en falla (con su resumen) o cuando la falla termina (null),
 * con `fin`: 'escrito' si lo que esperaba quedó en el disco, 'apagado' si el instructor apagó el registro.
 */
function crearRegistroDisco({ carpeta, ahora = () => Date.now(), alCambiar = () => {}, reintentoMs = 30000 }) {
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
      if (!c || typeof c !== 'object') throw new Error('configuración vacía');
      return c;
    } catch (e) {
      if (e.code === 'ENOENT' && !sinConfigPorRecuperar()) return { activo: false, pin: null };
      return { activo: false, pin: null, ilegible: true };
    }
  }
  /** Para escribir: sin archivo, el registro está apagado; si existe y no se puede leer (o quedó a medias), es una falla. */
  function leerParaEscribir() {
    try { return JSON.parse(fs.readFileSync(archivoConfig, 'utf8')); } catch (e) {
      if (e.code === 'ENOENT' && !sinConfigPorRecuperar()) return { activo: false };
      throw Object.assign(new Error('No se pudo leer la configuración del registro'), { code: 'CONFIG' });
    }
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
    if (!c.pin) return { ok: false, motivo: 'sin-pin' };
    if (ahora() < bloqueadoHasta) return { ok: false, motivo: 'espera', segundos: Math.ceil((bloqueadoHasta - ahora()) / 1000) };
    const esperado = Buffer.from(c.pin.hash, 'hex');
    const dado = crypto.scryptSync(String(pin || ''), c.pin.sal, 32);
    if (esperado.length === dado.length && crypto.timingSafeEqual(esperado, dado)) { fallidos = 0; return { ok: true, config: c }; }
    if (++fallidos >= INTENTOS) { fallidos = 0; bloqueadoHasta = ahora() + ESPERA_MS; }
    return { ok: false, motivo: 'pin' };
  }

  /* ---- La falla del disco: la cola, el aviso y la recuperación ---- */
  const nombreDe = (linea) => `${codigoParaArchivo(linea.equipo)}-${fechaArchivo(typeof linea.t === 'number' ? linea.t : ahora())}.jsonl`;
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
  /** Pone una línea al final de la cola; si ya no cabe, cuenta como perdida para su sesión. */
  function encolar(item) {
    if (cola.length >= COLA_LINEAS || bytesCola + item.texto.length > COLA_BYTES) {
      if (falla && item.sobre) deSesion(item.sobre).perdidos++;
      return;
    }
    cola.push(item);
    bytesCola += item.texto.length;
  }
  /**
   * Escribe lo que espera, en orden. Si el disco falla, la línea se queda primera en la cola. Cuando todo lo de una falla
   * quedó escrito, agrega el registro_interrumpido de cada sesión afectada y la falla termina.
   */
  function vaciar() {
    while (cola.length) {
      let config;
      try { config = leerParaEscribir(); } catch (e) { fallar(e); return; }
      if (!config.activo) {
        // El instructor lo apagó: lo que esperaba ya no se guarda, y la falla termina con el registro.
        cola = [];
        bytesCola = 0;
        if (falla) terminarFalla('apagado');
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
        }
      } catch (e) { fallar(e); return; }
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
      return { activo: !!c.activo, tienePin: !!c.pin, falla, configIlegible: !!c.ilegible };
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
     * (registro apagado, o una línea que no es un evento con equipo) y true si se escribió o quedó esperando.
     */
    escribir(linea) {
      if (!linea || typeof linea !== 'object' || typeof linea.equipo !== 'string' || !linea.equipo.trim() || typeof linea.tipo !== 'string') return false;
      let texto;
      try { texto = JSON.stringify(linea); } catch (e) { return false; }
      if (texto.length > LINEA_MAX) return false;
      let config = null;
      try { config = leerParaEscribir(); } catch (e) { /* lo resuelve vaciar(): la línea espera y queda la falla */ }
      if (config && !config.activo) return false;
      encolar({ nombre: nombreDe(linea), texto, sobre: sobreDe(linea) });
      vaciar();
      avisarSiCambio();
      return true;
    },
    /** Intenta escribir ya lo que espera (el botón del instructor, y al cerrar la app). Devuelve la falla o null. */
    reintentar() {
      vaciar();
      avisarSiCambio();
      return resumenFalla();
    },
    archivos() {
      try { return fs.readdirSync(registros).filter((f) => f.endsWith('.jsonl')); } catch (e) { return []; }
    },
    /** Copia los .jsonl a una carpeta nueva dentro de `destino`. Pide el PIN. Lo que espera en la cola no va. */
    exportar({ pin, destino }) {
      const r = comprobar(pin);
      if (!r.ok) return r;
      const archivos = this.archivos();
      if (!archivos.length) return { ok: false, motivo: 'sin-archivos' };
      const d = new Date(ahora());
      const sello = `${fechaArchivo(ahora())}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      const carpetaDestino = path.join(destino, `TecnoBloques-registros-${sello}`);
      fs.mkdirSync(carpetaDestino, { recursive: true });
      for (const f of archivos) fs.copyFileSync(path.join(registros, f), path.join(carpetaDestino, f));
      return { ok: true, carpeta: carpetaDestino, archivos: archivos.length, pendientes: cola.length };
    },
  };
}

module.exports = { crearRegistroDisco };
