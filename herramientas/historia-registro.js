// Historia de un registro de eventos (REG-004, fase 4 del registro; contrato con TecnoCircuito, sección 6.1).
// Lee uno o varios .jsonl (o una carpeta con ellos) y cuenta, por equipo y sesión, lo que pasó en orden: qué
// cambiaron, qué compilaron, cada corrida con sus fallas y qué se corrigió de una corrida a la siguiente.
//
// Va por capas, para no afirmar nada que el registro no respalde (rediseño tras la auditoría de Codex, 20 oct):
//   1. Lectura: cada línea se revisa con el esquema del contrato; la que no sirve se aparta con su motivo, deja un hueco
//      en su sesión y lo demás sigue. Nunca se completa un dato que falta.
//   2. Hechos: sesiones (por sesión y equipo), corridas con su modo, sus no idealidades, su placa y sus piezas.
//   3. Integridad: huecos, contradicciones y problemas del ciclo de vida, en «Avisos». Un hueco impide comparar a
//      través de él, y una duda de la sesión impide asegurar el final.
//   4. Conclusiones: «corrigió» solo entre corridas comparables (mismo modo, mismas no idealidades, misma placa y la
//      pieza sigue); si no, «ya no se observó» con el motivo, o «no se compara».
//
// Uso: node herramientas/historia-registro.js <archivo.jsonl | carpeta> [...] [--json]
//      (npm run historia -- <...>). Con --json sale la historia como datos, para el análisis.
//      Siempre muestra la historia. Sale con 0 si todo está limpio, con 1 si hay avisos de integridad o líneas que no
//      se pudieron leer, y con 2 si falta lo que hay que leer.
// Solo lee: no cambia los archivos. No necesita la app ni internet. Para validar con el esquema usa el revisor de
// ..\TecnoCircuito (prototipo/pruebas/contrato_eventos.js); sin él, lo dice y revisa solo lo mínimo.
'use strict';
const fs = require('fs');
const path = require('path');
const { quitarComentarios } = require('../src/registro.js');

// Los nombres en español de las fallas conocidas (contrato/evento.schema.json, «fallas-conocidas»). Una nueva sale
// con su clave.
const FALLAS = {
  led_quemado: 'LED quemado', resistencia_caliente: 'resistencia caliente', corriente_pin: 'corriente del pin',
  corriente_chip: 'corriente del chip', cortocircuito: 'cortocircuito', sin_solucion: 'circuito sin solución',
  servo_alimentacion: 'servo mal alimentado', reinicio_usb: 'reinicio por el USB', fusible_usb: 'fusible del USB',
  bateria_baja: 'batería baja', bateria_celdas: 'celdas de la batería', bateria_invertida: 'batería al revés',
  bateria_corto: 'batería en corto', bateria_en_5v: 'batería en el 5V', motores_sin_energia: 'motores sin energía',
};
const MOTIVOS_REINICIO = { boton: 'botón RESET', energia_usb: 'energía del USB', energia_nano: 'energía del Nano' };
const propio = (o, k) => Object.prototype.hasOwnProperty.call(o, k); // las claves vienen de afuera: «__proto__» no es una falla

