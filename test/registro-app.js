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

  async function abrir(carpetaDatos = datos) {
    const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${carpetaDatos}`], cwd: RAIZ, env });
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

  // 4. El equipo trabaja: elige el Nano, abre un ejemplo (que vuelve al Uno), cambia bloques, simula y detiene
  await win.selectOption('#placa', 'nano');
  await win.waitForTimeout(200);
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
  const cambiosPlaca = lineas.filter((l) => l.tipo === 'placa_cambiada').map((l) => `${l.datos.de}→${l.datos.a}`);
  revisar(cambiosPlaca.join() === 'uno→nano,nano→uno' && tipos.lastIndexOf('placa_cambiada') < tipos.indexOf('ejemplo_cargado'),
    `REG-004: placa_cambiada con el selector y con el ejemplo, antes de ejemplo_cargado (${cambiosPlaca.join(', ') || 'ninguno'})`);
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

  // 6b. AUD-02: el disco deja de escribir (el archivo del día, de solo lectura: un fallo real, sin ganchos de prueba)
  await win.locator('#avisoRegistro').click();
  await win.waitForTimeout(200);
  await win.locator('#codigoEquipo').fill('C3');
  await win.locator('#codigoEquipo').press('Enter');
  await win.waitForTimeout(200);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(300);
  const archivoC3 = fs.readdirSync(registros).find((f) => f.startsWith('C3-'));
  fs.chmodSync(path.join(registros, archivoC3), 0o444);
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => e.id === 'eco')));
  revisar(await esperar(win, () => $('avisoRegistro').classList.contains('falla'), 5000) &&
    await win.evaluate(() => $('avisoRegistro').textContent) === 'El registro no se está guardando · Avisen al instructor',
  'E1: el disco no deja escribir y la esquina lo dice: «El registro no se está guardando · Avisen al instructor»');
  await win.screenshot({ path: path.join(SALIDA, 'registro_4_falla.png') });
  await win.evaluate((circuito) => { const p = proyectoActual(); p.circuito = circuito; cargarProyecto(p, true); }, LED);
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300), 'E1: con la falla, compilar y simular siguen funcionando');
  await win.evaluate(() => detenerSimulacion());
  await win.waitForTimeout(300);
  await win.locator('#avisoRegistro').click();
  await win.waitForTimeout(200);
  revisar(await titulo(win) === 'El registro no se está guardando' && /Pueden seguir trabajando; avisen al instructor/.test(await win.locator('#modalCuerpo').textContent()),
    'E2: el aviso explica qué pasó, sin detener el trabajo');
  await boton(win, 'Entendido');
  await win.waitForTimeout(200);
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  await win.locator('#pinInstructor').fill('2468');
  await boton(win, 'Entrar');
  await win.waitForTimeout(300);
  const lineaFalla = await win.evaluate(() => ($('fallaRegistro') && !$('fallaRegistro').hidden ? $('fallaRegistro').textContent : ''));
  const esperando = Number((lineaFalla.match(/(\d+) eventos? esperando/) || [])[1]);
  revisar(/^No se guarda desde las \d{2}:\d{2} · sin permiso para escribir · \d+ eventos? esperando$/.test(lineaFalla) && esperando > 2,
    `E3: el panel del instructor lo detalla: «${lineaFalla}»`);
  // AUD-20 (R06 de la auditoría de Codex): con el panel abierto, la línea de la falla sigue lo que espera, no se queda en
  // la cuenta de cuando se abrió
  await win.evaluate(() => { registrarEditor('ejemplo_cargado', { id: 'eco' }); registrarEditor('ejemplo_cargado', { id: 'eco' }); });
  const siguePanel = await win.waitForFunction((n) => {
    const l = $('fallaRegistro');
    return l && !l.hidden && Number(((l.textContent || '').match(/(\d+) eventos? esperando/) || [])[1]) >= n;
  }, esperando + 2, { timeout: 3000, polling: 100 }).then(() => true, () => false);
  revisar(siguePanel, `AUD-20: con el panel abierto, la línea pasa de ${esperando} a ${esperando + 2} eventos esperando o más («${await win.evaluate(() => $('fallaRegistro').textContent)}»)`);
  await win.screenshot({ path: path.join(SALIDA, 'registro_5_falla_instructor.png') });
  revisar(leerRegistro().filter((l) => l.equipo === 'C3').length === 1, 'mientras falla, el archivo no cambia (solo sesion_iniciada)');
  fs.chmodSync(path.join(registros, archivoC3), 0o666);
  await boton(win, 'Reintentar ahora');
  await win.waitForTimeout(400);
  revisar(/volvió a guardarse/.test(await win.locator('#modalCuerpo').textContent()) && await win.evaluate(() => $('fallaRegistro').hidden),
    'E4: «Reintentar ahora» escribe lo que esperaba');
  revisar(await win.evaluate(() => !$('toast').hidden && $('toast').textContent === 'El registro volvió a guardarse.'), 'E4: y la app lo dice: «El registro volvió a guardarse.»');
  await boton(win, 'Cerrar');
  await win.waitForTimeout(200);
  revisar(await win.evaluate(() => !$('avisoRegistro').classList.contains('falla') && $('avisoRegistro').textContent === 'Esta sesión se registra · Equipo C3'),
    'E4: la esquina vuelve a «Esta sesión se registra · Equipo C3»');
  const c3 = leerRegistro().filter((l) => l.equipo === 'C3');
  const marca = c3[c3.length - 1];
  console.log('      C3:', c3.map((l) => l.tipo).join(', '));
  // Entre E3 y el reintento puede sumarse el resumen de bloques (sale 3 s después del último cambio)
  const recuperadas = c3.slice(1, -1);
  revisar(c3[0].tipo === 'sesion_iniciada' && recuperadas.length >= esperando && c3.every((l) => l.sesion === c3[0].sesion) &&
    c3.slice(0, -1).every((l, i, a) => i === 0 || l.t >= a[i - 1].t),
  `E4: los ${recuperadas.length} eventos que esperaban quedaron en orden y con su sesión original`);
  revisar(marca.tipo === 'registro_interrumpido' && marca.datos.recuperados === recuperadas.length && marca.datos.perdidos === 0 &&
    ['EPERM', 'EACCES'].includes(marca.datos.motivo) && marca.datos.hasta >= marca.datos.desde,
  `E5: al final, registro_interrumpido (recuperados ${marca.datos && marca.datos.recuperados}, perdidos ${marca.datos && marca.datos.perdidos}, ${marca.datos && marca.datos.motivo})`);
  if (fs.existsSync(REVISOR)) {
    const { revisarEvento } = require(REVISOR);
    const problemas = c3.flatMap((l, i) => { const { archivo, ...linea } = l; return revisarEvento(linea).map((p) => `${i + 1} (${l.tipo}): ${p}`); });
    revisar(!problemas.length, `las ${c3.length} líneas de C3 cumplen contrato/evento.schema.json` + (problemas.length ? ':\n  ' + problemas.slice(0, 10).join('\n  ') : ''));
  }

  // 6c. AUD-04: lo que hace un equipo queda en su sesión. La simulación se detiene antes de cerrar la sesión, el
  // resumen de bloques que espera se escribe en ella y una compilación en curso se descarta (decisión de Efraín, 18 oct).
  const deEquipo = (equipo) => leerRegistro().filter((l) => l.equipo === equipo);
  const tiposDe = (equipo) => deEquipo(equipo).map((l) => l.tipo);
  // El final de la sesión sin el resumen de bloques: si esperaba, sale (bien) entre el cierre de la corrida y sesion_terminada.
  const finDe = (equipo, n) => tiposDe(equipo).filter((t) => t !== 'bloques_cambiados').slice(-n).join();
  const eventosSim = (equipo) => deEquipo(equipo).filter((l) => l.origen === 'simulador' && l.tipo.startsWith('simulacion_'));
  /** Cada corrida del equipo: inicio con circuito, cierre después, y los dos antes de sesion_terminada. */
  function corridasCompletas(equipo) {
    const ls = deEquipo(equipo);
    const fin = ls.findIndex((l) => l.tipo === 'sesion_terminada');
    const corridas = [...new Set(ls.filter((l) => l.tipo === 'simulacion_iniciada').map((l) => l.corrida))];
    return corridas.length > 0 && ls.every((l) => l.sesion === ls[0].sesion) && corridas.every((n) => {
      const i = ls.findIndex((l) => l.tipo === 'simulacion_iniciada' && l.corrida === n);
      const d = ls.findIndex((l) => l.tipo === 'simulacion_detenida' && l.corrida === n);
      return ls[i].datos.circuito && d > i && (fin < 0 || d < fin) && Array.isArray(ls[d].datos.fallas);
    }) && ls.filter((l) => l.origen === 'simulador').every((l) => corridas.includes(l.corrida));
  }
  async function cambiarCodigo(codigo) {
    await win.locator('#avisoRegistro').click();
    await win.waitForTimeout(200);
    await win.locator('#codigoEquipo').fill(codigo);
    await win.locator('#codigoEquipo').press('Enter');
    await win.waitForTimeout(200);
    await boton(win, 'Sí, somos ese equipo');
    await win.waitForTimeout(300);
  }
  async function simularLED() {
    await win.evaluate((circuito) => { const p = proyectoActual(); p.circuito = circuito; cargarProyecto(p, true); }, LED);
    await win.locator('#btnSimularBarra').click();
    return esperar(win, () => simulador.sim && simulador.sim.medidas().estado === 'corriendo' && simulador.sim.medidas().msSimulados > 300);
  }
  const toast = () => win.evaluate(() => (!$('toast').hidden ? $('toast').textContent : ''));

  // Corriendo: C3 simula y cambia a D1
  revisar(await simularLED(), 'AUD-04: C3 simula');
  await cambiarCodigo('D1');
  revisar(await win.evaluate(() => simulador.sim === null && registroEventos.equipo() === 'D1') &&
    await toast() === 'La simulación se detuvo porque cambió el equipo. Pulsen «Simular» para empezar la suya.',
  'AUD-04 corriendo: al cambiar a D1 la simulación se detiene y la app lo dice');
  revisar(corridasCompletas('C3') && finDe('C3', 2) === 'simulacion_detenida,sesion_terminada' && !eventosSim('D1').length,
    `AUD-04 corriendo: la corrida queda entera en C3 (inicio, circuito, cierre con fallas, antes de sesion_terminada) y D1 no tiene ninguna (C3 termina: ${tiposDe('C3').slice(-3).join(', ')})`);

  // En pausa: D1 simula, pausa y cambia a E2
  revisar(await simularLED(), 'AUD-04: D1 simula');
  await win.evaluate(() => simulador.sim.pausar());
  await win.waitForTimeout(200);
  await cambiarCodigo('E2');
  revisar(corridasCompletas('D1') && finDe('D1', 3) === 'simulacion_pausada,simulacion_detenida,sesion_terminada' && !eventosSim('E2').length,
    `AUD-04 en pausa: D1 cierra su corrida pausada antes de terminar y E2 no hereda nada (${tiposDe('D1').slice(-3).join(', ')})`);

  // Mismo código: E2 simula y confirma E2 otra vez
  revisar(await simularLED(), 'AUD-04: E2 simula');
  const sesionE2 = deEquipo('E2')[0].sesion;
  await cambiarCodigo('E2');
  revisar(await win.evaluate(() => simulador.sim && simulador.sim.medidas().estado === 'corriendo') && !tiposDe('E2').includes('sesion_terminada') &&
    deEquipo('E2').every((l) => l.sesion === sesionE2),
  'AUD-04 mismo código: E2 sigue en su sesión y su simulación sigue corriendo');
  // REG-004, INT-RES-03a: el RESET del botón pone el reloj de la corrida en cero. El reinicio sale con el tiempo de
  // antes y el cierre con uno menor; la historia (paso 8) no lo toma por una contradicción.
  await esperar(win, () => simulador.sim.medidas().msSimulados > 1500);
  await win.evaluate(() => simulador.sim.reiniciar());
  await esperar(win, () => simulador.sim.medidas().estado === 'corriendo' && simulador.sim.medidas().msSimulados > 100 && simulador.sim.medidas().msSimulados < 1000, 10000);
  await win.evaluate(() => detenerSimulacion());
  await win.waitForTimeout(200);
  const corridaReset = deEquipo('E2').filter((l) => l.tipo === 'simulacion_iniciada').pop().corrida;
  const reset = deEquipo('E2').find((l) => l.tipo === 'reinicio_placa' && l.corrida === corridaReset && l.datos.motivo === 'boton');
  const cierreReset = deEquipo('E2').find((l) => l.tipo === 'simulacion_detenida' && l.corrida === corridaReset);
  revisar(reset && cierreReset && reset.ms_sim > 1500 && cierreReset.datos.ms_sim < reset.ms_sim,
    `REG-004: el RESET pone el reloj de la corrida en cero (reinicio a ${reset && reset.ms_sim} ms, cierre a ${cierreReset && cierreReset.datos.ms_sim} ms)`);

  // Compilando: E2 pulsa Simular y, antes de que termine la compilación, confirma F3
  const compiladasE2 = tiposDe('E2').filter((t) => t === 'codigo_compilado').length;
  const compilando = await win.evaluate(async () => {
    const p = simular();
    const enCurso = simulador.compilando;
    confirmarEquipo('F3');
    $('modalAcciones').querySelector('.primario').click(); // «Sí, somos ese equipo», con la compilación en curso
    await p;
    return { enCurso, sim: !!simulador.sim, equipo: registroEventos.equipo(), toast: $('toast').textContent };
  });
  await win.waitForTimeout(300);
  revisar(compilando.enCurso && !compilando.sim && compilando.equipo === 'F3' && compilando.toast === 'Cambió el equipo mientras se preparaba el programa. Pulsen «Simular» otra vez.',
    `AUD-04 compilando: la compilación se descarta, no empieza la simulación y la app lo dice («${compilando.toast}»)`);
  revisar(tiposDe('E2').filter((t) => t === 'codigo_compilado').length === compiladasE2 && tiposDe('E2').slice(-1)[0] === 'sesion_terminada' &&
    !tiposDe('F3').includes('codigo_compilado') && !eventosSim('F3').length,
  'AUD-04 compilando: ni E2 ni F3 registran esa compilación ni una corrida');

  // Resumen de bloques pendiente: F3 cambia un bloque y, antes de 3 s, confirma G4
  await win.evaluate(() => {
    const prog = espacio.getBlocksByType('programa')[0];
    const b = Blockly.serialization.blocks.append({ type: 'esperar', inputs: { MS: { shadow: { type: 'math_number', fields: { NUM: 200 } } } } }, espacio);
    prog.getInput('LOOP').connection.connect(b.previousConnection);
  });
  await win.waitForTimeout(300);
  await cambiarCodigo('G4');
  await win.waitForTimeout(3500);
  revisar(tiposDe('F3').slice(-2).join() === 'bloques_cambiados,sesion_terminada' && !tiposDe('G4').includes('bloques_cambiados'),
    `AUD-04 bloques: el resumen que esperaba queda en F3, antes de su sesion_terminada, y no pasa a G4 (F3 termina: ${tiposDe('F3').slice(-2).join(', ')})`);

  // Cerrar la ventana: G4 simula y se cierra la app
  revisar(await simularLED(), 'AUD-04: G4 simula');
  await app.close();
  await new Promise((r) => setTimeout(r, 500));
  revisar(corridasCompletas('G4') && finDe('G4', 2) === 'simulacion_detenida,sesion_terminada',
    `AUD-04 cerrar: al cerrar la app, la corrida de G4 se cierra antes de su sesion_terminada (${tiposDe('G4').slice(-2).join(', ')})`);

  // AUD-04-V1: al simular con el monitor serial conectado, la placa se desconecta antes de empezar. Si el equipo cambia
  // mientras se cierra el puerto, la simulación no empieza para el equipo nuevo. El puerto es un objeto de prueba cuyo
  // close() queda pendiente hasta soltarlo; desconectarSerial() es la de la app (la idea es de la verificación de Codex).
  ({ app, win } = await abrir());
  await win.locator('#codigoEquipo').fill('H5');
  await win.locator('#codigoEquipo').press('Enter');
  await win.waitForTimeout(200);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(300);
  async function simularConCierrePendiente() {
    await win.evaluate((circuito) => { const p = proyectoActual(); p.circuito = circuito; cargarProyecto(p, true); }, LED);
    await win.evaluate(() => {
      window.__cerrando = false;
      serial.lector = null;
      serial.bucle = null;
      serial.conectado = true;
      serial.puerto = { close: () => { window.__cerrando = true; return new Promise((soltar) => { window.__soltarCierre = soltar; }); } };
      window.__simulando = simular();
    });
    return esperar(win, () => window.__cerrando);
  }
  const soltarCierre = () => win.evaluate(async () => { window.__soltarCierre(); await window.__simulando; });
  const cuenta = (equipo, tipo) => tiposDe(equipo).filter((t) => t === tipo).length;
  // Sin cambio: al cerrarse el puerto, la simulación de H5 empieza
  revisar(await simularConCierrePendiente(), 'AUD-04-V1: H5 pulsa Simular y el puerto serial queda cerrándose');
  await soltarCierre();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().estado === 'corriendo' && registroEventos.equipo() === 'H5', 5000) &&
    cuenta('H5', 'codigo_compilado') === 1 && cuenta('H5', 'simulacion_iniciada') === 1,
  'AUD-04-V1 sin cambio: al cerrarse el puerto, la simulación de H5 empieza en su sesión');
  await win.evaluate(() => detenerSimulacion());
  await win.waitForTimeout(200);
  // Con cambio: H5 pulsa Simular, confirma I6 mientras el puerto se cierra y después se suelta el cierre
  revisar(await simularConCierrePendiente(), 'AUD-04-V1: H5 pulsa Simular otra vez y el puerto queda cerrándose');
  await cambiarCodigo('I6');
  await soltarCierre();
  await win.waitForTimeout(500);
  revisar(await win.evaluate(() => simulador.sim === null && registroEventos.equipo() === 'I6') &&
    await toast() === 'Cambió el equipo mientras se preparaba el programa. Pulsen «Simular» otra vez.',
  'AUD-04-V1 con cambio: la simulación preparada por H5 no empieza para I6 y la app pide pulsar «Simular»');
  revisar(cuenta('H5', 'codigo_compilado') === 2 && cuenta('H5', 'simulacion_iniciada') === 1 && corridasCompletas('H5') && finDe('H5', 1) === 'sesion_terminada' &&
    !eventosSim('I6').length && !tiposDe('I6').includes('codigo_compilado'),
  `AUD-04-V1 con cambio: la compilación queda en H5 (la hizo H5), sin corrida nueva; I6 no tiene ninguna (H5: ${tiposDe('H5').join(', ')})`);

  // 6d. AUD-03-V2: Detener ya soltó la simulación y su cierre espera al Worker, con fotos en camino. Lo que viene
  // después (cambiar de equipo, volver a simular, apagar el registro) espera ese mismo cierre: la corrida queda entera,
  // con sus fallas, en el equipo que la empezó. El Worker, el núcleo y el registro son los reales; solo se retiene la
  // entrega de sus fotos y de su «detenido», en orden, hasta soltarlas (la idea es de la verificación de Codex, 19 oct).
  const instalarRetencion = () => win.evaluate(() => {
    const Nativo = window.Worker;
    window.__ret = { siguiente: false, trabajadores: [], cola: [], copias: [] };
    window.Worker = class extends Nativo {
      constructor(...a) { super(...a); this.retener = __ret.siguiente; __ret.siguiente = false; __ret.trabajadores.push(this); }
      set onmessage(fn) {
        super.onmessage = (e) => {
          const t = e.data && e.data.tipo;
          if (this.retener && (t === 'foto' || t === 'detenido')) { __ret.copias.push(e.data); __ret.cola.push(() => fn(e)); } else fn(e);
        };
      }
    };
    __ret.soltar = () => { __ret.trabajadores.forEach((w) => { w.retener = false; }); __ret.cola.splice(0).forEach((entregar) => entregar()); };
    // Detener (lo mismo que el botón) y esperar a que el Worker confirme; su «detenido» queda retenido
    __ret.detener = async () => {
      window.__detener = detenerSimulacion();
      while (!__ret.copias.some((m) => m.tipo === 'detenido')) await new Promise((r) => setTimeout(r, 5));
    };
  });
  await instalarRetencion();
  const QUEMAR = 'void setup() { pinMode(13, OUTPUT); digitalWrite(13, HIGH); }\nvoid loop() {}\n'; // el LED sin resistencia se quema
  /** Simula el LED en D13 con el Worker retenido, hasta que el Worker manda la foto con las dos fallas. */
  async function simularRetenido() {
    await win.evaluate(({ circuito, prog }) => {
      __ret.siguiente = true; __ret.copias = [];
      const p = proyectoActual(); delete p.texto; p.circuito = circuito; cargarProyecto(p, true);
      entrarModoTexto(prog, '');
      window.__simulando = simular();
    }, { circuito: LED, prog: QUEMAR });
    return esperar(win, () => __ret.copias.some((m) => m.tipo === 'foto' && (m.fallas || []).length >= 2));
  }
  const ultimaCorrida = (equipo) => Math.max(...deEquipo(equipo).filter((l) => l.tipo === 'simulacion_iniciada').map((l) => l.corrida));
  /** Las fallas de una corrida en el registro del equipo, y las de su cierre: las dos, una vez cada una. */
  function fallasEnteras(equipo, corrida) {
    const ls = deEquipo(equipo);
    const sueltas = ls.filter((l) => l.tipo === 'falla' && l.corrida === corrida).map((l) => l.datos.tipo).sort().join();
    const cierre = ls.find((l) => l.tipo === 'simulacion_detenida' && l.corrida === corrida);
    return sueltas === 'corriente_pin,led_quemado' && !!cierre && cierre.datos.fallas.map((f) => f.tipo).sort().join() === sueltas;
  }
  const nadaDelSimulador = (equipo) => !deEquipo(equipo).some((l) => l.origen === 'simulador');

  // Detener y cambiar de equipo: I6 pulsa Detener y, con su cierre pendiente, confirma J7
  revisar(await simularRetenido(), 'AUD-03-V2: I6 simula el LED sin resistencia (Worker retenido con la foto de las dos fallas)');
  const v2equipo = await win.evaluate(async () => {
    const t0 = performance.now();
    await __ret.detener();
    confirmarEquipo('J7');
    $('modalAcciones').querySelector('.primario').click(); // «Sí, somos ese equipo», con el cierre de I6 pendiente
    await new Promise((r) => setTimeout(r, 30));
    // El cambio de equipo sigue esperando: su promesa en la cola todavía no se cumplió (REG-005: la cola reemplaza la bandera)
    const cambiando = await Promise.race([cambioDeEquipo.then(() => false), new Promise((r) => setTimeout(() => r(true), 0))]);
    const antes = { equipo: registroEventos.equipo(), cambiando, ms: Math.round(performance.now() - t0) };
    __ret.soltar();
    await __detener;
    return antes;
  });
  await esperar(win, () => registroEventos.equipo() === 'J7', 5000);
  const corridaI6 = ultimaCorrida('I6');
  revisar(v2equipo.equipo === 'I6' && v2equipo.cambiando && v2equipo.ms < 400,
    `AUD-03-V2 equipo: con el cierre de I6 pendiente, la sesión de I6 sigue abierta (${v2equipo.ms} ms después de Detener, antes del tope de 500)`);
  revisar(fallasEnteras('I6', corridaI6) && corridasCompletas('I6') && finDe('I6', 2) === 'simulacion_detenida,sesion_terminada' && nadaDelSimulador('J7'),
    `AUD-03-V2 equipo: la corrida ${corridaI6} queda en I6 con sus dos fallas y su cierre antes de sesion_terminada; J7 no hereda nada (I6 termina: ${finDe('I6', 3)})`);

  // Detener y volver a simular: J7 pulsa Detener y, con su cierre pendiente, pulsa Simular
  revisar(await simularRetenido(), 'AUD-03-V2: J7 simula (Worker retenido)');
  const v2simular = await win.evaluate(async () => {
    await __ret.detener();
    let cumplida = false;
    detenerSimulacion().then(() => { cumplida = true; }); // la espera que comparte quien llega después
    window.__simulando = simular();
    await new Promise((r) => setTimeout(r, 30));
    const antes = { cumplida, cerrando: !!simulador.cerrando };
    __ret.soltar();
    await __detener;
    await __simulando;
    return antes;
  });
  const corridaJ7 = ultimaCorrida('J7') - 1;
  const ordenJ7 = (tipo, corrida) => deEquipo('J7').findIndex((l) => l.tipo === tipo && l.corrida === corrida);
  revisar(!v2simular.cumplida && v2simular.cerrando,
    'AUD-03-V2 simular: con el cierre pendiente, una segunda llamada a detenerSimulacion() espera ese mismo cierre (no responde al instante)');
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().estado === 'corriendo', 40000) && fallasEnteras('J7', corridaJ7) &&
    ordenJ7('simulacion_detenida', corridaJ7) >= 0 && ordenJ7('simulacion_detenida', corridaJ7) < ordenJ7('simulacion_iniciada', corridaJ7 + 1),
  `AUD-03-V2 simular: la corrida ${corridaJ7} cierra con sus dos fallas antes de que empiece la ${corridaJ7 + 1}`);

  // Apagar el registro, camino directo (AUD-04): la corrida de J7 sigue corriendo y el instructor lo apaga
  if (fs.existsSync(REVISOR)) {
    const { revisarEvento } = require(REVISOR);
    const lineas = ['C3', 'D1', 'E2', 'F3', 'G4', 'H5', 'I6'].flatMap(deEquipo);
    const problemas = lineas.flatMap((l, i) => { const { archivo, ...linea } = l; return revisarEvento(linea).map((p) => `${i + 1} (${l.tipo}): ${p}`); });
    revisar(!problemas.length, `AUD-04: las ${lineas.length} líneas de C3 a I6 cumplen contrato/evento.schema.json` + (problemas.length ? ':\n  ' + problemas.slice(0, 10).join('\n  ') : ''));
  }

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
  revisar(corridasCompletas('J7') && finDe('J7', 2) === 'simulacion_detenida,sesion_terminada',
    `AUD-04 apagar: la corrida de J7 se cierra antes de su sesion_terminada (${tiposDe('J7').slice(-2).join(', ')})`);

  // AUD-03-V2, cerrar la ventana y apagar: el instructor vuelve a encender; K8 pulsa Detener y se cierra la app; al
  // abrir, L9 pulsa Detener y, con su cierre pendiente, el instructor apaga el registro
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  await win.locator('#pinInstructor').fill('2468');
  await boton(win, 'Entrar');
  await win.waitForTimeout(300);
  await boton(win, 'Encender el registro');
  await win.waitForTimeout(400);
  await win.locator('#codigoEquipo').fill('K8');
  await win.locator('#codigoEquipo').press('Enter');
  await win.waitForTimeout(200);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(300);
  revisar(await simularRetenido(), 'AUD-03-V2: K8 simula (Worker retenido)');
  // Detener y cerrar la ventana: no se puede esperar al Worker (sinEsperar), pero el cierre que ya estaba en camino sale
  // ya, antes de sesion_terminada (sus fotos retenidas no llegan: es el límite declarado de cerrar la ventana)
  await win.evaluate(() => __ret.detener());
  await app.close();
  await new Promise((r) => setTimeout(r, 500));
  revisar(corridasCompletas('K8') && finDe('K8', 2) === 'simulacion_detenida,sesion_terminada',
    `AUD-03-V2 cerrar: con el cierre de K8 pendiente, cerrar la ventana lo saca antes de sesion_terminada (K8 termina: ${finDe('K8', 3)})`);
  ({ app, win } = await abrir());
  revisar(await titulo(win) === 'Código del equipo', 'al abrir otra vez, pide el código');
  await win.locator('#codigoEquipo').fill('L9');
  await win.locator('#codigoEquipo').press('Enter');
  await win.waitForTimeout(200);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(300);
  await instalarRetencion();
  revisar(await simularRetenido(), 'AUD-03-V2: L9 simula (Worker retenido)');
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  await win.locator('#pinInstructor').fill('2468');
  await boton(win, 'Entrar');
  await win.waitForTimeout(300);
  const v2apagar = await win.evaluate(async () => {
    await __ret.detener();
    [...$('modalAcciones').querySelectorAll('button')].find((b) => b.textContent === 'Apagar el registro').click();
    await new Promise((r) => setTimeout(r, 30));
    const antes = { equipo: registroEventos.equipo() };
    __ret.soltar();
    await __detener;
    return antes;
  });
  revisar(await esperar(win, () => $('avisoRegistro').hidden, 5000) && v2apagar.equipo === 'L9',
    'AUD-03-V2 apagar: con el cierre pendiente, la sesión de L9 sigue abierta hasta que sale; después se apaga');
  const corridaL9 = ultimaCorrida('L9');
  revisar(fallasEnteras('L9', corridaL9) && corridasCompletas('L9') && finDe('L9', 2) === 'simulacion_detenida,sesion_terminada',
    `AUD-03-V2 apagar: la corrida ${corridaL9} queda en L9 con sus dos fallas y su cierre antes de sesion_terminada (L9 termina: ${finDe('L9', 3)})`);
  if (fs.existsSync(REVISOR)) {
    const { revisarEvento } = require(REVISOR);
    const lineas = ['I6', 'J7', 'K8', 'L9'].flatMap(deEquipo);
    const problemas = lineas.flatMap((l, i) => { const { archivo, ...linea } = l; return revisarEvento(linea).map((p) => `${i + 1} (${l.tipo}): ${p}`); });
    revisar(!problemas.length, `AUD-03-V2: las ${lineas.length} líneas de I6 a L9 cumplen contrato/evento.schema.json` + (problemas.length ? ':\n  ' + problemas.slice(0, 10).join('\n  ') : ''));
  }
  await app.close();
  await new Promise((r) => setTimeout(r, 300));
  ({ app, win } = await abrir());
  revisar(await titulo(win) === null, 'apagado: al abrir ya no pide el código');
  await app.close();
  await new Promise((r) => setTimeout(r, 300));

  // 7. AUD-02-V2: la configuración se daña con la app cerrada. No es una instalación nueva: se ve desde el arranque.
  fs.writeFileSync(path.join(datos, 'registro-config.json'), '{ roto');
  ({ app, win } = await abrir());
  const arranque = await win.evaluate(() => ({ visible: !$('avisoRegistro').hidden, falla: $('avisoRegistro').classList.contains('falla'), texto: $('avisoRegistro').textContent }));
  revisar(arranque.visible && arranque.falla && arranque.texto === 'El registro no está funcionando · Avisen al instructor' && await titulo(win) === null,
    `V2: con la configuración dañada, la esquina lo dice desde el arranque y no pide el código: «${arranque.texto}»`);
  await win.locator('#avisoRegistro').click();
  await win.waitForTimeout(200);
  revisar(await titulo(win) === 'El registro no está funcionando' && /no se está registrando nada/.test(await win.locator('#modalCuerpo').textContent()), 'V2: el aviso explica que no se registra nada');
  await boton(win, 'Entendido');
  await win.waitForTimeout(200);
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  revisar(await titulo(win) === 'Registro de eventos: la configuración está dañada', 'V2: el instructor ve que está dañada (no «crear el PIN» como si fuera nueva)');
  await win.screenshot({ path: path.join(SALIDA, 'registro_6_config_danada.png') });
  await boton(win, 'Crear un PIN nuevo');
  await win.waitForTimeout(300);
  await win.locator('#pinNuevo').fill('8642');
  await win.locator('#pinRepetido').fill('8642');
  await boton(win, 'Crear PIN');
  await win.waitForTimeout(400);
  const aparte = fs.readdirSync(datos).filter((f) => /^registro-config-ilegible-.*\.json$/.test(f));
  revisar(/apagado/.test(await win.locator('#modalCuerpo').textContent()) && aparte.length === 1 &&
    fs.readFileSync(path.join(datos, aparte[0]), 'utf8') === '{ roto' && JSON.parse(fs.readFileSync(path.join(datos, 'registro-config.json'), 'utf8')).activo === false,
  'V2: con el PIN nuevo, el registro queda apagado y la configuración dañada se guarda aparte');
  await boton(win, 'Cerrar');
  await win.waitForTimeout(200);
  revisar(await win.evaluate(() => $('avisoRegistro').hidden) && fs.readdirSync(registros).length >= 2, 'V2: el aviso se quita y los registros guardados siguen ahí');
  await app.close();

  revisar(!errores.length, 'sin errores en la consola' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));

  // 8. REG-004: la historia de todos estos registros reales. Ninguna sesión tiene avisos de integridad, y las corridas
  // que se quemaron el LED (I6, J7 y L9) cuentan sus dos fallas.
  const { leerArchivos, contarHistoria, narrar } = require('../herramientas/historia-registro.js');
  const leidos = leerArchivos([registros]);
  const historias = contarHistoria(leidos.lineas);
  const conAvisos = historias.filter((h) => h.avisos.length);
  revisar(!leidos.problemas.length && historias.length === 11 && !conAvisos.length,
    `REG-004: ${historias.length} sesiones reales leídas, sin avisos` + (conAvisos.length ? ':\n  ' + conAvisos.map((h) => `${h.equipo}: ${h.avisos.join(' | ')}`).join('\n  ') : ''));
  const quemadas = (equipo) => (historias.find((h) => h.equipo === equipo) || { corridas: [] }).corridas
    .some((c) => (c.cierre || []).map((f) => f.tipo).sort().join() === 'corriente_pin,led_quemado');
  revisar(quemadas('I6') && quemadas('J7') && quemadas('L9'), 'REG-004: la historia de I6, J7 y L9 cuenta el LED quemado y la corriente del pin');
  console.log('\n' + narrar(historias.filter((h) => h.equipo === 'J7')));
  fs.rmSync(datos, { recursive: true, force: true });

  // 9. AUD-07: un evento que no se puede guardar deja evento_descartado en su lugar, la esquina lo dice y el instructor lo
  // ve. En otra carpeta de datos, para que las sesiones de arriba sigan sin avisos.
  const datos2 = path.join(os.tmpdir(), 'tecnobloques-prueba-registro-app-2');
  if (path.dirname(path.resolve(datos2)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos2, { recursive: true, force: true });
  const registros2 = path.join(datos2, 'registros');
  const leerRegistro2 = () => (fs.existsSync(registros2) ? fs.readdirSync(registros2).filter((f) => f.endsWith('.jsonl')) : [])
    .flatMap((f) => fs.readFileSync(path.join(registros2, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  ({ app, win } = await abrir(datos2));
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  await win.locator('#pinNuevo').fill('1357');
  await win.locator('#pinRepetido').fill('1357');
  await boton(win, 'Crear PIN');
  await win.waitForTimeout(300);
  await boton(win, 'Encender el registro');
  await win.waitForTimeout(400);
  await win.locator('#codigoEquipo').fill('M1');
  await win.locator('#codigoEquipo').press('Enter');
  await win.waitForTimeout(200);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(300);
  const esquina = () => win.evaluate(() => ({ texto: $('avisoRegistro').textContent, falla: $('avisoRegistro').classList.contains('falla') }));
  revisar((await esquina()).texto === 'Esta sesión se registra · Equipo M1', 'AUD-07: control, la esquina normal antes de perder nada');
  // Un C++ de más de 2 097 152 caracteres: el proceso principal no lo guarda. La esquina avisa las pérdidas del equipo
  // que está trabajando (decisión de Efraín, 21 oct)
  const grande = () => win.evaluate(() => registroEventos.editor('codigo_compilado', { ok: true, error: null, bytes: 1, codigo: 'x'.repeat(2 * 1024 * 1024) }));
  await grande();
  revisar(await esperar(win, () => $('avisoRegistro').textContent === 'Equipo M1 · El registro perdió un evento · Avisen al instructor' && $('avisoRegistro').classList.contains('falla'), 5000),
    `AUD-07: un evento demasiado grande: la esquina dice «${(await esquina()).texto}»`);
  await win.screenshot({ path: path.join(SALIDA, 'registro_7_descartado.png') });
  // Uno que ni siquiera llega a la app: trae algo que no se puede copiar
  await win.evaluate(() => registroEventos.editor('ejemplo_cargado', { id: 'x', f: () => 1 }));
  revisar(await esperar(win, () => $('avisoRegistro').textContent === 'Equipo M1 · El registro perdió 2 eventos · Avisen al instructor', 5000),
    `AUD-07: un evento que no se puede copiar también se cuenta: «${(await esquina()).texto}»`);
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => e.id === 'eco')));
  await win.waitForTimeout(400);
  await win.locator('#avisoRegistro').click();
  await win.waitForTimeout(200);
  revisar(await titulo(win) === 'El registro perdió 2 eventos' && /Quedó anotado que falta\. Pueden seguir trabajando; avisen al instructor/.test(await win.locator('#modalCuerpo').textContent()),
    'AUD-07: la esquina explica qué pasó, sin detener el trabajo');
  await boton(win, 'Entendido');
  await win.waitForTimeout(200);
  const entrarPanel = async () => {
    await win.keyboard.press('Control+Alt+Shift+KeyR');
    await win.waitForTimeout(300);
    await win.locator('#pinInstructor').fill('1357');
    await boton(win, 'Entrar');
    await win.waitForTimeout(300);
  };
  const lineaPanel = () => win.evaluate(() => ($('descartadosRegistro') && !$('descartadosRegistro').hidden ? $('descartadosRegistro').textContent : ''));
  await entrarPanel();
  const lineaDescartados = await lineaPanel();
  revisar(/^2 eventos no se guardaron desde que se abrió la app \(el último: ejemplo_cargado, no se pudo convertir a texto, a las \d{2}:\d{2}\)\. Quedaron anotados en el registro\.$/.test(lineaDescartados),
    `AUD-07: el panel del instructor lo detalla: «${lineaDescartados}»`);
  await win.screenshot({ path: path.join(SALIDA, 'registro_8_descartado_instructor.png') });
  // F06: con el panel abierto, otra pérdida actualiza el panel y la esquina
  await grande();
  revisar(await esperar(win, () => /^3 eventos no se guardaron/.test($('descartadosRegistro').textContent) && /perdió 3 eventos/.test($('avisoRegistro').textContent), 5000),
    `AUD-07 (F06): con el panel abierto, otra pérdida lo actualiza: «${await lineaPanel()}»`);
  // AUD-08: dos exportaciones seguidas desde el panel (la carpeta la «elige» la prueba): dos carpetas, la primera intacta.
  // Con carpetas señuelo del minuto actual y del siguiente, las dos tienen que usar el sufijo aunque cambie el minuto (A-10)
  const usb2 = path.join(datos2, 'usb');
  fs.mkdirSync(usb2, { recursive: true });
  const dos = (n) => String(n).padStart(2, '0');
  const sello = (d) => `TecnoBloques-registros-${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}_${dos(d.getHours())}${dos(d.getMinutes())}`;
  const senuelos = [sello(new Date()), sello(new Date(Date.now() + 60000))];
  for (const s of senuelos) fs.mkdirSync(path.join(usb2, s), { recursive: true });
  await app.evaluate(({ dialog }, dir) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] }); }, usb2);
  const notaPanel = () => win.evaluate(() => [...document.querySelectorAll('#modalCuerpo p.muted')].pop().textContent);
  const sha = (archivo) => require('crypto').createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');
  const nuevas = () => fs.readdirSync(usb2).filter((f) => !senuelos.includes(f)).sort();
  await boton(win, 'Exportar registros');
  await win.waitForTimeout(500);
  const nota1 = await notaPanel();
  const [exp1] = nuevas();
  const copia1 = path.join(usb2, exp1, fs.readdirSync(path.join(usb2, exp1)).find((f) => f.startsWith('M1-')));
  const sha1 = sha(copia1);
  await win.evaluate(() => registroEventos.editor('ejemplo_cargado', { id: 'eco' })); // M1 cambia entre las dos
  await win.waitForTimeout(200);
  await boton(win, 'Exportar registros');
  await win.waitForTimeout(500);
  const nota2 = await notaPanel();
  const exportaciones = nuevas();
  const exp2 = exportaciones.find((f) => f !== exp1);
  const manifiestoDe = (c) => JSON.parse(fs.readFileSync(path.join(usb2, c, 'exportacion.json'), 'utf8'));
  revisar(exportaciones.length === 2 && exportaciones.every((f) => /^TecnoBloques-registros-\d{4}-\d{2}-\d{2}_\d{4}-\d+$/.test(f)) && sha(copia1) === sha1 &&
    senuelos.every((s) => !fs.readdirSync(path.join(usb2, s)).length) &&
    fs.statSync(path.join(usb2, exp2, path.basename(copia1))).size > fs.statSync(copia1).size &&
    manifiestoDe(exp1).completa === true && manifiestoDe(exp2).completa === true && manifiestoDe(exp1).archivos.every((a) => sha(path.join(usb2, exp1, a.archivo)) === a.sha256) &&
    nota1.includes(exp1) && nota2.includes(exp2) && /^Se copió 1 archivo a /.test(nota1),
  `AUD-08: dos exportaciones desde el panel, las dos con sufijo por los señuelos: ${exportaciones.join(' y ')}; la primera intacta y cada una con su exportacion.json`);
  await boton(win, 'Cerrar');
  await win.waitForTimeout(200);
  // A-05: al cambiar de equipo, las pérdidas del anterior ya no son del nuevo: la esquina vuelve a la normal
  await win.locator('#avisoRegistro').click();
  await win.waitForTimeout(200);
  await boton(win, 'Cambiar el código del equipo');
  await win.waitForTimeout(300);
  await win.locator('#codigoEquipo').fill('M2');
  await win.locator('#codigoEquipo').press('Enter');
  await win.waitForTimeout(200);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(400);
  const deM2 = await esquina();
  revisar(deM2.texto === 'Esta sesión se registra · Equipo M2' && !deM2.falla, `A-05: el equipo siguiente ve su esquina normal: «${deM2.texto}»`);
  // Apagado no hay equipo: la esquina se oculta y la cuenta sigue en el panel del instructor (decisión de Efraín)
  await entrarPanel();
  revisar(/^3 eventos no se guardaron/.test(await lineaPanel()), 'A-05: el panel del instructor sigue con la cuenta de toda la app');
  await boton(win, 'Apagar el registro');
  await win.waitForTimeout(400);
  revisar(await win.evaluate(() => $('avisoRegistro').hidden && registroDescartados.cantidad === 3), 'A-05: con el registro apagado la esquina se oculta, pero la cuenta se conserva');
  await entrarPanel();
  revisar(/^3 eventos no se guardaron/.test(await lineaPanel()), 'A-05: apagado, el panel del instructor la muestra');
  await boton(win, 'Encender el registro');
  await win.waitForTimeout(400);
  await win.keyboard.press('Escape');
  await win.waitForTimeout(300);
  const sinEquipo = await esquina();
  revisar(sinEquipo.texto === 'Esta sesión se registra · Falta el código del equipo' && !sinEquipo.falla, `A-05: sin equipo, la esquina dice que falta el código: «${sinEquipo.texto}»`);
  await app.close();
  await new Promise((r) => setTimeout(r, 300));
  const m1 = leerRegistro2().filter((l) => l.equipo === 'M1');
  const iGrande = m1.findIndex((l) => l.tipo === 'evento_descartado' && l.datos.motivo === 'tamano');
  revisar(m1.filter((l) => l.tipo === 'evento_descartado').length === 3 && iGrande > 0 && m1[iGrande].datos.tipo === 'codigo_compilado' && m1[iGrande].datos.largo > m1[iGrande].datos.limite &&
    m1[iGrande + 1].tipo === 'evento_descartado' && m1[iGrande + 1].datos.motivo === 'no_serializable' && m1[iGrande + 1].datos.tipo === 'ejemplo_cargado' &&
    !m1.some((l) => l.tipo === 'codigo_compilado') && m1.every((l) => l.sesion === m1[0].sesion) && m1[m1.length - 1].tipo === 'sesion_terminada',
  `AUD-07: el archivo tiene los tres evento_descartado en su lugar, con la sesión de M1 (${m1.map((l) => l.tipo).join(', ')})`);
  if (fs.existsSync(REVISOR)) {
    const { revisarEvento } = require(REVISOR);
    const problemas = leerRegistro2().flatMap((l, i) => revisarEvento(l).map((p) => `${i + 1} (${l.tipo}): ${p}`));
    revisar(!problemas.length, `AUD-07: las ${leerRegistro2().length} líneas de M1 y M2 cumplen contrato/evento.schema.json` + (problemas.length ? ':\n  ' + problemas.slice(0, 10).join('\n  ') : ''));
  }
  const historiaM1 = contarHistoria(leerArchivos([registros2]).lineas).find((h) => h.equipo === 'M1');
  revisar(historiaM1 && historiaM1.avisos.filter((a) => /^Hay un hueco: no se guardó un evento/.test(a)).length === 3 && historiaM1.huecos.length === 3,
    `AUD-07: la historia cuenta los tres huecos (${historiaM1 ? historiaM1.avisos.join(' | ') : 'sin historia'})`);
  ({ app, win } = await abrir(datos2));
  await win.keyboard.press('Escape');
  await win.waitForTimeout(200);
  revisar((await esquina()).texto === 'Esta sesión se registra · Falta el código del equipo', 'AUD-07: al abrir otra vez, la cuenta empieza de cero (es desde que se abrió la app)');
  await app.close();
  fs.rmSync(datos2, { recursive: true, force: true });

  // 10. REG-005 (22 oct): lo que encontró la revisión de código de la app, con la app real. En otra carpeta de datos.
  const datos3 = path.join(os.tmpdir(), 'tecnobloques-prueba-registro-app-3');
  if (path.dirname(path.resolve(datos3)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos3, { recursive: true, force: true });
  const registros3 = path.join(datos3, 'registros');
  const leerRegistro3 = () => (fs.existsSync(registros3) ? fs.readdirSync(registros3).filter((f) => f.endsWith('.jsonl')) : [])
    .flatMap((f) => fs.readFileSync(path.join(registros3, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  const cambiarSelector = (placa) => win.evaluate((p) => { const s = $('placa'); s.value = p; s.dispatchEvent(new Event('change')); }, placa);
  ({ app, win } = await abrir(datos3));
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  await win.locator('#pinNuevo').fill('1357');
  await win.locator('#pinRepetido').fill('1357');
  await boton(win, 'Crear PIN');
  await win.waitForTimeout(300);
  await boton(win, 'Encender el registro');
  await win.waitForTimeout(400);
  await win.locator('#codigoEquipo').fill('N1');
  await win.locator('#codigoEquipo').press('Enter');
  await win.waitForTimeout(200);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(300);

  // TB-10: una librería con - en el nombre es «libreria» en el registro y en lo que ve el aprendiz
  const lib = await win.evaluate(() => {
    const r = { ok: false, etapa: 'compilar', salida: 'C:\\x\\x.ino:1:10: fatal error: Adafruit-GFX.h: No such file or directory' };
    return [tipoErrorCompilacion(r), explicarError(r, '').titulo];
  });
  revisar(lib[0] === 'libreria' && lib[1] === 'Falta una librería', `TB-10: Adafruit-GFX.h es «libreria» y «Falta una librería» (${lib.join(', ')})`);

  // TB-8: un proyecto que no abre (un bloque que esta versión no conoce) no deja cambios de placa; uno que abre, uno
  let desde = leerRegistro3().length;
  const noAbrio = await win.evaluate(() => cargarProyecto({ app: 'TecnoBloques', placa: 'nano', nivel: 1,
    bloques: { blocks: { languageVersion: 0, blocks: [{ type: 'bloque_que_no_existe', x: 0, y: 0 }] } } }, true));
  await win.waitForTimeout(400);
  const trasNoAbrio = leerRegistro3().slice(desde);
  revisar(noAbrio !== true && await win.evaluate(() => placaActual) === 'uno' && !trasNoAbrio.some((l) => l.tipo === 'placa_cambiada'),
    `TB-8: el proyecto que no abre vuelve a la placa de antes sin cambios de placa en el registro (${trasNoAbrio.map((l) => l.tipo).join(', ') || 'nada'})`);
  desde = leerRegistro3().length;
  const abrio = await win.evaluate(() => cargarProyecto({ app: 'TecnoBloques', placa: 'nano', nivel: 1, bloques: { blocks: { languageVersion: 0, blocks: [] } } }, true));
  await win.waitForTimeout(400);
  const cambios = leerRegistro3().slice(desde).filter((l) => l.tipo === 'placa_cambiada');
  revisar(abrio === true && cambios.length === 1 && cambios[0].datos.de === 'uno' && cambios[0].datos.a === 'nano', 'control TB-8: el proyecto que abre deja un placa_cambiada uno → nano');
  await cambiarSelector('uno');
  await win.waitForTimeout(400);

  // AUD-19 (auditoría de Codex de REG-005, R05 y R07): abrir proyectos seguidos no mezcla su C++, y uno que no abre
  // devuelve el anterior entero, con su C++ escrito a mano. Se mira también lo que compila (codigoActual) y el autoguardado.
  const vistaProyecto = () => win.evaluate(() => {
    const p = proyectoActual();
    return { nombre: p.nombre, placa: p.placa, nivel: p.nivel, texto: p.texto, modoTexto: !!estado.texto, base: estado.texto ? estado.texto.base : null,
      codigo: codigoActual(), bloques: JSON.stringify(p.bloques), circuito: JSON.stringify(p.circuito || null), auto: (leerLocal(CLAVE_AUTO) || {}).texto || null };
  });
  const seguidos = (...textos) => win.evaluate(async (ts) => {
    const r = ts.map((texto, i) => cargarProyecto({ app: 'TecnoBloques', placa: 'uno', nivel: 3, nombre: 'P' + i, texto, bloques: { blocks: { languageVersion: 0, blocks: [] } } }, true));
    await new Promise((fin) => setTimeout(fin, 900)); // pasan los 200 ms del temporizador de antes y el autoguardado
    return r;
  }, textos);
  const conMarca = (m) => `void setup() { int ${m} = 1; }\nvoid loop() {}\n`;
  for (const [nombre, textos, marca] of [
    ['A con C++ → B sin', [conMarca('SOLO_A'), null], null],
    ['A → B → C, solo C sin C++', [conMarca('SOLO_A'), conMarca('SOLO_B'), null], null],
    ['A con C++ → B con el suyo', [conMarca('SOLO_A'), conMarca('SOLO_B')], 'SOLO_B'],
  ]) {
    const abiertos = await seguidos(...textos);
    const v = await vistaProyecto();
    const ajenos = ['SOLO_A', 'SOLO_B'].filter((m) => m !== marca);
    const limpio = (s) => !s || ajenos.every((m) => !s.includes(m));
    revisar(abiertos.every((r) => r === true) && v.nombre === 'P' + (textos.length - 1) && limpio(v.codigo) && limpio(v.texto) && limpio(v.auto) &&
      (marca ? v.modoTexto && v.codigo.includes(marca) && v.texto.includes(marca) && v.auto.includes(marca) : !v.modoTexto && v.texto === null && v.auto === null),
    `AUD-19, ${nombre}: queda el C++ del último proyecto, también en lo que compila y en el autoguardado (${v.nombre}, modo texto ${v.modoTexto})`);
  }
  const malo = { app: 'TecnoBloques', placa: 'nano', nivel: 1, nombre: 'Malo', bloques: { blocks: { languageVersion: 0, blocks: [{ type: 'bloque_que_no_existe', x: 0, y: 0 }] } } };
  // Modo texto: el C++ escrito a mano, su base, la placa, el nivel y el circuito vuelven igual
  await win.evaluate((circuito) => {
    cargarProyecto({ app: 'TecnoBloques', placa: 'uno', nivel: 3, nombre: 'Mio', circuito, bloques: { blocks: { languageVersion: 0, blocks: [{ type: 'programa', x: 40, y: 40 }] } } }, true);
    entrarModoTexto(`void setup() { int CONSERVAR = 42; }\nvoid loop() {}\n`);
  }, LED);
  await win.waitForTimeout(900);
  const antesTexto = await vistaProyecto();
  const rechazoTexto = await win.evaluate((p) => cargarProyecto(p, true), malo);
  await win.waitForTimeout(900);
  const despuesTexto = await vistaProyecto();
  const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  revisar(rechazoTexto !== true && antesTexto.modoTexto && antesTexto.codigo.includes('CONSERVAR') && iguales(antesTexto, despuesTexto),
    `AUD-19, rechazo en modo texto: vuelve el proyecto entero, con el C++ a mano, su base y el autoguardado (${['nombre', 'placa', 'nivel', 'texto', 'base', 'codigo', 'circuito', 'auto'].filter((k) => antesTexto[k] !== despuesTexto[k]).join(', ') || 'todo igual'})`);
  // Modo bloques: los bloques y el circuito vuelven igual, sin C++ a mano
  await win.evaluate(() => salirModoTexto(true));
  await win.waitForTimeout(900);
  const antesBloques = await vistaProyecto();
  const rechazoBloques = await win.evaluate((p) => cargarProyecto(p, true), malo);
  await win.waitForTimeout(900);
  const despuesBloques = await vistaProyecto();
  revisar(rechazoBloques !== true && !antesBloques.modoTexto && iguales(antesBloques, despuesBloques),
    `AUD-19, rechazo en modo bloques: vuelve igual, con sus bloques y su circuito (${['nombre', 'placa', 'nivel', 'texto', 'codigo', 'bloques', 'circuito', 'auto'].filter((k) => antesBloques[k] !== despuesBloques[k]).join(', ') || 'todo igual'})`);
  await win.evaluate(() => cargarProyecto({ app: 'TecnoBloques', placa: 'uno', nivel: 1, bloques: { blocks: { languageVersion: 0, blocks: [] } } }, true));
  await win.waitForTimeout(400);

  // TB-3: «Cambiar a Nano» al subir (la placa conectada no coincide) también pasa el lienzo a la placa nueva
  await win.evaluate(() => {
    const s = $('puerto');
    s.append(el('option', { value: 'COM98' }, 'COM98'));
    s.value = 'COM98';
    window.placaDetectada = () => 'nano';
    window.subirOriginal = subirPlaca;
    subirPlaca();
  });
  await win.waitForTimeout(300);
  const tituloNoCoincide = await titulo(win);
  await win.evaluate(() => { window.subirPlaca = async () => {}; }); // la subida no es de esta parte
  await boton(win, 'Cambiar a');
  await win.waitForTimeout(500);
  const lienzoNano = await win.evaluate(() => [placaActual, simulador.lienzo && simulador.lienzo.circuito().placa]);
  revisar(tituloNoCoincide === 'La placa no coincide' && lienzoNano.join() === 'nano,nano', `TB-3: «Cambiar a Nano» cambia la placa y el lienzo (${lienzoNano.join(', ')})`);

  // TB-9: programa_subido dice la placa para la que se compiló, aunque la cambien mientras sube (a un puerto que no existe)
  desde = leerRegistro3().length;
  await win.evaluate(() => { window.subirPlaca = window.subirOriginal; subirPlaca(true); });
  await win.waitForTimeout(300);
  await cambiarSelector('uno');
  const subio = await esperar(win, () => !puertos.ocupado && !/^Subir a/.test($('modalTitulo').textContent), 120000);
  await win.waitForTimeout(400);
  const subido = leerRegistro3().slice(desde).find((l) => l.tipo === 'programa_subido');
  revisar(subio && subido && subido.datos.placa === 'nano' && subido.datos.ok === false,
    `TB-9: subir al Nano y cambiar a Uno mientras sube: programa_subido dice ${subido ? subido.datos.placa : '(no salió)'}`);
  await win.keyboard.press('Escape');
  await win.waitForTimeout(200);

  // TB-4: cambiar la placa mientras se prepara la simulación: no se simula en el lienzo nuevo
  desde = leerRegistro3().length;
  await win.evaluate(() => { simular(); setTimeout(() => { const s = $('placa'); s.value = 'nano'; s.dispatchEvent(new Event('change')); }, 100); });
  const preparo = await esperar(win, () => !simulador.compilando, 120000);
  await win.waitForTimeout(500);
  const trasSimular = leerRegistro3().slice(desde).map((l) => l.tipo);
  revisar(preparo && await win.evaluate(() => !simulador.sim) && trasSimular.includes('codigo_compilado') && !trasSimular.includes('simulacion_iniciada'),
    `TB-4: la placa cambió mientras se preparaba: no hay simulación (${trasSimular.join(', ')})`);

  // TB-7: dos códigos confirmados seguidos, el segundo mientras el primero espera: los dos cambios se hacen, en orden
  desde = leerRegistro3().length;
  const equipoFinal = await win.evaluate(async () => {
    confirmarEquipo('N2'); document.querySelector('#modalAcciones .primario').click();
    confirmarEquipo('N3'); document.querySelector('#modalAcciones .primario').click();
    await cambioDeEquipo;
    return registroEventos.equipo();
  });
  await win.waitForTimeout(400);
  const inicios = leerRegistro3().slice(desde).filter((l) => l.tipo === 'sesion_iniciada').map((l) => l.equipo);
  revisar(equipoFinal === 'N3' && inicios.join() === 'N2,N3', `TB-7: el segundo código no se pierde (equipo ${equipoFinal}; sesiones ${inicios.join(', ')})`);

  // TB-2: si apagar el registro falla por el disco, el registro sigue encendido y el equipo vuelve a su sesión
  const bloqueo = path.join(datos3, 'registro-config.json.tmp'); // una carpeta donde va el temporal: guardar() no puede
  fs.mkdirSync(bloqueo);
  await entrarPanel();
  desde = leerRegistro3().length;
  await boton(win, 'Apagar el registro');
  await win.waitForTimeout(600);
  const notaApagar = await win.evaluate(() => [...document.querySelectorAll('#modalCuerpo p.muted')].pop().textContent);
  const trasFallo = leerRegistro3().slice(desde).map((l) => `${l.tipo}:${l.equipo}`);
  const estadoFallo = await win.evaluate(() => [registroEventos.equipo(), registroEncendido]);
  revisar(estadoFallo.join() === 'N3,true' && /No se pudo guardar en el disco\. Revisa que haya espacio libre/.test(notaApagar) &&
    trasFallo.slice(-2).join() === 'sesion_terminada:N3,sesion_iniciada:N3',
  `TB-2: apagar falló por el disco: sigue encendido con N3 en su sesión (${trasFallo.join(', ')}; «${notaApagar}»)`);
  fs.rmSync(bloqueo, { recursive: true, force: true });
  await boton(win, 'Apagar el registro');
  await win.waitForTimeout(600);
  revisar(await win.evaluate(() => registroEventos.equipo() === null && !registroEncendido), 'control TB-2: con el disco bien, se apaga');

  // Al terminar TB-2 el registro quedó apagado: se enciende y vuelve N3
  await entrarPanel();
  await boton(win, 'Encender el registro');
  await win.waitForTimeout(600);
  await win.evaluate(async () => { cerrarModal(false); confirmarEquipo('N3'); document.querySelector('#modalAcciones .primario').click(); await cambioDeEquipo; });
  await win.waitForTimeout(300);
  revisar(await win.evaluate(() => registroEncendido && registroEventos.equipo() === 'N3'), 'antes de la sección 11: el registro encendido otra vez, con N3');

  // 11. Verificación de Codex del 24 oct. AUD-17 (R03): lo que se sube se toma en un solo objeto antes de la primera
  // espera. Si mientras se suelta el puerto cambia la placa o el puerto, la subida empieza otra vez con lo de ahora, una
  // vez; si cambia el equipo, no se sube. Lo enviado y lo registrado coinciden siempre. La subida se reemplaza en el
  // proceso principal (no se sube a ninguna placa).
  await app.evaluate(({ ipcMain }) => {
    globalThis._subidas = [];
    ipcMain.removeHandler('tb:subir');
    ipcMain.handle('tb:subir', (_e, d) => { globalThis._subidas.push(d); return { ok: false, etapa: 'subir', salida: 'Puerto sintético', memoria: {} }; });
  });
  const subirCon = async (cambio) => {
    await app.evaluate(() => { globalThis._subidas = []; });
    const antes = leerRegistro3().length;
    const resultado = await win.evaluate(async (c) => {
      // TB-3 dejó una placa detectada falsa: en estos puertos sintéticos no se detecta ninguna, salvo en el caso que la pide
      window.placaDetectada = (p) => (c === 'puerto con otra placa' && p === 'COM92' ? 'nano' : null);
      const s = $('puerto');
      for (const p of ['COM91', 'COM92']) if (![...s.options].some((o) => o.value === p)) s.append(el('option', { value: p }, p));
      ponerPlaca('uno'); refrescarPines(); abrirLienzo(); s.value = 'COM91';
      if (c === 'codigo') entrarModoTexto('void setup() { int SUBIDO = 1; }\nvoid loop() {}\n');
      const real = desconectarSerial;
      let esperas = 0;
      window.desconectarSerial = async () => {
        esperas++;
        if (c === 'placa' || (c === 'placa dos veces')) { const p = $('placa'); p.value = p.value === 'nano' ? 'uno' : 'nano'; p.dispatchEvent(new Event('change')); }
        if (c === 'puerto' || c === 'puerto con otra placa') s.value = 'COM92';
        if (c === 'codigo') $('editor').value = 'void setup() { int CAMBIADO = 2; }\nvoid loop() {}\n';
        if (c === 'equipo') { confirmarEquipo('N4'); document.querySelector('#modalAcciones .primario').click(); await cambioDeEquipo; }
        serial.conectado = c === 'placa dos veces'; // así la segunda vez también espera
      };
      serial.conectado = true;
      try { await subirPlaca(true); } finally { window.desconectarSerial = real; serial.conectado = false; }
      const titulo = $('modal').hidden ? null : $('modalTitulo').textContent;
      cerrarModal(false);
      if (estado.texto) salirModoTexto(true);
      return { esperas, titulo, equipo: registroEventos.equipo() };
    }, cambio);
    await win.waitForTimeout(300);
    const lineas = leerRegistro3().slice(antes);
    return { ...resultado, subidas: await app.evaluate(() => globalThis._subidas), subido: lineas.filter((l) => l.tipo === 'programa_subido'), compilado: lineas.filter((l) => l.tipo === 'codigo_compilado') };
  };
  const controlSubida = await subirCon('ninguno');
  revisar(controlSubida.subidas.length === 1 && /:uno$/.test(controlSubida.subidas[0].fqbn) && controlSubida.subidas[0].puerto === 'COM91' && controlSubida.subido.length === 1 && controlSubida.subido[0].datos.placa === 'uno',
    'control AUD-17: sin cambios, se envía y se registra el Uno en COM91');
  const conPlaca = await subirCon('placa');
  revisar(conPlaca.subidas.length === 1 && /:nano/.test(conPlaca.subidas[0].fqbn) && conPlaca.subido.length === 1 && conPlaca.subido[0].datos.placa === 'nano' && conPlaca.esperas === 1,
    `AUD-17: la placa cambia a Nano mientras se suelta el puerto: se sube otra vez, al Nano, y eso se registra (${conPlaca.subidas.map((x) => x.fqbn).join(' | ')}; ${conPlaca.subido.map((l) => l.datos.placa).join()})`);
  const conPuerto = await subirCon('puerto');
  revisar(conPuerto.subidas.length === 1 && conPuerto.subidas[0].puerto === 'COM92' && conPuerto.subido.length === 1,
    `AUD-17: el puerto cambia mientras se suelta: se sube al puerto de ahora (${conPuerto.subidas.map((x) => x.puerto).join()})`);
  const otraPlacaEnPuerto = await subirCon('puerto con otra placa');
  revisar(otraPlacaEnPuerto.subidas.length === 0 && otraPlacaEnPuerto.titulo === 'La placa no coincide' && !otraPlacaEnPuerto.subido.length,
    `AUD-17: al empezar otra vez se repiten las comprobaciones: en el puerto nuevo hay otra placa y se pregunta («${otraPlacaEnPuerto.titulo}»)`);
  const conCodigo = await subirCon('codigo');
  revisar(conCodigo.subidas.length === 1 && /SUBIDO/.test(conCodigo.subidas[0].codigo) && !/CAMBIADO/.test(conCodigo.subidas[0].codigo) &&
    conCodigo.compilado.length === 1 && /SUBIDO/.test(conCodigo.compilado[0].datos.codigo),
  'AUD-17: el código cambia mientras se suelta el puerto: se sube y se registra el que había al pulsar Subir');
  const conEquipo = await subirCon('equipo');
  revisar(conEquipo.subidas.length === 0 && !conEquipo.subido.length && !conEquipo.compilado.length && conEquipo.equipo === 'N4',
    'AUD-17: el equipo cambia mientras se suelta el puerto: no se sube ni se registra nada (la subida ya no es de nadie)');
  const dosVeces = await subirCon('placa dos veces');
  revisar(dosVeces.subidas.length === 0 && !dosVeces.subido.length && dosVeces.titulo === 'No se subió el programa' && dosVeces.esperas === 2,
    `AUD-17: si la placa cambia también la segunda vez, no se sube nada y se dice («${dosVeces.titulo}»)`);
  await cambiarSelector('uno');
  await win.waitForTimeout(400);

  // AUD-18 (R04): apagar el registro y confirmar un equipo van en la misma fila. Un equipo que espera y le toca con el
  // registro apagado no empieza; el editor queda sin equipo y el siguiente encendido pide un inicio nuevo. El cierre de la
  // simulación se controla a mano para que las dos operaciones esperen a la vez.
  const fila = async (pasos) => {
    const antes = leerRegistro3().length;
    const estadoFinal = await win.evaluate(async (ps) => {
      const real = detenerSimulacion;
      let soltar;
      const cierre = new Promise((listo) => { soltar = listo; });
      window.detenerSimulacion = () => cierre;
      try {
        for (const p of ps) {
          if (p === 'apagar' || p === 'encender') {
            panelInstructor('1357', { activo: p === 'apagar', archivos: 1, falla: null, descartados: null });
            [...$('modalAcciones').querySelectorAll('button')].find((b) => b.textContent === (p === 'apagar' ? 'Apagar el registro' : 'Encender el registro')).click();
          } else { confirmarEquipo(p); document.querySelector('#modalAcciones .primario').click(); }
        }
        soltar();
        await new Promise((listo) => setTimeout(listo, 50));
        await cambioDeEquipo;
        await new Promise((listo) => setTimeout(listo, 100));
      } finally { window.detenerSimulacion = real; }
      cerrarModal(false);
      return { equipo: registroEventos.equipo(), encendido: registroEncendido };
    }, pasos);
    await win.waitForTimeout(300);
    return { ...estadoFinal, lineas: leerRegistro3().slice(antes).map((l) => `${l.tipo}:${l.equipo}`) };
  };
  const apagaPrimero = await fila(['apagar', 'N5']);
  revisar(apagaPrimero.equipo === null && !apagaPrimero.encendido && !apagaPrimero.lineas.includes('sesion_iniciada:N5'),
    `AUD-18: apagar y después confirmar N5 mientras se cierra la corrida: apagado, sin equipo y N5 no empieza (${apagaPrimero.lineas.join(', ')})`);
  const reencender = await fila(['encender']);
  const conN5 = await win.evaluate(async () => {
    confirmarEquipo('N5'); document.querySelector('#modalAcciones .primario').click();
    await cambioDeEquipo;
    registrarEditor('codigo_compilado', { ok: true, error: null, bytes: 1, codigo: 'void setup(){}\nvoid loop(){}' });
    return registroEventos.equipo();
  });
  await win.waitForTimeout(300);
  const trasReencender = leerRegistro3().map((l) => `${l.tipo}:${l.equipo}`);
  const inicioN5 = trasReencender.lastIndexOf('sesion_iniciada:N5'), compiloN5 = trasReencender.lastIndexOf('codigo_compilado:N5');
  revisar(reencender.encendido && conN5 === 'N5' && inicioN5 >= 0 && compiloN5 > inicioN5,
    'AUD-18: al encender otra vez y confirmar N5, su sesión empieza antes de lo que compila (sin una sesión huérfana)');
  const confirmaPrimero = await fila(['N6', 'apagar']);
  revisar(confirmaPrimero.equipo === null && !confirmaPrimero.encendido && confirmaPrimero.lineas.join() === 'sesion_terminada:N5,sesion_iniciada:N6,sesion_terminada:N6',
    `AUD-18: confirmar N6 y después apagar: N6 empieza y termina antes de apagar (${confirmaPrimero.lineas.join(', ')})`);
  await fila(['encender']);
  await win.evaluate(async () => { confirmarEquipo('N7'); document.querySelector('#modalAcciones .primario').click(); await cambioDeEquipo; });
  const dosYApagar = await fila(['N8', 'N9', 'apagar']);
  revisar(dosYApagar.equipo === null && dosYApagar.lineas.join() === 'sesion_terminada:N7,sesion_iniciada:N8,sesion_terminada:N8,sesion_iniciada:N9,sesion_terminada:N9',
    `AUD-18: dos códigos que esperan y después apagar: cada uno en orden y nada después del apagado (${dosYApagar.lineas.join(', ')})`);
  await fila(['encender']);
  const mismoCodigo = await win.evaluate(async () => { confirmarEquipo('N9'); document.querySelector('#modalAcciones .primario').click(); await cambioDeEquipo; return registroEventos.equipo(); });
  await win.waitForTimeout(300);
  revisar(mismoCodigo === 'N9' && leerRegistro3().map((l) => `${l.tipo}:${l.equipo}`).filter((x) => x === 'sesion_iniciada:N9').length === 2,
    'AUD-18: al encender otra vez con el mismo código de antes, empieza una sesión nueva (no se queda con la de antes del apagado)');
  await app.close();
  await new Promise((r) => setTimeout(r, 300));
  if (fs.existsSync(REVISOR)) {
    const { revisarEvento } = require(REVISOR);
    const problemas = leerRegistro3().flatMap((l, i) => revisarEvento(l).map((p) => `${i + 1} (${l.tipo}): ${p}`));
    revisar(!problemas.length, `REG-005: las ${leerRegistro3().length} líneas de la sección 10 cumplen contrato/evento.schema.json` + (problemas.length ? ':\n  ' + problemas.slice(0, 10).join('\n  ') : ''));
  }
  fs.rmSync(datos3, { recursive: true, force: true });
  revisar(!errores.length, 'sin errores en la consola, también en las secciones 9 y 10' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
