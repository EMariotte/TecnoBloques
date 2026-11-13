// Casos sintéticos del ensayo I7 (EST-002, I6, E11; TecnoSuite/EstrategíaTecno/DISENO-I6-CALIDAD.md y
// material-I5/GUION-ENSAYO-I7.md). Recorre el guion de una pareja de la secuencia S1 como lo haría el aprendiz: sesión 1,
// A con X1 y B con Y1; sesión 2, B con X2 y A con Y2 (D5: el orden se invierte). Con el registro encendido, código de
// clase y grupo de la lista blanca, en la app de desarrollo o en el candidato empaquetado, y sin red (test/sin-red.js:
// el proceso principal corta y cuenta su red, con un control que lo demuestra; F03 de COD-20261112-001).
// Deja en una carpeta lo que el ensayo con personas tiene que producir: los cuatro JSON de respuestas, los .jsonl del
// registro y el manifiesto de la sección 13 del plan con la versión exacta.
// Revisión de los datos (F02 de COD-20261112-001): cada respuesta del JSON se coteja con su evento del registro (paso,
// pregunta, valor, tras_simular, hora y sesión) y con el guion; cada bloque debe tener sus eventos (tarea cargada, misión
// abierta, los cinco pasos, una compilación correcta antes de cada simulación y la misión terminada). Después, la misma
// revisión corre sobre copias alteradas de los datos (respuestas cambiadas a 999, compilaciones quitadas, un evento de
// respuesta quitado): cada control tiene que fallar; si uno pasa, la prueba falla.
// Medidas (plan, sección 12; F04): de los eventos salen datos técnicos (predicción entregada, arranque de la simulación,
// organizar, finalización), contados desde que la app abre la tarea, no desde que se entrega el control. Orientación y
// primer resultado (el comportamiento esperado) los observa una persona: van en la planilla y aquí quedan sin medir.
// Los tiempos son de la máquina, no de personas: sirven para comprobar que la captura es completa y legible.
// Uso: node test/ensayo-app.js [--app <carpeta win-unpacked>] [--setup <TecnoBloques-Setup-x.exe>] [--salida <carpeta>]
//      node test/ensayo-app.js --revisar <carpeta>   (sin abrir la app: revisa una salida guardada y corre los controles)
//      npm run test:ensayo   (arma con --simulador-local y usa la app de desarrollo)
'use strict';
const { execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sinRed = require('./sin-red');
const RAIZ = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const APP = arg('--app');
const SETUP = arg('--setup');
const REVISAR = arg('--revisar');
const SALIDA = REVISAR || arg('--salida') || path.join(__dirname, 'salida', 'ensayo');
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const PIN = '2468';
const GRUPO = 'Ensayo-1';
const SESIONES = [
  { sesion: 1, clase: 'K7Q2MX', bloques: [{ orden: 1, experiencia: 'A', tarea: 'X1', id: 'estudio_x1' }, { orden: 2, experiencia: 'B', tarea: 'Y1', id: 'estudio_y1' }] },
  { sesion: 2, clase: 'M3P8RT', bloques: [{ orden: 1, experiencia: 'B', tarea: 'X2', id: 'estudio_x2' }, { orden: 2, experiencia: 'A', tarea: 'Y2', id: 'estudio_y2' }] },
];
const ID_DE = { X1: 'estudio_x1', Y1: 'estudio_y1', X2: 'estudio_x2', Y2: 'estudio_y2' };
const NOMBRE = { estudio_x1: 'X1 · Luces en secuencia', estudio_y1: 'Y1 · Semáforo', estudio_x2: 'X2 · Brillo con potenciómetro', estudio_y2: 'Y2 · Servo con potenciómetro' };
// Las respuestas del guion (guía del facilitador): predicción, cierre y dificultad. En el paso 2 se marca la primera
// opción («Sí», valor «si»).
const RESPUESTAS = {
  estudio_x1: { predecir: ['11', '3'], final: ['4', 'Ahora son cuatro pasos de un segundo.'], dificultad: 1 },
  estudio_y1: { predecir: ['11', '5'], final: ['6', 'Se suma otro amarillo de un segundo.'], dificultad: 1 },
  estudio_x2: { predecir: ['127', '255'], final: ['Cambié la salida de mapear a 255–0.'], dificultad: 2 },
  estudio_y2: { predecir: ['90', '180'], final: ['Cambié la salida de mapear a 180–0.'], dificultad: 2 },
};
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const git = (c) => { try { return execSync(`git ${c}`, { cwd: RAIZ, encoding: 'utf8' }).trim(); } catch (e) { return null; } };

// =====================================================================================================================
// Revisión de los datos: pura (no abre la app). Entra lo que quedó en la carpeta; sale una lista de [condición, texto] y
// las medidas técnicas por bloque.
const numero = (v) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
function esperadoDe(id) {
  const R = RESPUESTAS[id];
  return [
    ...R.predecir.map((v) => ({ paso: 1, valor: numero(v), tras_simular: false })),
    { paso: 2, valor: 'si', tras_simular: true },
    ...R.final.map((v) => ({ paso: 5, valor: numero(v), tras_simular: true })),
    { paso: 5, valor: R.dificultad, tras_simular: true },
  ];
}
const igualJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// La hora del JSON es la de pulsar «Seguir» (`ahora` en src/app.js, una por paso); la del registro la pone cada evento al
// escribirse, en el mismo manejador: puede ir unos milisegundos después, nunca antes. Se acepta de 0 a 1000 ms.
const HOLGURA_MS = 1000;
const horaDe = (tJson, tRegistro) => Number.isFinite(tJson) && Number.isFinite(tRegistro) && tRegistro - tJson >= 0 && tRegistro - tJson <= HOLGURA_MS;
const mismaRespuesta = (j, r) => !!j && !!r && j.paso === r.paso && j.pregunta === r.pregunta && igualJSON(j.valor, r.valor) && j.tras_simular === r.tras_simular && j.sesion === r.sesion && horaDe(j.t, r.t);

function revisarDatos({ bloques, lineas, jsons }) {
  const c = [];
  const medidas = {};
  for (const b of bloques) {
    const etiqueta = `${b.tarea} en ${b.experiencia}`;
    const j = jsons[b.archivo] || null;
    const delEquipo = lineas.filter((l) => l.equipo === b.equipo);
    const deLaTarea = (tipo) => delEquipo.filter((l) => l.tipo === tipo && l.datos && l.datos.id === b.id);
    const carga = deLaTarea('ejemplo_cargado')[0] || null;
    const abierta = deLaTarea('mision_abierta')[0] || null;
    const terminada = carga ? deLaTarea('mision_terminada').find((l) => l.t >= carga.t) || null : null;
    const dentro = (l) => carga && terminada && l.t >= carga.t && l.t <= terminada.t;
    const compilaciones = delEquipo.filter((l) => l.tipo === 'codigo_compilado' && dentro(l));
    const simulaciones = delEquipo.filter((l) => l.tipo === 'simulacion_iniciada' && dentro(l));
    const pasos = deLaTarea('mision_paso').filter((l) => dentro(l)).map((l) => l.datos.paso);
    // 1. Los eventos del bloque
    c.push([!!carga && !!abierta && !!terminada, `${etiqueta}: el registro tiene la tarea cargada, la misión abierta y la misión terminada`]);
    c.push([igualJSON(pasos, [1, 2, 3, 4, 5]), `${etiqueta}: los cinco pasos de la misión, en orden (${pasos.join(', ') || 'ninguno'})`]);
    // Cada simulación del guion se compiló antes: entre la simulación anterior (o la carga) y ella hay una compilación correcta
    let previa = carga ? carga.t : Infinity;
    const sinCompilar = simulaciones.filter((s) => { const ok = compilaciones.some((k) => k.t >= previa && k.t <= s.t && k.datos && k.datos.ok === true); previa = s.t; return !ok; });
    c.push([simulaciones.length >= 2 && compilaciones.filter((k) => k.datos && k.datos.ok === true).length >= 2 && sinCompilar.length === 0,
      `${etiqueta}: ${simulaciones.length} simulaciones y ${compilaciones.length} compilaciones; cada simulación tiene su compilación correcta antes (${sinCompilar.length} sin ella)`]);
    // 2. El JSON descargado: de este equipo y esta tarea, terminado cuando el registro dice
    c.push([!!j, `${etiqueta}: el JSON de respuestas está y se puede leer (${b.archivo || 'sin archivo'})`]);
    const enJson = j ? (j.pasos || []).flatMap((p) => (p.respuestas || []).map((r) => ({ paso: p.paso, pregunta: r.pregunta, valor: r.valor, tras_simular: r.tras_simular, t: r.t, sesion: r.sesion }))) : [];
    c.push([!!j && j.equipo === b.equipo && j.tarea && j.tarea.id === b.id && j.simulo === true && !!terminada && horaDe(j.terminada, terminada.t) && !!abierta && horaDe(j.abierta, abierta.t) && Array.isArray(j.sesiones) && !!carga && j.sesiones.includes(carga.sesion),
      `${etiqueta}: el JSON es de ${b.equipo} y ${b.id}, simuló, y su apertura, cierre y sesión son los del registro`]);
    // 3. Respuesta por respuesta: JSON frente al registro (procedencia) y frente al guion (valores)
    const enRegistro = deLaTarea('mision_respuesta').filter((l) => dentro(l)).map((l) => ({ paso: l.datos.paso, pregunta: l.datos.pregunta, valor: l.datos.valor, tras_simular: l.datos.tras_simular, t: l.t, sesion: l.sesion }));
    const distintasReg = [];
    for (let k = 0; k < Math.max(enJson.length, enRegistro.length); k++) if (!mismaRespuesta(enJson[k], enRegistro[k])) distintasReg.push(k + 1);
    const desfase = enJson.map((r, k) => (enRegistro[k] ? enRegistro[k].t - r.t : null)).filter((x) => x !== null);
    c.push([enJson.length > 0 && distintasReg.length === 0, `${etiqueta}: las ${enJson.length} respuestas del JSON son las ${enRegistro.length} del registro, una a una (paso, pregunta, valor, tras_simular y sesión iguales; hora del registro de 0 a ${HOLGURA_MS} ms después: ${desfase.length ? Math.min(...desfase) + '–' + Math.max(...desfase) : '—'} ms)${distintasReg.length ? '; distintas: ' + distintasReg.join(', ') : ''}`]);
    const esperado = esperadoDe(b.id);
    const distintasGuion = [];
    for (let k = 0; k < Math.max(esperado.length, enJson.length); k++) {
      const e = esperado[k], r = enJson[k];
      if (!e || !r || e.paso !== r.paso || !igualJSON(e.valor, r.valor) || e.tras_simular !== r.tras_simular) distintasGuion.push(`${k + 1}: ${r ? JSON.stringify(r.valor) : 'falta'} ≠ ${e ? JSON.stringify(e.valor) : 'sobra'}`);
    }
    c.push([distintasGuion.length === 0, `${etiqueta}: los valores son los que escribió el guion (${esperado.length} esperados)${distintasGuion.length ? '; distintos: ' + distintasGuion.join('; ') : ''}`]);
    // Medidas técnicas, desde que la app abrió la tarea
    const desde = (l) => (carga && l ? l.t - carga.t : null);
    const p2 = carga && deLaTarea('mision_paso').find((l) => l.t >= carga.t && l.datos.paso === 2);
    const p3 = p2 && deLaTarea('mision_paso').find((l) => l.t >= p2.t && l.datos.paso === 3);
    medidas[`${b.sesion}-${b.orden}`] = {
      prediccion_entregada_ms: desde(enRegistro.find((r) => r.paso === 1)),
      arranque_simulacion_ms: desde(simulaciones[0]),
      organizar_ms: p2 && p3 ? p3.t - p2.t : null,
      finalizacion_ms: desde(terminada),
      completado: !!terminada,
      orientacion: null, primer_resultado: null,
      respuestas: enRegistro.length, simulaciones: simulaciones.length, compilaciones: compilaciones.length,
      sesionRegistro: carga ? carga.sesion : null,
    };
  }
  return { comprobaciones: c, medidas };
}

// Lee una carpeta de salida: el manifiesto (bloques), los JSON y los .jsonl copiados
function leerCarpeta(carpeta, bloquesDados) {
  const bloques = bloquesDados || JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto.json'), 'utf8')).bloques.map((b) => ({ ...b, id: ID_DE[b.tarea], archivo: b.archivoRespuestas }));
  const jsons = {};
  for (const b of bloques) if (b.archivo) { try { jsons[b.archivo] = JSON.parse(fs.readFileSync(path.join(carpeta, b.archivo), 'utf8')); } catch (e) { jsons[b.archivo] = null; } }
  const dir = path.join(carpeta, 'registros');
  const archivos = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort() : [];
  const lineas = archivos.flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => { try { return { archivo: f, ...JSON.parse(l) }; } catch (e) { return { archivo: f, ilegible: l }; } }));
  return { bloques, jsons, lineas, archivos };
}

