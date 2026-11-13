// Prueba la app ya empaquetada (win-unpacked) tal como queda instalada. Con --estudio (EST-002, I6, E9; TEC-11) sigue con
// el estudio A/B sin red: el instructor pone A con su PIN, X1 abre con su misión y simula con el arduino-cli del paquete;
// luego B con Y2. Sin red de verdad (F03 de COD-20261112-001): el proceso principal corta los nombres desde que arranca y,
// con test/sin-red.js, cancela y cuenta todo pedido de sus sesiones (la de la ventana y la de electron-updater) y de sus
// sockets de Node; un control con un servidor local prueba que el corte rechaza lo que antes llegaba.
// Uso: node test/app-empaquetada.js <carpeta win-unpacked> [--estudio]
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const sinRed = require('./sin-red');
(async () => {
  const dir = process.argv[2];
  const conEstudio = process.argv.includes('--estudio');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE'));
  if (conEstudio) Object.assign(env, sinRed.ENV_SIN_RED); // para los procesos hijos (arduino-cli)
  // Carpeta de datos aparte: si la app instalada está abierta, no choca con ella (una sola instancia)
  const datos = path.join(require('os').tmpdir(), 'tecnobloques-prueba');
  if (conEstudio) { fs.rmSync(datos, { recursive: true, force: true }); fs.mkdirSync(datos, { recursive: true }); }
  const app = await electron.launch({ executablePath: path.join(dir, 'TecnoBloques.exe'), args: [`--user-data-dir=${datos}`, ...(conEstudio ? sinRed.ARGS_SIN_RED : [])], env });
  const win = await app.firstWindow();
  const errores = [];
  win.on('pageerror', (e) => errores.push(String(e)));
  await win.waitForLoadState('load');
  // El corte va antes de todo lo demás; electron-updater busca a los 5 s de arrancar (escritorio/main.js)
  const control = conEstudio ? await sinRed.controlarCorte(app, win) : null;
  await win.waitForTimeout(2500);
  const r = await win.evaluate(async () => {
    const info = await window.tbEscritorio.info();
    ponerNivel(3); cargarEjemplo(EJEMPLOS[1]); actualizar();
    const t = Date.now();
    const c = await window.tbEscritorio.subir({ codigo: codigoActual(), fqbn: placa().fqbn, soloCompilar: true });
    return { info, compila: c.ok, memoria: c.memoria, ms: Date.now() - t, titulo: document.title };
  });
  console.log(JSON.stringify(r));
  let est = null;
  if (conEstudio) {
    const pausa = (t) => win.waitForTimeout(t);
    const esperar = (c, t = 60000) => win.waitForFunction(c, null, { timeout: t, polling: 200 }).then(() => true, () => false);
    const instructor = (p) => win.evaluate((q) => tbEscritorio.registro.instructor({ ...q, pin: '2468' }), p);
    const variante = async (v) => { const x = await instructor({ accion: 'estudio-variante', variante: v }); await win.evaluate((y) => aplicarVariante(y), v); await pausa(600); return x && x.ok && await win.evaluate(() => document.body.dataset.variante) === v; };
    const abrir = (id) => win.evaluate((i) => cargarEjemplo(EJEMPLOS.find((e) => e.id === i)), id).then(() => pausa(800));
    const panel = () => win.evaluate(() => ({ ve: !!$('misiones') && $('misiones').offsetParent !== null, titulo: $('misionTitulo') ? $('misionTitulo').textContent : null }));
    const simula = async () => { await win.evaluate(() => detenerSimulacion()); await pausa(300); const t = Date.now(); await win.locator('#btnSimularBarra').click(); const ok = await esperar(() => !!simulador.sim && simulador.sim.medidas().msSimulados > 300); return { ok, ms: Date.now() - t }; };
    est = { origen: await win.evaluate(() => window.TB_SIMULADOR_ORIGEN || null) };
    await instructor({ accion: 'crear-pin' });
    est.registro = (await instructor({ accion: 'activar', activo: true })).activo === true;
    est.A = await variante('A');
    if (await win.evaluate(() => [...document.querySelectorAll('.lado-vacio')].some((n) => n.offsetParent !== null))) {
      await win.locator('#ladoIzq .lado-vacio button[data-herr="bloques"]').click(); await pausa(300);
      await win.locator('#ladoDer .lado-vacio button[data-herr="circuito"]').click(); await pausa(600);
    }
    await abrir('estudio_x1');
    est.panelA = await panel();
    est.simA = await simula();
    est.B = await variante('B');
    await abrir('estudio_y2');
    est.panelB = await panel();
    est.franjaB = await win.evaluate(() => $('franjaActividad') && $('franjaActividad').offsetParent !== null);
    est.simB = await simula();
    await win.evaluate(() => detenerSimulacion());
    // Que el actualizador haya buscado (a los 5 s de estar lista la app) antes de leer los intentos y su registro
    await win.waitForTimeout(Math.max(0, 8000 - (await app.evaluate(() => process.uptime() * 1000))));
    est.red = await sinRed.resumenIntentos(app, control.datos.puerto);
    try { est.registroActualizacion = fs.readFileSync(path.join(datos, 'registro-actualizacion.txt'), 'utf8').trim().split(/\r?\n/).slice(-4); } catch (e) { est.registroActualizacion = null; }
    console.log(JSON.stringify({ ...est, red: { total: est.red.total, porVia: est.red.porVia } }));
    console.log('control de red:', JSON.stringify(control.datos));
  }
  console.log('ERRORES:', errores);
  await app.close();
  // AUD-29: salida distinta de 0 si la app empaquetada no abre como tal, no compila o tiene errores de página
  const fallas = [];
  const revisar = (condicion, texto) => { console.log((condicion ? 'OK    ' : 'FALLA ') + texto); if (!condicion) fallas.push(texto); };
  revisar(r.info && r.info.empaquetada === true && r.info.arduino === 'paquete', `es la app empaquetada, con el Arduino del paquete (${JSON.stringify(r.info)})`);
  revisar(r.titulo === `TecnoBloques ${r.info && r.info.version}`, `el título dice su versión («${r.titulo}»)`);
  revisar(r.compila === true && !!r.memoria, `compila el ejemplo (${r.ms} ms)`);
  revisar(!errores.length, 'sin errores de JavaScript en la página');
  if (conEstudio) {
    revisar(est.origen === 'etiqueta', `el simulador del paquete viene de la etiqueta (${est.origen})`);
    revisar(est.registro && est.A && est.panelA.ve && est.panelA.titulo === 'X1 · Luces en secuencia', `A: el instructor pone A con su PIN y X1 abre con su misión (${JSON.stringify(est.panelA)})`);
    revisar(est.simA.ok, `A: X1 compila con el Arduino del paquete y simula (${est.simA.ms} ms)`);
    revisar(est.B && est.franjaB && est.panelB.ve && est.panelB.titulo === 'Y2 · Servo con potenciómetro', `B: Y2 abre en «Programar y probar» con su misión (${JSON.stringify(est.panelB)})`);
    revisar(est.simB.ok, `B: Y2 compila y simula (${est.simB.ms} ms)`);
    for (const [c, t] of control.comprobaciones) revisar(c, `sin red: ${t}`);
    // Lo que la app intentó por su cuenta quedó cancelado y contado. La ventana no usa la red; el actualizador sí la busca
    const deLaVentana = est.red.intentos.filter((i) => !(i.via === 'chromium' && i.sesion === 'electron-updater'));
    revisar(deLaVentana.length === 0, `sin red: fuera del actualizador, nada intentó salir (${deLaVentana.length}: ${JSON.stringify(deLaVentana.map((i) => i.url))})`);
    const delActualizador = est.red.total - deLaVentana.length;
    const errorAnotado = Array.isArray(est.registroActualizacion) && est.registroActualizacion.some((l) => l.includes('[error]'));
    revisar(errorAnotado, `sin red: el actualizador buscó, no obtuvo respuesta y lo anotó en su registro (${delActualizador} pedidos cancelados; ${JSON.stringify(est.registroActualizacion)})`);
  }
  console.log(fallas.length ? `\n${fallas.length} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