const nombreFalla = (f) => `${propio(FALLAS, f.tipo) ? FALLAS[f.tipo] : f.tipo} (${f.componente})`;
const claveFalla = (f) => `${f.tipo}|${f.componente}`;
const segundos = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const cuantos = (n, palabra) => `${n} ${palabra}${n === 1 ? '' : 's'}`;
const lista = (xs) => (xs.length ? xs.join(', ') : 'ninguna');
// Una hora que Date puede representar (±8,64e15 ms). El esquema admite números más grandes, que no son fechas (INT-RES-05).
const esFecha = (t) => Number.isFinite(t) && Math.abs(t) <= 8.64e15;
const hora = (t) => (esFecha(t) ? new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).format(t) : '??:??');
const fecha = (t) => (esFecha(t) ? new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' }).format(t) : 'sin fecha');
const ref = (r) => (r && typeof r === 'object' ? JSON.stringify(r) : String(r));

/* ---------- 1. Lectura ---------- */

const REVISOR_TC = path.join(__dirname, '..', '..', 'TecnoCircuito', 'prototipo', 'pruebas', 'contrato_eventos.js');
/** El revisor del contrato (esquema y circuito) de TecnoCircuito, o null si no está. */
function cargarRevisor(ruta = REVISOR_TC) {
  try { return require(ruta).revisarEvento; } catch (e) { return null; }
}

// Lo que necesita cada tipo conocido para contarlo sin romperse. El esquema revisa más; esto se revisa siempre, también
// sin el revisor y con las líneas que llegan directo a contarHistoria.
const NECESITA = {
  sesion_iniciada: { placa: 'string' }, sesion_terminada: { ms: 'number' }, placa_cambiada: { de: 'string', a: 'string' },
  proyecto_abierto: { placa: 'string' }, ejemplo_cargado: { id: 'string' }, bloques_cambiados: { bloques: 'number', tipos: 'object' },
  codigo_compilado: { ok: 'boolean', codigo: 'string' }, programa_subido: { ok: 'boolean' },
  registro_interrumpido: { desde: 'number', hasta: 'number', recuperados: 'number', perdidos: 'number' },
  simulacion_iniciada: { placa: 'string', modo: 'string', circuito: 'object' }, simulacion_detenida: { fallas: 'array' },
  simulacion_pausada: {}, simulacion_reanudada: {}, falla: { tipo: 'string', componente: 'string' }, reinicio_placa: { motivo: 'string' },
  componente_agregado: { id: 'string', tipo: 'string' }, componente_quitado: { id: 'string' }, componente_cambiado: { id: 'string' },
  cable_agregado: {}, cable_quitado: {}, boton_pulsado: { id: 'string' },
};
const DEL_CIRCUITO = new Set(['componente_agregado', 'componente_quitado', 'componente_cambiado', 'cable_agregado', 'cable_quitado']);
const esDe = (v, tipo) => (tipo === 'array' ? Array.isArray(v) : tipo === 'object' ? !!v && typeof v === 'object' && !Array.isArray(v)
  : tipo === 'number' ? Number.isFinite(v) : typeof v === tipo);

/** Lo mínimo para contar una línea sin inventar nada. Devuelve el motivo para apartarla, o null si sirve. */
function revisarSobre(ev) {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return 'no es un evento';
  if (ev.v !== 1) return `es de la versión ${JSON.stringify(ev.v)} del registro y esta historia lee la 1`;
  for (const k of ['equipo', 'sesion', 'tipo', 'origen']) if (typeof ev[k] !== 'string' || !ev[k]) return `«${k}» falta o no es un texto`;
  if (!Number.isFinite(ev.t)) return 'le falta la hora («t»)';
  if (!esFecha(ev.t)) return 'su hora («t») no es una fecha';
  if (ev.datos !== undefined && !esDe(ev.datos, 'object')) return '«datos» no es un objeto';
  if (ev.origen === 'simulador' && !(Number.isInteger(ev.corrida) && ev.corrida >= 1)) return 'es del simulador y no tiene «corrida»';
  if (propio(NECESITA, ev.tipo)) {
    const datos = ev.datos || {};
    for (const [k, tipo] of Object.entries(NECESITA[ev.tipo])) if (!esDe(datos[k], tipo)) return `a «${ev.tipo}» le falta «${k}»`;
    if (ev.tipo === 'simulacion_detenida' && !datos.fallas.every((f) => esDe(f, 'object') && typeof f.tipo === 'string' && typeof f.componente === 'string')) {
      return 'una falla de «simulacion_detenida» no tiene tipo y componente';
    }
    if (ev.tipo === 'registro_interrumpido' && !(esFecha(datos.desde) && esFecha(datos.hasta))) return 'las horas de «registro_interrumpido» no son fechas';
  }
  return null;
}

/**
 * La sesión y el equipo de una línea apartada, para dejar su hueco donde va. Si el JSON se pudo leer, salen del objeto
 * ya decodificado; si está roto, del texto, decodificando sus escapes («integridad» es «integridad», INT-RES-04).
 * Si el texto nombra dos sesiones o dos equipos distintos, la pista es dudosa y no se usa.
 */
function pista(ev, texto) {
  if (ev && typeof ev === 'object') return typeof ev.sesion === 'string' && typeof ev.equipo === 'string' ? { pistaSesion: ev.sesion, pistaEquipo: ev.equipo } : {};
  const leer = (campo) => {
    const valores = new Set();
    for (const m of String(texto).matchAll(new RegExp(`"${campo}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`, 'g'))) {
      try { valores.add(JSON.parse(m[1])); } catch (e) { return undefined; }
    }
    return valores.size === 1 ? [...valores][0] : undefined;
  };
  const s = leer('sesion'), e = leer('equipo');
  return typeof s === 'string' && typeof e === 'string' ? { pistaSesion: s, pistaEquipo: e } : {};
}

/**
 * Las líneas de los archivos, en el orden en que se escribieron. Una carpeta aporta sus .jsonl. Una ruta que no se
 * puede abrir se dice y se sigue con las demás; la misma ruta dos veces se lee una vez. Cada línea que no sirve
 * (JSON dañado, bytes que no son UTF-8, fuera del esquema) vuelve como `apartada`, con su motivo, para que su sesión
 * sepa que ahí hay un hueco.
 */
function leerArchivos(rutas, { revisor = cargarRevisor() } = {}) {
  const problemas = [];
  const notas = [];
  if (!revisor) problemas.push(`No se validó con el esquema del contrato: no encontré el revisor de TecnoCircuito (${REVISOR_TC}). Solo se revisó lo mínimo.`);
  const archivos = [];
  const vistos = new Set();
  for (const r of rutas) {
    let st;
    try { st = fs.statSync(r); } catch (e) { problemas.push(`${r}: no se puede abrir (${e.code || e.message}).`); continue; }
    let deAqui = [r];
    if (st.isDirectory()) {
      try {
        deAqui = fs.readdirSync(r, { withFileTypes: true }).filter((d) => d.isFile() && d.name.endsWith('.jsonl')).map((d) => d.name).sort().map((f) => path.join(r, f));
      } catch (e) { problemas.push(`${r}: no se puede leer la carpeta (${e.code || e.message}).`); continue; }
    }
    for (const a of deAqui) {
      let real;
      try { real = fs.realpathSync(a); } catch (e) { real = path.resolve(a); }
      if (vistos.has(real)) { notas.push(`${a}: ya estaba entre lo que se lee; se leyó una vez.`); continue; }
      vistos.add(real);
      archivos.push(a);
    }
  }
  const lineas = [];
  for (const archivo of archivos) {
    const nombre = path.basename(archivo);
    let bytes;
    try { bytes = fs.readFileSync(archivo); } catch (e) { problemas.push(`${archivo}: no se puede leer (${e.code || e.message}).`); continue; }
    let texto;
    let utf8Malo = false;
    // ignoreBOM: el BOM queda en el texto, para quitarlo aquí y decirlo
    try { texto = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch (e) { utf8Malo = true; texto = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes); }
    if (texto.charCodeAt(0) === 0xfeff) { texto = texto.slice(1); notas.push(`${nombre}: empieza con una marca BOM; se quitó para leerlo.`); }
    texto.split('\n').forEach((crudo, i) => {
      const t = crudo.endsWith('\r') ? crudo.slice(0, -1) : crudo;
      if (!t.trim()) return;
      const base = { archivo: nombre, ruta: archivo, linea: i + 1, texto: t };
      const apartar = (motivo, ev) => {
        problemas.push(`${nombre}, línea ${i + 1}: ${motivo}.`);
        lineas.push({ ...base, apartada: motivo, ...pista(ev, t) });
      };
      if (utf8Malo && t.includes('�')) return apartar('tiene bytes que no son UTF-8 válido');
      let ev;
      try { ev = JSON.parse(t); } catch (e) { return apartar(`no se puede leer (${e.message})`); }
      const motivo = revisarSobre(ev) || (revisor ? revisor(ev)[0] || null : null);
      if (motivo) return apartar(motivo, ev);
      lineas.push({ ...base, ev });
    });
  }
  return { lineas, problemas, notas };
}

/* ---------- Ayudas para contar: el circuito, el programa y los bloques ---------- */

/**
 * Los cambios del circuito seguidos, en una sola frase: quitó, agregó, cambió, conectó, desconectó, movió. De cada pieza
 * se dice cómo quedó, no los pasos intermedios (al arrastrarla se desenchufa y se vuelve a enchufar). Lo que se hizo y
 * se deshizo en el mismo tramo no se cuenta: una pieza agregada y quitada, o un cable puesto y quitado. Si todo se
 * deshizo, devuelve ''.
 *
 * Un id puede nombrar varias piezas seguidas: el lienzo da el primer id libre, así que si quitan r1 y agregan otra
 * resistencia, la nueva también es r1 (R3 de la verificación de Codex, 20 oct). Por eso cada alta empieza una pieza
 * nueva, que no hereda nada de la anterior (valores, giro, enchufes); de la nueva solo se dice lo que el registro trae.
 */
function resumirCircuito(evs) {
  const piezas = new Map(); // id → [{ nueva, tipo, quitada, props, rot, en, movida }], en el orden en que aparecen
  const nueva = (id, datos) => { if (!piezas.has(id)) piezas.set(id, []); const p = { props: {}, ...datos }; piezas.get(id).push(p); return p; };
  // La pieza viva con ese id; si no hay, es la que ya estaba antes del tramo
  const viva = (id) => { const ps = piezas.get(id) || []; const p = ps[ps.length - 1]; return p && !p.quitada ? p : nueva(id, { nueva: false }); };
  const cables = new Map(); // de|a → { primero, ultimo, texto }: si el primero y el último no coinciden, se deshizo
  for (const { tipo, datos: d } of evs) {
    if (tipo === 'componente_agregado') nueva(d.id, { nueva: true, tipo: d.tipo });
    else if (tipo === 'componente_quitado') { const p = viva(d.id); p.quitada = true; p.tipo = p.tipo || d.tipo; }
    else if (tipo === 'cable_agregado' || tipo === 'cable_quitado') {
      const clave = `${ref(d.de)}|${ref(d.a)}`;
      const c = cables.get(clave) || { primero: tipo, texto: `${ref(d.de)} → ${ref(d.a)}` };
      c.ultimo = tipo;
      cables.set(clave, c);
    } else if (tipo === 'componente_cambiado') {
      const p = viva(d.id);
      if (d.props) Object.assign(p.props, d.props);
      if (d.rot !== undefined) p.rot = d.rot;
      if (d.en !== undefined) p.en = d.en;
      if (d.x !== undefined || d.y !== undefined) p.movida = true;
    }
  }
  const agrego = [], quito = [], cambio = [], movio = [];
  for (const [id, ps] of piezas) {
    let quitoLaQueEstaba = false;
    for (const p of ps) {
      if (p.nueva && p.quitada) continue; // la agregó y la quitó
      if (p.quitada) { quito.push(`${id} (${p.tipo})`); quitoLaQueEstaba = true; continue; } // lo de antes de quitarla no importa
      if (p.nueva) agrego.push(`${quitoLaQueEstaba ? 'otra ' : ''}${id} (${p.tipo})`);
      const quedo = Object.entries(p.props).map(([k, v]) => `${k} ${ref(v)}`);
      if (p.rot !== undefined) quedo.push(`giro ${p.rot}°`);
      if (p.en !== undefined) quedo.push(p.en ? `enchufado en ${Object.entries(p.en).map(([pata, r]) => `${pata}→${ref(r)}`).join(', ')}` : 'desenchufado');
      if (quedo.length) cambio.push(`${id}: ${quedo.join(', ')}`);
      if (p.movida) movio.push(id);
    }
  }
  const conecto = [...cables.values()].filter((c) => c.primero === c.ultimo && c.ultimo === 'cable_agregado').map((c) => c.texto);
  const desconecto = [...cables.values()].filter((c) => c.primero === c.ultimo && c.ultimo === 'cable_quitado').map((c) => c.texto);
  const partes = [];
  if (quito.length) partes.push('quitó ' + quito.join(', '));
  if (agrego.length) partes.push('agregó ' + agrego.join(', '));
  if (cambio.length) partes.push('cambió ' + cambio.join('; '));
  if (conecto.length) partes.push('conectó ' + conecto.join(', '));
  if (desconecto.length) partes.push('desconectó ' + desconecto.join(', '));
  if (movio.length) partes.push('movió ' + movio.join(', '));
  return partes.join('; ');
}

/**
 * Las líneas del C++, solo para mostrar qué cambió: espacios juntados, sin espacios a los lados ni líneas vacías. Nunca
 * deciden si el programa es el mismo: eso se decide con el C++ registrado exacto (decisión de Efraín, 20 oct; R4).
 */
const lineasParaMostrar = (codigo) => String(codigo).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
const corta = (l) => '`' + (l.length > 50 ? l.slice(0, 49) + '…' : l) + '`';
/**
 * Una línea cambiada por otra: si alguna es larga, las dos se muestran alrededor de lo que cambió, para que el corte
 * no esconda la diferencia («`…HIGH); delay(500); }` → `…HIGH); delay(200); }`»).
 */
function cambioDeLinea(x, y) {
  if (x.length <= 50 && y.length <= 50) return `${corta(x)} → ${corta(y)}`;
  let p = 0;
  while (p < x.length && p < y.length && x[p] === y[p]) p++;
  let q = 0;
  while (q < x.length - p && q < y.length - p && x[x.length - 1 - q] === y[y.length - 1 - q]) q++;
  const desde = Math.max(0, p - 15);
  const tramo = (l) => {
    const hasta = l.length - Math.max(0, q - 15);
    let t = l.slice(desde, hasta);
    if (t.length > 50) t = t.slice(0, 49) + '…';
    return '`' + (desde > 0 ? '…' : '') + t + (hasta < l.length && !t.endsWith('…') ? '…' : '') + '`';
  };
  return `${tramo(x)} → ${tramo(y)}`;
}

/**
 * Qué cambió del programa entre dos compilaciones distintas, en pocas palabras: «`delay(500);` → `delay(200);`
 * (2 veces)». Compara las líneas para mostrar (la subsecuencia común más larga) y junta los cambios iguales. Si esas
 * líneas son iguales, el texto cambió solo en espacios o saltos de línea, y lo dice así: no afirma que el programa
 * haga lo mismo. Ningún corte deja dos lados iguales: si el detalle no cabe, lo dice.
 */
function cambiosDelPrograma(antes, ahora) {
  const a = lineasParaMostrar(antes), b = lineasParaMostrar(ahora);
  if (a.join('\n') === b.join('\n')) return 'cambió solo en espacios o saltos de línea';
  if (a.length * b.length > 1e6) return `cambió (${cuantos(b.length, 'línea')}; el detalle no cabe)`; // un programa enorme
  const L = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const tramos = []; // { quito: [...], puso: [...] }
  let tramo = null;
  const cerrar = () => { if (tramo) tramos.push(tramo); tramo = null; };
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { cerrar(); i++; j++; continue; }
    tramo = tramo || { quito: [], puso: [] };
    if (j < b.length && (i === a.length || L[i][j + 1] >= L[i + 1][j])) tramo.puso.push(b[j++]);
    else tramo.quito.push(a[i++]);
  }
  cerrar();
  const lado = (ls) => (ls.length > 3 ? cuantos(ls.length, 'línea') : ls.map(corta).join(' '));
  const veces = new Map();
  for (const { quito, puso } of tramos) {
    let texto;
    if (quito.length && quito.length === puso.length && quito.length <= 3) texto = quito.map((q, k) => cambioDeLinea(q, puso[k])).join(' y ');
    else if (quito.length && puso.length) {
      const x = lado(quito), y = lado(puso);
      texto = x === y ? `cambió un tramo de ${cuantos(Math.max(quito.length, puso.length), 'línea')} (el detalle no cabe)` : `${x} → ${y}`;
    } else texto = puso.length ? `agregó ${lado(puso)}` : `quitó ${lado(quito)}`;
    veces.set(texto, (veces.get(texto) || 0) + 1);
  }
  const textos = [...veces].map(([t, n]) => (n > 1 ? `${t} (${n} veces)` : t));
  return textos.slice(0, 3).join('; ') + (textos.length > 3 ? `; y ${cuantos(textos.length - 3, 'cambio')} más` : '');
}

