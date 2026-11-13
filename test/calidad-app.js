// Calidad de la versión del estudio A/B (EST-002, I6; diseño y ejemplos E2–E7 en
// TecnoSuite/EstrategíaTecno/DISENO-I6-CALIDAD.md). Tres modos, en A, B y C0 según el caso:
//   --fallos    TEC-07 (el programa no compila; falta el compilador), TEC-08 (no se pudo escribir el archivo al
//               guardar), TEC-06 (cambiar la placa después de simular) y TEC-01 (un campo desconocido del proyecto).
//   --recursos  TEC-15 (tiempos de abrir la tarea y de la primera foto, memoria tras un bloque; C0 es la referencia y
//               A/B tienen el presupuesto D3) y TEC-10 (veinte aperturas y cierres seguidos: Workers, intervalos,
//               escuchas y memoria no crecen). Se corre con el cargador: sin él, se detiene (--sin-cargador lo salta).
//               La memoria es el heap de JavaScript del renderer leído por CDP (Runtime.getHeapUsage) tras dos
//               recolecciones; performance.memory no sirve (F01 de COD-20261112-001: sin --enable-precise-memory-info
//               se queda en un valor redondeado y no ve 128 MB retenidos). En cada app abierta, un control retiene
//               128 MB y los suelta: la lectura tiene que verlos y las condiciones de E5 y E6 tienen que rechazarlos.
//   --aria      TEC-12: el árbol accesible de A, B y C0 con la misión abierta (test/salida/aria-*.yaml), todo control
//               con nombre y nada enfocable dentro de aria-hidden.
//   --web       TEC-17: el mismo HTML sin el puente de escritorio (como en un navegador) es C0 y no ofrece compilar ni
//               simular, aunque el instructor haya dejado A: las capacidades vienen del entorno, no de la variante.
// Sin modo, los cuatro. Necesita arduino-cli (como test:simulador). La variante la deja el instructor en
// estudio-config.json; aquí se escribe antes de abrir la app.
// Uso: npm run test:calidad [-- --fallos | --recursos | --aria] [--sin-cargador]
'use strict';
const { _electron: electron } = require('playwright-core');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(__dirname, 'salida');
fs.mkdirSync(SALIDA, { recursive: true });
const args = process.argv.slice(2);
const modos = ['--fallos', '--recursos', '--aria', '--web'].filter((m) => args.includes(m));
const correr = (m) => !modos.length || modos.includes(m);
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const medianas = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const ms = (x) => `${Math.round(x)} ms`;
const mb = (x) => `${(x / 1048576).toFixed(1)} MB`;
const TAREAS = ['estudio_x1', 'estudio_y1', 'estudio_x2', 'estudio_y2'];
const ERRONEO = 'void setup() { ERROR_SINTETICO; }\nvoid loop() {}\n';
const medidas = {};

