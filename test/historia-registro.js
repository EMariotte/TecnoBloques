// La historia de un registro (REG-004): una secuencia conocida, armada con el sobre real (crearRegistroEventos) y un
// reloj fijo, tiene que contarse tal como pasó, y un registro con defectos (los de AUD-01 a AUD-04) tiene que
// avisarlos. También prueba la línea de comandos: una carpeta, --json y una línea que no se puede leer.
// Uso: npm run test:historia
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { crearRegistroEventos, quitarComentarios } = require('../src/registro.js');
const { leerArchivos, contarHistoria, narrar } = require('../herramientas/historia-registro.js');

let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}

const INICIO = Date.UTC(2026, 9, 19, 15, 0, 0); // 10:00 en Bogotá
let reloj = INICIO;
const lineas = [];
let sesiones = 0;
const registro = crearRegistroEventos({
  escribir: (l) => lineas.push(JSON.stringify(l)), versionTB: '0.3.0', versionTC: '0.1.0', ahora: () => reloj,
  nuevaSesion: () => `sesion-${++sesiones}-0000`,
});
const pasar = (s) => { reloj += s * 1000; };
const circuito = (tipo, datos) => registro.registrar({ v: 1, t: reloj, origen: 'circuito', tipo, datos });
const sim = (tipo, corrida, ms_sim, datos = {}) => registro.registrar({ v: 1, t: reloj, origen: 'simulador', tipo, corrida, ms_sim, datos });
const PROGRAMA = 'void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); delay(500); /* espera */ digitalWrite(13, LOW); }\n';
// Los cables solo se cuentan: cada {} se vuelve un cable válido, para que las líneas cumplan el esquema del contrato
const iniciar = (corrida, modo, componentes, cables, placa = 'uno', activas = { danoComponentes: modo === 'realista', limitePin: modo === 'realista' }) =>
  sim('simulacion_iniciada', corrida, 0, {
    placa, modo, activas,
    circuito: { formato: 1, placa, protoboard: null, componentes, cables: cables.map(() => ({ de: 'placa.D13', a: 'placa.D12' })) },
  });
const LED = { id: 'led1', tipo: 'led', x: 0, y: 0, rot: 0, props: { color: 'rojo' } };
const R1 = { id: 'r1', tipo: 'resistencia', x: 0, y: 0, rot: 0, props: { ohmios: 220 } };
const BTN = { id: 'btn1', tipo: 'pulsador', x: 0, y: 0, rot: 0, props: {} };

// ---- Equipo A1: la historia conocida
registro.empezar('A1', { placa: 'uno', nivel: 1 });
pasar(30); registro.editor('ejemplo_cargado', { id: 'parpadeo' });
pasar(60);
circuito('componente_agregado', { id: 'led1', tipo: 'led' });
circuito('cable_agregado', { de: 'placa.D13', a: 'led1.anodo' });
circuito('cable_agregado', { de: 'led1.catodo', a: 'placa.GND1' });
circuito('componente_cambiado', { id: 'led1', x: 40, y: 10 });
circuito('componente_cambiado', { id: 'led1', x: 50, y: 10 });
pasar(30); registro.editor('bloques_cambiados', { bloques: 5, tipos: { programa: 1, pin_digital: 2, esperar: 2 } });
pasar(10); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 924, codigo: quitarComentarios(PROGRAMA) });
pasar(2); iniciar(1, 'realista', [LED], [{}, {}]);
pasar(1); sim('falla', 1, 12, { tipo: 'led_quemado', componente: 'led1', corriente_mA: 61 });
sim('falla', 1, 12, { tipo: 'corriente_pin', componente: 'placa', corriente_mA: 61 });
pasar(40); sim('simulacion_detenida', 1, 41000, { ms_sim: 41000, ms_simulados: 41000, fallas: [{ tipo: 'led_quemado', componente: 'led1' }, { tipo: 'corriente_pin', componente: 'placa' }] });
pasar(90);
circuito('componente_agregado', { id: 'r1', tipo: 'resistencia' });
circuito('componente_cambiado', { id: 'r1', props: { valor: 220 } });
circuito('cable_quitado', { de: 'placa.D13', a: 'led1.anodo' });
circuito('cable_agregado', { de: 'placa.D13', a: 'r1.1' });
circuito('cable_agregado', { de: 'r1.2', a: 'led1.anodo' });
pasar(20); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 924, codigo: quitarComentarios(PROGRAMA) });
pasar(2); iniciar(2, 'realista', [LED, R1], [{}, {}, {}, {}]);
pasar(30); sim('simulacion_pausada', 2, 30000);
pasar(5); sim('simulacion_reanudada', 2, 30000);
pasar(10); sim('simulacion_detenida', 2, 40000, { ms_sim: 40000, fallas: [] });
pasar(60);
circuito('componente_agregado', { id: 'btn1', tipo: 'boton' });
circuito('componente_quitado', { id: 'r1', tipo: 'resistencia' });
pasar(10); registro.editor('codigo_compilado', { ok: false, error: 'no_declarado', bytes: null, codigo: 'void setup() { velocidad = 3; }' });
pasar(30); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 1100, codigo: 'void setup() {}\nvoid loop() {}\n' });
pasar(2); iniciar(3, 'realista', [LED, BTN], [{}, {}, {}]);
pasar(3); sim('falla', 3, 2900, { tipo: 'corriente_pin', componente: 'placa' });
circuito('boton_pulsado', { id: 'btn1', ms: 300 });
circuito('boton_pulsado', { id: 'btn1', ms: 250 });
sim('reinicio_placa', 3, 3100, { motivo: 'energia_usb', nuevos: 3, total: 3 });
pasar(20); sim('simulacion_detenida', 3, 23000, { ms_sim: 23000, fallas: [{ tipo: 'corriente_pin', componente: 'placa' }] });
pasar(120); registro.terminar();

const historiaA1 = lineas.slice();

// ---- Equipo B2: un registro con los defectos que la auditoría encontró
lineas.length = 0;
reloj = INICIO + 3600 * 1000;
registro.empezar('B2', { placa: 'nano', nivel: 2 });
pasar(10); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 900, codigo: 'void setup() {} // un comentario que no debía quedar\nvoid loop() {}\n' }); // AUD-01
pasar(10); registro.editor('registro_interrumpido', { desde: reloj - 8000, hasta: reloj, recuperados: 4, perdidos: 2, motivo: 'ENOSPC' }); // AUD-02
pasar(10); iniciar(4, 'realista', [LED], [{}, {}]);
pasar(1); sim('falla', 4, 16, { tipo: 'led_quemado', componente: 'led1' });
pasar(5); sim('simulacion_detenida', 4, 5000, { ms_sim: 5000, fallas: [] }); // AUD-03: el cierre perdió la falla
pasar(5); sim('falla', 9, 20, { tipo: 'corriente_pin', componente: 'placa' }); // AUD-04: de una corrida de otro equipo
sim('simulacion_detenida', 9, 900, { ms_sim: 900, fallas: [{ tipo: 'corriente_pin', componente: 'placa' }] });
pasar(5); iniciar(5, 'ideal', [LED], [{}, {}]); // sin cierre ni sesion_terminada: la app se cerró de golpe
registro.registrar({ v: 1, t: reloj, origen: 'editor', tipo: 'algo_nuevo', datos: {} }); // un tipo que el lector no conoce
const historiaB2 = lineas.slice();

// ---- La historia conocida
const leer = (ls) => ls.map((l, i) => ({ archivo: 'prueba.jsonl', linea: i + 1, ev: JSON.parse(l) }));
const [a1] = contarHistoria(leer(historiaA1));
const texto = narrar([a1]);
console.log('\n' + texto);
const c = a1.corridas;
revisar(a1.equipo === 'A1' && a1.placa === 'uno' && a1.nivel === 1 && c.length === 3, 'A1: un equipo, Uno nivel 1, tres corridas');
revisar(c[0].cierre.length === 2 && c[0].comparada === null, 'corrida 1: dos fallas, sin corrida anterior para comparar');
revisar(c[1].cierre.length === 0 && c[1].corrigio.map((f) => f.tipo).sort().join() === 'corriente_pin,led_quemado',
  'corrida 2: sin fallas y corrigió el LED quemado y la corriente del pin');
revisar(c[2].nuevas.map((f) => f.tipo).join() === 'corriente_pin' && c[2].siguen.length === 0 && c[2].reinicios === 3,
  'corrida 3: la corriente del pin vuelve como nueva y la placa se reinició 3 veces');
revisar(a1.avisos.length === 0, `A1 sin avisos (${a1.avisos.join(' | ') || 'ninguno'})`);
const esperado = [
  '10:00  Empezó la sesión (uno, nivel 1).',
  '10:00  Abrió el ejemplo «parpadeo».',
  '10:01  Circuito: agregó led1 (led); conectó placa.D13 → led1.anodo, led1.catodo → placa.GND1; movió led1.',
  '10:02  Bloques: 5 (3 tipos).',
  '10:02  Compiló: bien, 924 bytes.',
  '10:02  ▶ Corrida 1 (uno, realista; 1 pieza, 2 cables).',
  '10:02     falla: LED quemado (led1), a los 0,0 s simulados.',
  '10:02     falla: corriente del pin (placa), a los 0,0 s simulados.',
  '10:02  ■ Corrida 1 terminó: 41,0 s simulados. Fallas: LED quemado (led1), corriente del pin (placa).',
  '10:04  Circuito: agregó r1 (resistencia); cambió r1: valor 220; conectó placa.D13 → r1.1, r1.2 → led1.anodo; desconectó placa.D13 → led1.anodo.',
  '10:04  Compiló: bien, 924 bytes (el mismo programa).',
  '10:04  ▶ Corrida 2 (uno, realista; 2 piezas, 4 cables).',
  '10:05     pausó.',
  '10:05     siguió.',
  '10:05  ■ Corrida 2 terminó: 40,0 s simulados. Sin fallas. Corrigió: LED quemado (led1), corriente del pin (placa).',
  '10:06  Circuito: quitó r1 (resistencia); agregó btn1 (boton).',
  '10:06  Compiló: con error (no_declarado). Programa: `void setup() { pinMode(13, OUTPUT); }` `void loop() { digitalWrite(13, HIGH); delay(500);…` → `void setup() { velocidad = 3; }`.',
  '10:07  Compiló: bien, 1100 bytes. Programa: `void setup() { velocidad = 3; }` → `void setup() {}` `void loop() {}`.',
  '10:07  ▶ Corrida 3 (uno, realista; 2 piezas, 3 cables).',
  '10:07     falla: corriente del pin (placa), a los 2,9 s simulados.',
  '10:07  Pulsó btn1 2 veces.',
  '10:07     la placa se reinició (energía del USB, 3 veces).',
  '10:07  ■ Corrida 3 terminó: 23,0 s simulados. Fallas: corriente del pin (placa). Nuevas: corriente del pin (placa).',
  '10:09  Terminó la sesión (10 min).',
  'Resumen: 3 corrida(s). Fallas vistas: LED quemado (led1), corriente del pin (placa). Corregidas al final: LED quemado (led1). Sin corregir: corriente del pin (placa).',
  'Avisos: ninguno.',
];
const renglones = texto.split('\n').map((r) => r.trim());
const faltan = esperado.filter((e) => !renglones.includes(e));
revisar(!faltan.length, 'la historia de A1 dice exactamente lo que pasó, en orden' + (faltan.length ? ':\n  falta: ' + faltan.join('\n  falta: ') : ''));
const orden = esperado.map((e) => renglones.indexOf(e));
revisar(orden.every((n, i) => i === 0 || n > orden[i - 1]), 'y los renglones están en el orden en que pasaron');

// ---- Los defectos se avisan
const [b2] = contarHistoria(leer(historiaB2));
const avisos = b2.avisos.join('\n');
console.log('\n' + narrar([b2]));
revisar(/tiene comentarios .*AUD-01/.test(avisos), 'AUD-01: avisa el C++ con comentarios');
revisar(/hueco: 2 eventos se perdieron/.test(avisos), 'AUD-02: avisa el hueco de eventos perdidos');
revisar(/corrida 4: las fallas del cierre \(ninguna\) no son las que llegaron \(LED quemado \(led1\)\)/.test(avisos), 'AUD-03: avisa que el cierre de la corrida 4 no trae la falla que llegó');
revisar(/corrida 9 no empezó en esta sesión/.test(avisos), 'AUD-04: avisa la falla y el cierre de una corrida que no empezó en esta sesión');
revisar(/corrida 5 no tiene cierre/.test(avisos), 'avisa la corrida sin cierre');
revisar(/no tiene sesion_terminada/.test(avisos), 'avisa la sesión sin sesion_terminada');
revisar(/1 evento «algo_nuevo» \(editor\) que esta historia no interpreta/.test(avisos),
  'un tipo nuevo no rompe la historia: se avisa que no se interpreta (en el estudio la versión está congelada)');
// Después del hueco de AUD-02 ya no se sabe qué placa estaba elegida (pudo perderse un placa_cambiada): no se acusa uno
// que falta (A-03 de la auditoría de AUD-07/08). El aviso sin hueco lo prueba «placaPerdida», más abajo.
revisar(!/corrida 4 simula con uno, pero la placa elegida era nano/.test(avisos), 'después de un hueco no se acusa un placa_cambiada que falta');

// ---- El resumen y la integridad con registros incompletos o incoherentes (R1 y R2 de la verificación de Codex,
// 19 oct). Cada sesión se arma con el sobre real; las líneas sueltas cumplen el esquema, la secuencia no siempre.
let equipos = 0;
function sesionCon(pasos, { terminar = true } = {}) {
  registro.terminar(); // la sesión anterior que quedó abierta no entra en esta
  lineas.length = 0;
  reloj = INICIO + (++equipos + 2) * 3600 * 1000;
  registro.empezar(`R${equipos}`, { placa: 'uno', nivel: 1 });
  pasos();
  if (terminar) registro.terminar();
  else registro.registrar({ v: 1, t: reloj, origen: 'editor', tipo: 'ejemplo_cargado', datos: { id: 'eco' } }); // la app se cerró de golpe
  const [h] = contarHistoria(leer(lineas));
  return h;
}
const quemado = (n) => { pasar(1); sim('falla', n, 16, { tipo: 'led_quemado', componente: 'led1' }); };
const cerrar = (n, fallas) => { pasar(1); sim('simulacion_detenida', n, 1000, { ms_sim: 1000, fallas: fallas.map((tipo) => ({ tipo, componente: 'led1' })) }); };
const con = (h, texto) => h.avisos.some((a) => a.includes(texto));

const control = sesionCon(() => {
  iniciar(11, 'realista', [LED], [{}, {}]);
  pasar(1); sim('simulacion_pausada', 11, 500); pasar(1); sim('simulacion_reanudada', 11, 500);
  pasar(1); sim('reinicio_placa', 11, 600, { motivo: 'boton', nuevos: 1, total: 1 });
  quemado(11); cerrar(11, ['led_quemado']);
});
revisar(!control.avisos.length && control.resumen === '1 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: ninguna. Sin corregir: LED quemado (led1).',
  `control completo (pausa, reinicio, falla y cierre coherente): sin avisos y el resumen exacto («${control.resumen}»)`);

const sinCierre = sesionCon(() => { iniciar(12, 'realista', [LED], [{}, {}]); quemado(12); }, { terminar: false });
revisar(sinCierre.resumen === '1 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: no se puede asegurar, porque la corrida 12 quedó sin cierre. Sin corregir: al menos LED quemado (led1).' &&
  con(sinCierre, 'La corrida 12 no tiene cierre'), `R1, corrida sin cierre con una falla: el resumen la conserva y no afirma nada al final («${sinCierre.resumen}»)`);

