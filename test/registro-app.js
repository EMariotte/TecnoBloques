// Prueba de punta a punta del registro de eventos en la app de escritorio (contrato con TecnoCircuito, sección 6.1):
// apagado por defecto; el instructor crea su PIN y lo enciende (Ctrl+Alt+Mayús+R); el equipo escribe su código y lo
// confirma; carga un ejemplo, cambia bloques, simula y detiene; al cerrar y abrir otra vez, el registro sigue
// encendido y pide el código; el instructor lo apaga. El .jsonl resultante se revisa contra contrato/evento.schema.json
// con el revisor de TecnoCircuito. Necesita arduino-cli (como test:simulador).
// Uso: npm run test:registro-app   (arma con --simulador-local; necesita ..\TecnoCircuito\prototipo\dist\tecnocircuito.js)
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(__dirname, 'salida');
fs.mkdirSync(SALIDA, { recursive: true });
const REVISOR = path.join(RAIZ, '..', 'TecnoCircuito', 'prototipo', 'pruebas', 'contrato_eventos.js');
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}

const LED = {
  formato: 1, placa: 'uno', protoboard: null,
  componentes: [{ id: 'led1', tipo: 'led', x: 380, y: -100, rot: 0, props: { color: 'rojo' } }],
  cables: [
    { de: 'placa.D13', a: 'led1.anodo', color: 'naranja', puntos: [[125, -20.35], [405, -20.35]] },
    { de: 'led1.catodo', a: 'placa.GND1', color: 'negro', puntos: [[395, -40], [115.5, -40]] }
  ]
};

