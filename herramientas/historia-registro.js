// Historia de un registro de eventos (REG-004, fase 4 del registro; contrato con TecnoCircuito, sección 6.1).
// Lee uno o varios .jsonl (o una carpeta con ellos) y cuenta, por equipo y sesión, lo que pasó en orden: qué
// cambiaron, qué compilaron, cada corrida con sus fallas y qué se corrigió de una corrida a la siguiente. Además revisa
// que el registro esté entero (corridas sin cierre, eventos de otra sesión, huecos del disco, comentarios en el C++):
// si algo falla, la historia lo dice en «Avisos» en vez de callarlo.
// Uso: node herramientas/historia-registro.js <archivo.jsonl | carpeta> [...] [--json]
//      (npm run historia -- <...>). Con --json sale la historia como datos, para el análisis.
// Solo lee: no cambia los archivos. No necesita la app ni internet.
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

const nombreFalla = (f) => `${FALLAS[f.tipo] || f.tipo} (${f.componente})`;
const claveFalla = (f) => `${f.tipo}|${f.componente}`;
const segundos = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const cuantos = (n, palabra) => `${n} ${palabra}${n === 1 ? '' : 's'}`;
const lista = (xs) => (xs.length ? xs.join(', ') : 'ninguna');
const hora = (t) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
const fecha = (t) => new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' }).format(t);
const ref = (r) => (r && typeof r === 'object' ? JSON.stringify(r) : String(r));

/** Las líneas de los archivos, en el orden en que se escribieron. Una carpeta aporta sus .jsonl. */
function leerArchivos(rutas) {
  const archivos = rutas.flatMap((r) => (fs.statSync(r).isDirectory()
    ? fs.readdirSync(r).filter((f) => f.endsWith('.jsonl')).sort().map((f) => path.join(r, f)) : [r]));
  const lineas = [];
  const problemas = [];
  for (const archivo of archivos) {
    const nombre = path.basename(archivo);
    fs.readFileSync(archivo, 'utf8').split('\n').forEach((texto, i) => {
      if (!texto.trim()) return;
      let ev;
      try { ev = JSON.parse(texto); } catch (e) { problemas.push(`${nombre}, línea ${i + 1}: no se puede leer (${e.message})`); return; }
      if (!ev || typeof ev !== 'object' || !ev.sesion || !ev.equipo || !ev.tipo) {
        problemas.push(`${nombre}, línea ${i + 1}: le falta el equipo, la sesión o el tipo`);
        return;
      }
      lineas.push({ archivo: nombre, linea: i + 1, ev });
    });
  }
  return { lineas, problemas };
}

/** Los cambios del circuito seguidos, en una sola frase: agregó, quitó, movió, cambió, conectó, desconectó. */
function resumirCircuito(evs) {
  const agrego = [], quito = [], cambio = [], conecto = [], desconecto = [];
  const movio = new Map();
  for (const { tipo, datos: d } of evs) {
    if (tipo === 'componente_agregado') agrego.push(`${d.id} (${d.tipo})`);
    else if (tipo === 'componente_quitado') quito.push(`${d.id} (${d.tipo})`);
    else if (tipo === 'cable_agregado') conecto.push(`${ref(d.de)} → ${ref(d.a)}`);
    else if (tipo === 'cable_quitado') desconecto.push(`${ref(d.de)} → ${ref(d.a)}`);
    else if (tipo === 'componente_cambiado') {
      if (d.props) cambio.push(`${d.id}: ${Object.entries(d.props).map(([k, v]) => `${k} ${ref(v)}`).join(', ')}`);
      if (d.rot !== undefined) cambio.push(`${d.id}: giro ${d.rot}°`);
      if (d.en !== undefined) cambio.push(d.en ? `${d.id}: enchufado en ${Object.entries(d.en).map(([p, r]) => `${p}→${ref(r)}`).join(', ')}` : `${d.id}: desenchufado`);
      if (d.x !== undefined || d.y !== undefined) movio.set(d.id, (movio.get(d.id) || 0) + 1);
    }
  }
  const partes = [];
  if (agrego.length) partes.push('agregó ' + agrego.join(', '));
  if (quito.length) partes.push('quitó ' + quito.join(', '));
  if (cambio.length) partes.push('cambió ' + cambio.join('; '));
  if (conecto.length) partes.push('conectó ' + conecto.join(', '));
  if (desconecto.length) partes.push('desconectó ' + desconecto.join(', '));
  if (movio.size) partes.push('movió ' + [...movio].map(([id, n]) => (n > 1 ? `${id} (${n} veces)` : id)).join(', '));
  return partes.join('; ');
}