/** Un resumen de bloques_cambiados: «8 (5 tipos)». */
const bloquesDe = (d) => `${d.bloques} (${cuantos(Object.keys(d.tipos || {}).length, 'tipo')})`;
const mismosTipos = (x, y) => JSON.stringify(Object.entries(x.tipos || {}).sort()) === JSON.stringify(Object.entries(y.tipos || {}).sort());

/* ---------- 2 a 4. Hechos, integridad y conclusiones ---------- */

/** Los hechos de una corrida: las fallas de todos sus cierres y las que llegaron una a una, sin repetir. */
function hechos(c) {
  const todas = new Map();
  for (const f of [...(c.cierres || []).flat(), ...c.fallasVistas]) if (!todas.has(claveFalla(f))) todas.set(claveFalla(f), { tipo: f.tipo, componente: f.componente });
  return [...todas.values()];
}
const claveDe = (fs) => [...new Set(fs.map(claveFalla))].sort().join(); // una falla repetida en un cierre es la misma

/**
 * Por qué una falla que estaba en la corrida `a` y no está en la `b` no se puede dar por corregida: cambió el modo,
 * lo que se revisa (las no idealidades), la placa o la pieza de la falla ya no está. null si son comparables.
 */
function cambioDeCondiciones(a, b, f) {
  if (a.modo !== b.modo) return `cambió el modo: ${a.modo} → ${b.modo}`;
  const claves = [...new Set([...Object.keys(a.activas), ...Object.keys(b.activas)])].sort();
  const distintas = claves.filter((k) => a.activas[k] !== b.activas[k]);
  if (distintas.length) return `cambió lo que se revisa: ${distintas.map((k) => `${k} ${b.activas[k] === true ? 'encendida' : b.activas[k] === false ? 'apagada' : 'sin dato'}`).join(', ')}`;
  if (a.placa !== b.placa) return `cambió la placa: ${a.placa} → ${b.placa}`;
  const pieza = String(f.componente).split('.')[0];
  if (pieza !== 'placa') {
    if (!propio(b.piezas, pieza)) return `quitó ${pieza}`;
    if (propio(a.piezas, pieza) && a.piezas[pieza] !== b.piezas[pieza]) return `${pieza} ahora es otra pieza: ${b.piezas[pieza]}`;
  }
  return null;
}
/** «Ya no se observó, porque cambió el modo (realista → ideal): A, B.» agrupado por motivo */
function yaNoSeObservo(xs) {
  const porMotivo = new Map();
  for (const { falla, motivo } of xs) porMotivo.set(motivo, [...(porMotivo.get(motivo) || []), nombreFalla(falla)]);
  return [...porMotivo].map(([motivo, fs]) => `${fs.join(', ')} (${motivo})`).join('; ');
}