const cierrePerdio = sesionCon(() => { iniciar(13, 'realista', [LED], [{}, {}]); quemado(13); cerrar(13, []); });
revisar(cierrePerdio.resumen === '1 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: no se puede asegurar, porque la corrida 13 tiene un cierre que no coincide con las fallas que llegaron. Sin corregir: al menos LED quemado (led1).' &&
  con(cierrePerdio, 'La corrida 13: las fallas del cierre (ninguna) no son las que llegaron (LED quemado (led1))'),
`R1, el cierre perdió la falla (AUD-03): el resumen la conserva y avisa la diferencia («${cierrePerdio.resumen}»)`);

const despues = sesionCon(() => { iniciar(14, 'realista', [LED], [{}, {}]); cerrar(14, []); quemado(14); });
revisar(con(despues, 'La corrida 14 tiene eventos después de su cierre (falla)') && con(despues, 'La corrida 14: las fallas del cierre (ninguna) no son las que llegaron (LED quemado (led1))') &&
  despues.resumen.startsWith('1 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: no se puede asegurar'),
`R2, una falla después del cierre: se avisa el orden y la diferencia, y el resumen la conserva (${despues.avisos.length} avisos)`);

const vuelve = sesionCon(() => {
  iniciar(15, 'realista', [LED], [{}, {}]); quemado(15); cerrar(15, ['led_quemado']);
  iniciar(16, 'realista', [LED, R1], [{}, {}, {}]); cerrar(16, []);
  iniciar(17, 'realista', [LED], [{}, {}]); quemado(17);
}, { terminar: false });
revisar(vuelve.corridas[1].corrigio.map((f) => f.tipo).join() === 'led_quemado' &&
  vuelve.resumen === '3 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: no se puede asegurar, porque la corrida 17 quedó sin cierre. Sin corregir: al menos LED quemado (led1).',
`R1, la falla vuelve en la última corrida, sin cierre: la 16 corrigió, pero el final no se da por corregido («${vuelve.resumen}»)`);

const trasIncompleta = sesionCon(() => {
  iniciar(18, 'realista', [LED], [{}, {}]); quemado(18);
  iniciar(19, 'realista', [LED, R1], [{}, {}, {}]); cerrar(19, []);
});
// Desde CLA-009: la 19 empezó con la 18 abierta, y la 18 nunca se cerró; no se sabe si se cruzaron, así que tampoco
// se asegura el final (límite que Codex dejó en observación)
revisar(trasIncompleta.corridas[1].corrigio === null && narrar([trasIncompleta]).includes('No se compara con la corrida 18: esta corrida empezó antes de que la corrida 18 se cerrara, y esa nunca se cerró.') &&
  trasIncompleta.resumen === '2 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: no se puede asegurar, porque la corrida 19 empezó antes de que la corrida 18 se cerrara, y esa nunca se cerró. Sin corregir: no se puede asegurar.' && con(trasIncompleta, 'La corrida 18 no tiene cierre'),
`una corrida después de otra sin cierre no se compara con ella, y el resumen tampoco da por corregida su falla (INT-RES-01) («${trasIncompleta.resumen}»)`);

// ---- R1a y R1b (segunda verificación de Codex, 19 oct): una falla tardía cambia lo que se puede comparar, y las
// fallas de una corrida sin inicio en la sesión no se pierden, pero quedan sin atribuir
const pasoDe = (h, n) => ([...h.pasos].reverse().find((p) => p.corrida === n && p.texto.startsWith('■')) || {}).texto || ''; // el último cierre, con el resumen
const dosCoherentes = sesionCon(() => {
  iniciar(20, 'realista', [LED], [{}, {}]); quemado(20); cerrar(20, ['led_quemado']);
  iniciar(21, 'realista', [LED, R1], [{}, {}, {}]); cerrar(21, []);
});
revisar(!dosCoherentes.avisos.length && dosCoherentes.corridas[1].corrigio.map((f) => f.tipo).join() === 'led_quemado' &&
  pasoDe(dosCoherentes, 21).endsWith('Sin fallas. Corrigió: LED quemado (led1).'), `control, dos corridas coherentes: la segunda corrigió el LED («${pasoDe(dosCoherentes, 21)}»)`);

const tardiaSegunda = sesionCon(() => {
  iniciar(22, 'realista', [LED], [{}, {}]); quemado(22); cerrar(22, ['led_quemado']);
  iniciar(23, 'realista', [LED, R1], [{}, {}, {}]); cerrar(23, []); quemado(23);
});
const c23 = tardiaSegunda.corridas[1];
revisar(c23.corrigio === null && !c23.coherente && c23.fallas.map((f) => f.tipo).join() === 'led_quemado' && !pasoDe(tardiaSegunda, 23).includes('Corrigió') &&
  pasoDe(tardiaSegunda, 23).endsWith('El cierre dice: ninguna; llegaron: LED quemado (led1). No se compara con la corrida 22: el cierre de esta corrida no coincide con las fallas que llegaron.'),
`R1a, falla tardía en la segunda corrida: ni el paso ni los datos dicen que corrigió («${pasoDe(tardiaSegunda, 23)}»)`);

const tardiaPrimera = sesionCon(() => {
  iniciar(24, 'realista', [LED], [{}, {}]); quemado(24); cerrar(24, ['led_quemado']);
  iniciar(25, 'realista', [LED, R1], [{}, {}, {}]);
  pasar(1); sim('falla', 24, 20, { tipo: 'corriente_pin', componente: 'placa' }); // llega tarde a la corrida anterior
  cerrar(25, []);
});
revisar(tardiaPrimera.corridas[1].corrigio === null && pasoDe(tardiaPrimera, 25).endsWith('No se compara con la corrida 24: su cierre no coincide con las fallas que llegaron.') &&
  con(tardiaPrimera, 'La corrida 24 tiene eventos después de su cierre (falla)'),
`R1a, falla tardía en la corrida anterior: la siguiente no se compara con ella («${pasoDe(tardiaPrimera, 25)}»)`);

const sinInicio = sesionCon(() => {
  pasar(1); sim('falla', 30, 16, { tipo: 'led_quemado', componente: 'led1' });
  pasar(1); sim('simulacion_detenida', 31, 900, { ms_sim: 900, fallas: [{ tipo: 'corriente_pin', componente: 'placa' }] });
});
revisar(sinInicio.resumen === '0 corrida(s). Fallas vistas: LED quemado (led1) [sin atribuir: corrida 30], corriente del pin (placa) [sin atribuir: corrida 31].' &&
  sinInicio.sinAtribuir.length === 2 && con(sinInicio, 'La corrida 30 no empezó en esta sesión') && con(sinInicio, 'La corrida 31 no empezó en esta sesión'),
`R1b, una falla y un cierre de corridas sin inicio: se conservan sin atribuir («${sinInicio.resumen}»)`);

const conHuerfana = sesionCon(() => {
  iniciar(32, 'realista', [LED, R1], [{}, {}, {}]); cerrar(32, []);
  pasar(1); sim('falla', 33, 16, { tipo: 'led_quemado', componente: 'led1' });
});
revisar(conHuerfana.resumen === '1 corrida(s). Fallas vistas: LED quemado (led1) [sin atribuir: corrida 33]. Corregidas al final: no se puede asegurar, porque llegaron fallas de una corrida que no empezó en esta sesión. Sin corregir: no se puede asegurar.',
  `R1b, con una corrida propia sin fallas y una falla sin atribuir: no se afirma el final («${conHuerfana.resumen}»)`);

// ---- R1c (tercera verificación de Codex, 19 oct): un segundo cierre no borra lo que dijo el primero
const unico = sesionCon(() => { iniciar(40, 'realista', [LED], [{}, {}]); cerrar(40, ['led_quemado']); });
revisar(unico.corridas[0].fallas.map((f) => f.tipo).join() === 'led_quemado' && unico.resumen.startsWith('1 corrida(s). Fallas vistas: LED quemado (led1).'),
  `control, un solo cierre con la falla y sin evento suelto: la falla se conserva («${unico.resumen}»)`);

const dosCierres = sesionCon(() => { iniciar(41, 'realista', [LED], [{}, {}]); cerrar(41, ['led_quemado']); cerrar(41, []); });
const c41 = dosCierres.corridas[0];
revisar(c41.fallas.map((f) => f.tipo).join() === 'led_quemado' && !c41.coherente && c41.cierres.length === 2 &&
  con(dosCierres, 'La corrida 41 tiene cierres que no coinciden entre sí (LED quemado (led1) | ninguna)') &&
  dosCierres.resumen === '1 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: no se puede asegurar, porque la corrida 41 tiene cierres que no coinciden entre sí. Sin corregir: al menos LED quemado (led1).' &&
  dosCierres.pasos.some((p) => p.texto === '■ Corrida 41, cierre 1 de 2: LED quemado (led1).') &&
  pasoDe(dosCierres, 41).endsWith('Los cierres dicen: LED quemado (led1) | ninguna; llegaron: ninguna.'),
`R1c, dos cierres contradictorios: el segundo no borra la falla del primero ni da la corrida por coherente («${dosCierres.resumen}»)`);

const dosCierresSinInicio = sesionCon(() => {
  pasar(1); sim('simulacion_detenida', 42, 900, { ms_sim: 900, fallas: [{ tipo: 'led_quemado', componente: 'led1' }] });
  pasar(1); sim('simulacion_detenida', 42, 900, { ms_sim: 900, fallas: [] });
});
revisar(dosCierresSinInicio.resumen === '0 corrida(s). Fallas vistas: LED quemado (led1) [sin atribuir: corrida 42].',
  `R1c sin inicio: los dos cierres de la corrida 42 conservan la falla sin atribuir («${dosCierresSinInicio.resumen}»)`);

const repetido = sesionCon(() => {
  iniciar(43, 'realista', [LED], [{}, {}]); quemado(43); cerrar(43, ['led_quemado']); cerrar(43, ['led_quemado']);
  iniciar(44, 'realista', [LED, R1], [{}, {}, {}]); cerrar(44, []);
});
revisar(repetido.corridas[0].coherente && repetido.corridas[1].corrigio.map((f) => f.tipo).join() === 'led_quemado' &&
  con(repetido, 'La corrida 43 se cierra dos veces') && pasoDe(repetido, 44).endsWith('Corrigió: LED quemado (led1).'),
`control, cierre repetido idéntico: se avisa, pero la corrida sigue coherente y la comparación siguiente vale («${pasoDe(repetido, 44)}»)`);

// ---- La prueba humana de Efraín (20 oct): cambió la placa sin que el registro lo dijera, un cambio de valor del
// programa no se veía y los bloques y el circuito traían pasos de más. Se cuenta la misma sesión, ya con placa_cambiada.
const PARPADEO = (ms) => `\n\n#define LedRojo 13\n\nvoid setup() {\n  pinMode(LedRojo, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LedRojo, HIGH);\n  delay(${ms});\n  digitalWrite(LedRojo, LOW);\n  delay(${ms});\n}\n`;
const OCHO = { bloques: 8, tipos: { programa: 1, pin_nombre: 1, escribir_digital: 2, esperar: 2, math_number: 2 } };
const humana = sesionCon(() => {
  pasar(1); registro.editor('bloques_cambiados', { bloques: 1, tipos: { programa: 1 } });
  pasar(5); registro.editor('bloques_cambiados', { bloques: 1, tipos: { programa: 1 } });
  pasar(5); registro.editor('bloques_cambiados', OCHO);
  pasar(10); registro.editor('placa_cambiada', { de: 'uno', a: 'nano' });
  pasar(10);
  circuito('componente_agregado', { id: 'r1', tipo: 'resistencia' });
  circuito('componente_cambiado', { id: 'r1', x: 10, y: 0, en: null });
  circuito('componente_cambiado', { id: 'r1', rot: 90, en: null });
  circuito('componente_cambiado', { id: 'r1', x: 12, y: 3, en: { 2: 'placa.GND1' } });
  circuito('componente_agregado', { id: 'r2', tipo: 'resistencia' }); // la agrega y la quita: no cuenta
  circuito('componente_cambiado', { id: 'r2', props: { ohmios: 10 } });
  circuito('componente_quitado', { id: 'r2', tipo: 'resistencia' });
  circuito('cable_agregado', { de: 'placa.D12', a: 'r1.1' }); // lo pone y lo quita: no cuenta
  circuito('cable_quitado', { de: 'placa.D12', a: 'r1.1' });
  circuito('cable_agregado', { de: 'placa.D13', a: 'r1.1' });
  pasar(10); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 924, codigo: PARPADEO(500) });
  pasar(1); iniciar(50, 'realista', [R1], [{}], 'nano'); cerrar(50, []);
  pasar(10); registro.editor('bloques_cambiados', OCHO);
  pasar(5); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 922, codigo: PARPADEO(200) });
  pasar(1); iniciar(51, 'realista', [R1], [{}], 'nano'); cerrar(51, []);
  pasar(5); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 922, codigo: PARPADEO(200) });
  pasar(5); registro.editor('bloques_cambiados', { bloques: 1, tipos: { programa: 1 } });
  pasar(5); circuito('componente_agregado', { id: 'r3', tipo: 'resistencia' }); circuito('componente_quitado', { id: 'r3', tipo: 'resistencia' });
});
const textosHumana = humana.pasos.map((p) => p.texto);
const esperadoHumana = [
  'Empezó la sesión (uno, nivel 1).',
  'Bloques: 8 (5 tipos).',
  'Cambió la placa: uno → nano.',
  'Circuito: agregó r1 (resistencia); cambió r1: giro 90°, enchufado en 2→placa.GND1; conectó placa.D13 → r1.1; movió r1.',
  'Compiló: bien, 924 bytes.',
  '▶ Corrida 50 (nano, realista; 1 pieza, 1 cable).',
  '■ Corrida 50 terminó: 1,0 s simulados. Sin fallas.',
  'Bloques: cambió algo dentro de los mismos 8 (misma cantidad y mismos tipos).',
  'Compiló: bien, 922 bytes. Programa: `delay(500);` → `delay(200);` (2 veces).',
  '▶ Corrida 51 (nano, realista; 1 pieza, 1 cable).',
  '■ Corrida 51 terminó: 1,0 s simulados. Sin fallas.',
  'Compiló: bien, 922 bytes (el mismo programa).',
  'Bloques: 8 (5 tipos) → 1 (1 tipo).',
  'Circuito: hizo cambios y los deshizo.',
];
const sesionHumana = textosHumana.filter((t) => !t.startsWith('Terminó la sesión'));
revisar(JSON.stringify(sesionHumana) === JSON.stringify(esperadoHumana) && !humana.avisos.length && humana.placas.join() === 'uno,nano' &&
  narrar([humana]).split('\n')[0].includes(' · uno → nano, nivel 1 · '),
`la prueba de Efraín, con placa_cambiada: la placa, el programa, los bloques y el circuito sin pasos de más, y sin avisos` +
  (JSON.stringify(sesionHumana) === JSON.stringify(esperadoHumana) ? '' : ':\n  ' + sesionHumana.join('\n  ')) + (humana.avisos.length ? '\n  ⚠ ' + humana.avisos.join('\n  ⚠ ') : ''));

const placaPerdida = sesionCon(() => {
  iniciar(52, 'realista', [LED], [{}, {}], 'nano'); cerrar(52, []); // sin placa_cambiada: como el registro del 20 oct
  iniciar(53, 'realista', [LED], [{}, {}], 'nano'); cerrar(53, []); // ya se avisó: la corrida adopta la placa
  pasar(1); registro.editor('placa_cambiada', { de: 'uno', a: 'nano' }); // dice venir de una placa que no era la elegida
});
revisar(con(placaPerdida, 'La corrida 52 simula con nano, pero la placa elegida era uno: falta un placa_cambiada.') &&
  con(placaPerdida, 'placa_cambiada dice que la placa era uno, pero la elegida era nano.') && placaPerdida.avisos.length === 2 && placaPerdida.placas.join() === 'uno,nano',
`sin placa_cambiada, la corrida avisa una vez la placa distinta; un placa_cambiada que no cuadra también se avisa (${placaPerdida.avisos.length} avisos)`);