/** Los hechos de una corrida: las fallas de todos sus cierres y las que llegaron una a una, sin repetir. */
function hechos(c) {
  const todas = new Map();
  for (const f of [...(c.cierres || []).flat(), ...c.fallasVistas]) if (!todas.has(claveFalla(f))) todas.set(claveFalla(f), f);
  return [...todas.values()];
}

/**
 * El resumen de una sesión. Las fallas vistas son todos los hechos (cierres y fallas sueltas), también las de una
 * corrida que no empezó en la sesión, marcadas «sin atribuir»: llegaron, pero no se sabe si son del montaje del equipo.
 * «Corregidas» solo se afirma si la última corrida está completa y coherente y no hay fallas sin atribuir: si no, no se
 * puede saber, y lo que sí se vio en la última corrida sigue sin corregir.
 */
function resumen(h) {
  const vistas = new Map();
  for (const c of h.corridas) for (const f of c.fallas) vistas.set(claveFalla(f), f);
  const sinAtribuir = h.sinAtribuir.flatMap((x) => x.fallas.map((f) => `${nombreFalla(f)} [sin atribuir: corrida ${x.corrida}]`));
  const texto = `${h.corridas.length} corrida(s). Fallas vistas: ${lista([...[...vistas.values()].map(nombreFalla), ...sinAtribuir])}.`;
  const ultima = h.corridas[h.corridas.length - 1];
  if (!ultima) return texto;
  const pendientes = ultima.fallas;
  if (ultima.coherente && !sinAtribuir.length) {
    const corregidas = [...vistas.values()].filter((f) => !pendientes.some((p) => claveFalla(p) === claveFalla(f)));
    return `${texto} Corregidas al final: ${lista(corregidas.map(nombreFalla))}. Sin corregir: ${lista(pendientes.map(nombreFalla))}.`;
  }
  const porque = !ultima.completa ? `la corrida ${ultima.numero} quedó sin cierre`
    : !ultima.coherente ? `la corrida ${ultima.numero} ${ultima.incoherencia}`
      : 'llegaron fallas de una corrida que no empezó en esta sesión';
  return `${texto} Corregidas al final: no se puede asegurar, porque ${porque}. ` +
    `Sin corregir: ${pendientes.length ? `al menos ${lista(pendientes.map(nombreFalla))}` : 'no se puede asegurar'}.`;
}

/**
 * La historia de cada sesión, como datos: sus pasos en orden (cada uno con su hora y su texto), sus corridas con las
 * fallas y su comparación con la corrida anterior, y los avisos de integridad.
 */
function contarHistoria(lineas) {
  const sesiones = new Map();
  for (const l of lineas) {
    if (!sesiones.has(l.ev.sesion)) sesiones.set(l.ev.sesion, { sesion: l.ev.sesion, equipo: l.ev.equipo, archivos: new Set(), lineas: [] });
    const s = sesiones.get(l.ev.sesion);
    s.archivos.add(l.archivo);
    s.lineas.push(l);
  }
  const historias = [...sesiones.values()].map(contarSesion);
  historias.sort((a, b) => a.inicio - b.inicio || a.equipo.localeCompare(b.equipo));
  return historias;
}

