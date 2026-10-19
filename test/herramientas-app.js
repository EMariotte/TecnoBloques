// AUD-06: las herramientas de desarrollo (F12) solo son del instructor. Este recorrido las abre muchas veces por otro
// camino (openDevTools desde el proceso principal, con cada modo de Electron), sin el PIN, y cuenta cuántas quedan
// abiertas a los 800 ms (el mismo plazo de test/registro-app.js). También revisa F12 sin PIN y, al final, que con el PIN
// del instructor sí se abran y se queden abiertas.
// Uso: node test/herramientas-app.js [veces]   (por defecto 50; arma antes con node build.js)
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
const VECES = Number(process.argv[2]) || 50;
const MODOS = [undefined, 'detach', 'undocked', 'right', 'bottom'];
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}

(async () => {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')), TB_HERRAMIENTAS: 'instructor' };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-herramientas');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`], cwd: RAIZ, env });
  const win = await app.firstWindow();
  const errores = [];
  win.on('pageerror', (e) => errores.push(String(e)));
  await win.waitForLoadState('load');
  await win.waitForTimeout(1500);

  const abiertas = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened());
  /** Abre las herramientas por otro camino y mira cada 20 ms si siguen abiertas, hasta 800 ms. */
  const abrirYMirar = (modo) => app.evaluate(async ({ BrowserWindow }, modo) => {
    const wc = BrowserWindow.getAllWindows()[0].webContents;
    const t0 = Date.now();
    wc.openDevTools(modo ? { mode: modo } : undefined);
    let vistaEn = null, cerradaEn = null;
    let muestras = '';
    while (Date.now() - t0 < 800) {
      await new Promise((r) => setTimeout(r, 20));
      const a = wc.isDevToolsOpened();
      muestras += a ? '1' : '0';
      if (a && vistaEn === null) vistaEn = Date.now() - t0;
      if (!a && vistaEn !== null && cerradaEn === null) cerradaEn = Date.now() - t0;
    }
    const sigue = wc.isDevToolsOpened();
    if (sigue) { // se cierran a mano para el intento siguiente
      wc.closeDevTools();
      const t1 = Date.now();
      while (wc.isDevToolsOpened() && Date.now() - t1 < 3000) await new Promise((r) => setTimeout(r, 20));
    }
    return { sigue, vistaEn, cerradaEn, muestras };
  }, modo);

  // 1. Por otro camino, sin PIN: VECES intentos repartidos entre los modos
  const porModo = {};
  const tiempos = [];
  for (let i = 0; i < VECES; i++) {
    const modo = MODOS[i % MODOS.length];
    const r = await abrirYMirar(modo);
    const k = modo || 'por defecto';
    porModo[k] = porModo[k] || { intentos: 0, abiertas: 0 };
    porModo[k].intentos++;
    if (r.sigue) { porModo[k].abiertas++; console.log(`      intento ${i + 1} (${k}): sigue abierta a los 800 ms; muestras cada 20 ms: ${r.muestras}`); }
    if (r.vistaEn !== null && r.cerradaEn !== null) tiempos.push(r.cerradaEn - r.vistaEn); // cuánto se vieron abiertas
    await win.waitForTimeout(100);
  }
  const quedaron = Object.values(porModo).reduce((n, m) => n + m.abiertas, 0);
  console.log('      por modo:', Object.entries(porModo).map(([k, m]) => `${k} ${m.abiertas}/${m.intentos}`).join(' · '));
  if (tiempos.length) console.log(`      se vieron abiertas ${tiempos.length} veces, de ${Math.min(...tiempos)} a ${Math.max(...tiempos)} ms (en modo detach Electron no las da por abiertas hasta su aviso)`);
  revisar(quedaron === 0, `sin PIN, abiertas por otro camino: ${quedaron} de ${VECES} siguen abiertas a los 800 ms`);

  // 2. F12 sin PIN no las abre
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }));
  await win.waitForTimeout(800);
  revisar(!(await abiertas()), 'sin PIN, F12 no las abre');

  // 3. Con el PIN del instructor: F12 las abre y se quedan abiertas (también por otro camino)
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  await win.locator('#pinNuevo').fill('2468');
  await win.locator('#pinRepetido').fill('2468');
  await win.locator('#modalAcciones button', { hasText: 'Crear PIN' }).click();
  await win.waitForTimeout(400);
  await win.locator('#modalAcciones button', { hasText: 'Cerrar' }).click();
  await win.waitForTimeout(200);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }));
  await win.waitForTimeout(800);
  revisar(await abiertas(), 'con el PIN del instructor, F12 las abre');
  await win.waitForTimeout(1000);
  revisar(await abiertas(), 'y se quedan abiertas');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.closeDevTools());
  await win.waitForTimeout(500);
  const conPin = await abrirYMirar('detach');
  revisar(conPin.sigue && conPin.cerradaEn === null, 'con el PIN, abiertas por otro camino también se quedan');

  await app.close();
  revisar(!errores.length, 'sin errores en la página' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