/**
 * El resumen de una sesión. Las fallas vistas son todos los hechos (cierres y fallas sueltas), también las de una
 * corrida que no empezó en la sesión, marcadas «sin atribuir». El final solo se afirma si la última corrida está
 * completa y coherente, no hay fallas sin atribuir ni dudas de la sesión. Cada falla que ya no está al final es
 * «corregida» solo si el tramo desde la última corrida que la vio hasta el fin de la sesión está acreditado (todas sus
 * corridas completas y coherentes, sin huecos hasta la última línea) y alguna corrida posterior es comparable con ella.
 */
function resumen(h, hayHueco, finPos) {
  const vistas = new Map();
  for (const c of h.corridas) for (const f of c.fallas) vistas.set(claveFalla(f), f);
  const sinAtribuir = h.sinAtribuir.flatMap((x) => x.fallas.map((f) => `${nombreFalla(f)} [sin atribuir: corrida ${x.corrida}]`));
  const texto = `${h.corridas.length} corrida(s). Fallas vistas: ${lista([...[...vistas.values()].map(nombreFalla), ...sinAtribuir])}.`;
  const ultima = h.corridas[h.corridas.length - 1];
  if (!ultima) return texto;
  const pendientes = ultima.fallas;
  const porque = !ultima.completa ? `la corrida ${ultima.numero} quedó sin cierre`
    : !ultima.coherente ? `la corrida ${ultima.numero} ${ultima.incoherencia}`
      : sinAtribuir.length ? 'llegaron fallas de una corrida que no empezó en esta sesión' : h.dudas[0] || null;
  if (porque) {
    return `${texto} Corregidas al final: no se puede asegurar, porque ${porque}. ` +
      `Sin corregir: ${pendientes.length ? `al menos ${lista(pendientes.map(nombreFalla))}` : 'no se puede asegurar'}.`;
  }
  // Una falla que ya no está al final es «corregida» si alguna corrida posterior a la última que la vio es comparable con
  // ella: ahí se corrigió, aunque después cambiaran la placa o el modo (prueba de Efraín, 20 oct). Antes, el tramo tiene
  // que estar acreditado de punta a punta, la corrida que la vio incluida (INT-RES-01) y hasta la última línea de la
  // sesión (INT-RES-02): una corrida incompleta o incoherente, o un hueco, pudieron esconder que volvió.
  const corregidas = [], yaNo = [], inciertas = [];
  for (const f of vistas.values()) {
    if (pendientes.some((p) => claveFalla(p) === claveFalla(f))) continue;
    const k = h.corridas.map((c) => c.fallas.some((x) => claveFalla(x) === claveFalla(f))).lastIndexOf(true);
    const donde = h.corridas[k];
    const floja = h.corridas.slice(k).find((c) => !c.completa || !c.coherente);
    if (floja) { inciertas.push({ falla: f, motivo: floja.completa ? `la corrida ${floja.numero} ${floja.incoherencia}` : `la corrida ${floja.numero} quedó sin cierre` }); continue; }
    if (hayHueco(donde.desdePos, finPos)) { inciertas.push({ falla: f, motivo: 'hay un hueco en el registro después de verla' }); continue; }
    if (h.corridas.slice(k + 1).some((c) => !cambioDeCondiciones(donde, c, f))) corregidas.push(f);
    else yaNo.push({ falla: f, motivo: cambioDeCondiciones(donde, ultima, f) });
  }
  return `${texto} Corregidas al final: ${lista(corregidas.map(nombreFalla))}.` +
    (yaNo.length ? ` Ya no se observaron al final: ${yaNoSeObservo(yaNo)}.` : '') +
    (inciertas.length ? ` No se puede asegurar: ${yaNoSeObservo(inciertas)}.` : '') +
    ` Sin corregir: ${lista(pendientes.map(nombreFalla))}.`;
}

const fechaDelNombre = (archivo) => (/-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(archivo || '') || [])[1] || null;

/**
 * La historia de cada sesión, como datos: sus pasos en orden (cada uno con su hora y su texto), sus corridas con las
 * fallas y su comparación con la corrida anterior, los avisos de integridad y las notas. Recibe las líneas de
 * leerArchivos (con las apartadas) o líneas armadas a mano ({ archivo, linea, ev }), que también se revisan.
 */
function contarHistoria(lineas) {
  const grupos = new Map(); // sesion + equipo → { sesion, equipo, segmentos: Map(archivo → [entradas]) }
  const grupo = (sesion, equipo) => {
    const k = JSON.stringify([sesion, equipo]);
    if (!grupos.has(k)) grupos.set(k, { sesion, equipo, segmentos: new Map(), dudas: [] });
    return grupos.get(k);
  };
  const poner = (g, l) => {
    const k = l.ruta || l.archivo;
    if (!g.segmentos.has(k)) g.segmentos.set(k, []);
    g.segmentos.get(k).push(l);
  };
  // Por archivo y en orden: una línea apartada sin pista de su sesión se atribuye a las sesiones de sus vecinas
  const porArchivo = new Map();
  for (const l0 of lineas) {
    let l = l0;
    if (!l.apartada) {
      const motivo = revisarSobre(l.ev);
      if (motivo) l = { ...l, apartada: motivo, ...pista(l.ev, '') };
    }
    const k = l.ruta || l.archivo;
    if (!porArchivo.has(k)) porArchivo.set(k, []);
    porArchivo.get(k).push(l);
  }
  for (const ls of porArchivo.values()) {
    let previo = null;
    let pendientes = []; // apartadas sin pista que esperan a la siguiente línea buena
    for (const l of ls) {
      if (!l.apartada) {
        const g = grupo(l.ev.sesion, l.ev.equipo);
        for (const p of pendientes) if (g !== previo) poner(g, p);
        pendientes = [];
        poner(g, l);
        previo = g;
      } else if (l.pistaSesion !== undefined) poner(grupo(l.pistaSesion, l.pistaEquipo), l);
      else {
        if (previo) poner(previo, l);
        pendientes.push(l);
      }
    }
    if (pendientes.length && !previo) { // un archivo sin ninguna línea buena: su sesión no se sabe
      const g = grupo('(desconocida)', '(desconocido)');
      for (const p of pendientes) poner(g, p);
    }
  }
  // Un mismo código de sesión con dos equipos: se cuentan aparte y ninguno asegura su final (INT-03)
  const porSesion = new Map();
  for (const g of grupos.values()) porSesion.set(g.sesion, [...(porSesion.get(g.sesion) || []), g]);
  for (const gs of porSesion.values()) {
    if (gs.length < 2) continue;
    for (const g of gs) g.dudas.push(`la sesión ${g.sesion} también tiene líneas ${gs.filter((x) => x !== g).map((x) => `del equipo ${x.equipo}`).join(', ')}`);
  }
  const historias = [...grupos.values()].map((g) => {
    try { return contarSesion(g); } catch (e) { // una sesión que no se puede contar no tumba las demás
      return { equipo: g.equipo, sesion: g.sesion, inicio: 0, error: e.message, pasos: [], corridas: [], placas: [], avisos: [`No se pudo contar esta sesión: ${e.message}`], notas: [] };
    }
  });
  historias.sort((a, b) => a.inicio - b.inicio || String(a.equipo).localeCompare(String(b.equipo)));
  return historias;
}

