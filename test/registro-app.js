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
  await win.evaluate(() => detenerSimulacion());
  await win.waitForTimeout(200);

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
    const antes = { equipo: registroEventos.equipo(), cambiando: cambiandoEquipo, ms: Math.round(performance.now() - t0) };
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
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