function contarSesion({ sesion, equipo, archivos, lineas }) {
  const h = {
    equipo, sesion, archivos: [...archivos], inicio: lineas[0].ev.t, fin: null, placa: null, nivel: null,
    pasos: [], corridas: [], avisos: [], desconocidos: {},
  };
  const paso = (t, texto, corrida) => h.pasos.push({ t, texto, ...(corrida ? { corrida } : {}) });
  const aviso = (texto) => { if (!h.avisos.includes(texto)) h.avisos.push(texto); };
  const corridas = new Map(); // número → { numero, inicio, fin, modo, fallasVistas, cierres, ... }
  const huerfanas = new Map(); // corridas que no empezaron en la sesión pero tienen eventos aquí: sus fallas no se pierden
  let terminada = false;
  let grupo = null; // cambios del circuito seguidos: { t, evs }
  let pulsos = null; // pulsos de botón seguidos en una corrida: { t, corrida, porId }

  const cerrarGrupos = () => {
    if (grupo) { paso(grupo.t, 'Circuito: ' + resumirCircuito(grupo.evs) + '.'); grupo = null; }
    if (pulsos) {
      paso(pulsos.t, 'Pulsó ' + [...pulsos.porId].map(([id, n]) => (n > 1 ? `${id} ${n} veces` : id)).join(', ') + '.', pulsos.corrida);
      pulsos = null;
    }
  };

  for (const { ev, archivo, linea } of lineas) {
    const { t, tipo, datos = {}, corrida: n } = ev;
    if (ev.equipo !== equipo) aviso(`La sesión tiene líneas de otro equipo (${ev.equipo}, ${archivo} línea ${linea}).`);
    if (terminada && tipo !== 'registro_interrumpido') aviso(`Hay eventos después de sesion_terminada (${tipo}, ${archivo} línea ${linea}).`);
    if (ev.origen === 'circuito' && tipo !== 'boton_pulsado') {
      if (pulsos) cerrarGrupos();
      grupo = grupo || { t, evs: [] };
      grupo.evs.push(ev);
      continue;
    }
    if (tipo === 'boton_pulsado') {
      if (grupo) cerrarGrupos();
      pulsos = pulsos || { t, corrida: n, porId: new Map() };
      pulsos.porId.set(datos.id, (pulsos.porId.get(datos.id) || 0) + 1);
      continue;
    }
    cerrarGrupos();

    if (ev.origen === 'simulador' && tipo !== 'simulacion_iniciada' && !corridas.has(n)) {
      aviso(`La corrida ${n} no empezó en esta sesión y tiene eventos aquí: ¿quedó en el equipo equivocado?`);
      const x = huerfanas.get(n) || { numero: n, fallasVistas: [], cierres: [] };
      huerfanas.set(n, x);
      if (tipo === 'falla') x.fallasVistas.push({ tipo: datos.tipo, componente: datos.componente });
      if (tipo === 'simulacion_detenida') x.cierres.push((datos.fallas || []).map((f) => ({ tipo: f.tipo, componente: f.componente })));
    }
    const c = corridas.get(n);
    // El cierre de una corrida es lo último que llega de ella (AUD-03): lo que venga después no cabe en su resumen
    if (c && c.cierres.length && tipo !== 'simulacion_iniciada') aviso(`La corrida ${n} tiene eventos después de su cierre (${tipo}).`);
    switch (tipo) {
      case 'sesion_iniciada':
        h.placa = datos.placa; h.nivel = datos.nivel;
        paso(t, `Empezó la sesión (${datos.placa}, nivel ${datos.nivel}).`);
        break;
      case 'sesion_terminada':
        terminada = true; h.fin = t;
        paso(t, `Terminó la sesión (${datos.ms < 60000 ? `${Math.round(datos.ms / 1000)} s` : `${Math.round(datos.ms / 60000)} min`}).`);
        break;
      case 'ejemplo_cargado': paso(t, `Abrió el ejemplo «${datos.id}».`); break;
      case 'proyecto_abierto': paso(t, `Abrió un proyecto (${datos.placa}).`); break;
      case 'bloques_cambiados': paso(t, `Bloques: ${datos.bloques} (${Object.keys(datos.tipos || {}).length} tipos).`); break;
      case 'codigo_compilado':
        paso(t, datos.ok ? `Compiló: bien${datos.bytes ? `, ${datos.bytes} bytes` : ''}.` : `Compiló: con error${datos.error ? ` (${datos.error})` : ''}.`);
        if (typeof datos.codigo === 'string' && quitarComentarios(datos.codigo) !== datos.codigo) {
          aviso(`El C++ de codigo_compilado tiene comentarios (${archivo} línea ${linea}); el registro debe guardarlo sin ellos (AUD-01).`);
        }
        break;
      case 'programa_subido': paso(t, datos.ok ? `Subió el programa a la placa real (${datos.placa}).` : 'No pudo subir el programa a la placa real.'); break;
      case 'registro_interrumpido':
        paso(t, `El disco no dejó guardar de ${hora(datos.desde)} a ${hora(datos.hasta)} (${datos.motivo}); se recuperaron ${datos.recuperados} eventos.`);
        if (datos.perdidos > 0) aviso(`Hay un hueco: ${datos.perdidos} eventos se perdieron cuando el disco falló (${hora(datos.desde)} a ${hora(datos.hasta)}).`);
        break;
      case 'simulacion_iniciada': {
        if (corridas.has(n)) aviso(`La corrida ${n} empieza dos veces.`);
        const nueva = { numero: n, inicio: t, fin: null, modo: datos.modo, placa: datos.placa, fallasVistas: [], cierres: [], pasosCierre: [], ms_sim: null, reinicios: 0 };
        corridas.set(n, nueva);
        h.corridas.push(nueva);
        const piezas = (datos.circuito && datos.circuito.componentes || []).length;
        const cables = (datos.circuito && datos.circuito.cables || []).length;
        const apagadas = Object.entries(datos.activas || {}).filter(([, v]) => !v).map(([k]) => k);
        paso(t, `▶ Corrida ${n} (${datos.modo}; ${cuantos(piezas, 'pieza')}, ${cuantos(cables, 'cable')}${apagadas.length && datos.modo !== 'ideal' ? `; apagadas: ${apagadas.join(', ')}` : ''}).`, n);
        break;
      }
      case 'falla':
        if (c && !c.fallasVistas.some((f) => claveFalla(f) === claveFalla(datos))) c.fallasVistas.push({ tipo: datos.tipo, componente: datos.componente });
        paso(t, `   falla: ${nombreFalla(datos)}, a los ${segundos(ev.ms_sim || 0)} simulados.`, n);
        break;
      case 'reinicio_placa':
        if (c) c.reinicios += datos.nuevos || 1;
        paso(t, `   la placa se reinició (${MOTIVOS_REINICIO[datos.motivo] || datos.motivo}${datos.nuevos > 1 ? `, ${datos.nuevos} veces` : ''}).`, n);
        break;
      case 'simulacion_pausada': paso(t, '   pausó.', n); break;
      case 'simulacion_reanudada': paso(t, '   siguió.', n); break;
      case 'simulacion_detenida': {
        if (!c) break;
        if (c.cierres.length) aviso(`La corrida ${n} se cierra dos veces.`);
        // Se guardan todos los cierres: uno posterior no borra lo que dijo el anterior
        c.fin = t; c.ms_sim = datos.ms_sim; c.cierres.push((datos.fallas || []).map((f) => ({ tipo: f.tipo, componente: f.componente })));
        // El texto del cierre y la comparación con la corrida anterior se escriben al final, con todo leído: una falla
        // que llegue tarde (a esta corrida o a la anterior) cambia lo que se puede afirmar.
        paso(t, '', n);
        c.pasosCierre.push(h.pasos[h.pasos.length - 1]);
        break;
      }
      default:
        h.desconocidos[tipo] = (h.desconocidos[tipo] || 0) + 1;
    }
  }
  cerrarGrupos();
  // Al final, con todo leído: cada corrida queda con sus hechos y se dice si está completa (tiene cierre) y coherente
  // (sus cierres dicen lo mismo entre sí y traen las mismas fallas que llegaron una a una, también las que llegaron
  // después del cierre). `cierre` queda como la unión de todos los cierres, para quien lea los datos.
  for (const c of h.corridas) {
    c.fallas = hechos(c);
    const clave = (fs) => fs.map(claveFalla).sort().join();
    c.completa = c.cierres.length > 0;
    c.cierre = c.completa ? hechos({ cierres: c.cierres, fallasVistas: [] }) : null;
    const iguales = c.cierres.every((k) => clave(k) === clave(c.cierres[0]));
    c.coherente = c.completa && iguales && clave(c.cierres[0]) === clave(c.fallasVistas);
    c.incoherencia = c.coherente || !c.completa ? null
      : !iguales ? 'tiene cierres que no coinciden entre sí' : 'tiene un cierre que no coincide con las fallas que llegaron';
    if (!c.completa) aviso(`La corrida ${c.numero} no tiene cierre (simulacion_detenida).`);
    else if (!iguales) aviso(`La corrida ${c.numero} tiene cierres que no coinciden entre sí (${c.cierres.map((k) => lista(k.map(nombreFalla))).join(' | ')}).`);
    else if (!c.coherente) {
      aviso(`La corrida ${c.numero}: las fallas del cierre (${lista(c.cierres[0].map(nombreFalla))}) no son las que llegaron (${lista(c.fallasVistas.map(nombreFalla))}).`);
    }
  }
  // El cierre de cada corrida, y qué corrigió, siguen y es nuevo frente a la anterior. Solo se compara si las dos
  // están completas y coherentes; si no, se dice por qué no y corrigio/siguen/nuevas quedan en null.
  h.corridas.forEach((c, i) => {
    const previa = h.corridas[i - 1];
    c.comparada = previa ? previa.numero : null;
    c.corrigio = c.siguen = c.nuevas = null;
    if (!c.completa) return;
    let texto = `■ Corrida ${c.numero} terminó: ${segundos(c.ms_sim || 0)} simulados. `;
    if (c.coherente) texto += c.fallas.length ? `Fallas: ${c.fallas.map(nombreFalla).join(', ')}.` : 'Sin fallas.';
    else if (c.cierres.length > 1) texto += `Los cierres dicen: ${c.cierres.map((k) => lista(k.map(nombreFalla))).join(' | ')}; llegaron: ${lista(c.fallasVistas.map(nombreFalla))}.`;
    else texto += `El cierre dice: ${lista(c.cierres[0].map(nombreFalla))}; llegaron: ${lista(c.fallasVistas.map(nombreFalla))}.`;
    const motivo = !c.coherente ? (c.cierres.length > 1 && c.incoherencia.includes('entre sí') ? 'los cierres de esta corrida no coinciden entre sí' : 'el cierre de esta corrida no coincide con las fallas que llegaron')
      : previa && !previa.completa ? 'quedó sin cierre'
        : previa && !previa.coherente ? (previa.incoherencia.includes('entre sí') ? 'sus cierres no coinciden entre sí' : 'su cierre no coincide con las fallas que llegaron') : null;
    if (previa && motivo) texto += ` No se compara con la corrida ${previa.numero}: ${motivo}.`;
    else if (!motivo) {
      const antes = previa ? previa.fallas.map(claveFalla) : [];
      const ahora = c.fallas.map(claveFalla);
      c.corrigio = previa ? previa.fallas.filter((f) => !ahora.includes(claveFalla(f))) : [];
      c.siguen = c.fallas.filter((f) => antes.includes(claveFalla(f)));
      c.nuevas = c.fallas.filter((f) => !antes.includes(claveFalla(f)));
      if (previa) {
        if (c.corrigio.length) texto += ` Corrigió: ${c.corrigio.map(nombreFalla).join(', ')}.`;
        if (c.siguen.length) texto += ` Siguen: ${c.siguen.map(nombreFalla).join(', ')}.`;
        if (c.nuevas.length) texto += ` Nuevas: ${c.nuevas.map(nombreFalla).join(', ')}.`;
      }
    }
    // Si hubo más de un cierre, cada uno conserva su paso y el último lleva el resumen
    c.pasosCierre.forEach((p, k) => { p.texto = k === c.pasosCierre.length - 1 ? texto : `■ Corrida ${c.numero}, cierre ${k + 1} de ${c.cierres.length}: ${c.cierres[k].length ? c.cierres[k].map(nombreFalla).join(', ') : 'sin fallas'}.`; });
  });
  for (const c of h.corridas) delete c.pasosCierre;
  h.sinAtribuir = [...huerfanas.values()].map((x) => ({ corrida: x.numero, fallas: hechos(x) })).filter((x) => x.fallas.length);
  if (!terminada) aviso('La sesión no tiene sesion_terminada: la app se cerró de golpe o el archivo está incompleto.');
  for (const [tipo, n] of Object.entries(h.desconocidos)) aviso(`${n} evento(s) «${tipo}» que esta historia no conoce: se ignoran (el contrato lo permite).`);
  h.resumen = resumen(h);
  return h;
}