// Los controles: copias alteradas de los mismos datos que la revisión tiene que rechazar
function controles(datos) {
  const copia = () => JSON.parse(JSON.stringify({ bloques: datos.bloques, jsons: datos.jsons, lineas: datos.lineas }));
  const lista = [];
  // a) la primera respuesta numérica de cada misión cambiada a 999 en el JSON (misma cantidad y esquema), como en F02
  { const d = copia(); for (const j of Object.values(d.jsons)) { const r = j && (j.pasos || []).flatMap((p) => p.respuestas || []).find((x) => typeof x.valor === 'number'); if (r) r.valor = 999; } lista.push(['respuestas numéricas cambiadas a 999 en el JSON', d]); }
  // b) sin ningún evento codigo_compilado, como en F02
  { const d = copia(); d.lineas = d.lineas.filter((l) => l.tipo !== 'codigo_compilado'); lista.push(['sin eventos codigo_compilado', d]); }
  // c) el mismo 999, pero en el registro y en el JSON a la vez (procedencia de acuerdo, valor fuera del guion)
  { const d = copia(); const tocadas = new Set(); for (const j of Object.values(d.jsons)) { const r = j && (j.pasos || []).flatMap((p) => p.respuestas || []).find((x) => typeof x.valor === 'number'); if (r) { tocadas.add(`${j.equipo}|${j.tarea.id}|${r.pregunta}`); r.valor = 999; } }
    for (const l of d.lineas) if (l.tipo === 'mision_respuesta' && tocadas.has(`${l.equipo}|${l.datos.id}|${l.datos.pregunta}`) && l.datos.paso === 1) l.datos.valor = 999; lista.push(['respuestas cambiadas a 999 en el JSON y en el registro', d]); }
  // d) una respuesta del registro quitada en cada bloque (el JSON sigue completo)
  { const d = copia(); const quitar = new Set(); for (const b of d.bloques) { const i = d.lineas.findIndex((l) => l.tipo === 'mision_respuesta' && l.equipo === b.equipo && l.datos.id === b.id); if (i >= 0) quitar.add(i); } d.lineas = d.lineas.filter((_l, i) => !quitar.has(i)); lista.push(['una respuesta del registro quitada por bloque', d]); }
  // e) la hora de una respuesta del registro movida 5 s por bloque (fuera de la holgura): la hora también se coteja
  { const d = copia(); for (const b of d.bloques) { const l = d.lineas.find((x) => x.tipo === 'mision_respuesta' && x.equipo === b.equipo && x.datos.id === b.id); if (l) l.t += 5000; } lista.push(['hora de una respuesta del registro movida 5 s por bloque', d]); }
  return lista.map(([nombre, d]) => { const r = revisarDatos(d); return { nombre, fallas: r.comprobaciones.filter(([ok]) => !ok).map(([, t]) => t) }; });
}

