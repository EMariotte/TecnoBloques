// Prueba la app ya empaquetada (win-unpacked) tal como queda instalada.
// Uso: node test/app-empaquetada.js <carpeta win-unpacked>
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
(async () => {
  const dir = process.argv[2];
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE'));
  // Carpeta de datos aparte: si la app instalada está abierta, no choca con ella (una sola instancia)
  const datos = path.join(require('os').tmpdir(), 'tecnobloques-prueba');
  const app = await electron.launch({ executablePath: path.join(dir, 'TecnoBloques.exe'), args: [`--user-data-dir=${datos}`], env });
  const win = await app.firstWindow();
  const errores = [];
  win.on('pageerror', (e) => errores.push(String(e)));
  await win.waitForLoadState('load');
  await win.waitForTimeout(2500);
  const r = await win.evaluate(async () => {
    const info = await window.tbEscritorio.info();
    ponerNivel(3); cargarEjemplo(EJEMPLOS[1]); actualizar();
    const t = Date.now();
    const c = await window.tbEscritorio.subir({ codigo: codigoActual(), fqbn: placa().fqbn, soloCompilar: true });
    return { info, compila: c.ok, memoria: c.memoria, ms: Date.now() - t, titulo: document.title };
  });
  console.log(JSON.stringify(r));
  console.log('ERRORES:', errores);
  await app.close();
  // AUD-29: salida distinta de 0 si la app empaquetada no abre como tal, no compila o tiene errores de página
  const fallas = [];
  const revisar = (condicion, texto) => { console.log((condicion ? 'OK    ' : 'FALLA ') + texto); if (!condicion) fallas.push(texto); };
  revisar(r.info && r.info.empaquetada === true && r.info.arduino === 'paquete', `es la app empaquetada, con el Arduino del paquete (${JSON.stringify(r.info)})`);
  revisar(r.titulo === `TecnoBloques ${r.info && r.info.version}`, `el título dice su versión («${r.titulo}»)`);
  revisar(r.compila === true && !!r.memoria, `compila el ejemplo (${r.ms} ms)`);
  revisar(!errores.length, 'sin errores de JavaScript en la página');
  console.log(fallas.length ? `\n${fallas.length} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