function contarSesion({ sesion, equipo, segmentos, dudas: dudasDelGrupo }) {
  // Los archivos de la sesión, en el orden de la fecha de su nombre (EQUIPO-AAAA-MM-DD.jsonl) si todos la tienen; si
  // no, en el orden en que se leyeron. Una línea que ya llegó en otro archivo (copias o exportaciones que se pisan) se
  // cuenta una vez.
  let segs = [...segmentos.entries()];
  if (segs.every(([k]) => fechaDelNombre(k))) segs = segs.map((s, i) => [s, i]).sort(([a, i], [b, j]) => fechaDelNombre(a[0]).localeCompare(fechaDelNombre(b[0])) || i - j).map(([s]) => s);
  const notas = [];
  const vistas = new Map(); // texto → archivo donde llegó primero
  let repetidas = 0;
  const entradas = [];
  for (const [archivo, ls] of segs) {
    for (const l of ls) {
      if (!l.apartada) {
        const texto = l.texto || JSON.stringify(l.ev);
        if (vistas.has(texto) && vistas.get(texto) !== archivo) { repetidas++; continue; }
        if (!vistas.has(texto)) vistas.set(texto, archivo);
      }
      entradas.push(l);
    }
  }
  if (repetidas) notas.push(`${cuantos(repetidas, 'línea')} ya había llegado en otro archivo (copias o exportaciones que se pisan): se contaron una vez.`);

  const buenas = entradas.filter((l) => !l.apartada);
  const h = {
    equipo, sesion, archivos: segs.map(([k]) => path.basename(k)), inicio: buenas.length ? buenas[0].ev.t : 0, fin: null,
    placa: null, placas: [], nivel: null, pasos: [], corridas: [], avisos: [], notas, dudas: [],
  };
  const paso = (t, texto, corrida) => h.pasos.push({ t, texto, ...(corrida ? { corrida } : {}) });
  const aviso = (texto) => { if (!h.avisos.includes(texto)) h.avisos.push(texto); };
  const contradice = (c, texto) => { if (!c.contradicciones.includes(texto)) c.contradicciones.push(texto); };
  const duda = (texto) => { aviso(texto[0].toUpperCase() + texto.slice(1) + '.'); if (!h.dudas.includes(texto)) h.dudas.push(texto); };
  for (const d of dudasDelGrupo) duda(d);

  // La placa elegida en cada momento (sesion_iniciada, placa_cambiada, proyecto_abierto) y las que pasaron, en orden
  let placa = null;
  const usar = (p) => { placa = p; if (h.placas[h.placas.length - 1] !== p) h.placas.push(p); };
  let codigoPrevio = null; // el C++ de la compilación anterior, para decir qué cambió
  let bloquesPrevio = null; // el último resumen de bloques
  let bloques = null; // resúmenes de bloques seguidos: { t, desde, hasta }
  const corridas = new Map(); // número → la corrida
  const huerfanas = new Map(); // corridas que no empezaron en la sesión pero tienen eventos aquí: sus fallas no se pierden
  const huecos = []; // { desdePos, hastaPos }: tramos de la sesión donde faltan líneas
  const huecosPorHora = []; // { desde, hasta, pos }: los de registro_interrumpido, que se ubican al final por la hora
  const horas = []; // { pos, t } de cada evento, para ubicarlos
  const desconocidos = new Map(); // «tipo (origen)» → cuántos
  let inicios = 0;
  let primero = null; // el tipo del primer evento
  let terminada = false;
  let tPrevio = null;
  let grupoCircuito = null; // cambios del circuito seguidos: { t, evs }
  let pulsos = null; // pulsos de botón seguidos en una corrida: { t, corrida, porId }

  // Solo hay un grupo abierto a la vez (cada uno cierra los otros al empezar), así los pasos quedan en orden
  const cerrarGrupos = () => {
    if (grupoCircuito) { paso(grupoCircuito.t, 'Circuito: ' + (resumirCircuito(grupoCircuito.evs) || 'hizo cambios y los deshizo') + '.'); grupoCircuito = null; }
    if (bloques) {
      const { t, desde, hasta } = bloques;
      paso(t, !desde ? `Bloques: ${bloquesDe(hasta)}.`
        : desde.bloques === hasta.bloques && mismosTipos(desde, hasta) ? `Bloques: cambió algo dentro de los mismos ${hasta.bloques} (misma cantidad y mismos tipos).`
          : `Bloques: ${bloquesDe(desde)} → ${bloquesDe(hasta)}.`);
      bloques = null;
    }
    if (pulsos) {
      paso(pulsos.t, 'Pulsó ' + [...pulsos.porId].map(([id, n]) => (n > 1 ? `${id} ${n} veces` : id)).join(', ') + '.', pulsos.corrida);
      pulsos = null;
    }
  };

  entradas.forEach((l, pos) => {
    if (l.apartada) {
      aviso(`Se apartó una línea (${l.archivo}, línea ${l.linea}): ${l.apartada}. Ahí hay un hueco.`);
      huecos.push({ desdePos: pos, hastaPos: pos });
      return;
    }
    const { ev, archivo, linea } = l;
    const { t, tipo, origen, corrida: n } = ev;
    const datos = ev.datos || {};
    horas.push({ pos, t });
    if (primero === null) primero = tipo;
    if (tPrevio !== null && t < tPrevio) aviso(`El reloj del computador retrocedió (${archivo} línea ${linea}): la historia sigue el orden en que se escribió.`);
    tPrevio = t;
    if (terminada && tipo !== 'registro_interrumpido') aviso(`Hay eventos después de sesion_terminada (${tipo}, ${archivo} línea ${linea}).`);
    if (!propio(NECESITA, tipo)) { // un tipo nuevo: el contrato lo permite, pero esta historia no lo interpreta
      cerrarGrupos();
      const k = `«${tipo}» (${origen})`;
      desconocidos.set(k, (desconocidos.get(k) || 0) + 1);
      return;
    }
    if (DEL_CIRCUITO.has(tipo)) {
      if (pulsos || bloques) cerrarGrupos();
      grupoCircuito = grupoCircuito || { t, evs: [] };
      grupoCircuito.evs.push({ tipo, datos });
      return;
    }
    if (tipo === 'boton_pulsado') {
      if (grupoCircuito || bloques) cerrarGrupos();
      pulsos = pulsos || { t, corrida: n, porId: new Map() };
      pulsos.porId.set(datos.id, (pulsos.porId.get(datos.id) || 0) + 1);
      return;
    }
    if (tipo === 'bloques_cambiados') { // se resumen juntos: cada uno sale unos segundos después de un cambio
      if (grupoCircuito || pulsos) cerrarGrupos();
      bloques = bloques || { t, desde: bloquesPrevio };
      bloques.hasta = bloquesPrevio = datos;
      return;
    }
    cerrarGrupos();

    if (origen === 'simulador' && tipo !== 'simulacion_iniciada' && !corridas.has(n)) {
      aviso(`La corrida ${n} no empezó en esta sesión y tiene eventos aquí: ¿quedó en el equipo equivocado?`);
      const x = huerfanas.get(n) || { numero: n, fallasVistas: [], cierres: [] };
      huerfanas.set(n, x);
      if (tipo === 'falla') x.fallasVistas.push({ tipo: datos.tipo, componente: datos.componente });
      if (tipo === 'simulacion_detenida') x.cierres.push(datos.fallas.map((f) => ({ tipo: f.tipo, componente: f.componente })));
    }
    const c = origen === 'simulador' ? corridas.get(n) : undefined;
    // El tramo del reloj de este hecho: el que trae el evento (contrato 6.1, desde el 21 oct). Un registro anterior no lo
    // trae y se cuenta por el orden de escritura, con un límite: una foto de antes de un RESET que llega después queda
    // en el tramo nuevo (INT-RES-03c).
    const tramoDe = (x) => (Number.isInteger(ev.tramo) && ev.tramo >= 0 ? ev.tramo : x.tramo);
    if (c && tipo !== 'simulacion_iniciada') {
      // El cierre de una corrida es lo último que llega de ella (AUD-03): lo que venga después no cabe en su resumen y la
      // corrida no se compara (INT-RES-03a). Un cierre repetido idéntico no cuenta; uno distinto se revisa con los cierres.
      if (c.cierres.length) {
        aviso(`La corrida ${n} tiene eventos después de su cierre (${tipo}).`);
        if (tipo !== 'simulacion_detenida') contradice(c, 'tiene eventos después de su cierre');
      }
      // Y la app cierra la corrida antes de terminar la sesión (AUD-03/04): un cierre o un hecho de la corrida después del
      // fin se conserva, pero no acredita cómo quedó (INT-RES-03b)
      if (terminada) contradice(c, tipo === 'simulacion_detenida' ? 'se cerró después de terminar la sesión' : 'tiene eventos después de terminar la sesión');
      // El tiempo de las pausas y los reinicios también se revisa con el cierre; el de las fallas va en `ocurrencias`
      if (tipo !== 'falla' && tipo !== 'simulacion_detenida') c.marcas.push({ tipo, ms_sim: ev.ms_sim, tramo: tramoDe(c) });
      c.hastaPos = pos;
    }
    switch (tipo) {
      case 'sesion_iniciada':
        if (++inicios > 1) { duda('la sesión empieza dos veces (sesion_iniciada repetido)'); break; }
        h.placa = datos.placa; h.nivel = datos.nivel ?? null; usar(datos.placa);
        paso(t, `Empezó la sesión (${datos.placa}, nivel ${datos.nivel ?? '?'}).`);
        break;
      case 'sesion_terminada':
        if (terminada) aviso('La sesión termina dos veces (sesion_terminada repetido).');
        terminada = true; h.fin = t;
        paso(t, `Terminó la sesión (${datos.ms < 60000 ? `${Math.round(datos.ms / 1000)} s` : `${Math.round(datos.ms / 60000)} min`}).`);
        break;
      case 'placa_cambiada':
        if (placa !== null && datos.de !== placa) aviso(`placa_cambiada dice que la placa era ${datos.de}, pero la elegida era ${placa}.`);
        usar(datos.a);
        paso(t, `Cambió la placa: ${datos.de} → ${datos.a}.`);
        break;
      case 'ejemplo_cargado': paso(t, `Abrió el ejemplo «${datos.id}».`); break;
      case 'proyecto_abierto': usar(datos.placa); paso(t, `Abrió un proyecto (${datos.placa}).`); break;
      case 'codigo_compilado': {
        let texto = datos.ok ? `Compiló: bien${datos.bytes ? `, ${datos.bytes} bytes` : ''}` : `Compiló: con error${datos.error ? ` (${datos.error})` : ''}`;
        // «El mismo programa» solo si el C++ registrado es idéntico, carácter por carácter (decisión de Efraín, 20 oct)
        if (codigoPrevio !== null) texto += datos.codigo === codigoPrevio ? ' (el mismo programa)' : `. Programa: ${cambiosDelPrograma(codigoPrevio, datos.codigo)}`;
        codigoPrevio = datos.codigo;
        paso(t, texto + '.');
        if (quitarComentarios(datos.codigo) !== datos.codigo) {
          aviso(`El C++ de codigo_compilado tiene comentarios (${archivo} línea ${linea}); el registro debe guardarlo sin ellos (AUD-01).`);
        }
        break;
      }
      case 'programa_subido': paso(t, datos.ok ? `Subió el programa a la placa real (${datos.placa}).` : 'No pudo subir el programa a la placa real.'); break;
      case 'registro_interrumpido':
        paso(t, `El disco no dejó guardar de ${hora(datos.desde)} a ${hora(datos.hasta)} (${datos.motivo}); se recuperaron ${datos.recuperados} eventos.`);
        if (datos.perdidos > 0) {
          aviso(`Hay un hueco: ${datos.perdidos} eventos se perdieron cuando el disco falló (${hora(datos.desde)} a ${hora(datos.hasta)}).`);
          huecosPorHora.push({ desde: datos.desde, hasta: datos.hasta, pos });
        }
        break;
      case 'simulacion_iniciada': {
        if (corridas.has(n)) { // una sola corrida con ese número: el segundo inicio no la reemplaza
          aviso(`La corrida ${n} empieza dos veces.`);
          corridas.get(n).contradicciones.push('empieza dos veces');
          corridas.get(n).hastaPos = pos;
          break;
        }
        // La corrida usa la placa elegida: si no, el registro perdió un cambio de placa (o es anterior a placa_cambiada)
        if (placa !== null && datos.placa !== placa) aviso(`La corrida ${n} simula con ${datos.placa}, pero la placa elegida era ${placa}: falta un placa_cambiada.`);
        usar(datos.placa);
        const componentes = Array.isArray(datos.circuito.componentes) ? datos.circuito.componentes : [];
        const piezas = Object.create(null);
        for (const p of componentes) if (p && typeof p.id === 'string') piezas[p.id] = p.tipo;
        // Las corridas que seguían abiertas al empezar esta: si después se cierran, las dos se cruzaron (INT-RES-03)
        const abiertas = h.corridas.filter((x) => !x.cierres.length).map((x) => x.numero);
        const nueva = {
          numero: n, inicio: t, fin: null, modo: datos.modo, placa: datos.placa, activas: { ...(datos.activas || {}) }, piezas,
          fallasVistas: [], cierres: [], pasosCierre: [], ms_sim: null, reinicios: 0, estado: 'corriendo', contradicciones: [],
          // Cada falla que llegó y cada cierre, con su tiempo simulado: las repetidas también (INT-RES-03a). El tramo
          // cuenta los RESET con el botón, que ponen el reloj de la corrida en cero; un reinicio por energía no lo hace.
          ocurrencias: [], tiemposCierre: [], tramo: 0, marcas: [],
          desdePos: pos, hastaPos: pos, abiertas,
        };
        if (datos.circuito.placa !== undefined && datos.circuito.placa !== datos.placa) {
          aviso(`La corrida ${n} dice ${datos.placa}, pero su circuito dice ${datos.circuito.placa}.`);
          nueva.contradicciones.push(`dice ${datos.placa} y su circuito ${datos.circuito.placa}`);
        }
        if (terminada) nueva.contradicciones.push('empezó después de terminar la sesión');
        corridas.set(n, nueva);
        h.corridas.push(nueva);
        const cables = Array.isArray(datos.circuito.cables) ? datos.circuito.cables.length : 0;
        const apagadas = Object.entries(datos.activas || {}).filter(([, v]) => !v).map(([k]) => k);
        paso(t, `▶ Corrida ${n} (${datos.placa}, ${datos.modo}; ${cuantos(componentes.length, 'pieza')}, ${cuantos(cables, 'cable')}${apagadas.length && datos.modo !== 'ideal' ? `; apagadas: ${apagadas.join(', ')}` : ''}).`, n);
        break;
      }
      case 'falla':
        if (c && !c.fallasVistas.some((f) => claveFalla(f) === claveFalla(datos))) c.fallasVistas.push({ tipo: datos.tipo, componente: datos.componente, ms_sim: ev.ms_sim });
        if (c) c.ocurrencias.push({ tipo: datos.tipo, componente: datos.componente, ms_sim: ev.ms_sim ?? null, tramo: tramoDe(c) });
        paso(t, `   falla: ${nombreFalla(datos)}, a los ${segundos(ev.ms_sim || 0)} simulados.`, n);
        break;
      case 'reinicio_placa':
        if (c) c.reinicios += datos.nuevos || 1;
        if (c && datos.motivo === 'boton') c.tramo++; // el chip vuelve a cero (simulador.js de TecnoCircuito, reiniciar())
        paso(t, `   la placa se reinició (${propio(MOTIVOS_REINICIO, datos.motivo) ? MOTIVOS_REINICIO[datos.motivo] : datos.motivo}${datos.nuevos > 1 ? `, ${datos.nuevos} veces` : ''}).`, n);
        break;
      // Un estado imposible no es solo un aviso: la corrida queda con una contradicción y no se compara (INT-RES-03)
      case 'simulacion_pausada':
        if (c && c.estado !== 'corriendo') { aviso(`La corrida ${n} se pausa sin estar corriendo.`); c.contradicciones.push('se pausa sin estar corriendo'); }
        if (c && c.estado === 'corriendo') c.estado = 'pausada';
        paso(t, '   pausó.', n);
        break;
      case 'simulacion_reanudada':
        if (c && c.estado !== 'pausada') { aviso(`La corrida ${n} sigue sin haberse pausado.`); c.contradicciones.push('sigue sin haberse pausado'); }
        if (c && c.estado === 'pausada') c.estado = 'corriendo';
        paso(t, '   siguió.', n);
        break;
      case 'simulacion_detenida': {
        if (!c) break;
        if (c.cierres.length) aviso(`La corrida ${n} se cierra dos veces.`);
        if (Number.isFinite(datos.ms_sim) && Number.isFinite(ev.ms_sim) && datos.ms_sim !== ev.ms_sim) {
          aviso(`El cierre de la corrida ${n} dice ${datos.ms_sim} ms simulados y su sobre ${ev.ms_sim}.`);
          c.contradicciones.push('su cierre dice dos tiempos simulados distintos');
        }
        if (!c.cierres.length) { // se cierra ahora: las que empezaron mientras seguía abierta se cruzaron con ella
          for (const x of h.corridas) {
            if (x === c || !x.abiertas.includes(n)) continue;
            aviso(`Las corridas ${n} y ${x.numero} se cruzan: la ${x.numero} empezó antes de que la ${n} se cerrara.`);
            c.contradicciones.push(`se cruza con la corrida ${x.numero}`);
            x.contradicciones.push(`se cruza con la corrida ${n}`);
          }
        }
        // Se guardan todos los cierres, con su tiempo: uno posterior no borra lo que dijo el anterior
        c.fin = t; c.ms_sim = Number.isFinite(datos.ms_sim) ? datos.ms_sim : ev.ms_sim ?? null; c.estado = 'cerrada';
        c.cierres.push(datos.fallas.map((f) => ({ tipo: f.tipo, componente: f.componente })));
        c.tiemposCierre.push({ ms_sim: c.ms_sim, tramo: tramoDe(c) });
        // El texto del cierre y la comparación con la corrida anterior se escriben al final, con todo leído: una falla
        // que llegue tarde (a esta corrida o a la anterior) cambia lo que se puede afirmar.
        paso(t, '', n);
        c.pasosCierre.push(h.pasos[h.pasos.length - 1]);
        break;
      }
      default: break;
    }
  });
  cerrarGrupos();

  // El ciclo de vida de la sesión: empieza una vez y con sesion_iniciada (INT-05)
  if (!inicios) duda('la sesión no tiene sesion_iniciada: puede faltarle el comienzo');
  else if (primero !== 'sesion_iniciada') duda('sesion_iniciada no es lo primero de la sesión: le falta el comienzo o sus archivos se leyeron en otro orden (pásalos en orden, o con la fecha en el nombre como los escribe la app)');
  if (!terminada) aviso('La sesión no tiene sesion_terminada: la app se cerró de golpe o el archivo está incompleto.');
  // El contrato permite tipos nuevos, pero en el estudio la versión está congelada: un tipo que esta historia no conoce
  // dice que el registro es de una versión más nueva y que el análisis quedó incompleto. Se avisa; no cambia lo demás.
  for (const [k, n] of desconocidos) aviso(`${cuantos(n, 'evento')} ${k} que esta historia no interpreta: no entran en ella (¿registro de una versión más nueva?).`);

  // Los huecos de registro_interrumpido, ubicados por la hora: desde el primer evento a partir de «desde» hasta el aviso
  for (const x of huecosPorHora) {
    const primeroDentro = horas.find((e) => e.t >= x.desde && e.pos <= x.pos);
    huecos.push({ desdePos: primeroDentro ? primeroDentro.pos : x.pos, hastaPos: x.pos });
  }
  const hayHueco = (a, b) => huecos.some((x) => x.desdePos <= b && x.hastaPos >= a);

  // Al final, con todo leído: cada corrida queda con sus hechos y se dice si está completa (tiene cierre) y coherente
  // (sus cierres dicen lo mismo entre sí y traen las mismas fallas que llegaron, también las que llegaron después del
  // cierre, y nada en ella se contradice). `cierre` queda como la unión de todos los cierres, para quien lea los datos.
  for (const c of h.corridas) {
    c.fallas = hechos(c);
    c.completa = c.cierres.length > 0;
    c.cierre = c.completa ? hechos({ cierres: c.cierres, fallasVistas: [] }) : null;
    const iguales = c.cierres.every((k) => claveDe(k) === claveDe(c.cierres[0]));
    // El tiempo de cada cierre frente a cada falla que llegó en su mismo tramo del reloj, sin quedarse con una sola
    // repetición ni con el último cierre (INT-RES-03a). Una falla de antes de un RESET puede tener más tiempo que el cierre.
    const despuesDelCierre = (xs) => c.tiemposCierre.some((k) => Number.isFinite(k.ms_sim) && xs.some((o) => o.tramo === k.tramo && Number.isFinite(o.ms_sim) && o.ms_sim > k.ms_sim));
    if (despuesDelCierre(c.ocurrencias)) {
      aviso(`La corrida ${c.numero} tiene una falla después del tiempo simulado de su cierre.`);
      contradice(c, 'tiene una falla después del tiempo simulado de su cierre');
    }
    if (despuesDelCierre(c.marcas)) {
      aviso(`La corrida ${c.numero} tiene una pausa o un reinicio después del tiempo simulado de su cierre.`);
      contradice(c, 'tiene una pausa o un reinicio después del tiempo simulado de su cierre');
    }
    if (new Set(c.tiemposCierre.map((k) => `${k.ms_sim}|${k.tramo}`)).size > 1) {
      aviso(`Los cierres de la corrida ${c.numero} dicen tiempos simulados distintos (${c.tiemposCierre.map((k) => k.ms_sim).join(' | ')} ms).`);
      contradice(c, 'sus cierres dicen tiempos simulados distintos');
    }
    // Una corrida que empezó mientras otra seguía abierta, y esa otra nunca se cerró: no se sabe si se cruzaron, así que
    // tampoco se puede acreditar el orden (límite de CLA-009). Si la otra sí se cierra, es un cruce (arriba).
    for (const m of c.abiertas) {
      if (corridas.get(m).cierres.length) continue;
      aviso(`La corrida ${c.numero} empezó antes de que la corrida ${m} se cerrara, y esa nunca se cerró.`);
      contradice(c, `empezó antes de que la corrida ${m} se cerrara, y esa nunca se cerró`);
    }
    c.coherente = c.completa && iguales && claveDe(c.cierres[0]) === claveDe(c.fallasVistas) && !c.contradicciones.length;
    c.incoherencia = c.coherente || !c.completa ? null
      : !iguales ? 'tiene cierres que no coinciden entre sí'
        : claveDe(c.cierres[0]) !== claveDe(c.fallasVistas) ? 'tiene un cierre que no coincide con las fallas que llegaron' : c.contradicciones[0];
    if (!c.completa) aviso(`La corrida ${c.numero} no tiene cierre (simulacion_detenida).`);
    else if (!iguales) aviso(`La corrida ${c.numero} tiene cierres que no coinciden entre sí (${c.cierres.map((k) => lista(k.map(nombreFalla))).join(' | ')}).`);
    else if (claveDe(c.cierres[0]) !== claveDe(c.fallasVistas)) {
      aviso(`La corrida ${c.numero}: las fallas del cierre (${lista(c.cierres[0].map(nombreFalla))}) no son las que llegaron (${lista(c.fallasVistas.map(nombreFalla))}).`);
    }
  }
  // El cierre de cada corrida, y frente a la anterior: qué corrigió, qué ya no se observó (y por qué), qué sigue y qué
  // es nuevo. Solo se compara si las dos están completas y coherentes y no hay un hueco entre ellas; si no, se dice por
  // qué no y corrigio/yaNoSeObservo/siguen/nuevas quedan en null.
  h.corridas.forEach((c, i) => {
    const previa = h.corridas[i - 1];
    c.comparada = previa ? previa.numero : null;
    c.corrigio = c.yaNoSeObservo = c.siguen = c.nuevas = null;
    if (!c.completa) return;
    let texto = `■ Corrida ${c.numero} terminó: ${segundos(c.ms_sim || 0)} simulados. `;
    if (c.coherente) texto += c.fallas.length ? `Fallas: ${c.fallas.map(nombreFalla).join(', ')}.` : 'Sin fallas.';
    else if (c.cierres.length > 1) texto += `Los cierres dicen: ${c.cierres.map((k) => lista(k.map(nombreFalla))).join(' | ')}; llegaron: ${lista(c.fallasVistas.map(nombreFalla))}.`;
    else if (claveDe(c.cierres[0]) !== claveDe(c.fallasVistas)) texto += `El cierre dice: ${lista(c.cierres[0].map(nombreFalla))}; llegaron: ${lista(c.fallasVistas.map(nombreFalla))}.`;
    else texto += `Fallas: ${lista(c.fallas.map(nombreFalla))}.`;
    const motivo = !c.coherente ? (c.incoherencia.includes('cierres que no coinciden') ? 'los cierres de esta corrida no coinciden entre sí'
      : c.incoherencia.includes('no coincide con las fallas') ? 'el cierre de esta corrida no coincide con las fallas que llegaron' : `esta corrida ${c.incoherencia}`)
      : previa && !previa.completa ? 'quedó sin cierre'
        : previa && !previa.coherente ? (previa.incoherencia.includes('cierres que no coinciden') ? 'sus cierres no coinciden entre sí'
          : previa.incoherencia.includes('no coincide con las fallas') ? 'su cierre no coincide con las fallas que llegaron' : previa.incoherencia)
          : previa && hayHueco(previa.desdePos, c.hastaPos) ? 'hay un hueco en el registro entre las dos' : null;
    if (previa && motivo) texto += ` No se compara con la corrida ${previa.numero}: ${motivo}.`;
    else if (!motivo) {
      const antes = previa ? previa.fallas.map(claveFalla) : [];
      const ahora = c.fallas.map(claveFalla);
      c.corrigio = []; c.yaNoSeObservo = [];
      for (const f of previa ? previa.fallas.filter((x) => !ahora.includes(claveFalla(x))) : []) {
        const porque = cambioDeCondiciones(previa, c, f);
        if (porque) c.yaNoSeObservo.push({ ...f, motivo: porque });
        else c.corrigio.push(f);
      }
      c.siguen = c.fallas.filter((f) => antes.includes(claveFalla(f)));
      c.nuevas = c.fallas.filter((f) => !antes.includes(claveFalla(f)));
      if (previa) {
        if (c.corrigio.length) texto += ` Corrigió: ${c.corrigio.map(nombreFalla).join(', ')}.`;
        if (c.yaNoSeObservo.length) texto += ` Ya no se observó: ${yaNoSeObservo(c.yaNoSeObservo.map((f) => ({ falla: f, motivo: f.motivo })))}.`;
        if (c.siguen.length) texto += ` Siguen: ${c.siguen.map(nombreFalla).join(', ')}.`;
        if (c.nuevas.length) texto += ` Nuevas: ${c.nuevas.map(nombreFalla).join(', ')}.`;
      }
    }
    // Si hubo más de un cierre, cada uno conserva su paso y el último lleva el resumen
    c.pasosCierre.forEach((p, k) => { p.texto = k === c.pasosCierre.length - 1 ? texto : `■ Corrida ${c.numero}, cierre ${k + 1} de ${c.cierres.length}: ${c.cierres[k].length ? c.cierres[k].map(nombreFalla).join(', ') : 'sin fallas'}.`; });
  });
  for (const c of h.corridas) { delete c.pasosCierre; delete c.estado; delete c.abiertas; delete c.tramo; delete c.marcas; }
  h.sinAtribuir = [...huerfanas.values()].map((x) => ({ corrida: x.numero, fallas: hechos(x) })).filter((x) => x.fallas.length);
  h.huecos = huecos;
  h.resumen = resumen(h, hayHueco, entradas.length - 1);
  return h;
}