function revisarYControlar(datos) {
  const ilegibles = datos.lineas.filter((l) => l.ilegible).length;
  revisar(datos.archivos.length >= 2 && ilegibles === 0, `registro: ${datos.archivos.length} archivos .jsonl, ${datos.lineas.length} líneas, ${ilegibles} ilegibles`);
  const r = revisarDatos(datos);
  for (const [ok, t] of r.comprobaciones) revisar(ok, t);
  console.log('\n-- Controles: datos alterados que la revisión tiene que rechazar --');
  const ctl = controles(datos);
  for (const k of ctl) revisar(k.fallas.length > 0, `control «${k.nombre}»: rechazado con ${k.fallas.length} comprobaciones en falla${k.fallas.length ? ' (p. ej. «' + k.fallas[0] + '»)' : ' — NO SE DETECTÓ'}`);
  return { medidas: r.medidas, controles: ctl.map((k) => ({ nombre: k.nombre, rechazado: k.fallas.length > 0, fallas: k.fallas })) };
}

// El revisor del contrato de TecnoCircuito, si está al lado (EST-004)
function revisarContrato(datos) {
  const revisor = path.join(RAIZ, '..', 'TecnoCircuito', 'prototipo', 'pruebas', 'contrato_respuestas.js');
  if (!fs.existsSync(revisor)) { console.log('nota: sin el revisor del contrato de TecnoCircuito al lado; el JSON no se validó contra el esquema'); return; }
  const { revisarRespuestas } = require(revisor);
  for (const b of datos.bloques.filter((x) => x.archivo && datos.jsons[x.archivo])) {
    const r = revisarRespuestas(datos.jsons[b.archivo]);
    const malos = (r && r.errores) || (Array.isArray(r) ? r : []);
    revisar(malos.length === 0, `${b.tarea} en ${b.experiencia}: el JSON cumple el contrato de respuestas (${b.archivo})`);
  }
}

