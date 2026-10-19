// La historia de un registro (REG-004): una secuencia conocida, armada con el sobre real (crearRegistroEventos) y un
// reloj fijo, tiene que contarse tal como pasó, y un registro con defectos (los de AUD-01 a AUD-04) tiene que
// avisarlos. También prueba la línea de comandos: una carpeta, --json y una línea que no se puede leer.
// Uso: npm run test:historia
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
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
const iniciar = (corrida, modo, componentes, cables) => sim('simulacion_iniciada', corrida, 0, {
  placa: 'uno', modo, activas: { danoComponentes: modo === 'realista', limitePin: modo === 'realista' },
  circuito: { formato: 1, placa: 'uno', protoboard: null, componentes, cables },
});
const LED = { id: 'led1', tipo: 'led', x: 0, y: 0, rot: 0, props: { color: 'rojo' } };
const R1 = { id: 'r1', tipo: 'resistencia', x: 0, y: 0, rot: 0, props: { valor: 220 } };
const BTN = { id: 'btn1', tipo: 'boton', x: 0, y: 0, rot: 0, props: {} };

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
  '10:01  Circuito: agregó led1 (led); conectó placa.D13 → led1.anodo, led1.catodo → placa.GND1; movió led1 (2 veces).',
  '10:02  Bloques: 5 (3 tipos).',
  '10:02  Compiló: bien, 924 bytes.',
  '10:02  ▶ Corrida 1 (realista; 1 pieza, 2 cables).',
  '10:02     falla: LED quemado (led1), a los 0,0 s simulados.',
  '10:02     falla: corriente del pin (placa), a los 0,0 s simulados.',
  '10:02  ■ Corrida 1 terminó: 41,0 s simulados. Fallas: LED quemado (led1), corriente del pin (placa).',
  '10:04  Circuito: agregó r1 (resistencia); cambió r1: valor 220; conectó placa.D13 → r1.1, r1.2 → led1.anodo; desconectó placa.D13 → led1.anodo.',
  '10:04  Compiló: bien, 924 bytes.',
  '10:04  ▶ Corrida 2 (realista; 2 piezas, 4 cables).',
  '10:05     pausó.',
  '10:05     siguió.',
  '10:05  ■ Corrida 2 terminó: 40,0 s simulados. Sin fallas. Corrigió: LED quemado (led1), corriente del pin (placa).',
  '10:06  Circuito: agregó btn1 (boton); quitó r1 (resistencia).',
  '10:06  Compiló: con error (no_declarado).',
  '10:07  Compiló: bien, 1100 bytes.',
  '10:07  ▶ Corrida 3 (realista; 2 piezas, 3 cables).',
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
revisar(/«algo_nuevo» que esta historia no conoce/.test(avisos), 'un tipo nuevo no rompe la historia: se avisa y se ignora');

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
revisar(trasIncompleta.corridas[1].corrigio === null && narrar([trasIncompleta]).includes('No se compara con la corrida 18: quedó sin cierre.') &&
  trasIncompleta.resumen === '2 corrida(s). Fallas vistas: LED quemado (led1). Corregidas al final: LED quemado (led1). Sin corregir: ninguna.' && con(trasIncompleta, 'La corrida 18 no tiene cierre'),
`una corrida después de otra sin cierre no se compara con ella; la última está completa y coherente, así que el final sí se sabe («${trasIncompleta.resumen}»)`);

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

// ---- La línea de comandos: una carpeta con dos archivos y una línea dañada, en texto y en --json
const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-historia-'));
try {
  fs.writeFileSync(path.join(carpeta, 'A1-2026-10-19.jsonl'), historiaA1.join('\n') + '\n');
  fs.writeFileSync(path.join(carpeta, 'B2-2026-10-19.jsonl'), historiaB2.join('\n') + '\n{ dañada\n');
  fs.writeFileSync(path.join(carpeta, 'notas.txt'), 'no es un registro');
  const cli = path.join(__dirname, '..', 'herramientas', 'historia-registro.js');
  const salida = execFileSync(process.execPath, [cli, carpeta], { encoding: 'utf8' });
  revisar(salida.indexOf('Equipo A1') >= 0 && salida.indexOf('Equipo A1') < salida.indexOf('Equipo B2'), 'la carpeta: lee los dos .jsonl, en orden de hora, y no el .txt');
  revisar(/B2-2026-10-19\.jsonl, línea 11: no se puede leer/.test(salida), 'la línea dañada se dice con su archivo y número, sin detener la historia');
  const datos = JSON.parse(execFileSync(process.execPath, [cli, path.join(carpeta, 'A1-2026-10-19.jsonl'), '--json'], { encoding: 'utf8' }));
  revisar(datos.historias.length === 1 && datos.historias[0].corridas.length === 3 && datos.problemas.length === 0, '--json: la historia como datos, para el análisis');
  const { lineas: todas } = leerArchivos([carpeta]);
  revisar(todas.length === historiaA1.length + historiaB2.length, `leerArchivos: ${todas.length} líneas buenas`);
} finally {
  fs.rmSync(carpeta, { recursive: true, force: true });
}

console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
process.exit(fallos ? 1 : 0);