/** La historia en texto, para leerla. */
function narrar(historias, problemas = [], notas = []) {
  const salida = [];
  for (const h of historias) {
    if (h.error) {
      salida.push(`Equipo ${h.equipo} · sesión ${String(h.sesion).slice(0, 8)}: no se pudo contar (${h.error}).`, '');
      continue;
    }
    const fin = h.fin !== null ? h.fin : h.pasos.length ? h.pasos[h.pasos.length - 1].t : h.inicio;
    const cuando = h.inicio ? `${fecha(h.inicio)}, ${hora(h.inicio)} a ${hora(fin)}` : 'sin hora';
    salida.push(`Equipo ${h.equipo} · ${cuando} · ${h.placas.join(' → ') || '?'}, nivel ${h.nivel ?? '?'} · sesión ${String(h.sesion).slice(0, 8)}`);
    for (const p of h.pasos) salida.push(`  ${hora(p.t)}  ${p.texto}`);
    salida.push(`  Resumen: ${h.resumen}`);
    salida.push(h.avisos.length ? '  Avisos:' : '  Avisos: ninguno.');
    for (const a of h.avisos) salida.push(`  ⚠ ${a}`);
    for (const n of h.notas) salida.push(`  · ${n}`);
    salida.push('');
  }
  if (problemas.length) {
    salida.push('Lo que no se pudo leer:');
    for (const p of problemas) salida.push(`  ⚠ ${p}`);
  }
  if (notas.length) {
    salida.push('Notas de la lectura:');
    for (const n of notas) salida.push(`  · ${n}`);
  }
  if (!historias.length && !problemas.length) salida.push('No hay eventos en esos archivos.');
  return salida.join('\n');
}

/** true si no hay nada que avisar: ni líneas sin leer ni avisos de integridad. */
const estaLimpio = (historias, problemas) => !problemas.length && historias.every((h) => !h.avisos.length);

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const rutas = args.filter((a) => a !== '--json');
  if (!rutas.length) {
    console.error('Uso: node herramientas/historia-registro.js <archivo.jsonl | carpeta> [...] [--json]');
    process.exit(2);
  }
  const { lineas, problemas, notas } = leerArchivos(rutas);
  const historias = contarHistoria(lineas);
  const limpio = estaLimpio(historias, problemas);
  console.log(json ? JSON.stringify({ limpio, historias, problemas, notas }, null, 2) : narrar(historias, problemas, notas));
  process.exitCode = limpio ? 0 : 1;
}

module.exports = { leerArchivos, contarHistoria, narrar, resumirCircuito, cambiosDelPrograma, revisarSobre, estaLimpio };