// ---- R3 y R4 (verificación de Codex, 20 oct). R3: el lienzo da el primer id libre, así que una resistencia nueva
// después de quitar r1 también es r1; no debe heredar nada de la quitada ni esconder que se quitó. R4: dentro de un
// literal los espacios y las líneas vacías son datos; fuera de ellos, no.
const tramoCircuito = (...evs) => { const h = sesionCon(() => { pasar(1); for (const [tipo, datos] of evs) circuito(tipo, datos); }); return (h.pasos.find((p) => p.texto.startsWith('Circuito:')) || {}).texto; };
const altaR1 = ['componente_agregado', { id: 'r1', tipo: 'resistencia' }];
const bajaR1 = ['componente_quitado', { id: 'r1', tipo: 'resistencia' }];
const valorR1 = (ohmios) => ['componente_cambiado', { id: 'r1', props: { ohmios } }];
const casosR3 = [
  ['control, agrega y quita una pieza nueva', [altaR1, bajaR1], 'Circuito: hizo cambios y los deshizo.'],
  ['control, quita la pieza que estaba', [bajaR1], 'Circuito: quitó r1 (resistencia).'],
  ['control, varios valores de la misma pieza: queda el último', [valorR1(1000), valorR1(330)], 'Circuito: cambió r1: ohmios 330.'],
  ['R3, quita la que estaba, agrega otra r1 y la quita: no se esconde la baja', [bajaR1, altaR1, bajaR1], 'Circuito: quitó r1 (resistencia).'],
  ['R3, 1000 Ω, la quita y agrega otra: la nueva no hereda el valor', [valorR1(1000), bajaR1, altaR1], 'Circuito: quitó r1 (resistencia); agregó otra r1 (resistencia).'],
  ['R3, la nueva r1 cuenta solo sus cambios', [['componente_cambiado', { id: 'r1', rot: 90, en: { 1: 'placa.D13' } }], bajaR1, altaR1, valorR1(330)],
    'Circuito: quitó r1 (resistencia); agregó otra r1 (resistencia); cambió r1: ohmios 330.'],
];
for (const [nombre, evs, esperado] of casosR3) {
  const texto = tramoCircuito(...evs);
  revisar(texto === esperado, `${nombre} («${texto}»)`);
}