// =====================================================================================================================
if (REVISAR) {
  console.log(`Revisión de una salida guardada: ${REVISAR}`);
  const datos = leerCarpeta(REVISAR);
  const r = revisarYControlar(datos);
  revisarContrato(datos);
  fs.writeFileSync(path.join(os.tmpdir(), 'tecnobloques-ensayo-revision.json'), JSON.stringify(r, null, 1));
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
}

(async () => {
  const { _electron: electron } = require('playwright-core');
  fs.rmSync(SALIDA, { recursive: true, force: true });
  fs.mkdirSync(path.join(SALIDA, 'registros'), { recursive: true });
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')), TB_HERRAMIENTAS: 'instructor', ...sinRed.ENV_SIN_RED };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-ensayo-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  fs.mkdirSync(datos, { recursive: true });
  const errores = [];
  const opciones = ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', ...sinRed.ARGS_SIN_RED];
  const app = APP
    ? await electron.launch({ executablePath: path.join(APP, 'TecnoBloques.exe'), args: [`--user-data-dir=${datos}`, ...opciones], env })
    : await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`, ...opciones], cwd: RAIZ, env });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errores.push(String(e)));
  await win.waitForLoadState('load');
  // Sin red: el corte del proceso principal va antes de todo (electron-updater busca a los 5 s en la empaquetada)
  const control = await sinRed.controlarCorte(app, win);
  for (const [c, t] of control.comprobaciones) revisar(c, `sin red: ${t}`);
  await app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0]; v.unmaximize(); v.setContentSize(1536, 864); });
  await win.waitForTimeout(1500);
  const pausa = (t) => win.waitForTimeout(t);
  const esperar = (condicion, t = 60000) => win.waitForFunction(condicion, null, { timeout: t, polling: 200 }).then(() => true, () => false);
  const focoEn = (id) => win.waitForFunction((i) => document.activeElement && document.activeElement.id === i, id, { timeout: 3000, polling: 10 }).then(() => true, () => false);
  const boton = (texto) => win.locator('#modalAcciones button', { hasText: texto }).click();
  const instructor = (p) => win.evaluate((q) => tbEscritorio.registro.instructor({ ...q, pin: window.__pin }), p);
  await win.evaluate((p) => { window.__pin = p; }, PIN);
  const info = await win.evaluate(() => ({ titulo: document.title, origen: window.TB_SIMULADOR_ORIGEN || null, pantalla: [screen.width, screen.height], escala: Math.round(devicePixelRatio * 100), empaquetada: null }));
  try { info.empaquetada = await win.evaluate(() => tbEscritorio.info()); } catch (e) { /* sin info */ }
  console.log(`app: ${info.titulo} · simulador de ${info.origen} · pantalla ${info.pantalla.join('×')} al ${info.escala} % · ${APP ? 'empaquetada' : 'desarrollo'}`);

  // ---- Preparación del instructor: PIN, registro encendido, lista blanca
  await instructor({ accion: 'crear-pin' });
  const act = await instructor({ accion: 'activar', activo: true });
  // Encendido por la IPC, como en test:misiones: la página se entera por su panel; aquí se le dice directamente
  await win.evaluate((a) => { registroEncendido = !!a; pintarAvisoRegistro(); }, act && act.activo);
  revisar(act && act.activo === true, 'preparación: el registro queda encendido con el PIN del instructor');
  const lista = await instructor({ accion: 'estudio-lista', lista: `${GRUPO}\nEnsayo-2` });
  revisar(lista && lista.ok, 'preparación: la lista blanca tiene los dos grupos del ensayo');

  async function entrarGrupo(clase) {
    await win.evaluate(() => { if (!$('modal').hidden) cerrarModal(false); pedirGrupo(); });
    if (!(await focoEn('claseEstudio'))) console.log(`       entrar: sin foco en claseEstudio; pantalla ${JSON.stringify(await win.evaluate(() => ({ titulo: $('modal').hidden ? null : $('modalTitulo').textContent, botones: [...document.querySelectorAll('#modalAcciones button')].map((b) => b.textContent), campos: [...document.querySelectorAll('#modalCuerpo input')].map((i) => i.id) })))}`);
    await win.locator('#claseEstudio').fill(clase);
    await win.locator('#grupoEstudio').fill(GRUPO);
    await boton('Seguir');
    await pausa(600);
    const estado = await win.evaluate(() => ({ titulo: $('modal').hidden ? null : $('modalTitulo').textContent, botones: [...document.querySelectorAll('#modalAcciones button')].map((b) => b.textContent), error: $('errorGrupo') ? $('errorGrupo').textContent : null }));
    if (!/Son el equipo/.test(estado.titulo || '')) console.log(`       entrar: la pantalla tras «Seguir» es ${JSON.stringify(estado)}`);
    await boton('Sí, somos ese equipo'); // «¿Son el equipo …?»
    await win.evaluate(() => cambioDeEquipo);
    await pausa(400);
    return win.evaluate(() => registroEventos.equipo());
  }
  async function ponerVariante(v) {
    const r = await instructor({ accion: 'estudio-variante', variante: v });
    await win.evaluate((x) => aplicarVariante(x), v);
    await pausa(600);
    if (v === 'A' && await win.evaluate(() => [...document.querySelectorAll('.lado-vacio')].some((n) => n.offsetParent !== null))) {
      await win.locator('#ladoIzq .lado-vacio button[data-herr="bloques"]').click();
      await pausa(300);
      await win.locator('#ladoDer .lado-vacio button[data-herr="circuito"]').click();
      await pausa(600);
    }
    return r && r.ok && await win.evaluate(() => document.body.dataset.variante) === v;
  }
  async function abrirTarea(nombre) {
    await win.locator('#btnEjemplos').click();
    await pausa(300);
    await win.locator('#listaEjemplos button', { hasText: nombre }).click();
    await pausa(300);
    await win.locator('#modalAcciones button', { hasText: 'Abrir ejemplo' }).click();
    await pausa(900);
  }
  const seguir = () => win.locator('#misionSeguir').click().then(() => pausa(400));
  const simular = async () => { await win.locator('#btnSimularBarra').click(); return esperar(() => !!simulador.sim && simulador.sim.medidas().msSimulados > 300); };
  const panel = () => win.evaluate(() => ({ titulo: $('misionTitulo') ? $('misionTitulo').textContent : null, avance: $('misionAvance') ? $('misionAvance').textContent : null, boton: $('misionSeguir') ? $('misionSeguir').textContent : null }));
  await win.evaluate(() => { window.__descargas = []; descargar = (nombre, contenido, tipo) => { window.__descargas.push({ nombre, contenido, tipo }); }; });

  // ---- Las dos sesiones, bloque por bloque, como dice la guía
  const bloques = [];
  for (const s of SESIONES) {
    const clase = await instructor({ accion: 'estudio-clase', codigo: s.clase });
    revisar(clase && clase.ok, `sesión ${s.sesion}: código de clase ${s.clase}`);
    for (const b of s.bloques) {
      const bloque = { sesion: s.sesion, orden: b.orden, experiencia: b.experiencia, tarea: b.tarea, id: b.id, incidencias: [] };
      revisar(await ponerVariante(b.experiencia), `sesión ${s.sesion}, bloque ${b.orden}: variante ${b.experiencia} puesta por el instructor`);
      const equipo = await entrarGrupo(s.clase);
      revisar(equipo === `${s.clase}-${GRUPO}`, `sesión ${s.sesion}, bloque ${b.orden}: el equipo es ${equipo}`);
      bloque.equipo = equipo;
      await abrirTarea(NOMBRE[b.id]);
      let p = await panel();
      revisar(p.titulo === NOMBRE[b.id] && /Paso 1/.test(p.avance), `${b.tarea} en ${b.experiencia}: la misión abre en el paso 1 (${p.avance})`);
      const R = RESPUESTAS[b.id];
      // 1. Predecir
      await pausa(1500);
      await win.locator('#mision0q0').fill(R.predecir[0]);
      await win.locator('#mision0q1').fill(R.predecir[1]);
      await seguir();
      // 2. Simular
      revisar(await simular(), `${b.tarea} en ${b.experiencia}: la primera simulación arranca`);
      await pausa(2000);
      await win.locator('#mision1q0o0').check();
      await seguir();
      // 3. Organizar la pantalla: el circuito a toda la pantalla y de vuelta
      await win.locator('#ampliarDer').click();
      await pausa(1200);
      await win.locator('#ampliarDer').click();
      await pausa(600);
      await seguir();
      // 4. Cambiar el programa: la solución del facilitador, y simular para comprobarlo
      await win.evaluate((i) => { detenerSimulacion(); cargarXML(EJEMPLOS.find((e) => e.id === i).solucion); actualizar(); }, b.id);
      await pausa(800);
      revisar(await simular(), `${b.tarea} en ${b.experiencia}: la simulación del cambio arranca`);
      await pausa(1500);
      await seguir();
      // 5. Para terminar
      p = await panel();
      revisar(/Paso 5/.test(p.avance) && p.boton === 'Terminar misión', `${b.tarea} en ${b.experiencia}: llega al paso 5 (${p.avance}, «${p.boton}»)`);
      for (let k = 0; k < R.final.length; k++) await win.locator(`#mision4q${k}`).fill(R.final[k]);
      await win.locator(`#mision4q${R.final.length}o${R.dificultad - 1}`).check();
      await win.evaluate(() => detenerSimulacion());
      await seguir();
      await pausa(500);
      const d = await win.evaluate(() => { const bt = $('misionDescargar'); if (!bt) return null; window.__descargas = []; bt.click(); return window.__descargas.pop() || null; });
      revisar(d && d.nombre && d.contenido, `${b.tarea} en ${b.experiencia}: «Descargar respuestas» entrega el archivo (${d && d.nombre})`);
      if (d) {
        bloque.archivo = `s${s.sesion}-b${b.orden}-${b.tarea}-${b.experiencia}-${d.nombre}`;
        fs.writeFileSync(path.join(SALIDA, bloque.archivo), d.contenido);
      }
      bloques.push(bloque);
      // Restaurar el equipo para el bloque siguiente: sin simulación y sin heredar nada
      await win.evaluate(() => { detenerSimulacion(); });
      await pausa(500);
    }
  }
  // Lo que la app intentó por su cuenta, sin los controles: cancelado y contado
  await win.waitForTimeout(Math.max(0, 8000 - (await app.evaluate(() => process.uptime() * 1000))));
  const red = await sinRed.resumenIntentos(app, control.datos.puerto);
  let registroActualizacion = null;
  try { registroActualizacion = fs.readFileSync(path.join(datos, 'registro-actualizacion.txt'), 'utf8').trim().split(/\r?\n/).slice(-4); } catch (e) { /* la app de desarrollo no busca actualizaciones */ }
  await app.close();
  const ajenos = red.intentos.filter((i) => !(i.via === 'chromium' && i.sesion === 'electron-updater'));
  revisar(ajenos.length === 0, `sin red: fuera del actualizador, nada intentó salir (${ajenos.length}); intentos propios cancelados y contados: ${red.total} ${JSON.stringify(red.porVia)}`);

  // ---- Lo que queda en el PC: los .jsonl del registro, copiados a la salida
  const registros = path.join(datos, 'registros');
  for (const f of fs.existsSync(registros) ? fs.readdirSync(registros).filter((x) => x.endsWith('.jsonl')) : []) fs.copyFileSync(path.join(registros, f), path.join(SALIDA, 'registros', f));

  // ---- La revisión de los datos y sus controles, sobre lo que quedó en la carpeta
  const leidos = leerCarpeta(SALIDA, bloques);
  console.log('\n-- Revisión de los datos (registro, JSON y guion) --');
  const rev = revisarYControlar(leidos);
  revisarContrato(leidos);
  for (const b of bloques) {
    const m = rev.medidas[`${b.sesion}-${b.orden}`];
    console.log(`sesión ${b.sesion} bloque ${b.orden} · ${b.tarea} en ${b.experiencia} (${b.equipo}): predicción entregada ${m.prediccion_entregada_ms} ms · arranque de la simulación ${m.arranque_simulacion_ms} ms · organizar ${m.organizar_ms} ms · finalización ${m.finalizacion_ms} ms · ${m.respuestas} respuestas, ${m.simulaciones} simulaciones, ${m.compilaciones} compilaciones`);
  }

  // ---- El manifiesto de la sección 13 del plan, con la versión exacta y las condiciones reales
  let bateria = null;
  try { bateria = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_Battery).BatteryStatus"', { encoding: 'utf8' }).trim(); } catch (e) { /* sin batería */ }
  const tcPkg = (() => { try { return require(path.join(RAIZ, 'node_modules', 'tecnocircuito', 'package.json')).version; } catch (e) { return null; } })();
  const manifiesto = {
    formato: 1, ejecucionId: `ensayo-sintetico-${new Date().toISOString().slice(0, 10)}`, fecha: new Date().toISOString(), zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tipo: 'ensayo_sintetico', versionProtocolo: 'EST-002-I6', secuencia: 'S1', parejaId: GRUPO,
    bloques: bloques.map((b) => ({ sesion: b.sesion, orden: b.orden, experiencia: b.experiencia, tarea: b.tarea, equipo: b.equipo, archivoRespuestas: b.archivo || null })),
    software: {
      tecnobloques: { version: require(path.join(RAIZ, 'package.json')).version, head: git('rev-parse HEAD'), archivosModificados: (git('status --porcelain') || '').split('\n').filter(Boolean) },
      tecnocircuito: { version: tcPkg, origenDelSimulador: info.origen, dependencia: require(path.join(RAIZ, 'package.json')).dependencies.tecnocircuito },
      candidato: APP ? { carpeta: APP, exeSha256: sha256(path.join(APP, 'TecnoBloques.exe')), setup: SETUP ? { ruta: SETUP, sha256: sha256(SETUP), bytes: fs.statSync(SETUP).size } : null, info: info.empaquetada } : null,
    },
    entorno: {
      equipoId: APP ? 'pc-candidato' : 'pc-desarrollo', resolucion: info.pantalla, escalaWindowsPorcentaje: info.escala, conCargador: bateria === '2',
      redDisponible: false, red: { corte: 'proceso principal (test/sin-red.js): nombres sin resolver desde el arranque, pedidos de las sesiones y sockets de Node cancelados y contados', control: control.datos, intentosPropios: red.porVia, registroActualizacion },
      destino: 'simulacion', placa: 'uno', tiemposDe: 'máquina (casos sintéticos), no de personas',
    },
    origenDeLosTiempos: 'Cada tiempo se cuenta desde el evento ejemplo_cargado (la app abre la tarea), no desde que se entrega el control: en el aula el cronómetro empieza al entregar el control y lo lleva el observador (planilla).',
    incidencias: bloques.flatMap((b) => b.incidencias.map((i) => ({ bloque: `${b.sesion}-${b.orden}`, que: i }))).concat(errores.map((e) => ({ bloque: null, que: `error de página: ${e}` }))),
    resultados: bloques.map((b) => ({ sesion: b.sesion, orden: b.orden, experiencia: b.experiencia, tarea: b.tarea, ...rev.medidas[`${b.sesion}-${b.orden}`] })),
    revisionDeDatos: { controles: rev.controles.map((k) => ({ nombre: k.nombre, rechazado: k.rechazado, fallas: k.fallas.length })) },
    limites: [
      'orientación y primer resultado (el comportamiento esperado de la tarea) los observa una persona y van en la planilla; en estos casos sintéticos no hay observador y quedan sin medir (null), no en cero',
      'arranque_simulacion_ms es un dato técnico (la primera simulación arrancó); no es el primer resultado del plan, sección 12',
      'ayudas, explicación causal y dificultad observada las anota el observador; aquí no se inventan',
      'los tiempos son de un guion automático: no describen a aprendices ni a adultos',
      'el corte de red cubre el proceso de TecnoBloques (Chromium y Node); arduino-cli es un proceso aparte, con HTTP(S)_PROXY a un puerto cerrado; la desconexión física es la de E10',
    ],
  };
  fs.writeFileSync(path.join(SALIDA, 'manifiesto.json'), JSON.stringify(manifiesto, null, 1));
  revisar(errores.length === 0, `sin errores de JavaScript en la página${errores.length ? ': ' + errores.join(' | ') : ''}`);
  console.log(`\nsalida: ${SALIDA} (${bloques.filter((b) => b.archivo).length} JSON, ${leidos.archivos.length} .jsonl, manifiesto.json)`);
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