(async () => {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')), TB_HERRAMIENTAS: 'instructor' };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-calidad-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  fs.mkdirSync(datos, { recursive: true });
  const ponerVariante = (v) => fs.writeFileSync(path.join(datos, 'estudio-config.json'), JSON.stringify({ formato: 1, variante: v }));
  const errores = [];
  async function tamano(app, win, ancho, alto) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => { const v = BrowserWindow.getAllWindows()[0]; v.unmaximize(); v.setContentSize(w, h); }, [ancho, alto]);
    await win.waitForTimeout(500);
  }
  async function abrir(variante, ancho = 1536, alto = 864) {
    ponerVariante(variante);
    // Las mismas opciones de test:actividad (una ventana tapada deja de pintarse) más --expose-gc, para medir memoria
    const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--js-flags=--expose-gc'], cwd: RAIZ, env });
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await win.waitForLoadState('load');
    await tamano(app, win, ancho, alto);
    await win.waitForTimeout(1500);
    const v = await win.evaluate(() => document.body.dataset.variante || 'C0');
    if (v !== variante) throw new Error(`La app abrió en ${v}, no en ${variante}`);
    return { app, win };
  }
  const pausa = (win, t) => win.waitForTimeout(t);
  const esperar = (win, condicion, t = 40000, polling = 200) => win.waitForFunction(condicion, null, { timeout: t, polling }).then(() => true, () => false);
  // En A, el primer uso tiene los dos espacios vacíos: Bloques a la izquierda y Circuito a la derecha, como en test:paneles
  async function armarA(win) {
    // Con una disposición ya guardada (la misma carpeta de datos sirve a varias corridas), los espacios no están vacíos
    if (!(await win.evaluate(() => [...document.querySelectorAll('.lado-vacio')].some((v) => v.offsetParent !== null)))) return;
    await win.locator('#ladoIzq .lado-vacio button[data-herr="bloques"]').click();
    await pausa(win, 300);
    await win.locator('#ladoDer .lado-vacio button[data-herr="circuito"]').click();
    await pausa(win, 600);
  }
  const cargarTarea = (win, id) => win.evaluate((i) => cargarEjemplo(EJEMPLOS.find((e) => e.id === i)), id).then(() => pausa(win, 700));
  // Abrir un ejemplo como el aprendiz: menú Ejemplos, el botón con su nombre y «Abrir ejemplo»
  async function abrirTarea(win, nombre) {
    await win.locator('#btnEjemplos').click();
    await pausa(win, 200);
    await win.locator('#listaEjemplos button', { hasText: nombre }).click();
    await pausa(win, 300);
    await win.locator('#modalAcciones button', { hasText: 'Abrir ejemplo' }).click();
    await pausa(win, 900);
  }
  const simularBarra = (win) => win.locator('#btnSimularBarra').click();
  const arranco = (win) => esperar(win, () => !!simulador.sim && simulador.sim.medidas().msSimulados > 300, 60000);
  const detener = (win) => win.evaluate(() => detenerSimulacion()).then(() => pausa(win, 400));
  const modalAbierto = (win) => esperar(win, () => !simulador.compilando && !$('modal').hidden, 60000);
  const leerModal = (win) => win.evaluate(() => ({ titulo: $('modalTitulo').textContent, cuerpo: $('modalCuerpo').textContent, pre: ($('modalCuerpo').querySelector('pre') || {}).textContent || '' }));
  const cerrarModal = (win) => win.evaluate(() => cerrarModal(false)).then(() => pausa(win, 200));
  // Lo que el aprendiz no debe perder: programa, circuito, nombre y disposición de los espacios
  const trabajo = (win) => win.evaluate(() => ({
    bloques: JSON.stringify(Blockly.serialization.workspaces.save(espacio)), texto: estado.texto ? $('editor').value : null,
    circuito: JSON.stringify(proyectoActual().circuito || null), nombre: $('nombreProyecto').value,
    disposicion: panelesA.activo() ? JSON.stringify(panelesA.disposicion()) : null, placa: placaActual,
  }));
  const igual = (a, b, campos) => campos.every((c) => a[c] === b[c]);
  // Las condiciones del presupuesto, iguales para las medidas y para el control (D3 y E5, sin márgenes añadidos)
  const MB50 = 50 * 1048576;
  const dentroE6 = (heapVariante, heapC0) => heapVariante <= heapC0 + MB50;
  const dentroE5 = (heap20, heap10) => heap20 <= heap10 * 1.1;
  // Heap de JavaScript del renderer, por CDP, después de dos recolecciones
  async function heap(win) {
    const cdp = await win.context().newCDPSession(win);
    try {
      await cdp.send('HeapProfiler.collectGarbage');
      await win.waitForTimeout(300);
      await cdp.send('HeapProfiler.collectGarbage');
      const u = await cdp.send('Runtime.getHeapUsage');
      return u.usedSize;
    } finally { await cdp.detach().catch(() => {}); }
  }
  // Los tiempos de E6 esperan dos cuadros pintados: con la pantalla en reposo o la ventana tapada, Chromium deja de pintar
  // y la medida es del entorno, no de la app. La prueba impide el reposo de la pantalla y anota el estado de la ventana.
  const mantenerPantalla = (app) => app.evaluate(({ powerSaveBlocker }) => powerSaveBlocker.start('prevent-display-sleep'));
  // Antes de cada medida: si la ventana quedó minimizada u oculta (pasa con Electron de prueba), se restaura y se anota
  const estadoVentana = async (app, win) => {
    const restaurada = await app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0]; if (v.isMinimized() || !v.isVisible()) { v.restore(); v.show(); v.focus(); return true; } return false; });
    if (restaurada) await win.waitForTimeout(800);
    return {
      restaurada,
      ...(await app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0]; return { visible: v.isVisible(), minimizada: v.isMinimized(), alto: v.getContentSize()[1] }; })),
      pagina: await win.evaluate(() => document.visibilityState),
    };
  };
  // Control de la medida (F01): 32 millones de enteros pequeños (128 MB con punteros comprimidos) retenidos y soltados
  async function controlMemoria(win, variante) {
    const pm = () => win.evaluate(() => performance.memory.usedJSHeapSize);
    const base = await heap(win), pmBase = await pm();
    await win.evaluate(() => { window.__retencion = new Array(32e6).fill(7); });
    const retenido = await heap(win), pmRetenido = await pm();
    await win.evaluate(() => { window.__retencion = null; });
    const liberado = await heap(win), pmLiberado = await pm();
    const r = { base, retenido, liberado, crece: retenido - base, vuelve: liberado - base, performanceMemory: [pmBase, pmRetenido, pmLiberado] };
    revisar(r.crece >= 100 * 1048576 && !dentroE6(retenido, base) && !dentroE5(retenido, base),
      `control de memoria (${variante}): la lectura ve los 128 MB retenidos (${mb(base)} → ${mb(retenido)}) y E5 y E6 los rechazan (performance.memory: ${pmBase} → ${pmRetenido} bytes)`);
    revisar(Math.abs(r.vuelve) < 10 * 1048576, `control de memoria (${variante}): al soltarlos la lectura vuelve (${mb(liberado)}; diferencia ${mb(r.vuelve)})`);
    return r;
  }

  // =====================================================================================================
  if (correr('--fallos')) {
    console.log('\n== Fallos (E2, E3, E4 y TEC-01) ==');
    for (const variante of ['A', 'B']) {
      let { app, win } = await abrir(variante);
      if (variante === 'A') await armarA(win);
      await abrirTarea(win, 'X1 · Luces en secuencia');
      const antes = await trabajo(win);

      // ---- E2 (TEC-07). Un programa que no compila: aviso con la causa; nada se pierde; sin simulación
      await win.evaluate((c) => entrarModoTexto(c, ''), ERRONEO);
      await simularBarra(win);
      const hayModal = await modalAbierto(win);
      const m = await leerModal(win);
      revisar(hayModal && m.titulo === 'El programa tiene un error' && /Línea 1/.test(m.cuerpo) && /ERROR_SINTETICO/.test(m.pre),
        `E2 (${variante}): el error de compilación dice la causa y la línea («${m.titulo}»; ${/Línea 1/.test(m.cuerpo) ? 'línea 1' : 'sin línea'}; mensaje completo ${/ERROR_SINTETICO/.test(m.pre) ? 'presente' : 'ausente'})`);
      const tras = await win.evaluate(() => ({ sim: !!simulador.sim, cancelada: estadoEjecucion().cancelada, destino: $('estadoSim').dataset.destino }));
      revisar(!tras.sim && tras.cancelada === 'compilacion' && tras.destino === '', `E2 (${variante}): no hay simulación y la ejecución quedó cancelada por la compilación (${JSON.stringify(tras)})`);
      let ahora = await trabajo(win);
      revisar(ahora.texto === ERRONEO && igual(antes, ahora, ['circuito', 'nombre', 'disposicion', 'placa']), `E2 (${variante}): el C++ escrito, el circuito, el nombre y la disposición siguen como estaban`);
      await cerrarModal(win);
      await win.evaluate(() => salirModoTexto(true));
      await pausa(win, 400);
      ahora = await trabajo(win);
      revisar(ahora.bloques === antes.bloques && ahora.texto === null, `E2 (${variante}): al volver a los bloques, el programa es el de antes`);
      await simularBarra(win);
      revisar(await arranco(win), `E2 (${variante}): con el programa bueno, «Simular» vuelve a funcionar (recuperación)`);
      await detener(win);

      // ---- E4 (TEC-06). Simular y después cambiar la placa: la corrida anterior no vale; la nueva compila para la placa nueva
      await simularBarra(win);
      revisar(await arranco(win), `E4 (${variante}): X1 simula en el Uno`);
      await win.evaluate(() => { $('placa').value = 'nano'; $('placa').dispatchEvent(new Event('change')); });
      await pausa(win, 800);
      const cambio = await win.evaluate(() => ({ sim: !!simulador.sim, placa: placaActual, ej: estadoEjecucion(), barra: $('estadoSimBarra').hidden, detener: $('btnDetenerBarra').hidden }));
      revisar(!cambio.sim && cambio.placa === 'nano' && !cambio.ej.destino && cambio.barra && cambio.detener,
        `E4 (${variante}): al cambiar al Nano la simulación del Uno se detiene y nada queda «simulando» (${JSON.stringify({ sim: cambio.sim, destino: cambio.ej.destino, cancelada: cambio.ej.cancelada })})`);
      await simularBarra(win);
      revisar(await arranco(win) && await win.evaluate(() => estadoEjecucion().placa === 'nano' && simulador.sim && simulador.sim.medidas().msSimulados > 0),
        `E4 (${variante}): «Simular» de nuevo compila y corre para el Nano (${await win.evaluate(() => JSON.stringify({ placa: estadoEjecucion().placa, revision: estadoEjecucion().revisionEjecutada }))})`);
      await detener(win);
      await win.evaluate(() => { $('placa').value = 'uno'; $('placa').dispatchEvent(new Event('change')); });
      await pausa(win, 500);

      // ---- TEC-01. Un campo que TecnoBloques no conoce sobrevive a cargar y volver a serializar el proyecto
      const ajeno = await win.evaluate(() => { const p = proyectoActual(); p.ajeno = { x: 1, y: 'dos' }; const r = cargarProyecto(p, true); return { r, despues: JSON.stringify(proyectoActual().ajeno || null) }; });
      revisar(ajeno.r === true && ajeno.despues === '{"x":1,"y":"dos"}', `TEC-01 (${variante}): un campo desconocido del .tbq.json se conserva al cargar y guardar (${ajeno.despues})`);
      await pausa(win, 300);

      // ---- E3 (TEC-08). «Guardar» cuando el archivo no se puede escribir: el de antes queda intacto y nadie dice «guardado».
      // El cuadro de guardar de Windows es del sistema; aquí el proceso principal fija la ruta por él y anota cómo termina
      // la descarga. El archivo elegido está abierto por otro programa sin compartir (lo más común en Windows: «el archivo
      // está en uso»). Un archivo de solo lectura no sirve de caso: Chromium lo reemplaza igual.
      const carpeta = path.join(datos, 'guardar');
      fs.mkdirSync(carpeta, { recursive: true });
      const destino = path.join(carpeta, `${variante}-anterior.tbq.json`);
      fs.writeFileSync(destino, '{"app":"TecnoBloques","anterior":true}');
      const candado = spawn('powershell', ['-NoProfile', '-Command', `$f=[System.IO.File]::Open('${destino.replace(/'/g, "''")}','Open','ReadWrite','None'); Start-Sleep -Seconds 120`], { stdio: 'ignore' });
      for (let i = 0; i < 100; i++) { try { fs.closeSync(fs.openSync(destino, 'r+')); await pausa(win, 100); } catch (e) { break; } }
      let bloqueado = false;
      try { fs.closeSync(fs.openSync(destino, 'r+')); } catch (e) { bloqueado = true; }
      revisar(bloqueado, `E3 (${variante}): el archivo de destino quedó abierto por otro programa (preparación)`);
      await win.evaluate(() => { $('toast').hidden = true; });
      await app.evaluate(({ session }, ruta) => {
        global.__descarga = { ruta, inicio: false, estado: null };
        session.defaultSession.once('will-download', (_e, item) => {
          global.__descarga.inicio = true;
          item.setSavePath(ruta);
          item.once('done', (_ev, estado) => { global.__descarga.estado = estado; });
        });
      }, destino);
      await win.locator('#btnGuardar').click();
      await pausa(win, 400);
      await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
      await esperar(win, () => true, 100);
      let d = null;
      for (let i = 0; i < 40 && !(d && d.estado); i++) { await pausa(win, 250); d = await app.evaluate(() => global.__descarga); }
      const visto = await win.evaluate(() => ({ toast: $('toast').hidden ? null : $('toast').textContent, modal: $('modal').hidden ? null : $('modalTitulo').textContent, cuerpo: $('modal').hidden ? '' : $('modalCuerpo').textContent }));
      candado.kill();
      await pausa(win, 300);
      const intacto = fs.readFileSync(destino, 'utf8') === '{"app":"TecnoBloques","anterior":true}';
      revisar(d && d.inicio && d.estado && d.estado !== 'completed' && intacto,
        `E3 (${variante}): la escritura falla (estado «${d && d.estado}») y el archivo anterior queda intacto`);
      const afirmaGuardado = /guardad|se guardó/i.test((visto.toast || '') + (visto.cuerpo || ''));
      revisar(!afirmaGuardado, `E3 (${variante}): la app no dice «guardado» (toast: ${JSON.stringify(visto.toast)}; pantalla: ${JSON.stringify(visto.modal)})`);
      console.log(`       E3 (${variante}): lo que ve el aprendiz tras el fallo: toast ${JSON.stringify(visto.toast)}, pantalla «${visto.modal}»`);
      medidas[`E3-${variante}`] = { descarga: d, visto };
      await cerrarModal(win);
      ahora = await trabajo(win);
      revisar(ahora.bloques === antes.bloques && ahora.nombre === antes.nombre, `E3 (${variante}): el proyecto sigue abierto y completo después del fallo`);

      // ---- E2 (TEC-07), compilador ausente. Va al final: se quita la IPC del compilador y no se puede devolver sin reabrir.
      await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('tb:compilar-hex'); ipcMain.handle('tb:compilar-hex', async () => ({ ok: false, etapa: 'sin-arduino', salida: 'No se encontró arduino-cli.' })); });
      await simularBarra(win);
      const hayModal2 = await modalAbierto(win);
      const m2 = await leerModal(win);
      revisar(hayModal2 && m2.titulo === 'Falta el compilador' && /Reinstala TecnoBloques/.test(m2.cuerpo), `E2 (${variante}): sin compilador, el aviso dice qué pasa y qué hacer («${m2.titulo}: ${m2.cuerpo.trim()}»)`);
      await cerrarModal(win);
      ahora = await trabajo(win);
      revisar(!(await win.evaluate(() => !!simulador.sim)) && ahora.bloques === antes.bloques && igual(antes, ahora, ['circuito', 'nombre', 'disposicion']), `E2 (${variante}): sin compilador no hay simulación y el trabajo sigue completo`);
      // Cerrar y abrir: el proyecto vuelve solo (AUD-19), que es la otra mitad de TEC-08
      await app.close();
      ({ app, win } = await abrir(variante));
      const vuelto = await trabajo(win);
      revisar(vuelto.bloques === antes.bloques && vuelto.nombre === antes.nombre && vuelto.circuito === antes.circuito, `E3 (${variante}): al cerrar y abrir la app vuelve el mismo proyecto (${vuelto.nombre})`);
      await app.close();
    }
  }

  // =====================================================================================================
  if (correr('--recursos')) {
    console.log('\n== Recursos (E5 y E6) ==');
    let bateria = 'desconocida';
    try { bateria = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_Battery).BatteryStatus"', { encoding: 'utf8' }).trim(); } catch (e) { /* sin batería o sin PowerShell */ }
    console.log(`alimentación: BatteryStatus=${bateria} (2 = con el cargador)`);
    if (bateria === '1' && !args.includes('--sin-cargador')) {
      console.log('FALLA  los tiempos se miden con el cargador conectado (lección de I2): conecta el cargador o pasa --sin-cargador');
      fallos++;
    } else {
      // ---- E6 (TEC-15). Abrir la tarea (hasta pintar), primera foto de la simulación y memoria tras un bloque, en C0, A y B
      const tiempos = {};
      for (const variante of ['C0', 'A', 'B']) {
        const { app, win } = await abrir(variante);
        if (variante === 'A') await armarA(win);
        await mantenerPantalla(app);
        const abrirT = [], fotoT = [], compT = [];
        const ventanaE6 = [];
        for (let i = 0; i < 5; i++) {
          await detener(win);
          ventanaE6.push(await estadoVentana(app, win));
          const ta = await win.evaluate(async (id) => {
            const t0 = performance.now();
            cargarEjemplo(EJEMPLOS.find((e) => e.id === id));
            const t1 = performance.now();
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return { sincrono: t1 - t0, pintado: performance.now() - t0 };
          }, i % 2 ? 'estudio_y1' : 'estudio_x1');
          abrirT.push(ta.pintado);
          await pausa(win, 600);
          await win.evaluate(() => { window.__t0 = performance.now(); window.__vio = false; window.__tc = null; $('btnSimularBarra').click(); });
          const ok = await win.waitForFunction(() => {
            if (simulador.compilando) window.__vio = true;
            if (window.__vio && !simulador.compilando && window.__tc === null) window.__tc = performance.now() - window.__t0;
            return simulador.sim && simulador.sim.medidas().msSimulados > 0 ? performance.now() - window.__t0 : false;
          }, null, { timeout: 60000, polling: 10 }).then((h) => h.jsonValue()).catch(() => null);
          const tc = await win.evaluate(() => window.__tc);
          if (ok) { fotoT.push(ok); compT.push(tc || 0); }
          await pausa(win, 300);
        }
        await detener(win);
        // Un bloque sintético: X1 simulada 3 s, el circuito a toda la pantalla y de vuelta, Y1 simulada 3 s
        for (const id of ['estudio_x1', 'estudio_y1']) {
          await cargarTarea(win, id);
          await simularBarra(win);
          await arranco(win);
          await pausa(win, 3000);
          await detener(win);
          if (variante === 'C0') { await win.evaluate(() => cambiarVista('circuito')); await pausa(win, 400); await win.evaluate(() => cambiarVista('dividido')); }
          else { await win.locator('#ampliarDer').click(); await pausa(win, 400); await win.locator('#ampliarDer').click(); }
          await pausa(win, 400);
        }
        const mem = await heap(win);
        const ws = Math.max(...(await app.evaluate(({ app: a }) => a.getAppMetrics().filter((p) => p.type === 'Tab').map((p) => p.memory.workingSetSize * 1024))));
        const control = await controlMemoria(win, `E6 ${variante}`);
        tiempos[variante] = { abrir: medianas(abrirT), foto: fotoT.length ? medianas(fotoT) : null, compilar: compT.length ? medianas(compT) : null, arranque: fotoT.length ? medianas(fotoT.map((f, k) => f - compT[k])) : null, heap: mem, ws, controlMemoria: control, ventana: ventanaE6, abrirTodas: abrirT.map(Math.round), fotoTodas: fotoT.map(Math.round), compilarTodas: compT.map(Math.round) };
        console.log(`${variante}: abrir ${ms(tiempos[variante].abrir)} · primera foto ${ms(tiempos[variante].foto)} (compilar ${ms(tiempos[variante].compilar)} + arranque ${ms(tiempos[variante].arranque)}) · heap ${mb(mem)} · working set ${mb(ws)} · corridas ${fotoT.length}/5`);
        revisar(fotoT.length === 5, `E6 (${variante}): las cinco simulaciones arrancaron`);
        const tapada = ventanaE6.filter((v) => !v.visible || v.minimizada || v.pagina !== 'visible' || v.alto < 600);
        const restauradas = ventanaE6.filter((v) => v.restaurada).length;
        console.log(`       ventana (${variante}): ${restauradas ? `restaurada antes de ${restauradas} de 5 medidas; ` : ''}${tapada.length ? `en ${tapada.length} de 5 medidas no estaba a la vista: ${JSON.stringify(tapada[0])}` : 'a la vista en las cinco medidas'}`);
        revisar(tapada.length === 0, `E6 (${variante}): las cinco medidas se tomaron con la ventana a la vista (si no, la medida no vale)`);
        await app.close();
      }
      medidas.E6 = tiempos;
      for (const v of ['A', 'B']) {
        const r = tiempos[v], c = tiempos.C0;
        revisar(r.abrir <= c.abrir * 1.2, `E6 (${v}): abrir la tarea ${ms(r.abrir)} ≤ C0 ${ms(c.abrir)} + 20 % (D3; límite ${ms(c.abrir * 1.2)})`);
        revisar(r.foto !== null && r.foto <= c.foto * 1.2, `E6 (${v}): primera foto ${ms(r.foto)} ≤ C0 ${ms(c.foto)} + 20 % (D3); sin compilar: ${ms(r.arranque)} frente a ${ms(c.arranque)}`);
        revisar(dentroE6(r.heap, c.heap), `E6 (${v}): memoria tras un bloque ${mb(r.heap)} ≤ C0 ${mb(c.heap)} + 50 MB (D3); working set ${mb(r.ws)} frente a ${mb(c.ws)}`);
      }

      // ---- E5 (TEC-10). Veinte aperturas y cierres en A y en B: nada se acumula
      for (const variante of ['A', 'B']) {
        const { app, win } = await abrir(variante);
        if (variante === 'A') await armarA(win);
        await mantenerPantalla(app);
        await win.evaluate(() => {
          window.__cnt = { workersCreados: 0, workersVivos: 0, intervalos: new Set(), escuchas: 0 };
          const W = window.Worker;
          window.Worker = function (...a) { const w = new W(...a); __cnt.workersCreados++; __cnt.workersVivos++; const t = w.terminate.bind(w); w.terminate = () => { __cnt.workersVivos--; return t(); }; return w; };
          window.Worker.prototype = W.prototype;
          const si = window.setInterval, ci = window.clearInterval;
          window.setInterval = function (...a) { const id = si.apply(window, a); __cnt.intervalos.add(id); return id; };
          window.clearInterval = function (id) { __cnt.intervalos.delete(id); return ci.call(window, id); };
          const ae = EventTarget.prototype.addEventListener, re = EventTarget.prototype.removeEventListener;
          EventTarget.prototype.addEventListener = function (tipo, fn, op) { if ((this === window || this === document) && !(op && op.once)) __cnt.escuchas++; return ae.call(this, tipo, fn, op); };
          EventTarget.prototype.removeEventListener = function (tipo, fn, op) { if (this === window || this === document) __cnt.escuchas--; return re.call(this, tipo, fn, op); };
        });
        const foto = async (n) => ({ ciclo: n, heap: await heap(win), ...(await win.evaluate(() => ({ workersCreados: __cnt.workersCreados, workersVivos: __cnt.workersVivos, intervalos: __cnt.intervalos.size, escuchas: __cnt.escuchas }))) });
        const fotos = [];
        let arrancaron = 0;
        for (let i = 1; i <= 20; i++) {
          await cargarTarea(win, TAREAS[i % 4]);
          await simularBarra(win);
          if (await arranco(win)) arrancaron++;
          await pausa(win, 800);
          await detener(win);
          await win.locator('#ampliarDer').click(); await pausa(win, 300); await win.locator('#ampliarDer').click(); await pausa(win, 300);
          if ([5, 10, 20].includes(i)) { const f = await foto(i); fotos.push(f); console.log(`${variante} ciclo ${i}: heap ${mb(f.heap)} · workers ${f.workersVivos} vivos de ${f.workersCreados} · intervalos ${f.intervalos} · escuchas ${f.escuchas}`); }
        }
        const [f5, f10, f20] = fotos;
        medidas[`E5-${variante}`] = { arrancaron, fotos, ws: Math.max(...(await app.evaluate(({ app: a }) => a.getAppMetrics().filter((p) => p.type === 'Tab').map((p) => p.memory.workingSetSize * 1024)))) };
        revisar(arrancaron === 20 && f20.workersCreados >= 20, `E5 (${variante}): las veinte simulaciones arrancaron y cada una creó su Worker (${f20.workersCreados})`);
        revisar(f20.workersVivos <= f10.workersVivos && f20.workersVivos <= 1, `E5 (${variante}): los Workers se terminan (vivos: ${f5.workersVivos} → ${f10.workersVivos} → ${f20.workersVivos})`);
        revisar(f20.intervalos <= f10.intervalos + 1, `E5 (${variante}): los intervalos no se acumulan (${f5.intervalos} → ${f10.intervalos} → ${f20.intervalos})`);
        revisar(f20.escuchas <= f10.escuchas + 2, `E5 (${variante}): las escuchas de window/document no se acumulan (${f5.escuchas} → ${f10.escuchas} → ${f20.escuchas})`);
        revisar(dentroE5(f20.heap, f10.heap), `E5 (${variante}): la memoria del ciclo 20 (${mb(f20.heap)}) no pasa de la del 10 (${mb(f10.heap)}) + 10 %`);
        medidas[`E5-${variante}`].controlMemoria = await controlMemoria(win, `E5 ${variante}`);
        await app.close();
      }
    }
  }

  // =====================================================================================================
  if (correr('--aria')) {
    console.log('\n== Árbol accesible (E7) ==');
    for (const variante of ['C0', 'A', 'B']) {
      const { app, win } = await abrir(variante);
      if (variante === 'A') await armarA(win);
      if (variante === 'C0') { await cargarTarea(win, 'estudio_x1'); await win.evaluate(() => cambiarVista('dividido')); await pausa(win, 400); }
      else await abrirTarea(win, 'X1 · Luces en secuencia');
      const snap = await win.locator('body').ariaSnapshot();
      fs.writeFileSync(path.join(SALIDA, `aria-${variante}.yaml`), snap);
      const r = await win.evaluate(() => {
        const visible = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
        const texto = (n) => (n.textContent || '').replace(/\s+/g, ' ').trim();
        const porId = (ids) => (ids || '').split(/\s+/).filter(Boolean).map((i) => document.getElementById(i)).filter(Boolean).map(texto).join(' ').trim();
        const nombre = (n) => n.getAttribute('aria-label') || porId(n.getAttribute('aria-labelledby')) || (n.id && document.querySelector(`label[for="${n.id}"]`) ? texto(document.querySelector(`label[for="${n.id}"]`)) : '')
          || (n.closest('label') ? texto(n.closest('label')) : '') || (n.tagName === 'INPUT' && /^(button|submit|reset)$/.test(n.type) ? n.value : '') || (n.tagName === 'IMG' || n.querySelector('img[alt]') ? ((n.querySelector('img[alt]') || n).getAttribute('alt') || '') : '')
          || (/^(BUTTON|A|SUMMARY|OPTION)$/.test(n.tagName) || n.getAttribute('role') ? texto(n) : '') || n.title || '';
        const todos = [...document.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex], [role="button"], [role="tab"], [role="slider"], [role="switch"], [role="separator"][tabindex]')]
          .filter((n) => visible(n) && !n.disabled && n.getAttribute('tabindex') !== '-1' && !(n.tagName === 'INPUT' && n.type === 'hidden'));
        const describir = (n) => `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
        const sinNombre = todos.filter((n) => !nombre(n)).map(describir);
        const propios = sinNombre.filter((s) => !/blockly/i.test(s));
        const enOcultos = todos.filter((n) => n.closest('[aria-hidden="true"]')).map(describir);
        const dialogos = [...document.querySelectorAll('[role="dialog"]')].filter(visible).filter((n) => !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')).map(describir);
        const vivos = [...document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')].length;
        const h = [...document.querySelectorAll('h1, h2, h3')].filter(visible).map((n) => `${n.tagName.toLowerCase()}: ${texto(n)}`);
        return { controles: todos.length, sinNombre, propios, enOcultos, dialogos, vivos, h, h1: document.querySelectorAll('h1').length };
      });
      medidas[`E7-${variante}`] = r;
      console.log(`${variante}: ${r.controles} controles enfocables; regiones vivas ${r.vivos}; encabezados: ${r.h.join(' | ')}`);
      revisar(r.propios.length === 0, `E7 (${variante}): todos los controles de TecnoBloques tienen nombre accesible${r.propios.length ? ' (sin nombre: ' + r.propios.join(', ') + ')' : ''}`);
      if (r.sinNombre.length > r.propios.length) console.log(`       nota (${variante}): de Blockly, sin nombre: ${r.sinNombre.filter((s) => /blockly/i.test(s)).join(', ')}`);
      revisar(r.enOcultos.length === 0, `E7 (${variante}): nada enfocable dentro de aria-hidden${r.enOcultos.length ? ' (' + r.enOcultos.join(', ') + ')' : ''}`);
      revisar(r.dialogos.length === 0, `E7 (${variante}): todo diálogo visible tiene nombre`);
      revisar(r.h1 <= 1, `E7 (${variante}): a lo sumo un h1 (${r.h1})`);
      await app.close();
    }
  }

  // =====================================================================================================
  if (correr('--web')) {
    console.log('\n== Sin escritorio (E9, TEC-17) ==');
    // El mismo dist/TecnoBloques.html abierto sin preload: no hay tbEscritorio, como en un navegador. Aunque el instructor
    // haya dejado A en estudio-config.json, nadie lo puede leer: la app es C0 y dice que no puede compilar.
    const mainWeb = path.join(datos, 'main-web.js');
    fs.writeFileSync(mainWeb, `const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => { const w = new BrowserWindow({ width: 1536, height: 864, webPreferences: { contextIsolation: true, sandbox: true } }); w.loadFile(${JSON.stringify(path.join(RAIZ, 'dist', 'TecnoBloques.html'))}); });
`);
    ponerVariante('A');
    const app = await electron.launch({ args: [mainWeb, `--user-data-dir=${datos}`], cwd: RAIZ, env });
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    await win.waitForLoadState('load');
    await pausa(win, 1500);
    const r = await win.evaluate(() => ({
      escritorio: typeof window.tbEscritorio, variante: document.body.dataset.variante || 'C0', lados: document.querySelectorAll('.lado').length,
      panel: !!$('misiones') && $('misiones').offsetParent !== null, disponible: simulador.disponible,
      simular: { hidden: $('btnSimularBarra').hidden, disabled: $('btnSimularBarra').disabled, ve: $('btnSimularBarra').offsetParent !== null },
      vistas: $('vistas').offsetParent !== null, titulo: document.title,
    }));
    medidas.E9web = r;
    revisar(r.escritorio === 'undefined' && !r.disponible, `TEC-17: sin escritorio no hay compilador ni simulador (${JSON.stringify({ escritorio: r.escritorio, disponible: r.disponible })})`);
    revisar(r.variante === 'C0' && r.lados === 0 && !r.panel && r.vistas, `TEC-17: la app es C0 aunque el instructor haya dejado A: sin espacios A/B ni panel de misiones (${JSON.stringify({ variante: r.variante, lados: r.lados, panel: r.panel })})`);
    revisar(r.simular.hidden || r.simular.disabled || !r.simular.ve, `TEC-17: «Simular» no se ofrece sin escritorio (${JSON.stringify(r.simular)})`);
    await app.close();
  }

  // Las medidas de esta corrida, con el nombre de sus modos (una corrida no pisa la de otro modo)
  fs.writeFileSync(path.join(SALIDA, `calidad${modos.length ? '-' + modos.map((m) => m.slice(2)).join('-') : ''}.json`), JSON.stringify(medidas, null, 1));
  console.log('\nERRORES de página:', errores.length ? errores : 'ninguno');
  if (errores.length) fallos++;
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
