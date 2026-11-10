// Prueba de punta a punta de la variante B, por actividad (EST-002, I4; diseño y ejemplos E1–E11 en
// TecnoSuite/EstrategíaTecno/DISENO-I4-ACTIVIDAD.md). B usa los espacios de A (I3, test:paneles) con un punto de partida:
// al abrir una tarea del estudio, «Programar y probar» (Bloques | Circuito). Comprueba la franja de la actividad y
// «Volver a…», que nada se reacomoda solo, que la disposición se recuerda aparte de A, las tareas X y Y (solo con A o B)
// y que X se comporta igual en A, B y C0 (TEC-14). Necesita arduino-cli (como test:simulador).
// Uso: npm run test:actividad   (arma con --simulador-local)
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(__dirname, 'salida');
fs.mkdirSync(SALIDA, { recursive: true });
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const ACTIVIDAD = { izq: 'bloques', der: 'circuito', proporcion: 0.5, ampliado: null };
const esActividad = (d) => d && d.izq === ACTIVIDAD.izq && d.der === ACTIVIDAD.der && d.ampliado === null && Math.abs(d.proporcion - 0.5) < 0.006;

(async () => {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')), TB_HERRAMIENTAS: 'instructor' };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-actividad-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  fs.mkdirSync(datos, { recursive: true });
  const ponerVariante = (v) => fs.writeFileSync(path.join(datos, 'estudio-config.json'), JSON.stringify({ formato: 1, variante: v }));
  const errores = [];
  async function tamano(app, win, ancho, alto) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => { const v = BrowserWindow.getAllWindows()[0]; v.unmaximize(); v.setContentSize(w, h); }, [ancho, alto]);
    await win.waitForTimeout(500);
  }
  async function abrir(ancho = 1536, alto = 864) {
    // Si otra ventana tapa la de la app (Efraín trabajando en el mismo PC), Chromium deja de pintarla y frena sus
    // transiciones y temporizadores: la prueba lo desactiva para medir siempre igual. El producto no cambia.
    const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], cwd: RAIZ, env });
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await win.waitForLoadState('load');
    await tamano(app, win, ancho, alto);
    await win.waitForTimeout(1500);
    return { app, win };
  }
  const pausa = (win, ms) => win.waitForTimeout(ms);
  const esperar = (win, condicion, ms = 40000) => win.waitForFunction(condicion, null, { timeout: ms, polling: 200 }).then(() => true, () => false);
  const disp = (win) => win.evaluate(() => panelesA.disposicion());
  const franja = (win) => win.evaluate(() => {
    const f = $('franjaActividad'), v = $('volverActividad');
    return { ve: !!f && f.offsetParent !== null, nombre: $('nombreActividad') ? $('nombreActividad').textContent : null,
      volver: !!v && v.offsetParent !== null, textoVolver: v ? v.textContent : null };
  });
  const corrida = (win) => win.evaluate(() => ({
    hay: !!simulador.sim, ms: simulador.sim ? simulador.sim.medidas().msSimulados : 0,
    iniciadas: simulador.eventos.filter((e) => e.tipo === 'simulacion_iniciada').length, id: simulador.sim ? (simulador.sim.__prueba ||= Math.random()) : null,
  }));
  // Abrir un ejemplo como el aprendiz: menú Ejemplos, el botón con su nombre y «Abrir ejemplo»
  async function abrirTarea(win, nombre) {
    await win.locator('#btnEjemplos').click();
    await pausa(win, 200);
    await win.locator('#listaEjemplos button', { hasText: nombre }).click();
    await pausa(win, 300);
    await win.locator('#modalAcciones button', { hasText: 'Abrir ejemplo' }).click();
    await pausa(win, 900);
  }
  const enMenu = (win) => win.evaluate(() => [...$('listaEjemplos').querySelectorAll('button')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.querySelector('b').textContent));
  // TEC-14: con el circuito a la vista, pulsar el pulsador con el ratón enciende el LED; soltarlo, lo apaga
  async function ledConPulsador(win, boton = 'btn1') {
    const brillo = () => win.evaluate(() => { const m = simulador.sim && simulador.sim.mediciones(); const l = m && (m.leds || [])[0]; return l ? l.brillo : null; });
    const suelto = await brillo();
    // El lienzo se reacomoda al aparecer en su espacio: se espera a que el pulsador quede quieto antes de pulsarlo
    let b = null;
    for (let i = 0, antes = ''; i < 20; i++) {
      b = await win.locator(`.tc-comp[data-id="${boton}"]`).boundingBox();
      const ahora = b && [b.x, b.y, b.width].map(Math.round).join();
      if (ahora && ahora === antes) break;
      antes = ahora;
      await pausa(win, 150);
    }
    // Con alguien usando el PC, el ratón real puede cruzarse con el de la prueba y la pulsación no llega: se reintenta hasta
    // 3 veces. Un reintento no aprueba un programa roto (el LED no se enciende en ninguno) y se anota cuántos hubo.
    let pulsado = null, otraVez = null, intentos = 0;
    while (intentos < 3 && !(pulsado > 0.5)) {
      intentos++;
      await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await win.mouse.down();
      await pausa(win, 800);
      pulsado = await brillo();
      await win.mouse.up();
      await pausa(win, 800);
      otraVez = await brillo();
    }
    return { apagado: suelto !== null && suelto < 0.01, encendido: pulsado !== null && pulsado > 0.5, vuelve: otraVez !== null && otraVez < 0.01, suelto, pulsado, otraVez, intentos };
  }

  // ---- E1. Primer uso en B: «Programar y probar» sin configurar nada
  ponerVariante('B');
  let { app, win } = await abrir();
  const vistaC0Antes = await win.evaluate(() => (leerLocal(CLAVE_PREF) || {}).vista || null);
  revisar(await win.evaluate(() => document.body.dataset.variante === 'B' && panelesA.activo()), 'E1: con la variante B, la app abre con los espacios');
  let d = await disp(win);
  let f = await franja(win);
  revisar(esActividad(d), `E1: sin configurar nada, Bloques a la izquierda y Circuito a la derecha, mitad y mitad (${JSON.stringify(d)})`);
  revisar(f.ve && f.nombre === 'Programar y probar' && !f.volver, `E1: la franja dice «${f.nombre}» y no ofrece «Volver a…»`);
  revisar(await win.evaluate(() => $('vistas').offsetParent === null && [...document.querySelectorAll('h1')].map((h) => h.textContent).join() === 'TecnoBloques: por actividad'),
    'E1: sin la barra de vistas de C0, con un h1 propio de B');
  revisar(JSON.stringify(await enMenu(win)).includes('Tarea X') && JSON.stringify(await enMenu(win)).includes('Tarea Y'), `E1: el menú Ejemplos ofrece las tareas X y Y del estudio (${(await enMenu(win)).filter((n) => /Tarea/.test(n)).join(', ')})`);
  await win.screenshot({ path: path.join(SALIDA, 'actividad_1_inicio.png') });

  // ---- E2. Abrir «Tarea X»: programa y circuito listos en «Programar y probar»; Simular funciona
  await abrirTarea(win, 'Tarea X');
  const x = await win.evaluate(() => ({ codigo: codigoActual(), piezas: simulador.lienzo.circuito().componentes.map((c) => c.tipo).sort().join(), cables: simulador.lienzo.circuito().cables.map((c) => c.de + '>' + c.a).sort() }));
  revisar(/pinMode\(2, INPUT_PULLUP\)/.test(x.codigo) && /digitalWrite\(13, HIGH\)/.test(x.codigo) && x.piezas === 'led,pulsador,resistencia', `E2: X trae su programa (pulsador en D2 con pull-up, LED en D13) y su circuito (${x.piezas})`);
  revisar(esActividad(await disp(win)) && !(await franja(win)).volver, 'E2: queda en «Programar y probar», sin «Volver a…»');
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500), 'E2: «Simular» compila y simula X');
  const ledB = await ledConPulsador(win);
  revisar(ledB.apagado && ledB.encendido && ledB.vuelve, `E2: en B, el LED se enciende solo mientras se pulsa (${[ledB.suelto, ledB.pulsado, ledB.otraVez].map((v) => Math.round(v * 100) / 100).join(' → ')}; intentos: ${ledB.intentos})`);
  const codigoX = x.codigo;
  await win.screenshot({ path: path.join(SALIDA, 'actividad_2_tarea_x.png') });

  // ---- E3. Cambiar con los controles de A: aparece «Volver a…»
  const volverDespuesDe = async (accion, texto) => {
    await accion();
    await pausa(win, 400);
    const ff = await franja(win);
    revisar(ff.volver && ff.textoVolver === 'Volver a «Programar y probar»' && !esActividad(await disp(win)), `E3: ${texto}: aparece «${ff.textoVolver}»`);
    await win.locator('#volverActividad').click();
    await pausa(win, 400);
    revisar(esActividad(await disp(win)) && !(await franja(win)).volver, `E3: después de ${texto}, «Volver a…» pone «Programar y probar» y se va`);
  };
  await volverDespuesDe(() => win.locator('#herrDer').selectOption('monitor'), 'cambiar el circuito por el monitor');
  await volverDespuesDe(() => win.locator('#intercambiarIzq').click(), 'intercambiar');
  await volverDespuesDe(() => win.locator('#ampliarDer').click(), 'ampliar el circuito');
  await volverDespuesDe(async () => { await win.evaluate(() => $('divisor').focus()); await win.keyboard.press('ArrowLeft'); }, 'mover el divisor con el teclado');

  // ---- E4. Con la disposición cambiada, cambiar de nivel o pasar a «Editar C++» no mueve nada
  await win.locator('#herrDer').selectOption('codigo');
  await pausa(win, 300);
  const cambiada = JSON.stringify(await disp(win));
  await win.locator('#niveles button[data-nivel="2"]').click();
  await pausa(win, 400);
  await win.locator('#niveles button[data-nivel="3"]').click();
  await pausa(win, 400);
  await win.evaluate(() => { if (!estado.texto) entrarModoTexto(); });
  await pausa(win, 400);
  revisar(JSON.stringify(await disp(win)) === cambiada && (await franja(win)).volver, 'E4: cambiar de nivel y pasar a «Editar C++» no mueve los espacios, y «Volver a…» sigue');

  // ---- E5. «Volver a…» con la simulación andando: la misma simulación sigue; el foco queda visible
  await win.evaluate(() => salirModoTexto(true));
  await pausa(win, 300);
  if (!(await corrida(win)).hay) { await win.locator('#btnSimularBarra').click(); await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300); }
  let c0 = await corrida(win);
  await win.locator('#volverActividad').click();
  await pausa(win, 900);
  let c1 = await corrida(win);
  const foco = await win.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(); return { id: a.id, ve: a.offsetParent !== null && r.width > 0, contorno: getComputedStyle(a).outlineStyle !== 'none' }; });
  revisar(esActividad(await disp(win)) && c1.id === c0.id && c1.ms > c0.ms && c1.iniciadas === c0.iniciadas, `E5: «Volver a…» pone la actividad y la misma simulación sigue (${Math.round(c0.ms)} → ${Math.round(c1.ms)} ms, sin otro simulacion_iniciada)`);
  revisar(foco.id === 'herrIzq' && foco.ve, `E5: el botón se va y el foco queda en el selector del espacio izquierdo (${JSON.stringify(foco)})`);
  revisar(await win.evaluate(() => /Programar y probar/.test($('anuncioPaneles').textContent)), 'E5: el cambio se anuncia para el lector de pantalla');
  await win.evaluate(() => detenerSimulacion());

  // ---- E7. Con la disposición cambiada, abrir «Tarea Y» pone «Programar y probar» (D2)
  await win.locator('#intercambiarIzq').click();
  await win.locator('#ampliarIzq').click();
  await pausa(win, 300);
  revisar((await franja(win)).volver, 'E7: antes de abrir Y, la disposición está cambiada');
  await abrirTarea(win, 'Tarea Y');
  const y = await win.evaluate(() => ({ codigo: codigoActual(), cables: simulador.lienzo.circuito().cables.map((c) => c.de + '>' + c.a) }));
  revisar(esActividad(await disp(win)) && !(await franja(win)).volver, 'E7: abrir Y pone «Programar y probar» (D2)');
  revisar(/pinMode\(3, INPUT_PULLUP\)/.test(y.codigo) && /digitalWrite\(12, HIGH\)/.test(y.codigo) && y.cables.some((c) => /placa\.D3/.test(c)) && y.cables.some((c) => /placa\.D12/.test(c)),
    'E7: Y es el mismo montaje con otros pines (pulsador en D3, LED en D12)');
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500), 'E7: Y compila y simula');
  const ledY = await ledConPulsador(win);
  revisar(ledY.apagado && ledY.encendido && ledY.vuelve, `E7: en Y, el LED se enciende solo mientras se pulsa (intentos: ${ledY.intentos})`);
  await win.evaluate(() => detenerSimulacion());

  // ---- E6. Cambiar, guardar, cerrar y abrir: vuelven el trabajo y la disposición cambiada (TEC-18)
  await abrirTarea(win, 'Tarea X');
  await win.locator('#herrDer').selectOption('monitor');
  await win.evaluate(() => $('divisor').focus());
  await win.keyboard.press('ArrowRight');
  await pausa(win, 400);
  const guardada = await disp(win);
  await win.evaluate(() => autoguardar());
  await pausa(win, 1500);
  await app.close();
  await new Promise((r) => setTimeout(r, 500));
  ({ app, win } = await abrir());
  const otra = await disp(win);
  revisar(otra.izq === guardada.izq && otra.der === guardada.der && Math.abs(otra.proporcion - guardada.proporcion) < 0.005 && (await franja(win)).volver,
    `E6: al abrir otra vez vuelve la disposición cambiada (${otra.izq} | ${otra.der}, ${Math.round(otra.proporcion * 100)} %) con «Volver a…»`);
  revisar(await win.evaluate(() => codigoActual()) === codigoX && await win.evaluate(() => simulador.lienzo.circuito().componentes.length) === 3, 'E6: vuelven el programa y el circuito de X');

  // ---- E9. De B a A y de vuelta, con la app abierta: cada una conserva su disposición
  const enB = await disp(win);
  await win.evaluate(() => aplicarVariante('A'));
  await pausa(win, 500);
  const enA = await disp(win);
  revisar(enA.izq === null && enA.der === null && !(await franja(win)).ve && await win.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.textContent).join()) === 'TecnoBloques: paneles libres',
    `E9: en A, sin franja, con los espacios vacíos del primer uso de A (${JSON.stringify(enA)})`);
  // ---- E8 (A). En A, X está en el menú; abrirla no mueve los espacios; el LED responde igual
  revisar(JSON.stringify(await enMenu(win)).includes('Tarea X'), 'E8: en A, X está en el menú Ejemplos');
  await abrirTarea(win, 'Tarea X');
  revisar(JSON.stringify(await disp(win)) === JSON.stringify(enA), 'E8: en A, abrir X no mueve los espacios');
  await win.locator('#btnSimularBarra').click(); // D2 de A: trae el circuito al espacio vacío
  await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500);
  await pausa(win, 400);
  const ledA = await ledConPulsador(win);
  const codigoA = await win.evaluate(() => simulador.codigo);
  revisar(ledA.apagado && ledA.encendido && ledA.vuelve && codigoA === codigoX, `E8: en A, el mismo programa y el LED se enciende solo mientras se pulsa (TEC-14; ${[ledA.suelto, ledA.pulsado, ledA.otraVez].map((v) => v === null ? 'sin medida' : Math.round(v * 100) / 100).join(' → ')}; intentos: ${ledA.intentos})`);
  await win.evaluate(() => detenerSimulacion());
  await win.evaluate(() => aplicarVariante('B'));
  await pausa(win, 500);
  const deVuelta = await disp(win);
  revisar(deVuelta.izq === enB.izq && deVuelta.der === enB.der && Math.abs(deVuelta.proporcion - enB.proporcion) < 0.005 && (await franja(win)).ve,
    'E9: de vuelta en B, su disposición cambiada sigue, con la franja');

  // ---- E10. Teclado, foco, contraste y ventana en 1536 × 864 y 1366 × 768
  async function revisarFranja(etiqueta) {
    await win.evaluate(() => $('btnAcerca').focus());
    const vistos = [];
    for (let i = 0; i < 40; i++) {
      vistos.push(await win.evaluate(() => {
        const a = document.activeElement, cs = getComputedStyle(a), r = a.getBoundingClientRect();
        return { id: a.id, foco: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) * devicePixelRatio >= 2, dentro: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
      }));
      await win.keyboard.press('Tab');
    }
    const v = vistos.find((x) => x.id === 'volverActividad');
    const i = vistos.findIndex((x) => x.id === 'volverActividad'), h = vistos.findIndex((x) => x.id === 'herrIzq'), s = vistos.findIndex((x) => x.id === 'btnSubir');
    revisar(v && v.foco && v.dentro && i > s && i < h, `E10 ${etiqueta}: con Tab se llega a «Volver a…» después de la barra y antes de los espacios, con el foco visible`);
    const r = await win.evaluate(() => {
      const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const fondo = (n) => { for (let x = n; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return 'rgb(255,255,255)'; };
      const razon = (n) => { const a = lum(getComputedStyle(n).color), b = lum(fondo(n)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      const textos = [...document.querySelectorAll('#franjaActividad span, #franjaActividad b, #franjaActividad button')].filter((n) => n.offsetParent !== null);
      const fuera = [...document.querySelectorAll('.barra button, .barra select, .barra input, #franjaActividad button')].filter((b) => b.offsetParent !== null)
        .filter((b) => { const q = b.getBoundingClientRect(); return q.right > innerWidth + 0.5 || q.bottom > innerHeight + 0.5; }).map((b) => b.id);
      return { minimo: Math.min(...textos.map(razon)), n: textos.length, fuera, alto: Math.round($('franjaActividad').getBoundingClientRect().height) };
    });
    revisar(r.n >= 3 && r.minimo >= 4.5, `E10 ${etiqueta}: contraste de ${r.n} textos de la franja ≥ 4,5:1 (mínimo ${Math.round(r.minimo * 100) / 100})`);
    revisar(r.fuera.length === 0, `E10 ${etiqueta}: nada de la barra ni de la franja (${r.alto} px de alto) queda fuera de la ventana${r.fuera.length ? ' (' + r.fuera.join(', ') + ')' : ''}`);
  }
  await revisarFranja('1536 × 864, claro');
  await win.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await pausa(win, 200);
  await revisarFranja('1536 × 864, oscuro');
  await win.screenshot({ path: path.join(SALIDA, 'actividad_3_oscuro.png') });
  await win.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await tamano(app, win, 1366, 768);
  await revisarFranja('1366 × 768');
  await win.screenshot({ path: path.join(SALIDA, 'actividad_4_1366.png') });
  // En B también sirven los extremos del divisor (lo que corrigió la r1 de I3): la cabeza del espacio angosto se alcanza
  await win.evaluate(() => $('divisor').focus());
  for (let i = 0; i < 40; i++) await win.keyboard.press('ArrowLeft');
  await pausa(win, 300);
  const angosto = await win.evaluate(() => ['herrIzq', 'intercambiarIzq', 'ampliarIzq'].map((id) => {
    const n = $(id), r = n.getBoundingClientRect(), l = $('ladoIzq').getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.right <= l.right + 0.5 && (e === n || n.contains(e));
  }));
  revisar(angosto.every(Boolean), `E10 1366 × 768: con el espacio izquierdo al mínimo, sus tres controles se ven y responden (${JSON.stringify(angosto)})`);
  await win.locator('#volverActividad').click();
  await pausa(win, 300);
  // Zoom 200 %: la franja y las cabezas caben (medido en el DOM: con zoom, las capturas no sirven)
  await tamano(app, win, 1536, 864);
  await win.locator('#herrDer').selectOption('monitor');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2));
  await pausa(win, 800);
  const z = await win.evaluate(() => ({ fuera: [...document.querySelectorAll('.barra button, .barra select, #franjaActividad button, .cabeza-lado select, .cabeza-lado button')].filter((b) => b.offsetParent !== null)
    .filter((b) => { const q = b.getBoundingClientRect(); return q.right > innerWidth + 0.5 || q.bottom > innerHeight + 0.5; }).map((b) => b.id), cuerpo: Math.round(document.querySelector('#ladoIzq .cuerpo-lado').getBoundingClientRect().height) }));
  revisar(z.fuera.length === 0 && z.cuerpo >= 100, `E10 zoom 200 %: ningún control de la barra, la franja ni las cabezas queda fuera; el espacio conserva ${z.cuerpo} px`);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
  await pausa(win, 400);

  // ---- DISENO en «Volver a…»: presión sin «reducir movimiento», ninguna con él
  for (const [modo, espera] of [['no-preference', 'matrix(0.97, 0, 0, 0.97, 0, 0)'], ['reduce', 'none']]) {
    await win.emulateMedia({ reducedMotion: modo });
    await pausa(win, 300);
    const b = await win.locator('#volverActividad').boundingBox();
    // Sin reducción, se espera (hasta 600 ms) a que la transición de 120 ms llegue a la escala, con hasta 3 intentos por el
    // ratón real (ver ledConPulsador); con reducción, un solo intento de 400 ms: ahí un reintento no tendría sentido.
    let t = null, intentos = 0;
    while (intentos < (modo === 'reduce' ? 1 : 3) && t !== espera) {
      intentos++;
      await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await win.mouse.down();
      if (modo === 'reduce') await pausa(win, 400);
      else await win.waitForFunction((e) => getComputedStyle($('volverActividad')).transform === e, espera, { timeout: 600, polling: 50 }).catch(() => {});
      t = await win.evaluate(() => getComputedStyle($('volverActividad')).transform);
      await win.mouse.move(2, 2);
      await win.mouse.up();
    }
    revisar(t === espera, `DISENO: presionar «Volver a…» con «reducir movimiento» ${modo === 'reduce' ? 'activo' : 'apagado'} da ${t} (intentos: ${intentos})`);
  }
  await win.emulateMedia({ reducedMotion: null });

  // ---- F01 (r1 de I4, COD-20261109-004). Lo guardado de B no se cree: una actividad que no es del catálogo (un nombre
  // heredado del prototipo, otro tipo, nula o ninguna) vuelve a «Programar y probar» con la disposición guardada, al abrir
  // la app y al pasar de A a B, sin caer a C0 y sin tocar el trabajo. Una disposición que no es un objeto, como el primer uso.
  await win.evaluate(() => autoguardar());
  await pausa(win, 1500);
  // El trabajo: el programa y las piezas y cables del circuito (sin posiciones ni estados de la simulación, que cambian solos)
  const documento = () => win.evaluate(() => { const c = simulador.lienzo.circuito(); return JSON.stringify({ codigo: codigoActual(),
    piezas: c.componentes.map((p) => p.id + ':' + p.tipo).sort(), cables: c.cables.map((x) => x.de + '>' + x.a).sort() }); });
  const docAntes = await documento();
  const GUARDADA = { izq: 'codigo', der: 'monitor', proporcion: 0.6, ampliado: null };
  const conActividad = (a) => ({ ...GUARDADA, actividad: a });
  const CASOS = [
    ['actividad conocida', conActividad('programar-probar'), GUARDADA],
    ['actividad desconocida «otra»', conActividad('otra'), GUARDADA],
    ['actividad heredada «constructor»', conActividad('constructor'), GUARDADA],
    ['actividad heredada «toString»', conActividad('toString'), GUARDADA],
    ['actividad heredada «__proto__»', conActividad('__proto__'), GUARDADA],
    ['actividad heredada «hasOwnProperty»', conActividad('hasOwnProperty'), GUARDADA],
    ['actividad nula', conActividad(null), GUARDADA],
    ['sin actividad', { ...GUARDADA }, GUARDADA],
    ['actividad numérica', conActividad(5), GUARDADA],
    ['actividad en un arreglo', conActividad(['programar-probar']), GUARDADA],
    ['actividad objeto', conActividad({}), GUARDADA],
    ['disposición nula', null, ACTIVIDAD],
    ['disposición cadena', 'constructor', ACTIVIDAD],
    ['disposición arreglo', [], ACTIVIDAD],
  ];
  const estadoB = () => win.evaluate(async () => ({
    config: (await escritorio.estudio.estado()).variante, variante: document.body.dataset.variante, modo: panelesA.modo(), d: panelesA.disposicion(),
    franja: !!$('franjaActividad') && $('franjaActividad').offsetParent !== null, nombre: $('nombreActividad') ? $('nombreActividad').textContent : null,
    volver: !!$('volverActividad') && $('volverActividad').offsetParent !== null, tareas: !!document.querySelector('.de-estudio'),
  }));
  const coherente = (e, espera) => e.config === 'B' && e.variante === 'B' && e.modo === 'B' && e.franja && e.nombre === 'Programar y probar' && e.tareas
    && !!e.d && e.d.actividad === 'programar-probar' && e.d.izq === espera.izq && e.d.der === espera.der && e.d.ampliado === espera.ampliado
    && Math.abs(e.d.proporcion - espera.proporcion) < 0.005 && e.volver === !esActividad(e.d);
  const resumen = (e) => `config ${e.config}, interfaz ${e.variante}, espacios ${e.modo}, ` + (e.d ? `${e.d.izq} | ${e.d.der} ${Math.round(e.d.proporcion * 100)} %, actividad ${JSON.stringify(e.d.actividad)}` : 'sin disposición') + `, franja «${e.nombre}»${e.volver ? ' con «Volver a…»' : ''}${e.tareas ? '' : ', sin las tareas del estudio'}`;
  for (const [nombre, guardada, espera] of CASOS) {
    // Al abrir la app con lo guardado
    await win.evaluate((g) => guardarPreferencias({ disposicionB: g }), guardada);
    await win.reload();
    await win.waitForLoadState('load');
    await esperar(win, () => !!document.body.dataset.variante, 15000);
    await pausa(win, 800);
    const alAbrir = await estadoB();
    const docAbrir = await documento() === docAntes;
    revisar(coherente(alAbrir, espera) && docAbrir, `F01 al abrir, ${nombre}: ${resumen(alAbrir)}; ${docAbrir ? 'el trabajo sigue igual' : 'EL TRABAJO CAMBIÓ'}`);
    // Al pasar de A a B con la app abierta
    const fallo = await win.evaluate((g) => { try { aplicarVariante('A'); guardarPreferencias({ disposicionB: g }); aplicarVariante('B'); return null; } catch (e) { return String(e); } }, guardada);
    await pausa(win, 400);
    const alCambiar = await estadoB();
    const docCambiar = await documento() === docAntes;
    revisar(!fallo && coherente(alCambiar, espera) && docCambiar, `F01 de A a B, ${nombre}: ${fallo ? fallo + '; ' : ''}${resumen(alCambiar)}; ${docCambiar ? 'el trabajo sigue igual' : 'EL TRABAJO CAMBIÓ'}`);
  }
  await win.evaluate(() => guardarPreferencias({ disposicionB: null }));
  await app.close();
  await new Promise((r) => setTimeout(r, 400));

  // ---- E8 (C0). Sin estudio, X no está en el menú; abierta por código, se comporta igual; nada de B
  ponerVariante('C0');
  ({ app, win } = await abrir());
  const enC0 = await win.evaluate(() => ({ activo: panelesA.activo(), franja: !!$('franjaActividad'), vista: $('principal').dataset.vista, h1: document.querySelectorAll('h1').length }));
  revisar(!enC0.activo && !enC0.franja && enC0.h1 === 0 && enC0.vista === vistaC0Antes, `E8: en C0 no hay espacios, franja ni h1, y vuelve la vista «${enC0.vista}»`);
  revisar(!JSON.stringify(await enMenu(win)).includes('Tarea'), 'E8: en C0, las tareas X y Y no están en el menú Ejemplos');
  revisar(await win.evaluate(() => !document.querySelector('.de-estudio') && $('listaEjemplos').querySelectorAll('.menu-titulo').length === 1), 'E8: en C0, el menú Ejemplos es el de siempre también en el DOM: sin nodos del estudio y con un solo encabezado');
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => e.id === 'tarea_x')));
  await pausa(win, 600);
  await win.locator('#vDividido').click();
  await win.locator('#tCircuito').click();
  await pausa(win, 300);
  await win.locator('#btnSimularBarra').click();
  await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500);
  const ledC0 = await ledConPulsador(win);
  revisar(ledC0.apagado && ledC0.encendido && ledC0.vuelve && await win.evaluate(() => simulador.codigo) === codigoX, `E8: en C0, el mismo programa y el LED se enciende solo mientras se pulsa (TEC-14; intentos: ${ledC0.intentos})`);
  await win.evaluate(() => detenerSimulacion());
  await app.close();

  revisar(errores.length === 0, `sin errores en la página${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(`\n${fallos ? fallos + ' FALLAS' : 'Todo bien'} · capturas en test/salida/actividad_*.png`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