/** La historia en texto, para leerla. */
function narrar(historias, problemas = []) {
  const salida = [];
  for (const h of historias) {
    const fin = h.fin !== null ? h.fin : h.pasos.length ? h.pasos[h.pasos.length - 1].t : h.inicio;
    salida.push(`Equipo ${h.equipo} · ${fecha(h.inicio)}, ${hora(h.inicio)} a ${hora(fin)} · ${h.placa || '?'}, nivel ${h.nivel ?? '?'} · sesión ${h.sesion.slice(0, 8)}`);
    for (const p of h.pasos) salida.push(`  ${hora(p.t)}  ${p.texto}`);
    salida.push(`  Resumen: ${h.resumen}`);
    salida.push(h.avisos.length ? '  Avisos:' : '  Avisos: ninguno.');
    for (const a of h.avisos) salida.push(`  ⚠ ${a}`);
    salida.push('');
  }
  if (problemas.length) {
    salida.push('Líneas que no se pudieron leer:');
    for (const p of problemas) salida.push(`  ⚠ ${p}`);
  }
  if (!historias.length && !problemas.length) salida.push('No hay eventos en esos archivos.');
  return salida.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const rutas = args.filter((a) => a !== '--json');
  if (!rutas.length) {
    console.error('Uso: node herramientas/historia-registro.js <archivo.jsonl | carpeta> [...] [--json]');
    process.exit(2);
  }
  const { lineas, problemas } = leerArchivos(rutas);
  const historias = contarHistoria(lineas);
  console.log(json ? JSON.stringify({ historias, problemas }, null, 2) : narrar(historias, problemas));
}

module.exports = { leerArchivos, contarHistoria, narrar, resumirCircuito };