const programa = (...codigos) => {
  const h = sesionCon(() => { for (const codigo of codigos) { pasar(1); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 100, codigo: quitarComentarios(codigo) }); } });
  return h.pasos.filter((p) => p.texto.startsWith('Compiló'))[codigos.length - 1].texto;
};
const crudo = (contenido) => `const char *texto = R"marca(\n${contenido}\n)marca";\nvoid setup() {}\nvoid loop() {}\n`;
const largo = (ms) => `void loop() { digitalWrite(LED_BUILTIN, HIGH); Serial.println("una línea larga del programa"); delay(${ms}); }\n`;
// «El mismo programa» solo si el C++ registrado es idéntico (decisión de Efraín, 20 oct): así R4, R4a, R4b e INT-08 no
// dependen de entender C++. Si solo cambian espacios o saltos, se dice eso; nunca que el programa es el mismo.
const SOLO_ESPACIOS = 'Compiló: bien, 100 bytes. Programa: cambió solo en espacios o saltos de línea.';
const empalme = (relleno, salto, siguiente) => `const char *t = "A\\${relleno}${salto}${siguiente}B";${salto}void loop() {}${salto}`;
const casosR4 = [
  ['control, el mismo programa', ['void loop() {}\n', 'void loop() {}\n'], 'Compiló: bien, 100 bytes (el mismo programa).'],
  ['control, el mismo programa con una cadena empalmada larga', [empalme(' '.repeat(120), '\r\n', ' '), empalme(' '.repeat(120), '\r\n', ' ')], 'Compiló: bien, 100 bytes (el mismo programa).'],
  ['otra sangría y líneas vacías: no es «el mismo programa», cambió solo en espacios', ['void loop() {\n delay(500);\n}\n', '\nvoid loop() {\n\n    delay(500);   \n}\n'], SOLO_ESPACIOS],
  ['control, delay(500) → delay(200)', ['void loop() { delay(500); }\n', 'void loop() { delay(200); }\n'], 'Compiló: bien, 100 bytes. Programa: `void loop() { delay(500); }` → `void loop() { delay(200); }`.'],
  ['R4, espacios dentro de un raw', [crudo(' A '), crudo('A')], SOLO_ESPACIOS],
  ['R4, una línea vacía dentro de un raw', [crudo('A\n\nB'), crudo('A\nB')], SOLO_ESPACIOS],
  ['R4, un salto dentro de un raw frente al texto «\\n»', [crudo('A\nB'), crudo('A\\nB')], null],
  ['R4, espacios dentro de una cadena', ['const char *s = "x  y";\n', 'const char *s = "x y";\n'], SOLO_ESPACIOS],
  ['R4a, cadena empalmada con LF', [empalme('', '\n', ' '), empalme('', '\n', '')], SOLO_ESPACIOS],
  ['R4a, cadena empalmada con CRLF y espacio', [empalme('', '\r\n', ' '), empalme('', '\r\n', '')], SOLO_ESPACIOS],
  ['R4a, cadena empalmada con CRLF y tabulador', [empalme('', '\r\n', '\t'), empalme('', '\r\n', '')], SOLO_ESPACIOS],
  // R4b: ningún límite de lectura: LF con 98 y 99 espacios, CRLF con 97, 98 y 120, y 98 tabuladores
  ...[['\n', ' ', 98], ['\n', ' ', 99], ['\r\n', ' ', 97], ['\r\n', ' ', 98], ['\r\n', ' ', 120], ['\r\n', '\t', 98]].map(([salto, c, n]) =>
    [`R4b, empalme con ${n} ${c === ' ' ? 'espacios' : 'tabuladores'} y ${salto === '\n' ? 'LF' : 'CRLF'}`, [empalme(c.repeat(n), salto, ' '), empalme(c.repeat(n), salto, '')], SOLO_ESPACIOS]),
  // INT-08: el prefijo de un raw empalmado y los CR de las directivas tampoco dan «el mismo programa»
  ['INT-08, raw con el prefijo R empalmado', ['const char *t = R\\\n"x( A )x";\n', 'const char *t = R\\\n"x(A)x";\n'], null],
  ['INT-08, raw con el prefijo u8R empalmado', ['const char *t = u8R\\\n"x( A )x";\n', 'const char *t = u8R\\\n"x(A)x";\n'], null],
  ['INT-08, CR de una directiva frente a un espacio', ['#define A 1\r#define B 2\nvoid loop() {}\n', '#define A 1 #define B 2\nvoid loop() {}\n'], SOLO_ESPACIOS],
  ['INT-08, un programa con error (cadena sin cerrar)', ['void loop() { Serial.print("hola); }\n', 'void loop() { Serial.print("hola ); }\n'], null],
  ['una línea larga se muestra alrededor de lo que cambió', [largo(500), largo(200)], 'Compiló: bien, 100 bytes. Programa: `…grama"); delay(500); }` → `…grama"); delay(200); }`.'],
];
for (const [nombre, codigos, esperado] of casosR4) {
  const texto = programa(...codigos);
  revisar(esperado === null ? !texto.includes('(el mismo programa)') && texto.includes('Programa:') : texto === esperado, `${nombre} («${texto.length > 160 ? texto.slice(0, 160) + '…' : texto}»)`);
}
// INT-09: varias líneas largas seguidas que cambian: cada par se muestra alrededor de su cambio; nunca «X → X»
const larga = (n, x) => `Serial.println("una línea muy larga del programa que no cabe entera en la historia ${n}"); int v${n} = ${x};\n`;
const adyacentes = programa(larga(1, 10) + larga(2, 20), larga(1, 11) + larga(2, 21));
const pares = [...adyacentes.matchAll(/`([^`]*)` → `([^`]*)`/g)];
revisar(pares.length === 2 && pares.every(([, x, y]) => x !== y), `INT-09, dos líneas largas seguidas cambian: cada par muestra su diferencia («${adyacentes}»)`);
const cuatro = programa([1, 2, 3, 4].map((n) => larga(n, 1)).join(''), [1, 2, 3, 4].map((n) => larga(n, 2)).join(''));
revisar(/cambió un tramo de 4 líneas \(el detalle no cabe\)/.test(cuatro) && !/(`[^`]*`) → \1/.test(cuatro), `INT-09, cuatro líneas: si el detalle no cabe, lo dice («${cuatro}»)`);

// ---- INT-01 (auditoría integral, 20 oct): «corrigió» solo entre corridas comparables. Si cambió el modo, lo que se
// revisa, la placa o la pieza ya no está, la falla «ya no se observó», con su motivo.
const SIN_DANO = { danoComponentes: false, limitePin: true };
const casosINT01 = [
  ['realista → ideal, el mismo circuito', () => iniciar(61, 'ideal', [LED], [{}, {}]), 'cambió el modo: realista → ideal'],
  ['se apagó danoComponentes', () => iniciar(61, 'realista', [LED], [{}, {}], 'uno', SIN_DANO), 'cambió lo que se revisa: danoComponentes apagada'],
  ['se quitó la pieza', () => iniciar(61, 'realista', [R1], [{}]), 'quitó led1'],
  ['otra placa', () => iniciar(61, 'realista', [LED], [{}, {}], 'nano'), 'cambió la placa: uno → nano'],
];
for (const [nombre, segunda, motivo] of casosINT01) {
  const h = sesionCon(() => {
    iniciar(60, 'realista', [LED], [{}, {}]); quemado(60); cerrar(60, ['led_quemado']);
    if (nombre === 'otra placa') { pasar(1); registro.editor('placa_cambiada', { de: 'uno', a: 'nano' }); }
    segunda(); cerrar(61, []);
  });
  const c = h.corridas[1];
  revisar(c.corrigio.length === 0 && c.yaNoSeObservo.length === 1 && c.yaNoSeObservo[0].motivo === motivo &&
    pasoDe(h, 61).endsWith(`Sin fallas. Ya no se observó: LED quemado (led1) (${motivo}).`) &&
    h.resumen.includes(`Corregidas al final: ninguna. Ya no se observaron al final: LED quemado (led1) (${motivo}).`),
  `INT-01, ${nombre}: no «corrigió», «ya no se observó» (${motivo}) («${h.resumen}»)`);
}

// Prueba final de Efraín (20 oct): corrigió en una corrida comparable y después cambió la placa. La corrección vale
// al final; la última corrida, en otra placa, no la borra.
const corrigioYCambio = sesionCon(() => {
  iniciar(64, 'realista', [LED], [{}, {}]); quemado(64); cerrar(64, ['led_quemado']);
  iniciar(65, 'realista', [LED, R1], [{}, {}, {}]); cerrar(65, []);
  pasar(1); registro.editor('placa_cambiada', { de: 'uno', a: 'nano' });
  iniciar(66, 'realista', [LED, R1], [{}, {}, {}], 'nano'); cerrar(66, []);
});
revisar(corrigioYCambio.corridas[1].corrigio.map((f) => f.tipo).join() === 'led_quemado' &&
  corrigioYCambio.resumen === '3 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: LED quemado (led1). Sin corregir: ninguna.',
`corrigió en una corrida comparable y después cambió la placa: sigue corregida al final («${corrigioYCambio.resumen}»)`);

// ---- INT-02: un hueco impide comparar a través de él y afirmar el final; un hueco antes de todo, no
const conHueco = (antes) => sesionCon(() => {
  if (antes) { pasar(1); registro.editor('registro_interrumpido', { desde: reloj - 1000, hasta: reloj, recuperados: 1, perdidos: 1, motivo: 'ENOSPC' }); pasar(5); }
  iniciar(62, 'realista', [LED], [{}, {}]); quemado(62); cerrar(62, ['led_quemado']);
  if (!antes) { pasar(1); registro.editor('registro_interrumpido', { desde: reloj - 1000, hasta: reloj + 2000, recuperados: 2, perdidos: 1, motivo: 'ENOSPC' }); }
  iniciar(63, 'realista', [LED, R1], [{}, {}, {}]); cerrar(63, []);
});
const huecoEntre = conHueco(false);
revisar(huecoEntre.corridas[1].corrigio === null && pasoDe(huecoEntre, 63).endsWith('No se compara con la corrida 62: hay un hueco en el registro entre las dos.') &&
  huecoEntre.resumen.includes('No se puede asegurar: LED quemado (led1) (hay un hueco en el registro después de verla).') && !huecoEntre.resumen.includes('Corregidas al final: LED quemado'),
`INT-02, un hueco entre dos corridas: no se comparan ni se afirma la corrección («${huecoEntre.resumen}»)`);
const huecoAntes = conHueco(true);
revisar(huecoAntes.corridas[1].corrigio.map((f) => f.tipo).join() === 'led_quemado' && huecoAntes.resumen.includes('Corregidas al final: LED quemado (led1).'),
  `control, un hueco antes de las corridas no impide compararlas («${huecoAntes.resumen}»)`);

// ---- INT-03: un mismo código de sesión con líneas de otro equipo: se cuentan aparte y no se asegura el final
const propias = (() => { sesionCon(() => { iniciar(70, 'realista', [LED], [{}, {}]); quemado(70); cerrar(70, ['led_quemado']); }); return lineas.slice(); })();
const sesionPropia = JSON.parse(propias[0]).sesion;
const deOtro = [
  { v: 1, t: reloj, origen: 'simulador', tipo: 'simulacion_iniciada', corrida: 71, ms_sim: 0, datos: JSON.parse(propias.find((l) => l.includes('simulacion_iniciada'))).datos },
  { v: 1, t: reloj + 1, origen: 'simulador', tipo: 'simulacion_detenida', corrida: 71, ms_sim: 900, datos: { ms_sim: 900, fallas: [] } },
].map((ev) => ({ ...ev, equipo: 'OTRO', sesion: sesionPropia, version_tb: '0.3.0', version_tc: '0.1.0' }));
const mezcla = contarHistoria([...leer(propias), ...deOtro.map((ev, i) => ({ archivo: 'otro.jsonl', linea: i + 1, ev }))]);
const laPropia = mezcla.find((h) => h.equipo !== 'OTRO');
revisar(mezcla.length === 2 && laPropia.corridas.length === 1 && laPropia.resumen.includes('no se puede asegurar, porque la sesión') &&
  con(laPropia, 'también tiene líneas del equipo OTRO'), `INT-03, otro equipo con la misma sesión: se cuenta aparte y no le da una corrección («${laPropia.resumen}»)`);

// ---- INT-04: una línea inválida se aparta con su motivo y deja un hueco; nada se inventa y lo demás sigue
const validas = (() => { sesionCon(() => { iniciar(80, 'realista', [LED], [{}, {}]); quemado(80); cerrar(80, ['led_quemado']); iniciar(81, 'realista', [LED, R1], [{}, {}, {}]); cerrar(81, []); }); return lineas.slice(); })();
const base80 = JSON.parse(validas[0]);
const malas = [
  ['«datos» null', { ...base80, tipo: 'bloques_cambiados', datos: null }, '«datos» no es un objeto'],
  ['sin la hora', (() => { const e = { ...base80, tipo: 'ejemplo_cargado', datos: { id: 'x' } }; delete e.t; return e; })(), 'le falta la hora («t»)'],
  ['la hora como texto', { ...base80, t: 'ayer', tipo: 'ejemplo_cargado', datos: { id: 'x' } }, 'le falta la hora («t»)'],
  ['versión 2', { ...base80, v: 2, tipo: 'ejemplo_cargado', datos: { id: 'x' } }, 'es de la versión 2 del registro y esta historia lee la 1'],
];
for (const [nombre, mala, motivo] of malas) {
  const ls = leer(validas);
  ls.splice(5, 0, { archivo: 'prueba.jsonl', linea: 99, ev: mala });
  let h;
  try { [h] = contarHistoria(ls); } catch (e) { h = null; }
  revisar(h && con(h, `Se apartó una línea (prueba.jsonl, línea 99): ${motivo}.`) && h.corridas.length === 2 && h.corridas[1].corrigio === null &&
    !h.pasos.some((p) => !Number.isFinite(p.t)), `INT-04, ${nombre}: se aparta con su motivo, sin romper ni inventar, y deja un hueco${h ? ` («${pasoDe(h, 81)}»)` : ''}`);
}
const sesionRota = contarHistoria([...leer(validas), { archivo: 'otra.jsonl', linea: 1, ev: { ...base80, sesion: { no: 'es texto' } } }]);
revisar(sesionRota.length === 2 && sesionRota.some((h) => h.corridas.length === 2 && !h.avisos.length),
  'INT-04, una sesión inválida no tumba la válida del mismo lote');

// ---- INT-05: el ciclo de vida
const sinInicioSesion = contarHistoria(leer(validas.slice(1)))[0];
revisar(con(sinInicioSesion, 'La sesión no tiene sesion_iniciada') && sinInicioSesion.resumen.includes('no se puede asegurar, porque la sesión no tiene sesion_iniciada'),
  `INT-05, sin sesion_iniciada: se avisa y no se asegura el final («${sinInicioSesion.resumen}»)`);
const dobleInicio = contarHistoria(leer([validas[0], ...validas]))[0];
revisar(con(dobleInicio, 'La sesión empieza dos veces') && dobleInicio.resumen.includes('no se puede asegurar'), 'INT-05, sesion_iniciada repetido: se avisa y no se asegura el final');
const inicioRepetido = sesionCon(() => {
  iniciar(82, 'realista', [LED], [{}, {}]); quemado(82);
  iniciar(82, 'realista', [LED, R1], [{}, {}, {}]); cerrar(82, ['led_quemado']);
  iniciar(83, 'realista', [LED, R1], [{}, {}, {}]); cerrar(83, []);
});
revisar(inicioRepetido.corridas.length === 2 && con(inicioRepetido, 'La corrida 82 empieza dos veces') && inicioRepetido.corridas[1].corrigio === null &&
  pasoDe(inicioRepetido, 83).endsWith('No se compara con la corrida 82: empieza dos veces.'), `INT-05, una corrida que empieza dos veces sigue siendo una y no se compara («${pasoDe(inicioRepetido, 83)}»)`);
const pausas = sesionCon(() => { iniciar(84, 'realista', [LED], [{}, {}]); pasar(1); sim('simulacion_reanudada', 84, 10); pasar(1); sim('simulacion_pausada', 84, 20); sim('simulacion_pausada', 84, 20); cerrar(84, []); });
revisar(con(pausas, 'La corrida 84 sigue sin haberse pausado') && con(pausas, 'La corrida 84 se pausa sin estar corriendo'), 'INT-05, reanudar sin pausa y pausar dos veces se avisan');

// ---- INT-10: un tipo nuevo del circuito no es «hizo cambios y los deshizo»; «__proto__» se cuenta como cualquier otro
const nuevos = sesionCon(() => { pasar(1); circuito('componente_soldado', { id: 'r1' }); registro.registrar({ v: 1, t: reloj, origen: 'editor', tipo: '__proto__', datos: {} }); });
revisar(!nuevos.pasos.some((p) => p.texto.includes('deshizo')) && con(nuevos, '«componente_soldado» (circuito)') && con(nuevos, '«__proto__» (editor)') && nuevos.resumen === '0 corrida(s). Fallas vistas: ninguna.',
  `INT-10, tipos nuevos: no se inventa un efecto, se avisan y no cambian lo demás (${nuevos.avisos.join(' | ')})`);

// ---- INT-11: lo que se contradice dentro de una corrida, el tiempo del cierre y el reloj
const contradice = sesionCon(() => {
  iniciar(85, 'realista', [LED], [{}, {}]); quemado(85); cerrar(85, ['led_quemado']);
  sim('simulacion_iniciada', 86, 0, { placa: 'nano', modo: 'realista', activas: { danoComponentes: true, limitePin: true }, circuito: { formato: 1, placa: 'uno', protoboard: null, componentes: [LED, R1], cables: [] } });
  cerrar(86, []);
});
revisar(con(contradice, 'La corrida 86 dice nano, pero su circuito dice uno') && contradice.corridas[1].corrigio === null, 'INT-11, la placa de la corrida y la de su circuito no coinciden: se avisa y no se compara');
const tarde = sesionCon(() => { iniciar(87, 'realista', [LED], [{}, {}]); pasar(1); sim('falla', 87, 5000, { tipo: 'led_quemado', componente: 'led1' }); cerrar(87, ['led_quemado']); });
revisar(con(tarde, 'La corrida 87 tiene una falla después del tiempo simulado de su cierre') && !tarde.corridas[0].coherente, 'INT-11, una falla después del tiempo simulado del cierre: se avisa');
const reloj0 = reloj;
const atras = sesionCon(() => { iniciar(88, 'realista', [LED], [{}, {}]); reloj -= 60000; cerrar(88, []); });
reloj = Math.max(reloj, reloj0);
revisar(con(atras, 'El reloj del computador retrocedió'), 'INT-11, el reloj retrocede: se avisa y se sigue el orden en que se escribió');

// ---- Un cierre que repite la misma falla es la misma falla (auditoría integral, «duplicados»)
const repiteFalla = sesionCon(() => { iniciar(89, 'realista', [LED], [{}, {}]); quemado(89); pasar(1); sim('simulacion_detenida', 89, 1000, { ms_sim: 1000, fallas: [{ tipo: 'led_quemado', componente: 'led1' }, { tipo: 'led_quemado', componente: 'led1' }] }); });
revisar(repiteFalla.corridas[0].coherente && !repiteFalla.avisos.length, 'un cierre con la misma falla dos veces sigue siendo coherente');

// ---- INT-RES-01 a 05 (verificación de Codex, 20 oct). Un solo criterio para los pasos y el resumen: el tramo desde la
// corrida que vio la falla hasta el final tiene que estar acreditado de punta a punta.
const CORREGIDA = 'Corregidas al final: LED quemado (led1). Sin corregir: ninguna.';
const conOrigen = (origen) => sesionCon(() => { origen(); iniciar(91, 'realista', [LED, R1], [{}, {}, {}]); cerrar(91, []); });
const origenes = [
  ['cierres contradictorios', () => { iniciar(90, 'realista', [LED], [{}, {}]); quemado(90); cerrar(90, ['led_quemado']); cerrar(90, []); }, 'la corrida 90 tiene cierres que no coinciden entre sí'],
  ['empieza dos veces', () => { iniciar(90, 'realista', [LED], [{}, {}]); quemado(90); iniciar(90, 'realista', [LED], [{}, {}]); cerrar(90, ['led_quemado']); }, 'la corrida 90 empieza dos veces'],
  ['falla después del tiempo del cierre', () => { iniciar(90, 'realista', [LED], [{}, {}]); pasar(1); sim('falla', 90, 5000, { tipo: 'led_quemado', componente: 'led1' }); cerrar(90, ['led_quemado']); }, 'la corrida 90 tiene una falla después del tiempo simulado de su cierre'],
  ['cierre sin la falla suelta', () => { iniciar(90, 'realista', [LED], [{}, {}]); cerrar(90, ['led_quemado']); }, 'la corrida 90 tiene un cierre que no coincide con las fallas que llegaron'],
  // la 91 empezó con la 90 abierta, y la 90 nunca se cerró: tampoco se asegura el final
  ['sin cierre', () => { iniciar(90, 'realista', [LED], [{}, {}]); quemado(90); }, null, 'Corregidas al final: no se puede asegurar, porque la corrida 91 empezó antes de que la corrida 90 se cerrara, y esa nunca se cerró.'],
];
for (const [nombre, origen, motivo, esperado = `No se puede asegurar: LED quemado (led1) (${motivo}).`] of origenes) {
  const h = conOrigen(origen);
  revisar(!h.resumen.includes(CORREGIDA) && h.resumen.includes(esperado),
    `INT-RES-01, la corrida que vio la falla ${nombre}: el resumen no la da por corregida («${h.resumen}»)`);
}
const comparableControl = conOrigen(() => { iniciar(90, 'realista', [LED], [{}, {}]); quemado(90); cerrar(90, ['led_quemado']); });
revisar(comparableControl.resumen.endsWith(CORREGIDA), `control, origen completo y coherente: corregida («${comparableControl.resumen}»)`);
const reaparece = sesionCon(() => { iniciar(90, 'realista', [LED], [{}, {}]); quemado(90); cerrar(90, ['led_quemado']); iniciar(91, 'realista', [LED, R1], [{}, {}, {}]); cerrar(91, []); iniciar(92, 'realista', [LED], [{}, {}]); quemado(92); cerrar(92, ['led_quemado']); });
revisar(reaparece.resumen.endsWith('Corregidas al final: ninguna. Sin corregir: LED quemado (led1).'), `control, la falla vuelve al final: sin corregir («${reaparece.resumen}»)`);

// INT-RES-02: un hueco después del último cierre (una línea apartada o eventos perdidos) también deja el final sin asegurar
const corregidaYDespues = (despues) => {
  const ls = (() => { sesionCon(() => { iniciar(93, 'realista', [LED], [{}, {}]); quemado(93); cerrar(93, ['led_quemado']); iniciar(94, 'realista', [LED, R1], [{}, {}, {}]); cerrar(94, []); despues(); }); return leer(lineas); })();
  return ls;
};
const malaV2 = (ev) => ({ archivo: 'prueba.jsonl', linea: 98, ev: { ...ev, v: 2, tipo: 'ejemplo_cargado', datos: { id: 'x' } } });
const tras = [
  ['una línea apartada después del último cierre', () => { const ls = corregidaYDespues(() => {}); ls.splice(ls.length - 1, 0, malaV2(ls[0].ev)); return ls; }],
  ['una línea apartada después del fin de la sesión', () => { const ls = corregidaYDespues(() => {}); ls.push(malaV2(ls[0].ev)); return ls; }],
  ['eventos perdidos después del último cierre', () => corregidaYDespues(() => { pasar(1); registro.editor('registro_interrumpido', { desde: reloj, hasta: reloj + 1000, recuperados: 0, perdidos: 2, motivo: 'ENOSPC' }); })],
];
for (const [nombre, armar] of tras) {
  const [h] = contarHistoria(armar());
  revisar(h.corridas[1].corrigio.map((f) => f.tipo).join() === 'led_quemado' && h.resumen.includes('No se puede asegurar: LED quemado (led1) (hay un hueco en el registro después de verla).'),
    `INT-RES-02, ${nombre}: la corrección de la corrida 94 se conserva, pero el final no se asegura («${h.resumen}»)`);
}

// INT-RES-03: corridas que se cruzan, una corrida después del fin, tiempos del cierre y pausas imposibles: no se comparan
const cruzadas = sesionCon(() => { iniciar(95, 'realista', [LED], [{}, {}]); quemado(95); iniciar(96, 'realista', [LED, R1], [{}, {}, {}]); cerrar(96, []); cerrar(95, ['led_quemado']); });
revisar(con(cruzadas, 'Las corridas 95 y 96 se cruzan') && cruzadas.corridas[1].corrigio === null && !cruzadas.resumen.includes(CORREGIDA),
  `INT-RES-03, corridas que se cruzan: se avisa, no se compara y no se da por corregida («${cruzadas.resumen}»)`);
const causales = [
  ['una corrida después del fin de la sesión', () => { iniciar(97, 'realista', [LED], [{}, {}]); quemado(97); cerrar(97, ['led_quemado']); registro.registrar({ v: 1, t: reloj, origen: 'editor', tipo: 'sesion_terminada', datos: { ms: 1 } }); iniciar(98, 'realista', [LED, R1], [{}, {}, {}]); cerrar(98, []); }, 'empezó después de terminar la sesión'],
  ['un cierre con dos tiempos', () => { iniciar(97, 'realista', [LED], [{}, {}]); quemado(97); cerrar(97, ['led_quemado']); iniciar(98, 'realista', [LED, R1], [{}, {}, {}]); pasar(1); sim('simulacion_detenida', 98, 2000, { ms_sim: 1000, fallas: [] }); }, 'su cierre dice dos tiempos simulados distintos'],
  ['reanudar sin pausa', () => { iniciar(97, 'realista', [LED], [{}, {}]); quemado(97); cerrar(97, ['led_quemado']); iniciar(98, 'realista', [LED, R1], [{}, {}, {}]); pasar(1); sim('simulacion_reanudada', 98, 10); cerrar(98, []); }, 'sigue sin haberse pausado'],
];
for (const [nombre, pasos, motivo] of causales) {
  const h = sesionCon(pasos);
  revisar(h.corridas[1].corrigio === null && h.corridas[1].contradicciones.includes(motivo) && !h.resumen.includes(CORREGIDA),
    `INT-RES-03, ${nombre}: es una contradicción de la corrida y no se compara («${pasoDe(h, 98)}»)`);
}
const seguidas = sesionCon(() => { iniciar(97, 'realista', [LED], [{}, {}]); quemado(97); pasar(1); sim('simulacion_pausada', 97, 10); pasar(1); sim('simulacion_reanudada', 97, 10); cerrar(97, ['led_quemado']); iniciar(98, 'realista', [LED, R1], [{}, {}, {}]); cerrar(98, []); });
revisar(!seguidas.avisos.length && seguidas.resumen.endsWith(CORREGIDA), 'control, corridas seguidas con una pausa normal: sin avisos y corregida');

// INT-RES-03a (verificación de Codex de CLA-009): cada repetición de una falla y cada cierre conservan su tiempo, y
// el último no borra una contradicción anterior. El reloj de la corrida vuelve a cero con el RESET del botón (no con
// un reinicio por energía): una falla de antes del RESET puede tener más tiempo que el cierre.
const fallaEn = (n, ms) => { pasar(1); sim('falla', n, ms, { tipo: 'led_quemado', componente: 'led1' }); };
const cierreEn = (n, ms, fallas = ['led_quemado']) => { pasar(1); sim('simulacion_detenida', n, ms, { ms_sim: ms, fallas: fallas.map((tipo) => ({ tipo, componente: 'led1' })) }); };
const reset = (n, ms, motivo = 'boton') => { pasar(1); sim('reinicio_placa', n, ms, { motivo, nuevos: 1, total: 1 }); };
const yLuegoLimpia = (pasos) => sesionCon(() => { iniciar(110, 'realista', [LED], [{}, {}]); pasos(); iniciar(111, 'realista', [LED, R1], [{}, {}, {}]); cerrar(111, []); });
const DESPUES_DEL_CIERRE = 'tiene una falla después del tiempo simulado de su cierre';
const casos03a = [
  ['la falla se repite con más tiempo que el cierre, antes de él', () => { fallaEn(110, 500); fallaEn(110, 1500); cierreEn(110, 1000); }, DESPUES_DEL_CIERRE, [500, 1500]],
  ['las mismas repeticiones en el otro orden', () => { fallaEn(110, 1500); fallaEn(110, 500); cierreEn(110, 1000); }, DESPUES_DEL_CIERRE, [1500, 500]],
  ['la repetición con más tiempo llega después del cierre', () => { fallaEn(110, 500); cierreEn(110, 1000); fallaEn(110, 1500); }, DESPUES_DEL_CIERRE, [500, 1500]],
  ['la misma falla, con el mismo tiempo, después del cierre', () => { fallaEn(110, 500); cierreEn(110, 1000); fallaEn(110, 500); }, 'tiene eventos después de su cierre', [500, 500]],
  ['un segundo cierre con más tiempo no esconde el primero', () => { fallaEn(110, 1500); cierreEn(110, 1000); cierreEn(110, 2000); }, DESPUES_DEL_CIERRE, [1500]],
  ['los dos cierres en el otro orden', () => { fallaEn(110, 1500); cierreEn(110, 2000); cierreEn(110, 1000); }, 'sus cierres dicen tiempos simulados distintos', [1500]],
  ['después de un RESET, una falla con más tiempo que el cierre', () => { reset(110, 300); fallaEn(110, 1500); cierreEn(110, 1000); }, DESPUES_DEL_CIERRE, [1500]],
  ['un reinicio por energía no pone el reloj en cero', () => { fallaEn(110, 1500); reset(110, 1600, 'energia_usb'); cierreEn(110, 1000); }, DESPUES_DEL_CIERRE, [1500]],
  ['una pausa con más tiempo que el cierre', () => { fallaEn(110, 500); pasar(1); sim('simulacion_pausada', 110, 1500); pasar(1); sim('simulacion_reanudada', 110, 1500); cierreEn(110, 1000); },
    'tiene una pausa o un reinicio después del tiempo simulado de su cierre', [500]],
];
for (const [nombre, pasos, motivo, tiempos] of casos03a) {
  const h = yLuegoLimpia(pasos);
  const c = h.corridas[0];
  revisar(c.contradicciones.includes(motivo) && !c.coherente && JSON.stringify((c.ocurrencias || []).map((o) => o.ms_sim)) === JSON.stringify(tiempos) &&
    h.corridas[1].corrigio === null && !h.resumen.includes(CORREGIDA) && h.resumen.includes('No se puede asegurar: LED quemado (led1) (la corrida 110 ') && h.avisos.length > 0,
  `INT-RES-03a, ${nombre}: «${motivo}», se guardan todos los tiempos y no se da por corregida («${pasoDe(h, 111)}»)`);
}
const dosCierresDistintos = yLuegoLimpia(() => { fallaEn(110, 1500); cierreEn(110, 1000); cierreEn(110, 2000); });
revisar(JSON.stringify((dosCierresDistintos.corridas[0].tiemposCierre || []).map((k) => k.ms_sim)) === '[1000,2000]' &&
  dosCierresDistintos.corridas[0].contradicciones.includes('sus cierres dicen tiempos simulados distintos') && !('tramo' in dosCierresDistintos.corridas[0]),
'INT-RES-03a, los datos conservan el tiempo de cada cierre');
const controles03a = [
  ['la misma falla dos veces con el mismo tiempo', () => { fallaEn(110, 500); fallaEn(110, 500); cierreEn(110, 1000); }],
  ['RESET con el botón: la falla de antes tiene más tiempo que el cierre', () => { fallaEn(110, 1500); reset(110, 1600); cierreEn(110, 1000); }],
  ['RESET con el botón y la falla después, dentro del tiempo del cierre', () => { fallaEn(110, 1500); reset(110, 1600); fallaEn(110, 400); cierreEn(110, 1000); }],
  // Como lo emite la app: RESET en pausa sale como reanudar y reiniciar, los dos con el tiempo de antes del RESET
  ['RESET en pausa', () => { fallaEn(110, 1500); pasar(1); sim('simulacion_pausada', 110, 1600); pasar(1); sim('simulacion_reanudada', 110, 1600); reset(110, 1600); fallaEn(110, 400); cierreEn(110, 1000); }],
];
for (const [nombre, pasos] of controles03a) {
  const h = yLuegoLimpia(pasos);
  revisar(h.corridas[0].coherente && !h.avisos.length && h.resumen.endsWith(CORREGIDA) && h.corridas[1].corrigio.length === 1,
    `control, ${nombre}: coherente, sin avisos y corregida («${pasoDe(h, 111)}»)`);
}

// INT-RES-03c (verificación de Codex de CLA-20261021-001): una foto de antes del RESET puede llegar después. Desde el
// 21 oct cada evento del simulador trae su `tramo` (contrato 6.1) y el lector lo usa en vez del orden de escritura.
const simT = (tipo, corrida, ms_sim, tramo, datos = {}) => { pasar(1); registro.registrar({ v: 1, t: reloj, origen: 'simulador', tipo, corrida, ms_sim, tramo, datos }); };
const ledT = { tipo: 'led_quemado', componente: 'led1' };
const resetT = (ms) => simT('reinicio_placa', 110, ms, 0, { motivo: 'boton', nuevos: 1, total: 1 });
const cierreT = (ms, tramo = 1) => simT('simulacion_detenida', 110, ms, tramo, { ms_sim: ms, fallas: [ledT] });
const casos03c = [
  ['la foto de antes del RESET llega después; cierre a 10 ms del reloj nuevo', () => { iniciar(110, 'realista', [LED], [{}, {}]); resetT(0); simT('falla', 110, 20, 0, ledT); cierreT(10); }, true],
  ['control, la misma foto llega antes del RESET', () => { iniciar(110, 'realista', [LED], [{}, {}]); simT('falla', 110, 20, 0, ledT); resetT(20); cierreT(10); }, true],
  ['control, la foto llega después y el cierre nuevo es mayor', () => { iniciar(110, 'realista', [LED], [{}, {}]); resetT(0); simT('falla', 110, 20, 0, ledT); cierreT(40); }, true],
  ['un reinicio por energía de una foto de antes del RESET', () => { iniciar(110, 'realista', [LED], [{}, {}]); simT('falla', 110, 5, 0, ledT); resetT(10); simT('reinicio_placa', 110, 30, 0, { motivo: 'energia_usb', nuevos: 1, total: 1 }); cierreT(10); }, true],
  ['RESET en pausa: reanudar y reiniciar con el tiempo de antes', () => { iniciar(110, 'realista', [LED], [{}, {}]); simT('falla', 110, 5, 0, ledT); simT('simulacion_pausada', 110, 30, 0); simT('simulacion_reanudada', 110, 30, 0); resetT(30); cierreT(10); }, true],
  ['una falla del reloj nuevo con más tiempo que su cierre sigue siendo imposible', () => { iniciar(110, 'realista', [LED], [{}, {}]); resetT(0); simT('falla', 110, 20, 1, ledT); cierreT(10); }, false],
  ['una pausa del reloj nuevo con más tiempo que su cierre también', () => { iniciar(110, 'realista', [LED], [{}, {}]); simT('falla', 110, 5, 0, ledT); resetT(10); simT('simulacion_pausada', 110, 20, 1); simT('simulacion_reanudada', 110, 20, 1); cierreT(10); }, false],
];
for (const [nombre, pasos, valida] of casos03c) {
  const h = sesionCon(() => { pasos(); iniciar(111, 'realista', [LED, R1], [{}, {}, {}]); cerrar(111, []); });
  const c = h.corridas[0];
  revisar(valida ? c.coherente && !h.avisos.length && h.resumen.endsWith(CORREGIDA) && h.corridas[1].corrigio.length === 1
    : !c.coherente && c.contradicciones.some((x) => x.includes('después del tiempo simulado de su cierre')) && !h.resumen.includes(CORREGIDA),
  `INT-RES-03c, ${nombre}: ${valida ? 'coherente, sin avisos y corregida' : 'contradicción, no se compara'} («${pasoDe(h, 111)}»)`);
}

// INT-RES-03b: la app cierra la corrida antes de terminar la sesión. Lo que llega de una corrida después del fin se
// conserva como hecho, pero no acredita cómo quedó.
const fin = () => { pasar(1); registro.registrar({ v: 1, t: reloj, origen: 'editor', tipo: 'sesion_terminada', datos: { ms: 1 } }); };
const casos03b = [
  ['el cierre de la última corrida llega después del fin', () => { fin(); cerrar(121, []); }, 'se cerró después de terminar la sesión', 0],
  ['una falla y el cierre llegan después del fin', () => { fin(); quemado(121); cerrar(121, ['led_quemado']); }, 'tiene eventos después de terminar la sesión', 1],
  ['una pausa de una corrida ya cerrada llega después del fin', () => { cerrar(121, []); fin(); pasar(1); sim('simulacion_pausada', 121, 500); }, 'tiene eventos después de terminar la sesión', 0],
];
for (const [nombre, despuesDelInicio, motivo, fallas] of casos03b) {
  const h = sesionCon(() => { iniciar(120, 'realista', [LED], [{}, {}]); quemado(120); cerrar(120, ['led_quemado']); iniciar(121, 'realista', [LED, R1], [{}, {}, {}]); despuesDelInicio(); });
  const c = h.corridas[1];
  revisar(c.contradicciones.includes(motivo) && c.corrigio === null && c.fallas.length === fallas && !h.resumen.includes(CORREGIDA) &&
    h.resumen.includes('Corregidas al final: no se puede asegurar, porque la corrida 121 ') && con(h, 'Hay eventos después de sesion_terminada'),
  `INT-RES-03b, ${nombre}: se conserva, pero no se compara ni se asegura el final («${h.resumen}»)`);
}

// Límite de CLA-009 (observación de Codex): una corrida que empieza mientras otra sigue abierta, y esa otra nunca se
// cierra, no se compara: no se sabe si se cruzaron
const conAbierta = (conFalla) => sesionCon(() => {
  iniciar(130, 'realista', [LED], [{}, {}]); if (conFalla) quemado(130);
  iniciar(131, 'realista', [LED], [{}, {}]); quemado(131); cerrar(131, ['led_quemado']);
  iniciar(132, 'realista', [LED, R1], [{}, {}, {}]); cerrar(132, []);
});
for (const conFalla of [false, true]) {
  const h = conAbierta(conFalla);
  revisar(h.corridas[1].contradicciones.includes('empezó antes de que la corrida 130 se cerrara, y esa nunca se cerró') && h.corridas[2].corrigio === null &&
    !h.resumen.includes(CORREGIDA) && h.resumen.includes('no se puede asegurar, porque la corrida 132 empezó antes de que la corrida 130 se cerrara'),
  `límite de CLA-009, una corrida anterior abierta que nunca se cierra${conFalla ? ', con la misma falla' : ''}: no se da por corregida («${h.resumen}»)`);
}

// INT-RES-04: la sesión de una línea apartada se toma ya decodificada (un escape JSON no crea otra sesión)
const decodificada = (() => { sesionCon(() => { iniciar(99, 'realista', [LED], [{}, {}]); quemado(99); cerrar(99, ['led_quemado']); iniciar(100, 'realista', [LED, R1], [{}, {}, {}]); cerrar(100, []); }); return lineas.slice(); })();
const conEscape = decodificada[0].replace('"v":1', '"v":2').replace('"tipo":"sesion_iniciada"', '"tipo":"ejemplo_cargado"').replace(/"sesion":"([^"]*)"/, (m, s) => `"sesion":"${s.slice(0, -1)}\\u00${s.charCodeAt(s.length - 1).toString(16)}"`);
const carpetaEscape = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-historia-escape-'));
try {
  const archivo = path.join(carpetaEscape, 'R-2026-10-19.jsonl');
  fs.writeFileSync(archivo, [...decodificada.slice(0, 5), conEscape, ...decodificada.slice(5)].join('\n') + '\n');
  const { lineas: ls } = leerArchivos([archivo]);
  const hs = contarHistoria(ls);
  revisar(conEscape.includes('\\u00') && hs.length === 1 && hs[0].corridas[1].corrigio === null && con(hs[0], 'Se apartó una línea'),
    `INT-RES-04, la sesión escrita con un escape JSON: el hueco queda en su sesión, no en otra (${hs.length} historia(s))`);
  fs.writeFileSync(archivo, [...decodificada.slice(0, 5), '{"v":1,"equipo":"' + JSON.parse(decodificada[0]).equipo + '","sesion":"otra-sesion","t":', ...decodificada.slice(5)].join('\n') + '\n');
  const otra = contarHistoria(leerArchivos([archivo]).lineas);
  revisar(otra.length === 2 && otra.some((h) => h.sesion === 'otra-sesion') && otra.some((h) => h.corridas.length === 2 && h.corridas[1].corrigio.length === 1),
    'control, una línea dañada de otra sesión deja su hueco en esa sesión, no en esta');
} finally {
  fs.rmSync(carpetaEscape, { recursive: true, force: true });
}

// INT-RES-05: una hora que no es una fecha se aparta; el límite de Date sí se lee, y nada se cae
const fueraDeDate = (valor, campo) => {
  const ls = leer(validas);
  if (campo === 't') ls.splice(5, 0, { archivo: 'prueba.jsonl', linea: 97, ev: { ...base80, t: valor, tipo: 'ejemplo_cargado', datos: { id: 'x' } } });
  else ls.splice(5, 0, { archivo: 'prueba.jsonl', linea: 97, ev: { ...base80, tipo: 'registro_interrumpido', datos: { desde: valor, hasta: valor, recuperados: 0, perdidos: 1, motivo: 'X' } } });
  const hs = contarHistoria(ls);
  let texto = '';
  try { texto = narrar(hs); } catch (e) { texto = 'ERROR ' + e.message; }
  return { h: hs[0], texto };
};
for (const [nombre, valor, campo, motivo] of [['t = 8,64e15 + 1', 8640000000000001, 't', 'su hora («t») no es una fecha'], ['t = 1e20', 1e20, 't', 'su hora («t») no es una fecha'], ['registro_interrumpido con horas 1e20', 1e20, 'desde', 'las horas de «registro_interrumpido» no son fechas']]) {
  const { h, texto } = fueraDeDate(valor, campo);
  revisar(!texto.startsWith('ERROR') && h.corridas.length === 2 && con(h, motivo), `INT-RES-05, ${nombre}: se aparta («${motivo}») y la historia se narra`);
}
const limite = fueraDeDate(8640000000000000, 't');
revisar(!limite.texto.startsWith('ERROR') && !limite.h.avisos.some((a) => a.includes('no es una fecha')), 'control, t = 8,64e15 (el límite de Date) se lee');

// ---- AUD-07: un evento que no se pudo guardar deja evento_descartado en su lugar (contrato 6.1): ahí hay un hueco
const descartado = (datos) => { pasar(1); registro.editor('evento_descartado', datos); };
const GRANDE = { motivo: 'tamano', tipo: 'codigo_compilado', origen: 'editor', largo: 2097153, limite: 2097152 };
const entreCorridas = sesionCon(() => { iniciar(140, 'realista', [LED], [{}, {}]); quemado(140); cerrar(140, ['led_quemado']); descartado(GRANDE); iniciar(141, 'realista', [LED, R1], [{}, {}, {}]); cerrar(141, []); });
revisar(entreCorridas.corridas[1].corrigio === null && pasoDe(entreCorridas, 141).endsWith('No se compara con la corrida 140: hay un hueco en el registro entre las dos.') &&
  entreCorridas.pasos.some((p) => p.texto === 'No se guardó un evento (codigo_compilado): era demasiado grande. Ahí hay un hueco.') &&
  con(entreCorridas, 'Hay un hueco: no se guardó un evento (codigo_compilado) porque era demasiado grande') && !entreCorridas.resumen.includes(CORREGIDA),
`AUD-07, un evento descartado entre dos corridas: se cuenta, es un hueco y no se compara a través de él («${pasoDe(entreCorridas, 141)}»)`);
const dentroDeCorrida = sesionCon(() => { iniciar(142, 'realista', [LED], [{}, {}]); quemado(142); descartado({ motivo: 'tamano', tipo: 'falla', origen: 'simulador', corrida: 142 }); cerrar(142, ['led_quemado']); iniciar(143, 'realista', [LED, R1], [{}, {}, {}]); cerrar(143, []); });
revisar(dentroDeCorrida.corridas[0].contradicciones.includes('perdió un evento del registro (falla)') && dentroDeCorrida.corridas[1].corrigio === null && !dentroDeCorrida.resumen.includes(CORREGIDA),
  `AUD-07, un evento descartado de una corrida: esa corrida no se compara («${pasoDe(dentroDeCorrida, 143)}»)`);
const inicioPerdido = sesionCon(() => { descartado({ motivo: 'tamano', tipo: 'simulacion_iniciada', origen: 'simulador', corrida: 144 }); quemado(144); cerrar(144, ['led_quemado']); });
revisar(con(inicioPerdido, 'La corrida 144 perdió su inicio (no se guardó)') && !con(inicioPerdido, 'equipo equivocado') && inicioPerdido.resumen.includes('LED quemado (led1) [sin atribuir: corrida 144]'),
  `AUD-07, se perdió el inicio de una corrida: sus fallas quedan sin atribuir y el aviso dice por qué («${inicioPerdido.resumen}»)`);
const descarteAntes = sesionCon(() => { descartado({ motivo: 'no_serializable', tipo: 'bloques_cambiados', origen: 'editor' }); iniciar(145, 'realista', [LED], [{}, {}]); quemado(145); cerrar(145, ['led_quemado']); iniciar(146, 'realista', [LED, R1], [{}, {}, {}]); cerrar(146, []); });
revisar(descarteAntes.corridas[1].corrigio.length === 1 && descarteAntes.resumen.endsWith(CORREGIDA) && descarteAntes.avisos.length === 1 &&
  descarteAntes.pasos.some((p) => p.texto === 'No se guardó un evento (bloques_cambiados): no se pudo convertir a texto. Ahí hay un hueco.'),
`control, un evento descartado antes de las corridas: se avisa, pero no impide comparar después (${descarteAntes.avisos.join(' | ')})`);

// ---- Lote de la auditoría profunda (21 oct): AUD-12, A-01, A-03, AUD-10, AUD-09 y AUD-13
// AUD-12: un tramo del reloj que todavía no existe (no hubo tantos RESET) no es evidencia: la corrida no se compara
const casosAUD12 = [
  ['una falla de un tramo que no existe', () => { simT('falla', 110, 1500, 1, ledT); cierreT(1000, 0); }],
  ['un cierre de un tramo que no existe', () => { simT('falla', 110, 1500, 0, ledT); cierreT(1000, 9); }],
  ['una pausa de un tramo que no existe', () => { simT('falla', 110, 500, 0, ledT); simT('simulacion_pausada', 110, 1500, 9); simT('simulacion_reanudada', 110, 1500, 9); cierreT(1000, 0); }],
  ['un RESET que dice otro tramo', () => { simT('falla', 110, 5, 0, ledT); simT('reinicio_placa', 110, 10, 1, { motivo: 'boton', nuevos: 1, total: 1 }); cierreT(10, 1); }],
  ['un cierre de un tramo anterior al último RESET', () => { simT('falla', 110, 5, 0, ledT); resetT(10); cierreT(1000, 0); }],
  ['una corrida que mezcla eventos con tramo y sin él', () => { quemado(110); cierreT(1000, 0); }],
];
for (const [nombre, pasos] of casosAUD12) {
  const h = sesionCon(() => { iniciar(110, 'realista', [LED], [{}, {}]); pasos(); iniciar(111, 'realista', [LED, R1], [{}, {}, {}]); cerrar(111, []); });
  revisar(!h.corridas[0].coherente && h.corridas[1].corrigio === null && !h.resumen.includes(CORREGIDA),
    `AUD-12, ${nombre}: la corrida no se compara ni se da por corregida (${h.corridas[0].contradicciones.join(' | ')})`);
}

// A-01: si se perdió el cierre de una corrida (evento_descartado), se sabe que existió: las siguientes no se acusan de cruce
const cierrePerdido = sesionCon(() => {
  iniciar(150, 'realista', [LED], [{}, {}]); quemado(150); descartado({ motivo: 'tamano', tipo: 'simulacion_detenida', origen: 'simulador', corrida: 150 });
  iniciar(151, 'realista', [LED], [{}, {}]); quemado(151); cerrar(151, ['led_quemado']);
  iniciar(152, 'realista', [LED, R1], [{}, {}, {}]); cerrar(152, []);
});
revisar(cierrePerdido.corridas[1].coherente && cierrePerdido.corridas[2].coherente && cierrePerdido.corridas[2].corrigio.length === 1 && con(cierrePerdido, 'La corrida 150 perdió su cierre (no se guardó)') &&
  !con(cierrePerdido, 'empezó antes de que la corrida 150') && cierrePerdido.corridas[1].corrigio === null,
`A-01, un cierre perdido: las corridas siguientes son coherentes y la 152 corrigió; la 151 no se compara con la 150 («${pasoDe(cierrePerdido, 151)}»)`);
const nuncaCerro = conAbierta(false);
revisar(nuncaCerro.corridas[1].contradicciones.includes('empezó antes de que la corrida 130 se cerrara, y esa nunca se cerró'), 'control A-01: una corrida que de verdad nunca se cerró sigue sin acreditar el orden');

// A-03: en un hueco pudo perderse una compilación, unos bloques o un cambio de placa: no se compara a través de él
const compila = (codigo) => { pasar(1); registro.editor('codigo_compilado', { ok: true, error: null, bytes: 100, codigo }); };
const programaA = 'void loop() { delay(500); }\n';
const aTravesDelHueco = sesionCon(() => { compila(programaA); descartado({ motivo: 'tamano', tipo: 'codigo_compilado', origen: 'editor' }); compila(programaA); });
const compilaciones = aTravesDelHueco.pasos.filter((p) => p.texto.startsWith('Compiló')).map((p) => p.texto);
revisar(compilaciones[1] === 'Compiló: bien, 100 bytes (después de un hueco: no se compara con la compilación anterior).',
  `A-03, A, una compilación perdida y A: no dice «el mismo programa» («${compilaciones[1]}»)`);
const sinHueco = sesionCon(() => { compila(programaA); compila(programaA); });
revisar(sinHueco.pasos.filter((p) => p.texto.startsWith('Compiló'))[1].texto === 'Compiló: bien, 100 bytes (el mismo programa).', 'control A-03: sin hueco, A y A es «el mismo programa»');
const bloquesHueco = sesionCon(() => { pasar(1); registro.editor('bloques_cambiados', OCHO); descartado({ motivo: 'tamano', tipo: 'bloques_cambiados', origen: 'editor' }); pasar(5); registro.editor('bloques_cambiados', OCHO); });
revisar(bloquesHueco.pasos.filter((p) => p.texto.startsWith('Bloques')).map((p) => p.texto).join(' | ') === 'Bloques: 8 (5 tipos). | Bloques: 8 (5 tipos).',
  'A-03, los bloques no se juntan ni se comparan a través de un hueco');
const placaHueco = sesionCon(() => { descartado({ motivo: 'tamano', tipo: 'placa_cambiada', origen: 'editor' }); pasar(1); registro.editor('placa_cambiada', { de: 'nano', a: 'uno' }); });
revisar(!con(placaHueco, 'placa_cambiada dice que la placa era nano'), 'A-03, después de perder un placa_cambiada no se acusa al siguiente');

// AUD-10: varias copias del mismo archivo son fotos de un archivo que crece: se lee la más completa, con sus repeticiones
const carpetaCopias = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-historia-copias-'));
try {
  const altaR = ['componente_agregado', { id: 'r1', tipo: 'resistencia' }];
  const lineasCopia = (() => { sesionCon(() => { pasar(1); circuito(...altaR); circuito('componente_quitado', { id: 'r1', tipo: 'resistencia' }); circuito(...altaR); }); return lineas.slice(); })();
  const escribir = (sub, ls) => { const d = path.join(carpetaCopias, sub); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'R-2026-10-21.jsonl'), ls.join('\n') + '\n'); return d; };
  const primera = escribir('primera', lineasCopia.slice(0, 2)); // hasta la primera alta
  const ultima = escribir('ultima', lineasCopia);
  const pasosDe = (rutas) => contarHistoria(leerArchivos(rutas).lineas).map((h) => h.pasos.map((p) => p.texto));
  revisar(JSON.stringify(pasosDe([primera, ultima])) === JSON.stringify(pasosDe([ultima])) && JSON.stringify(pasosDe([ultima])).includes('agregó r1 (resistencia)'),
    'AUD-10: la primera copia y la última juntas cuentan lo mismo que la última sola (la alta repetida no se pierde)');
  revisar(JSON.stringify(pasosDe([ultima, primera])) === JSON.stringify(pasosDe([ultima])), 'AUD-10: también pasándolas en otro orden');
  const distinta = escribir('distinta', [lineasCopia[0], lineasCopia[1].replace('"r1"', '"r9"')]);
  const [conflicto] = contarHistoria(leerArchivos([distinta, ultima]).lineas);
  revisar(con(conflicto, 'Hay copias de R-2026-10-21.jsonl que no coinciden entre sí') && conflicto.dudas.length === 1, 'AUD-10: dos copias que no coinciden se avisan y no aseguran el final');
} finally { fs.rmSync(carpetaCopias, { recursive: true, force: true }); }

// AUD-09: una exportación se admite antes de leerla: entera, con sus huellas, sin archivos de más ni de menos
{
  const { crearRegistroDisco } = require('../escritorio/registro-disco.js');
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-historia-admision-'));
  try {
    let caso = 0;
    const lineasCorregida = (() => { sesionCon(() => { iniciar(160, 'realista', [LED], [{}, {}]); quemado(160); cerrar(160, ['led_quemado']); iniciar(161, 'realista', [LED, R1], [{}, {}, {}]); cerrar(161, []); }); return lineas.slice(); })();
    // Una sesión que se corrige, exportada de verdad con el escritor de la app; `dañar` la cambia después de exportar
    const exportar = (dañar = () => {}) => {
      const carpeta = path.join(raiz, `caso-${++caso}`);
      const disco = crearRegistroDisco({ carpeta, ahora: () => INICIO, version: '0.4.0' });
      disco.instructor({ accion: 'crear-pin', pin: '2468' });
      disco.instructor({ accion: 'activar', pin: '2468', activo: true });
      for (const l of lineasCorregida) disco.escribir(JSON.parse(l));
      const usb = path.join(carpeta, 'usb');
      fs.mkdirSync(usb);
      const r = disco.exportar({ pin: '2468', destino: usb });
      dañar(r.carpeta);
      return r.carpeta;
    };
    const correrCli = (...args) => spawnSync(process.execPath, [path.join(__dirname, '..', 'herramientas', 'historia-registro.js'), ...args], { encoding: 'utf8' });
    const leerExportacion = (carpeta) => { const l = leerArchivos([carpeta]); return { ...l, historias: contarHistoria(l.lineas), cli: correrCli(carpeta) }; };
    const buena = leerExportacion(exportar());
    revisar(!buena.problemas.length && buena.cli.status === 0 && buena.historias[0].resumen.endsWith(CORREGIDA), `control AUD-09: una exportación entera se admite y se lee igual que antes (salida ${buena.cli.status})`);
    const unicoArchivo = (c) => fs.readdirSync(c).find((f) => f.endsWith('.jsonl'));
    const cambiarManifiesto = (c, cambio) => { const m = JSON.parse(fs.readFileSync(path.join(c, 'exportacion.json'), 'utf8')); cambio(m); fs.writeFileSync(path.join(c, 'exportacion.json'), JSON.stringify(m)); };
    const malas = [
      ['incompleta (completa: false)', (c) => cambiarManifiesto(c, (m) => { m.completa = false; m.faltan = []; m.error = { archivo: 'X-2026-10-19.jsonl', codigo: 'ENOSPC', donde: 'destino' }; }), /quedó incompleta/],
      ['con un archivo cambiado después de exportar', (c) => { const a = path.join(c, unicoArchivo(c)); fs.writeFileSync(a, fs.readFileSync(a, 'utf8').replace('"ms_sim":1000', '"ms_sim":1001')); }, /no coincide con su huella/],
      ['sin uno de sus archivos', (c) => fs.renameSync(path.join(c, unicoArchivo(c)), path.join(raiz, `apartado-${caso}.jsonl`)), /falta .* que está en exportacion\.json/],
      ['con un .jsonl de más', (c) => fs.writeFileSync(path.join(c, 'OTRO-2026-10-19.jsonl'), ''), /no está en exportacion\.json/],
      ['con exportacion.json roto', (c) => fs.writeFileSync(path.join(c, 'exportacion.json'), '{ roto'), /no se puede leer/],
      ['sin exportacion.json', (c) => fs.rmSync(path.join(c, 'exportacion.json')), /sin exportacion\.json/],
      ['de un formato desconocido', (c) => cambiarManifiesto(c, (m) => { m.formato = 2; }), /formato que esta historia no conoce/],
      ['con un nombre de archivo que sale de la carpeta', (c) => cambiarManifiesto(c, (m) => { m.archivos[0].archivo = '../fuera.jsonl'; }), /no es válido/],
      ['con eventos pendientes al exportar', (c) => cambiarManifiesto(c, (m) => { m.pendientes = 2; }), /esperaban a que el disco funcionara/],
    ];
    for (const [nombre, dañar, problema] of malas) {
      const r = leerExportacion(exportar(dañar));
      const h = r.historias[0];
      revisar(r.problemas.some((p) => problema.test(p)) && r.cli.status === 1 && (!h || (!h.resumen.includes(CORREGIDA) && h.resumen.includes('no se puede asegurar'))),
        `AUD-09, una exportación ${nombre}: se dice, la línea de comandos sale con 1 y no se afirma la corrección (${h ? h.resumen.slice(0, 110) : 'sin historia'})`);
    }
    // AUD-09-R1: el manifiesto se valida como estructura; nada se convierte ni se supone (un pendientes que falta no es 0)
    const estructura = [
      ...[['ausente', undefined], ['texto «1»', '1'], ['null', null], ['negativo', -1], ['fracción', 0.5], ['objeto', {}]].map(([n, v]) => [`pendientes ${n}`, (m) => { if (v === undefined) delete m.pendientes; else m.pendientes = v; }, 'pendientes']),
      ['completa como texto', (m) => { m.completa = 'true'; }, 'completa'], ['total ausente', (m) => { delete m.total; }, 'total'], ['t negativo', (m) => { m.t = -5; }, 't'],
      ['app de otro programa', (m) => { m.app = 'Otro'; }, 'app'], ['version_tb vacía', (m) => { m.version_tb = ''; }, 'version_tb'],
      ['bytes como texto', (m) => { m.archivos[0].bytes = String(m.archivos[0].bytes); }, 'archivos'], ['faltan con completa: true', (m) => { m.faltan = []; }, 'faltan o error'],
      ['completa: false sin faltan ni error', (m) => { m.completa = false; }, 'faltan, error'],
    ];
    for (const [nombre, cambio, campo] of estructura) {
      const r = leerExportacion(exportar((c) => cambiarManifiesto(c, cambio)));
      const h = r.historias[0];
      revisar(r.problemas.some((p) => p.includes(`no es válido (${campo}`)) && r.cli.status === 1 && !h.resumen.includes(CORREGIDA) && h.corridas[1].corrigio === null,
        `AUD-09-R1, ${nombre}: el manifiesto no es válido, CLI 1, sin comparar ni afirmar el final`);
    }
    for (const [nombre, pendientes, limpio] of [['pendientes 0', 0, true], ['pendientes 2', 2, false]]) {
      const r = leerExportacion(exportar((c) => cambiarManifiesto(c, (m) => { m.pendientes = pendientes; })));
      revisar(limpio ? !r.problemas.length && r.cli.status === 0 && r.historias[0].resumen.endsWith(CORREGIDA)
        : r.problemas.some((p) => /2 eventos esperaban/.test(p)) && r.cli.status === 1 && !r.historias[0].resumen.includes(CORREGIDA),
      `control AUD-09-R1, ${nombre}: ${limpio ? 'se admite y concluye' : 'se avisa y no se asegura el final'}`);
    }
    {
      // Con un evento de verdad esperando en la cola (disco lleno) y el pendientes cambiado a "1" en el manifiesto
      const carpetaCola = exportar();
      const disco = crearRegistroDisco({ carpeta: path.join(raiz, `caso-cola`), ahora: () => INICIO, version: '0.4.0' });
      disco.instructor({ accion: 'crear-pin', pin: '2468' });
      disco.instructor({ accion: 'activar', pin: '2468', activo: true });
      for (const l of lineasCorregida) disco.escribir(JSON.parse(l));
      const anexar = fs.appendFileSync;
      fs.appendFileSync = function (a, ...resto) { if (String(a).startsWith(path.join(raiz, 'caso-cola'))) throw Object.assign(new Error('ENOSPC sintético'), { code: 'ENOSPC' }); return anexar.call(this, a, ...resto); };
      let exp;
      try { disco.escribir({ ...JSON.parse(lineasCorregida[0]), tipo: 'ejemplo_cargado', datos: { id: 'en-cola' } }); fs.mkdirSync(path.join(raiz, 'caso-cola', 'usb')); exp = disco.exportar({ pin: '2468', destino: path.join(raiz, 'caso-cola', 'usb') }); } finally { fs.appendFileSync = anexar; }
      const conUno = leerExportacion(exp.carpeta);
      cambiarManifiesto(exp.carpeta, (m) => { m.pendientes = '1'; });
      const conTexto = leerExportacion(exp.carpeta);
      revisar(exp.ok && conUno.cli.status === 1 && conTexto.cli.status === 1 && !conTexto.historias[0].resumen.includes(CORREGIDA) && conTexto.problemas.some((p) => p.includes('no es válido (pendientes')) && !!carpetaCola,
        `AUD-09-R1, con un evento de verdad en la cola: pendientes 1 avisa, y cambiado a "1" tampoco sale limpio (${conTexto.cli.status})`);
    }
    // AUD-22: se analizan los mismos bytes cuya huella se comprobó. Aquí el archivo cambia justo después de leerlo para
    // comprobarlo (como en el diagnóstico de Codex, 22 oct): antes se volvía a abrir y se analizaba el cambiado. La
    // copia íntegra y la cambiada antes de admitirla son los casos de AUD-09 de arriba.
    {
      const carpeta = exportar();
      const archivo = path.join(carpeta, unicoArchivo(carpeta));
      const otro = fs.readFileSync(archivo, 'utf8').split('\n').filter((l) => l && !l.includes('"corrida":161') && !l.includes('sesion_terminada')).join('\n') + '\n';
      const leerOriginal = fs.readFileSync;
      let lecturas = 0;
      fs.readFileSync = function (f, ...resto) {
        const b = leerOriginal.call(this, f, ...resto);
        if (path.resolve(String(f)) === path.resolve(archivo) && ++lecturas === 1) fs.writeFileSync(archivo, otro);
        return b;
      };
      let r;
      try { r = leerArchivos([carpeta]); } finally { fs.readFileSync = leerOriginal; }
      const h = contarHistoria(r.lineas)[0];
      revisar(lecturas === 1 && !r.problemas.length && h.corridas.length === 2 && h.resumen.endsWith(CORREGIDA),
        `AUD-22: el archivo cambia después de comprobar su huella: se lee una vez y se analizan los bytes comprobados (${lecturas} lectura(s), ${h.corridas.length} corridas)`);
      const otraVez = leerExportacion(carpeta);
      revisar(otraVez.problemas.some((p) => /no coincide con su huella/.test(p)) && otraVez.cli.status === 1 && !otraVez.historias[0].resumen.includes(CORREGIDA),
        'AUD-22: leída otra vez, la copia cambiada ya no coincide con su huella y no se admite');
    }
    // F01 (verificación de Codex del 24 oct): el mismo archivo, dado suelto y dentro de su exportación, en los dos órdenes.
    // Se lee una vez, se analizan los bytes que se comprobaron y vale la restricción más exigente: la conclusión no
    // depende del orden. Para la línea de comandos, un gancho cambia el archivo después de su primera lectura.
    {
      const gancho = path.join(raiz, 'cambiar-tras-leer.cjs');
      fs.writeFileSync(gancho, [
        "'use strict';",
        "const fs = require('fs'), path = require('path');",
        'const blanco = path.resolve(process.env.HISTORIA_BLANCO), otro = fs.readFileSync(process.env.HISTORIA_OTRO);',
        'const leer = fs.readFileSync;',
        'let n = 0;',
        'fs.readFileSync = function (f, ...resto) { const b = leer.call(this, f, ...resto); if (typeof f === \'string\' && path.resolve(f) === blanco && ++n === 1) fs.writeFileSync(blanco, otro); return b; };',
      ].join('\n'));
      const sinLaSegunda = (texto) => texto.split('\n').filter((l) => l && !l.includes('"corrida":161') && !l.includes('sesion_terminada')).join('\n') + '\n';
      // `cambiar`: después de la primera lectura del archivo, queda otro contenido (la sustitución entre comprobar y usar)
      const leerContando = (entradas, archivo, cambiar) => {
        const original = fs.readFileSync;
        const otro = cambiar ? sinLaSegunda(original(archivo, 'utf8')) : null;
        let lecturas = 0;
        fs.readFileSync = function (f, ...resto) {
          const b = original.call(this, f, ...resto);
          if (path.resolve(String(f)) === path.resolve(archivo) && ++lecturas === 1 && otro) fs.writeFileSync(archivo, otro);
          return b;
        };
        try { const r = leerArchivos(entradas); return { ...r, lecturas, h: contarHistoria(r.lineas)[0] }; } finally { fs.readFileSync = original; }
      };
      const cliCambiando = (entradas, archivo) => {
        const otro = path.join(raiz, `otro-${++caso}.jsonl`);
        fs.writeFileSync(otro, sinLaSegunda(fs.readFileSync(archivo, 'utf8')));
        const r = spawnSync(process.execPath, ['-r', gancho, path.join(__dirname, '..', 'herramientas', 'historia-registro.js'), ...entradas, '--json'],
          { encoding: 'utf8', env: { ...process.env, HISTORIA_BLANCO: archivo, HISTORIA_OTRO: otro } });
        return { status: r.status, datos: JSON.parse(r.stdout) };
      };
      for (const orden of ['archivo primero', 'carpeta primero']) {
        const entradas = (c) => { const a = path.join(c, unicoArchivo(c)); return { a, lista: orden === 'archivo primero' ? [a, c] : [c, a] }; };
        // Copia íntegra
        let c = exportar(); let { a, lista: e } = entradas(c);
        const integra = leerContando(e, a, false);
        revisar(integra.lecturas === 1 && !integra.problemas.length && integra.h.resumen.endsWith(CORREGIDA) && correrCli(...e).status === 0,
          `F01, ${orden}, copia íntegra: una lectura, se concluye igual y la línea de comandos sale con 0`);
        // Sustitución entre la comprobación y el uso
        c = exportar(); ({ a, lista: e } = entradas(c));
        const sustituida = leerContando(e, a, true);
        revisar(sustituida.lecturas === 1 && !sustituida.problemas.length && sustituida.h.corridas.length === 2 && sustituida.h.resumen.endsWith(CORREGIDA),
          `F01, ${orden}, el archivo cambia después de comprobarlo: se analizan los bytes comprobados (${sustituida.lecturas} lectura(s), ${sustituida.h.corridas.length} corridas)`);
        c = exportar(); ({ a, lista: e } = entradas(c));
        const cli = cliCambiando(e, a);
        revisar(cli.status === 0 && cli.datos.historias[0].corridas.length === 2 && cli.datos.historias[0].resumen.endsWith(CORREGIDA),
          `F01, ${orden}, lo mismo por la línea de comandos: sale con ${cli.status} y analiza los bytes comprobados`);
        // Manifiesto inválido y eventos pendientes: la restricción vale aunque el archivo suelto venga antes
        for (const [nombre, cambio, problema] of [['manifiesto inválido (pendientes «1»)', (m) => { m.pendientes = '1'; }, /no es válido \(pendientes/],
          ['con 2 eventos pendientes', (m) => { m.pendientes = 2; }, /2 eventos esperaban/]]) {
          c = exportar((x) => cambiarManifiesto(x, cambio)); ({ a, lista: e } = entradas(c));
          const r = leerContando(e, a, false);
          revisar(r.problemas.some((p) => problema.test(p)) && !r.h.resumen.includes(CORREGIDA) && r.h.resumen.includes('no se puede asegurar') && correrCli(...e).status === 1 &&
            (nombre.startsWith('manifiesto') ? r.h.corridas[1].corrigio === null : true),
          `F01, ${orden}, ${nombre}: la restricción se conserva y no se concluye`);
        }
      }
      // La misma carpeta dos veces, y el archivo cambia entre las dos admisiones: no se sabe qué bytes valen
      const c = exportar();
      const a = path.join(c, unicoArchivo(c));
      const doble = leerContando([c, c], a, true);
      revisar(doble.problemas.some((p) => /cambió entre dos lecturas|no coincide con su huella/.test(p)) && !doble.h.resumen.includes(CORREGIDA) && doble.h.corridas[1].corrigio === null,
        `F01: la misma carpeta dos veces con el archivo cambiado entre las dos lecturas: se dice y no se concluye (${doble.lecturas} lecturas)`);
    }
    const noAdmitida = leerExportacion(exportar((c) => cambiarManifiesto(c, (m) => { m.completa = false; m.faltan = []; m.error = { archivo: 'X-2026-10-19.jsonl', codigo: 'ENOSPC' }; })));
    revisar(noAdmitida.historias[0].corridas[1].corrigio === null, 'AUD-09: en una exportación no admitida tampoco se comparan las corridas');
    // Leer un archivo suelto es una lectura cruda, deliberada: no se verifica la exportación
    const crudo = exportar();
    const suelto = leerArchivos([path.join(crudo, unicoArchivo(crudo))]);
    revisar(!suelto.problemas.length && contarHistoria(suelto.lineas)[0].resumen.endsWith(CORREGIDA), 'control AUD-09: un archivo suelto se lee crudo, sin verificar la exportación');
    // La carpeta de registros de la app no es una exportación y se lee como siempre
    revisar(!leerArchivos([path.join(raiz, 'caso-1', 'registros')]).problemas.length, 'control AUD-09: la carpeta de registros de la app no es una exportación y se lee como siempre');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
}

// AUD-13: cada línea se decodifica sola: un byte roto aparta solo su línea, aunque otra tenga un U+FFFD legítimo
{
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-historia-utf8-'));
  try {
    const ls = (() => { sesionCon(() => { compila('const char *s = "�";\n'); pasar(1); registro.editor('ejemplo_cargado', { id: 'ROTO' }); }); return lineas.slice(); })();
    const bytes = Buffer.from('﻿' + ls.join('\r\n') + '\r\n');
    bytes[bytes.indexOf(Buffer.from('ROTO'))] = 0xff;
    const archivo = path.join(carpeta, 'U-2026-10-21.jsonl');
    fs.writeFileSync(archivo, bytes);
    const r = leerArchivos([archivo]);
    const apartadas = r.lineas.filter((l) => l.apartada);
    revisar(apartadas.length === 1 && apartadas[0].linea === 3 && r.lineas.some((l) => l.ev && l.ev.tipo === 'codigo_compilado' && l.ev.datos.codigo.includes('�')) && r.notas.some((n) => /BOM/.test(n)),
      `AUD-13: con BOM y CRLF, solo se aparta la línea del byte roto (la ${apartadas[0] && apartadas[0].linea}); el U+FFFD legítimo se conserva`);
  } finally { fs.rmSync(carpeta, { recursive: true, force: true }); }
}

// ---- Revisión de REG-005 (22 oct)
// TB-1: el C++ que guarda la app con el separador /**/ de una \ suelta no es «C++ con comentarios» (antes, limpiarlo
// otra vez agregaba un espacio y la historia avisaba AUD-01 sobre un registro correcto)
{
  const B = String.fromCharCode(92);
  const guardados = ['int x = 1; ' + B + ' // nota\nint y;\n', 'int a = 1; ' + B + '/* a\nb */ int b;\n', '#define M a ' + B + '// x\nint z;\n'].map(quitarComentarios);
  const separador = sesionCon(() => { for (const g of guardados) compila(g); });
  revisar(guardados.every((g) => g.includes(B + '/**/')) && !con(separador, 'AUD-01'), `TB-1: el C++ con el separador /**/ no se acusa de tener comentarios (${separador.avisos.length} avisos)`);
  const conComentario = sesionCon(() => { compila('int x = 1; // nota\n'); });
  revisar(con(conComentario, 'AUD-01'), 'control TB-1: un C++ con un comentario de verdad sí se avisa');
}
// TC-2: un cierre sin la confirmación del simulador (confirmado: false) deja la corrida sin comparar, sin aviso; con
// confirmado true o sin el campo (registros de antes del 22 oct), se compara como siempre
{
  const cerrarCon = (n, fallas, confirmado) => { pasar(1); sim('simulacion_detenida', n, 1000, { ms_sim: 1000, fallas: fallas.map((tipo) => ({ tipo, componente: 'led1' })), ...(confirmado === undefined ? {} : { confirmado }) }); };
  const dos = (n, confirmado) => sesionCon(() => {
    iniciar(n, 'realista', [LED], [{}, {}]); quemado(n); cerrarCon(n, ['led_quemado'], confirmado);
    iniciar(n + 1, 'realista', [LED, R1], [{}, {}, {}]); cerrarCon(n + 1, [], true);
  });
  const sinConfirmar = dos(170, false);
  revisar(sinConfirmar.corridas[0].contradicciones.includes('se cerró sin la confirmación del simulador (pudieron quedar fallas sin llegar)') &&
    sinConfirmar.corridas[1].corrigio === null && !sinConfirmar.resumen.includes(CORREGIDA) && !sinConfirmar.avisos.length,
  `TC-2: la corrida cerrada sin confirmación no se compara y no se avisa («${pasoDe(sinConfirmar, 171)}»)`);
  for (const [n, confirmado] of [[172, true], [174, undefined]]) {
    const h = dos(n, confirmado);
    revisar(h.corridas[1].corrigio.length === 1 && h.resumen.endsWith(CORREGIDA) && !h.avisos.length, `control TC-2: con confirmado ${confirmado} se compara como siempre`);
  }
  const ultima = sesionCon(() => { iniciar(176, 'realista', [LED], [{}, {}]); quemado(176); cerrarCon(176, ['led_quemado'], false); });
  revisar(ultima.resumen.includes('no se puede asegurar, porque la corrida 176 se cerró sin la confirmación del simulador'), `TC-2: si es la última corrida, el final no se asegura («${ultima.resumen}»)`);
  // AUD-16: la falla volvió en la segunda corrida, pero su foto se perdió; el simulador cierra esa corrida sin confirmar
  const perdidaDespues = sesionCon(() => {
    iniciar(178, 'realista', [LED], [{}, {}]); quemado(178); cerrarCon(178, ['led_quemado'], true);
    iniciar(179, 'realista', [LED], [{}, {}]); cerrarCon(179, [], false);
  });
  revisar(perdidaDespues.corridas[1].corrigio === null && !perdidaDespues.resumen.includes(CORREGIDA) && perdidaDespues.resumen.includes('no se puede asegurar'),
    `AUD-16: la corrida que perdió una foto no acredita la corrección de la anterior («${perdidaDespues.resumen}»)`);
}

// AUD-15: una falla se corrige solo en la misma pieza. El lienzo da el primer id libre: si quitan led1 y agregan otro LED,
// el nuevo también es led1, y que no se queme no corrige al anterior. Abrir un proyecto o un ejemplo cambia todo el
// circuito sin altas ni bajas.
{
  const bajaLed = () => circuito('componente_quitado', { id: 'led1', tipo: 'led' });
  const altaLed = () => circuito('componente_agregado', { id: 'led1', tipo: 'led' });
  const dosCorridas = (n, entre, segunda = [LED]) => sesionCon(() => {
    iniciar(n, 'realista', [LED], [{}, {}]); quemado(n); cerrar(n, ['led_quemado']);
    pasar(1); entre();
    iniciar(n + 1, 'realista', segunda, [{}, {}]); cerrar(n + 1, []);
  });
  const misma = dosCorridas(180, () => circuito('componente_cambiado', { id: 'led1', props: { color: 'verde' } }));
  revisar(misma.corridas[1].corrigio.length === 1 && misma.resumen.endsWith(CORREGIDA) && !misma.avisos.length, 'control AUD-15: la misma pieza, con un cambio de color: corrigió');
  const otraPieza = dosCorridas(182, () => { circuito('componente_quitado', { id: 'r1', tipo: 'resistencia' }); circuito('componente_agregado', { id: 'r1', tipo: 'resistencia' }); });
  revisar(otraPieza.corridas[1].corrigio.length === 1 && otraPieza.resumen.endsWith(CORREGIDA), 'control AUD-15: reemplazar otra pieza no cambia la del LED: corrigió');
  const casos = [
    ['baja y alta con el mismo id y tipo', () => { bajaLed(); altaLed(); }, [LED], /se reemplazó led1/],
    ['mismo id con otro tipo', () => { bajaLed(); circuito('componente_agregado', { id: 'led1', tipo: 'resistencia' }); }, [{ ...R1, id: 'led1' }], /led1 ahora es otra pieza: resistencia/],
    ['abrió otro proyecto', () => registro.editor('proyecto_abierto', { placa: 'uno' }), [LED], /abrió otro proyecto o ejemplo/],
    ['abrió un ejemplo', () => registro.editor('ejemplo_cargado', { id: 'parpadeo' }), [LED], /abrió otro proyecto o ejemplo/],
  ];
  for (const [nombre, entre, segunda, motivo] of casos) {
    const h = dosCorridas(184, entre, segunda);
    const c2 = h.corridas[1];
    revisar(c2.corrigio.length === 0 && c2.yaNoSeObservo.length === 1 && motivo.test(c2.yaNoSeObservo[0].motivo) && !h.resumen.includes('Corregidas al final: LED quemado') &&
      motivo.test(h.resumen) && motivo.test(pasoDe(h, 185)),
    `AUD-15, ${nombre}: no corrigió, ya no se observó (${c2.yaNoSeObservo[0] && c2.yaNoSeObservo[0].motivo})`);
  }
  // En el resumen, la corrida que vio la falla se compara con todas las siguientes: ninguna es la misma pieza
  const tres = sesionCon(() => {
    iniciar(190, 'realista', [LED], [{}, {}]); quemado(190); cerrar(190, ['led_quemado']);
    pasar(1); bajaLed(); altaLed();
    iniciar(191, 'realista', [LED], [{}, {}]); cerrar(191, []);
    iniciar(192, 'realista', [LED], [{}, {}]); cerrar(192, []);
  });
  revisar(!tres.resumen.includes('Corregidas al final: LED quemado') && /Ya no se observaron al final: LED quemado \(led1\) \(se reemplazó led1/.test(tres.resumen),
    `AUD-15: con dos corridas después del reemplazo, el resumen tampoco la da por corregida («${tres.resumen}»)`);
  // La pieza nueva sí se corrige: se quemó en su propia corrida y después ya no. Desde F02 (24 oct) el resumen nombra
  // aparte la falla de cada pieza: la nueva es «pieza 2» y la de la primera ya no se observó
  const nueva = sesionCon(() => {
    iniciar(194, 'realista', [LED], [{}, {}]); quemado(194); cerrar(194, ['led_quemado']);
    pasar(1); bajaLed(); altaLed();
    iniciar(195, 'realista', [LED], [{}, {}]); quemado(195); cerrar(195, ['led_quemado']);
    iniciar(196, 'realista', [LED], [{}, {}]); cerrar(196, []);
  });
  revisar(nueva.corridas[2].corrigio.length === 1 && nueva.corridas[2].corrigio[0].pieza === 2 &&
    nueva.resumen.endsWith('Corregidas al final: LED quemado (led1, pieza 2). Ya no se observaron al final: LED quemado (led1) (se reemplazó led1: quitó la que estaba y agregó otra con el mismo nombre). Sin corregir: ninguna.'),
  `control AUD-15: la pieza nueva que se quemó y después no, sí se corrigió («${nueva.resumen}»)`);

  // F02 (verificación de Codex del 24 oct): la misma falla en la pieza nueva no «sigue» la de la anterior. La de antes ya
  // no se observó (con el motivo) y la de ahora es nueva, también en el resumen
  const conFallaDos = (n, entre) => sesionCon(() => {
    iniciar(n, 'realista', [LED], [{}, {}]); quemado(n); cerrar(n, ['led_quemado']);
    pasar(1); entre();
    iniciar(n + 1, 'realista', [LED], [{}, {}]); quemado(n + 1); cerrar(n + 1, ['led_quemado']);
  });
  for (const [nombre, entre, motivo] of [
    ['baja y alta con el mismo id y tipo', () => { bajaLed(); altaLed(); }, /se reemplazó led1/],
    ['abrió otro proyecto', () => registro.editor('proyecto_abierto', { placa: 'uno' }), /abrió otro proyecto o ejemplo/],
    ['abrió un ejemplo', () => registro.editor('ejemplo_cargado', { id: 'parpadeo' }), /abrió otro proyecto o ejemplo/],
  ]) {
    const h = conFallaDos(200, entre);
    const c2 = h.corridas[1];
    revisar(c2.siguen.length === 0 && c2.nuevas.length === 1 && c2.nuevas[0].pieza === 2 && c2.corrigio.length === 0 &&
      c2.yaNoSeObservo.length === 1 && motivo.test(c2.yaNoSeObservo[0].motivo) && /Nuevas: LED quemado \(led1, pieza 2\)/.test(pasoDe(h, 201)) && !/Siguen/.test(pasoDe(h, 201)) &&
      h.resumen.startsWith('2 corrida(s). Fallas vistas: LED quemado (led1), LED quemado (led1, pieza 2). Corregidas al final: ninguna. Ya no se observaron al final: LED quemado (led1) (') &&
      h.resumen.endsWith('Sin corregir: LED quemado (led1, pieza 2).') && !h.avisos.length,
    `F02, ${nombre} y la misma falla: no sigue, es nueva («${pasoDe(h, 201)}»)`);
  }
  const persiste = conFallaDos(204, () => circuito('componente_cambiado', { id: 'led1', props: { color: 'verde' } }));
  revisar(persiste.corridas[1].siguen.length === 1 && persiste.corridas[1].nuevas.length === 0 && !persiste.corridas[1].siguen[0].pieza &&
    persiste.resumen === '2 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: ninguna. Sin corregir: LED quemado (led1).',
  'control F02: la misma pieza con la misma falla sigue');
  // Una pieza agregada mientras la corrida corría es la misma en la corrida siguiente si no se tocó más; si se reemplaza
  // durante la siguiente, o si en una misma corrida la falla la tuvieron dos piezas, no se compara esa pieza
  const durante = (n, mientrasDos) => sesionCon(() => {
    iniciar(n, 'realista', [], []); pasar(1); altaLed(); quemado(n); cerrar(n, ['led_quemado']);
    iniciar(n + 1, 'realista', [LED], [{}, {}]); mientrasDos(); cerrar(n + 1, []);
  });
  const agregadaDurante = durante(206, () => {});
  revisar(agregadaDurante.corridas[1].corrigio.length === 1 && agregadaDurante.resumen.endsWith(CORREGIDA),
    `control F02: la pieza agregada durante la corrida 206 es la misma en la 207: corrigió («${agregadaDurante.resumen}»)`);
  const cambiadaDurante = durante(208, () => { pasar(1); bajaLed(); altaLed(); });
  revisar(cambiadaDurante.corridas[1].corrigio.length === 0 && /led1 se agregó o se quitó durante la corrida 209/.test(cambiadaDurante.corridas[1].yaNoSeObservo[0].motivo) &&
    !cambiadaDurante.resumen.includes(CORREGIDA), `F02: la pieza reemplazada mientras corría la 209 no acredita la corrección (${cambiadaDurante.corridas[1].yaNoSeObservo[0].motivo})`);
  const mixta = sesionCon(() => {
    iniciar(210, 'realista', [LED], [{}, {}]); quemado(210); pasar(1); bajaLed(); altaLed(); quemado(210); cerrar(210, ['led_quemado']);
    iniciar(211, 'realista', [LED], [{}, {}]); cerrar(211, []);
  });
  revisar(mixta.corridas[1].corrigio.length === 0 && /led1 se agregó o se quitó durante la corrida 210/.test(mixta.corridas[1].yaNoSeObservo[0].motivo) && !mixta.resumen.includes(CORREGIDA),
    `F02: si en la corrida 210 la misma falla la tuvieron dos piezas, la 211 no la corrige (${mixta.corridas[1].yaNoSeObservo[0].motivo})`);
  // Los datos no traen lo de uso interno, y la primera pieza de cada falla no lleva `pieza`
  revisar(conFallaDos(212, () => { bajaLed(); altaLed(); }).corridas.every((c) => !('genFalla' in c) && !('cambiadas' in c)) && !persiste.corridas[0].fallas[0].pieza,
    'F02: la identidad de las piezas es de uso interno y la primera pieza no lleva «pieza»');
}

// ---- La línea de comandos (INT-06, INT-07 y la decisión 3): siempre muestra la historia y sale con 1 si hay problemas
const cli = path.join(__dirname, '..', 'herramientas', 'historia-registro.js');
const correr = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-historia-'));
try {
  const escribir = (nombre, ls) => { fs.mkdirSync(path.dirname(path.join(carpeta, nombre)), { recursive: true }); fs.writeFileSync(path.join(carpeta, nombre), ls.join('\n') + '\n'); return path.join(carpeta, nombre); };
  const a1 = escribir('A1-2026-10-19.jsonl', historiaA1);
  escribir('B2-2026-10-19.jsonl', [...historiaB2, '{ dañada']);
  fs.writeFileSync(path.join(carpeta, 'notas.txt'), 'no es un registro');
  const r = correr(carpeta);
  revisar(r.stdout.indexOf('Equipo A1') >= 0 && r.stdout.indexOf('Equipo A1') < r.stdout.indexOf('Equipo B2'), 'la carpeta: lee los dos .jsonl, en orden de hora, y no el .txt');
  revisar(/B2-2026-10-19\.jsonl, línea 11: no se puede leer/.test(r.stdout) && r.status === 1, `la línea dañada se dice con su archivo y número, la historia sale igual y el código es 1 (${r.status})`);
  const limpio = correr(a1, '--json');
  const datos = JSON.parse(limpio.stdout);
  revisar(limpio.status === 0 && datos.limpio && datos.historias.length === 1 && datos.historias[0].corridas.length === 3 && !datos.problemas.length,
    `--json de un registro limpio: la historia como datos y el código 0 (${limpio.status})`);
  const { lineas: todas } = leerArchivos([carpeta]);
  revisar(todas.filter((l) => l.ev).length === historiaA1.length + historiaB2.length && todas.filter((l) => l.apartada).length === 1,
    `leerArchivos: ${todas.filter((l) => l.ev).length} líneas buenas y la dañada apartada`);
  revisar(correr().status === 2, 'sin nada que leer: el uso y el código 2');

  // INT-06: la misma ruta dos veces, una copia que se pisa y los archivos de una sesión en otro orden
  const dos = correr(a1, a1, '--json');
  revisar(JSON.parse(dos.stdout).historias[0].corridas.length === 3 && /ya estaba entre lo que se lee/.test(JSON.stringify(JSON.parse(dos.stdout).notas)),
    'INT-06, la misma ruta dos veces se lee una vez');
  const copia = escribir('exportado/A1-2026-10-19.jsonl', historiaA1);
  const pisadas = JSON.parse(correr(a1, copia, '--json').stdout).historias;
  revisar(pisadas.length === 1 && pisadas[0].corridas.length === 3 && pisadas[0].notas.some((n) => /ya había llegado en otro archivo/.test(n)) && !pisadas[0].avisos.length,
    'INT-06, una copia exportada de las mismas líneas se cuenta una vez');
  const mitad = Math.ceil(historiaA1.length / 2);
  const dia1 = escribir('partes/A1-2026-10-19.jsonl', historiaA1.slice(0, mitad));
  const dia2 = escribir('partes/A1-2026-10-20.jsonl', historiaA1.slice(mitad));
  const alReves = JSON.parse(correr(dia2, dia1, '--json').stdout);
  revisar(alReves.limpio && alReves.historias[0].corridas.length === 3, 'INT-06, los archivos de una sesión pasados al revés se ordenan por la fecha de su nombre');

  // INT-07: BOM, bytes que no son UTF-8 y una ruta que no existe
  const conBom = path.join(carpeta, 'bom', 'A1-2026-10-19.jsonl');
  fs.mkdirSync(path.dirname(conBom));
  fs.writeFileSync(conBom, '﻿' + historiaA1.join('\n') + '\n');
  const bom = JSON.parse(correr(conBom, '--json').stdout);
  revisar(bom.historias[0].pasos[0].texto.startsWith('Empezó la sesión') && bom.notas.some((n) => /BOM/.test(n)), 'INT-07, un BOM al inicio no hace perder sesion_iniciada');
  const malUtf8 = path.join(carpeta, 'utf8', 'A1-2026-10-19.jsonl');
  fs.mkdirSync(path.dirname(malUtf8));
  const linea2 = Buffer.from(historiaA1[1].replace('parpadeo', 'parpadeoÿ'));
  linea2[linea2.indexOf(0xc3)] = 0xff; // un byte que no es UTF-8
  fs.writeFileSync(malUtf8, Buffer.concat([Buffer.from(historiaA1[0] + '\n'), linea2, Buffer.from('\n' + historiaA1.slice(2).join('\n') + '\n')]));
  const utf8 = correr(malUtf8);
  revisar(utf8.status === 1 && /línea 2: tiene bytes que no son UTF-8 válido/.test(utf8.stdout), 'INT-07, bytes que no son UTF-8: la línea se aparta con su motivo, no se reemplaza callando');
  const falta = correr(path.join(carpeta, 'no-existe.jsonl'), a1);
  revisar(falta.status === 1 && /no-existe\.jsonl: no se puede abrir/.test(falta.stdout) && /Equipo A1/.test(falta.stdout), 'INT-07, una ruta que no existe se dice y las demás se leen');
} finally {
  fs.rmSync(carpeta, { recursive: true, force: true });
}

console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
process.exit(fallos ? 1 : 0);