(async () => {
  // TB_HERRAMIENTAS=instructor: F12 se comporta como en la app instalada (solo con el PIN del instructor)
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')), TB_HERRAMIENTAS: 'instructor' };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-registro-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  const registros = path.join(datos, 'registros');
  const errores = [];

  async function abrir() {
    const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`], cwd: RAIZ, env });
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await win.waitForLoadState('load');
    await win.waitForTimeout(1500);
    return { app, win };
  }
  const esperar = (win, condicion, ms = 40000) => win.waitForFunction(condicion, null, { timeout: ms, polling: 200 }).then(() => true, () => false);
  const titulo = (win) => win.evaluate(() => ($('modal').hidden ? null : $('modalTitulo').textContent));
  const boton = (win, texto) => win.locator('#modalAcciones button', { hasText: texto }).click();
  const leerRegistro = () => (fs.existsSync(registros) ? fs.readdirSync(registros) : [])
    .flatMap((f) => fs.readFileSync(path.join(registros, f), 'utf8').split('\n').filter(Boolean).map((l) => ({ archivo: f, ...JSON.parse(l) })));

  // 1. Recién instalada: el registro está apagado; no se pide código ni se escribe nada
  let { app, win } = await abrir();
  revisar(await titulo(win) === null && await win.evaluate(() => $('avisoRegistro').hidden), 'apagado por defecto: no pide código ni muestra el aviso');
  await win.evaluate(() => { cargarEjemplo(EJEMPLOS.find((e) => e.id === 'eco')); });
  await win.waitForTimeout(500);
  revisar(!fs.existsSync(registros), 'con el registro apagado no se crea la carpeta registros');
  const herramientas = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened());
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }));
  await win.waitForTimeout(800);
  revisar(!(await herramientas()), 'sin el PIN del instructor, F12 no abre las herramientas de desarrollo');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.openDevTools());
  await win.waitForTimeout(800);
  revisar(!(await herramientas()), 'y si se abren por otro camino, se cierran solas');

  // 2. El instructor crea su PIN y enciende el registro
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  revisar(/crear el PIN/.test(await titulo(win) || ''), `Ctrl+Alt+Mayús+R abre la opción del instructor: «${await titulo(win)}»`);
  await win.locator('#pinNuevo').fill('2468');
  await win.locator('#pinRepetido').fill('2469');
  await boton(win, 'Crear PIN');
  revisar(/no son iguales/.test(await win.locator('#modalCuerpo .error').textContent()), 'dos PIN distintos: lo avisa');
  await win.locator('#pinRepetido').fill('2468');
  await boton(win, 'Crear PIN');
  await win.waitForTimeout(300);
  revisar(/apagado/.test(await win.locator('#modalCuerpo').textContent()), 'el panel del instructor dice que está apagado');
  await win.screenshot({ path: path.join(SALIDA, 'registro_1_instructor.png') });
  await boton(win, 'Encender el registro');
  await win.waitForTimeout(400);

  // 3. El equipo escribe su código y lo confirma
  revisar(await titulo(win) === 'Código del equipo', 'al encenderlo, pide el código del equipo');
  await boton(win, 'Seguir');
  revisar(/Escriban el código/.test(await win.locator('#modalCuerpo .error').textContent()), 'sin código: lo pide');
  await win.locator('#codigoEquipo').fill('  B9 ');
  await boton(win, 'Seguir');
  await win.waitForTimeout(200);
  revisar(await titulo(win) === '¿Son el equipo B9?', 'pide confirmar: «¿Son el equipo B9?»');
  await boton(win, 'Corregir');
  await win.waitForTimeout(200);
  revisar(await win.locator('#codigoEquipo').inputValue() === 'B9', 'Corregir vuelve al código escrito');
  await win.locator('#codigoEquipo').fill('A7');
  await win.locator('#codigoEquipo').press('Enter');
  await win.waitForTimeout(200);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(200);
  const aviso = await win.evaluate(() => ({ visible: !$('avisoRegistro').hidden, texto: $('avisoRegistro').textContent }));
  revisar(aviso.visible && aviso.texto === 'Esta sesión se registra · Equipo A7', `el aviso discreto: «${aviso.texto}»`);
  await win.screenshot({ path: path.join(SALIDA, 'registro_2_aviso.png') });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }));
  await win.waitForTimeout(800);
  const abiertas = await herramientas();
  if (abiertas) await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.closeDevTools());
  revisar(abiertas, 'después del PIN del instructor, F12 sí abre las herramientas (hasta cerrar la app)');

  // 4. El equipo trabaja: abre un ejemplo, cambia bloques, simula y detiene
  await win.evaluate((circuito) => {
    cargarEjemplo(EJEMPLOS.find((e) => e.id === 'eco'));
    $('nombreProyecto').value = 'LED de Sofía'; // un nombre que escribe el aprendiz: no debe llegar al registro
    actualizar();
    const p = proyectoActual();
    p.circuito = circuito;
    cargarProyecto(p, true);
  }, LED);
  await win.evaluate(() => {
    const prog = espacio.getBlocksByType('programa')[0];
    const b = Blockly.serialization.blocks.append({ type: 'esperar', inputs: { MS: { shadow: { type: 'math_number', fields: { NUM: 100 } } } } }, espacio);
    prog.getInput('LOOP').connection.connect(b.previousConnection);
  }).catch(() => {}); // si el bloque cambió de nombre, el resumen sale igual por la carga del ejemplo
  await win.waitForTimeout(3500); // bloques_cambiados sale 3 s después del último cambio
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 600), 'compila y simula');
  await win.evaluate(() => detenerSimulacion());
  await win.waitForTimeout(500);
  await app.close();
  await new Promise((r) => setTimeout(r, 500));

  // 5. Lo que quedó en el archivo
  let lineas = leerRegistro();
  const archivos = [...new Set(lineas.map((l) => l.archivo))];
  revisar(archivos.length === 1 && /^A7-\d{4}-\d{2}-\d{2}\.jsonl$/.test(archivos[0]), `un archivo por equipo y día: ${archivos.join(', ')}`);
  const tipos = lineas.map((l) => l.tipo);
  console.log('      tipos:', tipos.join(', '));
  for (const t of ['sesion_iniciada', 'ejemplo_cargado', 'bloques_cambiados', 'codigo_compilado', 'simulacion_iniciada', 'simulacion_detenida']) {
    revisar(tipos.includes(t), `el registro tiene ${t}`);
  }
  revisar(tipos[0] === 'sesion_iniciada' && lineas[0].datos.placa === 'uno' && Number.isInteger(lineas[0].datos.nivel), 'empieza con sesion_iniciada (placa y nivel)');
  revisar(tipos[tipos.length - 1] === 'sesion_terminada', `al cerrar la app sale sesion_terminada (último: ${tipos[tipos.length - 1]})`);
  revisar(lineas.every((l) => l.equipo === 'A7' && l.sesion === lineas[0].sesion && l.version_tb && l.version_tc), 'cada línea con el equipo A7, la misma sesión y las dos versiones');
  const comp = lineas.find((l) => l.tipo === 'codigo_compilado');
  revisar(comp && comp.datos.ok && Number.isInteger(comp.datos.bytes) && !/\/\/|\/\*/.test(comp.datos.codigo.replace(/"(?:[^"\\]|\\.)*"/g, '""')) && /Serial\.begin/.test(comp.datos.codigo),
    `codigo_compilado: el C++ sin comentarios (${comp && comp.datos.codigo.split('\n').length} líneas, ${comp && comp.datos.bytes} bytes)`);
  const ini = lineas.find((l) => l.tipo === 'simulacion_iniciada');
  revisar(ini && ini.corrida >= 1 && ini.datos.circuito.componentes.some((c) => c.id === 'led1'), 'simulacion_iniciada con su corrida y el circuito completo');
  revisar(!JSON.stringify(lineas).includes('Sofía'), 'el nombre del proyecto que escribió el aprendiz no está en el registro');
  if (fs.existsSync(REVISOR)) {
    const { revisarEvento } = require(REVISOR);
    const problemas = lineas.flatMap((l, i) => { const { archivo, ...ev } = l; return revisarEvento(ev).map((p) => `${i + 1} (${l.tipo}): ${p}`); });
    revisar(!problemas.length, `las ${lineas.length} líneas cumplen contrato/evento.schema.json` + (problemas.length ? ':\n  ' + problemas.slice(0, 10).join('\n  ') : ''));
  } else revisar(false, 'no encuentro el revisor de TecnoCircuito en ' + REVISOR);

  // 6. Al abrir otra vez, el registro sigue encendido y pide el código; el instructor lo apaga
  ({ app, win } = await abrir());
  revisar(await titulo(win) === 'Código del equipo', 'al abrir otra vez, pide el código (el registro sigue encendido en este PC)');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(200);
  revisar(await win.evaluate(() => $('avisoRegistro').textContent) === 'Esta sesión se registra · Falta el código del equipo', 'sin código, el aviso lo dice y no se registra');
  const antes = leerRegistro().length;
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => e.id === 'eco')));
  await win.waitForTimeout(300);
  revisar(leerRegistro().length === antes, 'sin código del equipo no se escribe nada');
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  await win.locator('#pinInstructor').fill('1111');
  await boton(win, 'Entrar');
  revisar(/no es el PIN/.test(await win.locator('#modalCuerpo .error').textContent()), 'con el PIN equivocado no entra');
  await win.locator('#pinInstructor').fill('2468');
  await boton(win, 'Entrar');
  await win.waitForTimeout(300);
  revisar(/encendido/.test(await win.locator('#modalCuerpo').textContent()), 'el panel dice que está encendido');
  await boton(win, 'Apagar el registro');
  await win.waitForTimeout(300);
  revisar(await win.evaluate(() => $('avisoRegistro').hidden), 'apagado: el aviso desaparece');
  await app.close();
  await new Promise((r) => setTimeout(r, 300));
  ({ app, win } = await abrir());
  revisar(await titulo(win) === null, 'apagado: al abrir ya no pide el código');
  await app.close();

  revisar(!errores.length, 'sin errores en la consola' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
