// Prueba la app de escritorio: abre Electron, busca puertos, compila, y revisa los mensajes de error.
// Uso: npm run build && npm run test:app   (las capturas quedan en test/salida/app_*.png)
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(__dirname, 'salida');
fs.mkdirSync(SALIDA, { recursive: true });

(async () => {
  // Si ELECTRON_RUN_AS_NODE está puesta (la pone VS Code en algunas terminales), Electron arranca como Node sin ventana
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE'));
  const app = await electron.launch({ args: [RAIZ], cwd: RAIZ, env });
  const errores = [];
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errores.push(String(e)));
  await win.waitForLoadState('load');
  await win.waitForTimeout(2500);

  const info = await win.evaluate(async () => ({
    puente: !!window.tbEscritorio, info: await window.tbEscritorio.info(),
    puertoVisible: !document.getElementById('campoPuerto').hidden,
    opciones: [...document.querySelectorAll('#puerto option')].map(o => o.textContent)
  }));
  console.log('app:', JSON.stringify(info));
  await win.screenshot({ path: path.join(SALIDA, 'app_1_inicio.png') });

  // Compilar el ejemplo del carro (sin subir)
  const comp = await win.evaluate(async () => {
    ponerNivel(3); cargarEjemplo(EJEMPLOS[0]); actualizar();
    const t = Date.now();
    const r = await window.tbEscritorio.subir({ codigo: codigoActual(), fqbn: placa().fqbn, soloCompilar: true });
    return { ok: r.ok, memoria: r.memoria, ms: Date.now() - t };
  });
  console.log('compilar carro:', JSON.stringify(comp));

  // Subir a un puerto que no existe → mensaje claro
  await win.evaluate(() => {
    const sel = document.getElementById('puerto');
    sel.append(Object.assign(document.createElement('option'), { value: 'COM99', textContent: 'COM99 · prueba' }));
    sel.value = 'COM99';
    subirPlaca(true);
  });
  await win.waitForSelector('#modal:not([hidden]) .subir-barra');
  await win.screenshot({ path: path.join(SALIDA, 'app_2_subiendo.png') });
  await win.waitForFunction(() => !document.querySelector('#modal .subir-barra'), null, { timeout: 120000 });
  console.log('puerto falso →', await win.textContent('#modalTitulo'));
  await win.screenshot({ path: path.join(SALIDA, 'app_3_error_puerto.png') });
  await win.evaluate(() => cerrarModal(false));

  // Error de C++ escrito a mano → línea y explicación
  await win.evaluate(() => {
    const b = Blockly.serialization.blocks.append({ type: 'cpp_linea', fields: { CODE: 'velocidad = 3' } }, espacio);
    espacio.getBlocksByType('programa')[0].getInput('SETUP').connection.connect(b.previousConnection);
    actualizar();
    subirPlaca(true);
  });
  await win.waitForFunction(() => !document.querySelector('#modal .subir-barra') && !document.getElementById('modal').hidden, null, { timeout: 120000 });
  console.log('error C++ →', await win.textContent('#modalTitulo'), '|', (await win.textContent('#modalCuerpo')).slice(0, 220));
  await win.screenshot({ path: path.join(SALIDA, 'app_4_error_cpp.png') });

  console.log('ERRORES:', errores);
  await app.close();
  process.exit(errores.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
