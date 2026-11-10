// Prueba de punta a punta de la variante B, por actividad (EST-002, I4; diseño y ejemplos E1–E11 en
// TecnoSuite/EstrategíaTecno/DISENO-I4-ACTIVIDAD.md). B usa los espacios de A (I3, test:paneles) con un punto de partida:
// al abrir una tarea del estudio, «Programar y probar» (Bloques | Circuito). Comprueba la franja de la actividad y
// «Volver a…», que nada se reacomoda solo, que la disposición se recuerda aparte de A, las tareas del estudio (solo con A
// o B) y que X1 se comporta igual en A, B y C0 (TEC-14). Las tareas son las de I5 (DISENO-I5-MATERIAL.md): X1/Y1 y X2/Y2
// medidas y dos cierres; cada una abre en su nivel, su programa de partida hace lo que dice la hoja y su solución
// también (E2–E5 de I5). Necesita arduino-cli (como test:simulador).
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
  // `invertido`: el reto del cierre 1, donde el LED se apaga mientras se pulsa (se reintenta hasta que se apague)
  async function ledConPulsador(win, boton = 'btn1', invertido = false) {
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
    while (intentos < 3 && !(invertido ? pulsado !== null && pulsado < 0.01 : pulsado > 0.5)) {
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
  // Las tareas de I5, por su nombre en el menú
  const X1 = 'X1 · Luces en secuencia', Y1 = 'Y1 · Semáforo', X2 = 'X2 · Brillo con potenciómetro', Y2 = 'Y2 · Servo con potenciómetro';
  const C1 = 'Cierre 1 · Botón con «si»', C2 = 'Cierre 2 · Motor con la shield L293D';
  const TAREAS = [X1, Y1, C1, X2, Y2, C2];
  // Qué LED está encendido a lo largo del tiempo simulado: una marca { on, ms } cada vez que cambia, durante `dur` ms
  const encendidos = (win, dur) => win.evaluate((d) => new Promise((listo) => {
    const s = simulador.sim, ini = s.medidas().msSimulados, marcas = [];
    const t = setInterval(() => {
      const ms = s.medidas().msSimulados, on = s.mediciones().leds.filter((l) => l.brillo > 0.5).map((l) => l.id).join('+') || '-';
      if (!marcas.length || marcas[marcas.length - 1].on !== on) marcas.push({ on, ms });
      if (ms - ini > d) { clearInterval(t); listo(marcas); }
    }, 40);
  }), dur);
  /** ¿Los LED siguen `patron` ([id, ms], en ciclo)? Se quitan los cambios de menos de 100 ms (el paso de un LED al otro),
   *  el primer tramo (puede estar cortado) y el último (sigue abierto). Cada tramo, con ±150 ms. */
  function sigue(marcas, patron) {
    let t = marcas.slice(0, -1).map((m, i) => ({ on: m.on, dura: marcas[i + 1].ms - m.ms })).filter((x) => x.dura >= 100);
    t = t.reduce((a, x) => { if (a.length && a[a.length - 1].on === x.on) a[a.length - 1].dura += x.dura; else a.push({ ...x }); return a; }, []).slice(1);
    const cuadra = (j) => t.every((x, i) => { const [id, ms] = patron[(j + i) % patron.length]; return x.on === id && Math.abs(x.dura - ms) <= 150; });
    const ok = t.length >= patron.length + 1 && patron.some((_, j) => cuadra(j));
    return { ok, texto: t.map((x) => `${x.on} ${(x.dura / 1000).toFixed(2)} s`).join(' → ') };
  }
  /** Simula y comprueba que los LED siguen `patron` durante dos ciclos y medio. */
  async function lucesSiguen(win, patron) {
    if (!(await win.evaluate(() => !!simulador.sim && simulador.sim.medidas().msSimulados > 0))) await win.locator('#btnSimularBarra').click();
    await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300);
    const ciclo = patron.reduce((a, [, ms]) => a + ms, 0);
    return sigue(await encendidos(win, ciclo * 2.5), patron);
  }
  // X1: 1 s cada LED, del 11 al 13; Y1: verde 2 s, amarillo 1 s, rojo 2 s (led1, led2 y led3 están en D11, D12 y D13)
  const PATRON_X1 = [['led1', 1000], ['led2', 1000], ['led3', 1000]];
  const PATRON_Y1 = [['led1', 2000], ['led2', 1000], ['led3', 2000]];

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
  const menuB = (await enMenu(win)).filter((n) => TAREAS.includes(n));
  revisar(JSON.stringify(menuB) === JSON.stringify(TAREAS), `E1 (I5, E1): el menú Ejemplos ofrece las seis tareas del estudio, en el orden de las sesiones (${menuB.join(', ')})`);
  await win.screenshot({ path: path.join(SALIDA, 'actividad_1_inicio.png') });

  // ---- E2. Abrir X1: programa y circuito listos en «Programar y probar»; Simular funciona
  await abrirTarea(win, X1);
  const x = await win.evaluate(() => ({ codigo: codigoActual(), piezas: simulador.lienzo.circuito().componentes.map((c) => c.tipo).sort().join(), cables: simulador.lienzo.circuito().cables.map((c) => c.de + '>' + c.a).sort() }));
  revisar([11, 12, 13].every((p) => new RegExp(`digitalWrite\\(${p}, HIGH\\)`).test(x.codigo)) && x.piezas === 'led,led,led,resistencia,resistencia,resistencia',
    `E2: X1 trae su programa (LED en D11, D12 y D13) y su circuito (${x.piezas})`);
  revisar(esActividad(await disp(win)) && !(await franja(win)).volver, 'E2: queda en «Programar y probar», sin «Volver a…»');
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500), 'E2: «Simular» compila y simula X1');
  const lucesB = await lucesSiguen(win, PATRON_X1);
  revisar(lucesB.ok, `E2: en B, los LED se encienden del 11 al 13, 1 s cada uno (${lucesB.texto})`);
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

  // ---- E7. Con la disposición cambiada, abrir Y1 pone «Programar y probar» (D2)
  await win.locator('#intercambiarIzq').click();
  await win.locator('#ampliarIzq').click();
  await pausa(win, 300);
  revisar((await franja(win)).volver, 'E7: antes de abrir Y1, la disposición está cambiada');
  await abrirTarea(win, Y1);
  const y = await win.evaluate(() => ({ codigo: codigoActual(), colores: simulador.lienzo.circuito().componentes.filter((c) => c.tipo === 'led').map((c) => c.props.color).join() }));
  revisar(esActividad(await disp(win)) && !(await franja(win)).volver, 'E7: abrir Y1 pone «Programar y probar» (D2)');
  revisar(y.colores === 'verde,amarillo,rojo' && [11, 12, 13].every((p) => new RegExp(`digitalWrite\\(${p}, HIGH\\)`).test(y.codigo)),
    `E7: Y1 es el mismo montaje con un semáforo (${y.colores}, en D11, D12 y D13)`);
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500), 'E7: Y1 compila y simula');
  const lucesY = await lucesSiguen(win, PATRON_Y1);
  revisar(lucesY.ok, `E7: en Y1, verde 2 s, amarillo 1 s y rojo 2 s (${lucesY.texto})`);
  await win.evaluate(() => detenerSimulacion());

  // ---- E6. Cambiar, guardar, cerrar y abrir: vuelven el trabajo y la disposición cambiada (TEC-18)
  await abrirTarea(win, X1);
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
  revisar(await win.evaluate(() => codigoActual()) === codigoX && await win.evaluate(() => simulador.lienzo.circuito().componentes.length) === 6, 'E6: vuelven el programa y el circuito de X1');

  // ---- E9. De B a A y de vuelta, con la app abierta: cada una conserva su disposición
  const enB = await disp(win);
  await win.evaluate(() => aplicarVariante('A'));
  await pausa(win, 500);
  const enA = await disp(win);
  revisar(enA.izq === null && enA.der === null && !(await franja(win)).ve && await win.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.textContent).join()) === 'TecnoBloques: paneles libres',
    `E9: en A, sin franja, con los espacios vacíos del primer uso de A (${JSON.stringify(enA)})`);
  // ---- E8 (A). En A, las tareas están en el menú; abrir X1 no mueve los espacios; los LED responden igual
  const menuA = (await enMenu(win)).filter((n) => TAREAS.includes(n));
  revisar(JSON.stringify(menuA) === JSON.stringify(TAREAS), 'E8: en A, las seis tareas están en el menú Ejemplos');
  await abrirTarea(win, X1);
  revisar(JSON.stringify(await disp(win)) === JSON.stringify(enA), 'E8: en A, abrir X1 no mueve los espacios');
  await win.locator('#btnSimularBarra').click(); // D2 de A: trae el circuito al espacio vacío
  await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500);
  await pausa(win, 400);
  const lucesA = await lucesSiguen(win, PATRON_X1);
  const codigoA = await win.evaluate(() => simulador.codigo);
  revisar(lucesA.ok && codigoA === codigoX, `E8: en A, el mismo programa y los LED del 11 al 13, 1 s cada uno (TEC-14; ${lucesA.texto})`);
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

  // ---- I5 (DISENO-I5-MATERIAL.md, E2–E5). Cada tarea abre por el menú en su nivel, con su montaje y en «Programar y
  // probar»; su programa de partida hace lo que dice la hoja y su solución (`solucion`, que la app no muestra) lo que se pide
  const NIVEL = { [X1]: 1, [Y1]: 1, [C1]: 1, [X2]: 2, [Y2]: 2, [C2]: 2 };
  const LUCES = 'led,led,led,resistencia,resistencia,resistencia';
  const PIEZAS = { [X1]: LUCES, [Y1]: LUCES, [C1]: 'led,pulsador,resistencia,resistencia', [X2]: 'led,potenciometro,resistencia',
    [Y2]: 'potenciometro,servo', [C2]: 'bateria_lipo,motor_tt,potenciometro,shield_l293d' };
  await win.evaluate(() => ponerNivel(3)); // desde Inventor: cada tarea tiene que bajar a su nivel
  for (const t of TAREAS) {
    await abrirTarea(win, t);
    const np = await win.evaluate(() => ({ nivel: nivelActual, piezas: simulador.lienzo.circuito().componentes.map((c) => c.tipo).sort().join() }));
    revisar(np.nivel === NIVEL[t] && np.piezas === PIEZAS[t] && esActividad(await disp(win)), `I5 E2: «${t}» abre en el nivel ${np.nivel} con su montaje (${np.piezas}), en «Programar y probar»`);
  }
  const simular = async () => { await win.locator('#btnSimularBarra').click(); await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300); };
  const conSolucion = (id) => win.evaluate((i) => { detenerSimulacion(); cargarXML(EJEMPLOS.find((e) => e.id === i).solucion); actualizar(); }, id);
  // X1 y Y1: los programas de partida ya se midieron en E2 y E7; las soluciones copian el grupo del D12 al final
  for (const [t, id, patron, texto] of [[X1, 'estudio_x1', PATRON_X1, '11, 12, 13, 12, 1 s cada uno'], [Y1, 'estudio_y1', PATRON_Y1, 'verde 2 s, amarillo 1 s, rojo 2 s, amarillo 1 s']]) {
    await abrirTarea(win, t);
    await conSolucion(id);
    await simular();
    const r = await lucesSiguen(win, [...patron, ['led2', 1000]]);
    revisar(r.ok, `I5 E4: la solución de ${t.split(' ')[0]} da ${texto} (${r.texto})`);
  }
  // X2, Y2 y cierre 2: la perilla en una posición y lo que manda el programa: el PWM del D9 (con 255, el pin queda en alto
  // fijo: cuenta como 1, porque su voltaje baja con el LED), el pulso del servo (Servo.h: 544 µs a 0°, 1472 a 90° y 2400 a
  // 180°) y las RPM del motor. El ángulo del servo no se usa: el simulado tiene su propia desviación, ±5° (SERVO-002)
  async function conPerilla(posicion) {
    await win.evaluate((p) => {
      detenerSimulacion();
      const c = simulador.lienzo.circuito();
      c.componentes.find((x) => x.id === 'pot1').props.posicion = p;
      const pr = proyectoActual();
      pr.circuito = c;
      cargarProyecto(pr, true);
    }, posicion);
    await pausa(win, 500);
    await win.locator('#btnSimularBarra').click();
    await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 1500);
    return win.evaluate(() => {
      const m = simulador.sim.mediciones(), d9 = m.pines.find((p) => p.pin === 'D9');
      return { pwm: m.pwm && m.pwm.D9 !== undefined ? m.pwm.D9 : (d9 ? (d9.v > 2.5 ? 1 : 0) : null),
        pulso: m.servos && m.servos[0] ? m.servos[0].pulso : null, rpm: m.motores && m.motores[0] ? m.motores[0].rpm : null };
    });
  }
  const PERILLA = [
    [X2, 'estudio_x2', 'pwm', 0.02, [[0, 0], [0.5, 0.5], [1, 1]], [[0, 1], [1, 0]]],
    [Y2, 'estudio_y2', 'pulso', 12, [[0, 544], [0.5, 1472], [1, 2400]], [[0, 2400], [1, 544]]],
  ];
  for (const [t, id, mide, tol, partida, solucion] of PERILLA) {
    await abrirTarea(win, t);
    for (const [nombre, casos] of [['programa de partida', partida], ['solución', solucion]]) {
      if (nombre === 'solución') await conSolucion(id);
      const vistos = [];
      for (const [p] of casos) vistos.push((await conPerilla(p))[mide]);
      const ok = casos.every(([, v], i) => vistos[i] !== null && Math.abs(vistos[i] - v) <= tol);
      revisar(ok, `I5 ${nombre === 'solución' ? 'E4' : 'E3'}: ${t.split(' ')[0]}, ${nombre}: perilla ${casos.map(([p, v], i) => `${p} → ${mide} ${v} (medido ${vistos[i] === null ? 'nada' : Math.round(vistos[i] * 1000) / 1000})`).join('; ')}`);
    }
  }
  await abrirTarea(win, C2);
  const motor = [await conPerilla(1), await conPerilla(0)];
  revisar(motor[0].rpm > 50 && Math.abs(motor[1].rpm) < 1, `I5 E3: cierre 2, la perilla al máximo mueve el motor y al mínimo lo para (${motor.map((m) => Math.round(m.rpm)).join(' y ')} RPM)`);
  await conSolucion('estudio_cierre2');
  const atras = await conPerilla(1);
  revisar(atras.rpm < -50, `I5 E4: cierre 2, el reto gira hacia el otro lado (${Math.round(atras.rpm)} RPM)`);
  await win.evaluate(() => detenerSimulacion());
  // Cierre 1: el montaje T1 (pull-down) enciende el LED mientras se pulsa; el reto, al revés
  await abrirTarea(win, C1);
  await simular();
  const boton = await ledConPulsador(win);
  revisar(boton.apagado && boton.encendido && boton.vuelve, `I5 E3: cierre 1, el LED se enciende solo mientras se pulsa (intentos: ${boton.intentos})`);
  await conSolucion('estudio_cierre1');
  await simular();
  const reto = await ledConPulsador(win, 'btn1', true);
  revisar(reto.suelto > 0.5 && reto.pulsado !== null && reto.pulsado < 0.01 && reto.otraVez > 0.5, `I5 E4: cierre 1, el reto apaga el LED mientras se pulsa (intentos: ${reto.intentos})`);
  await win.evaluate(() => detenerSimulacion());
  // E5: en cada par, X y Y tienen los mismos bloques de partida y de solución, y la solución cambia lo mismo
  const cuenta = await win.evaluate(() => Object.fromEntries(EJEMPLOS.filter((e) => e.grupo === 'estudio').map((e) => {
    const n = (x) => (x.match(/<block /g) || []).length, nums = (x) => x.match(/<field name="NUM">[^<]*/g) || [];
    const a = nums(e.xml), b = nums(e.solucion);
    return [e.id, { partida: n(e.xml), solucion: n(e.solucion), numerosCambiados: a.length === b.length ? a.filter((v, i) => v !== b[i]).length : 'otros' }];
  })));
  const igual = (p, q) => JSON.stringify(cuenta[p]) === JSON.stringify(cuenta[q]);
  revisar(igual('estudio_x1', 'estudio_y1') && igual('estudio_x2', 'estudio_y2'),
    `I5 E5: en cada par, los mismos bloques de partida y de solución (X1 ${JSON.stringify(cuenta.estudio_x1)}, Y1 ${JSON.stringify(cuenta.estudio_y1)}, X2 ${JSON.stringify(cuenta.estudio_x2)}, Y2 ${JSON.stringify(cuenta.estudio_y2)})`);
  await app.close();
  await new Promise((r) => setTimeout(r, 400));

  // ---- E8 (C0). Sin estudio, X no está en el menú; abierta por código, se comporta igual; nada de B
  ponerVariante('C0');
  ({ app, win } = await abrir());
  const enC0 = await win.evaluate(() => ({ activo: panelesA.activo(), franja: !!$('franjaActividad'), vista: $('principal').dataset.vista, h1: document.querySelectorAll('h1').length }));
  revisar(!enC0.activo && !enC0.franja && enC0.h1 === 0 && enC0.vista === vistaC0Antes, `E8: en C0 no hay espacios, franja ni h1, y vuelve la vista «${enC0.vista}»`);
  revisar(!(await enMenu(win)).some((n) => TAREAS.includes(n)), 'E8: en C0, las tareas del estudio no están en el menú Ejemplos');
  revisar(await win.evaluate(() => !document.querySelector('.de-estudio') && $('listaEjemplos').querySelectorAll('.menu-titulo').length === 1), 'E8: en C0, el menú Ejemplos es el de siempre también en el DOM: sin nodos del estudio y con un solo encabezado');
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => e.id === 'estudio_x1')));
  await pausa(win, 600);
  await win.locator('#vDividido').click();
  await win.locator('#tCircuito').click();
  await pausa(win, 300);
  await win.locator('#btnSimularBarra').click();
  await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500);
  const lucesC0 = await lucesSiguen(win, PATRON_X1);
  revisar(lucesC0.ok && await win.evaluate(() => simulador.codigo) === codigoX, `E8: en C0, el mismo programa y los LED del 11 al 13, 1 s cada uno (TEC-14; ${lucesC0.texto})`);
  await win.evaluate(() => detenerSimulacion());
  await app.close();

  revisar(errores.length === 0, `sin errores en la página${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(`\n${fallos ? fallos + ' FALLAS' : 'Todo bien'} · capturas en test/salida/actividad_*.png`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
