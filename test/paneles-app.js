// Prueba de punta a punta de la variante A, paneles libres (EST-002, I3; diseño y ejemplos E1–E11 en
// TecnoSuite/EstrategíaTecno/DISENO-I3-PANELES.md). La variante la deja el instructor en estudio-config.json; aquí se
// escribe antes de abrir la app. Comprueba los dos espacios vacíos del primer uso, elegir, intercambiar, ampliar y
// sustituir herramientas sin reiniciar la simulación, que en A nada se reacomoda solo, que la disposición se recuerda
// aparte de la de C0, y el teclado y el contraste en 1536 × 864 y 1366 × 768. Necesita arduino-cli (como test:simulador).
// Uso: npm run test:paneles   (arma con --simulador-local)
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

// El ejercicio X de ADR-002: pulsador en D2 (al otro lado, GND) y LED con 220 Ω en D13
const X = {
  formato: 1, placa: 'uno', protoboard: null,
  componentes: [
    { id: 'r1', tipo: 'resistencia', x: 330, y: -160, rot: 0, props: { ohmios: 220 } },
    { id: 'led1', tipo: 'led', x: 420, y: -100, rot: 0, props: { color: 'rojo' } },
    { id: 'btn1', tipo: 'pulsador', x: 330, y: 40, rot: 0, props: { color: 'rojo' } }],
  cables: [
    { de: 'placa.D13', a: 'r1.1' }, { de: 'r1.2', a: 'led1.anodo' }, { de: 'led1.catodo', a: 'placa.GND1' },
    { de: 'placa.D2', a: 'btn1.1i' }, { de: 'placa.GND3', a: 'btn1.2i' }]
};
const PROGRAMA_X = 'void setup() { pinMode(2, INPUT_PULLUP); pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, digitalRead(2) == LOW ? HIGH : LOW); }\n';

(async () => {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')), TB_HERRAMIENTAS: 'instructor' };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-paneles-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  fs.mkdirSync(datos, { recursive: true });
  const ponerVariante = (v) => fs.writeFileSync(path.join(datos, 'estudio-config.json'), JSON.stringify({ formato: 1, variante: v }));
  const errores = [];
  async function abrir(ancho = 1536, alto = 864) {
    const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`], cwd: RAIZ, env });
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await win.waitForLoadState('load');
    await tamano(app, win, ancho, alto);
    await win.waitForTimeout(1500);
    return { app, win };
  }
  async function tamano(app, win, ancho, alto) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => { const v = BrowserWindow.getAllWindows()[0]; v.unmaximize(); v.setContentSize(w, h); }, [ancho, alto]);
    await win.waitForTimeout(500);
  }
  const esperar = (win, condicion, ms = 40000) => win.waitForFunction(condicion, null, { timeout: ms, polling: 200 }).then(() => true, () => false);
  const disp = (win) => win.evaluate(() => panelesA.disposicion());
  // Dónde está cada herramienta y si se ve (con tamaño de verdad en la pantalla)
  const donde = (win) => win.evaluate(() => {
    const lado = (n) => (n.closest('#ladoIzq') ? 'izq' : n.closest('#ladoDer') ? 'der' : n.closest('#almacenA') ? 'almacen' : 'otro');
    const ve = (n) => { const r = n.getBoundingClientRect(); return r.width > 150 && r.height > 150 && n.offsetParent !== null; };
    const o = {};
    for (const [h, id] of [['bloques', 'zonaBloques'], ['codigo', 'pCodigo'], ['circuito', 'pCircuito'], ['monitor', 'pSerial']]) o[h] = { lado: lado($(id)), ve: ve($(id)) };
    return o;
  });
  const corrida = (win) => win.evaluate(() => ({
    hay: !!simulador.sim, ms: simulador.sim ? simulador.sim.medidas().msSimulados : 0,
    iniciadas: simulador.eventos.filter((e) => e.tipo === 'simulacion_iniciada').length, id: simulador.sim ? (simulador.sim.__prueba ||= Math.random()) : null,
  }));
  const pausa = (win, ms) => win.waitForTimeout(ms);

  // ---- E1. Primer uso en A: dos espacios vacíos, sin la barra de vistas de C0
  ponerVariante('A');
  let { app, win } = await abrir();
  const vistaC0Antes = await win.evaluate(() => (leerLocal(CLAVE_PREF) || {}).vista || null);
  revisar(await win.evaluate(() => document.body.dataset.variante === 'A' && panelesA.activo()), 'E1: con la variante A, la app abre en paneles libres');
  const vacios = await win.evaluate(() => [...document.querySelectorAll('.lado-vacio')].map((v) => ({
    pregunta: v.querySelector('.pregunta-lado') && v.querySelector('.pregunta-lado').textContent,
    botones: [...v.querySelectorAll('button[data-herr]')].map((b) => b.dataset.herr).join(','), ve: v.offsetParent !== null })));
  revisar(vacios.length === 2 && vacios.every((v) => v.ve && v.pregunta === '¿Qué herramienta abres aquí?' && v.botones === 'bloques,codigo,circuito,monitor'),
    `E1: dos espacios vacíos con la pregunta y los cuatro botones (${JSON.stringify(vacios.map((v) => v.botones))})`);
  revisar(await win.evaluate(() => $('vistas').offsetParent === null && $('panel').offsetParent === null), 'E1: no se ven la barra de vistas de C0 ni su panel de pestañas');
  revisar(await win.evaluate(() => ['zonaBloques', 'pCodigo', 'pCircuito', 'pSerial'].every((id) => $(id).closest('#almacenA'))), 'E1: las cuatro herramientas esperan fuera de la vista, sin copias');
  await win.screenshot({ path: path.join(SALIDA, 'paneles_1_vacios.png') });

  // ---- E2. Elegir en los dos órdenes: Bloques | Circuito y Circuito | Bloques
  await win.locator('#ladoIzq .lado-vacio button[data-herr="bloques"]').click();
  await pausa(win, 300);
  revisar(await win.evaluate(() => document.activeElement === $('herrIzq')), 'E2: al elegir en el espacio vacío, el foco pasa al selector de ese espacio');
  await win.locator('#ladoDer .lado-vacio button[data-herr="circuito"]').click();
  await pausa(win, 600);
  let w = await donde(win);
  revisar(w.bloques.lado === 'izq' && w.bloques.ve && w.circuito.lado === 'der' && w.circuito.ve, `E2: Bloques a la izquierda y Circuito a la derecha, los dos a la vista (${JSON.stringify(w)})`);
  revisar(await win.evaluate(() => { const s = document.querySelector('#blockly .blocklySvg'); const r = $('zonaBloques').getBoundingClientRect(); return s && Math.abs(s.getBoundingClientRect().width - r.width) < 3; }),
    'E2: el área de Blockly toma el ancho de su espacio');
  await win.evaluate(({ circuito, programa }) => { const p = proyectoActual(); p.circuito = circuito; p.texto = programa; cargarProyecto(p, true); }, { circuito: X, programa: PROGRAMA_X });
  await pausa(win, 500);
  revisar(JSON.stringify(await disp(win)).includes('"izq":"bloques","der":"circuito"'), 'E2: cargar el proyecto no mueve las herramientas');
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500), 'E2: compila y simula el ejercicio X con Circuito a la derecha');
  revisar(await win.evaluate(() => $('btnDetenerBarra').offsetParent === null && $('btnDetenerSim').offsetParent !== null), 'E2: con el circuito a la vista, «Detener» está solo en el circuito, sin repetirse en la barra');
  await win.screenshot({ path: path.join(SALIDA, 'paneles_2_bloques_circuito.png') });

  // ---- E3. Intercambiar dos veces con la simulación andando
  let c0 = await corrida(win);
  const bloquesAntes = await win.evaluate(() => Blockly.serialization.workspaces.save(espacio));
  await win.locator('#intercambiarIzq').click();
  await pausa(win, 900);
  let c1 = await corrida(win);
  w = await donde(win);
  revisar(w.circuito.lado === 'izq' && w.circuito.ve && w.bloques.lado === 'der' && w.bloques.ve, 'E3: el primer «Intercambiar» deja Circuito a la izquierda y Bloques a la derecha');
  revisar(c1.id === c0.id && c1.ms > c0.ms && c1.iniciadas === c0.iniciadas, `E3: la misma simulación sigue (${Math.round(c0.ms)} → ${Math.round(c1.ms)} ms), sin otro simulacion_iniciada`);
  await win.locator('#intercambiarDer').click();
  await pausa(win, 900);
  let c2 = await corrida(win);
  w = await donde(win);
  revisar(w.bloques.lado === 'izq' && w.circuito.lado === 'der' && c2.id === c0.id && c2.ms > c1.ms && c2.iniciadas === c0.iniciadas,
    `E3: el segundo vuelve todo a su lado y la simulación sigue (${Math.round(c2.ms)} ms)`);
  revisar(JSON.stringify(await win.evaluate(() => Blockly.serialization.workspaces.save(espacio))) === JSON.stringify(bloquesAntes), 'E3: los bloques no cambian');
  revisar(await win.evaluate(() => /Circuito en el espacio izquierdo|Bloques en el espacio izquierdo/.test($('anuncioPaneles').textContent)), 'E3: el cambio se anuncia para el lector de pantalla');

  // ---- E4. Elegir en un espacio la herramienta del otro: se cambian de lado (D1)
  const opcion = await win.evaluate(() => [...$('herrIzq').options].find((o) => o.value === 'circuito').textContent);
  revisar(/otro espacio/.test(opcion), `E4: el selector avisa que Circuito está en el otro espacio («${opcion}»)`);
  await win.locator('#herrIzq').selectOption('circuito');
  await pausa(win, 900);
  w = await donde(win);
  let c3 = await corrida(win);
  revisar(w.circuito.lado === 'izq' && w.bloques.lado === 'der' && w.codigo.lado === 'almacen' && w.monitor.lado === 'almacen', 'E4: Circuito y Bloques se cambian de lado; no aparece una copia');
  revisar(c3.id === c0.id && c3.ms > c2.ms && c3.iniciadas === c0.iniciadas, 'E4: la simulación sigue sin reiniciarse');

  // ---- E5. Ampliar el circuito durante la simulación y reducir
  const anchosAntes = await win.evaluate(() => [$('ladoIzq').getBoundingClientRect().width, $('ladoDer').getBoundingClientRect().width]);
  await win.locator('#ampliarIzq').click();
  await pausa(win, 900);
  const amp = await win.evaluate(() => ({ izq: $('ladoIzq').getBoundingClientRect().width, total: $('principal').getBoundingClientRect().width,
    der: $('ladoDer').offsetParent === null, divisor: $('divisor').offsetParent === null, med: $('panelMediciones').offsetParent !== null,
    texto: $('ampliarIzq').textContent, inter: $('intercambiarIzq').disabled }));
  let c4 = await corrida(win);
  revisar(Math.abs(amp.izq - amp.total) < 2 && amp.der && amp.divisor, `E5: el circuito ocupa toda la ventana (${Math.round(amp.izq)} de ${Math.round(amp.total)} px)`);
  revisar(amp.med, 'E5: con el circuito ampliado se ven las mediciones, como en C0');
  revisar(amp.texto === 'Reducir' && amp.inter, 'E5: el botón dice «Reducir» y «Intercambiar» espera hasta reducir');
  revisar(c4.id === c0.id && c4.ms > c3.ms && c4.iniciadas === c0.iniciadas, 'E5: al ampliar, la simulación sigue');
  await win.screenshot({ path: path.join(SALIDA, 'paneles_3_circuito_ampliado.png') });
  await win.locator('#ampliarIzq').click();
  await pausa(win, 900);
  const anchosDespues = await win.evaluate(() => [$('ladoIzq').getBoundingClientRect().width, $('ladoDer').getBoundingClientRect().width]);
  let c5 = await corrida(win);
  revisar(Math.abs(anchosDespues[0] - anchosAntes[0]) < 2 && Math.abs(anchosDespues[1] - anchosAntes[1]) < 2 && await win.evaluate(() => $('panelMediciones').offsetParent === null),
    `E5: «Reducir» vuelve al tamaño de antes (${anchosAntes.map(Math.round)} → ${anchosDespues.map(Math.round)}) y las mediciones se recogen`);
  revisar(c5.id === c0.id && c5.ms > c4.ms && c5.iniciadas === c0.iniciadas, 'E5: al reducir, la simulación sigue');

  // ---- E6. Ampliar los bloques con la simulación andando: «Detener» en la barra
  await win.locator('#ampliarDer').click();
  await pausa(win, 700);
  w = await donde(win);
  let c6 = await corrida(win);
  revisar(w.bloques.ve && !w.circuito.ve && c6.id === c0.id && c6.ms > c5.ms, 'E6: con los bloques ampliados, el circuito no se ve y su simulación sigue');
  revisar(await win.evaluate(() => $('btnDetenerBarra').offsetParent !== null), 'E6: «Detener» está a mano en la barra');
  await win.locator('#btnDetenerBarra').click();
  await pausa(win, 500);
  revisar(await win.evaluate(() => !simulador.sim && $('btnDetenerBarra').offsetParent === null), 'E6: «Detener» de la barra detiene la simulación y se va');
  await win.locator('#ampliarDer').click();
  await pausa(win, 400);

  // ---- E7. Sustituir el circuito por el monitor y volver a elegirlo: la simulación sigue o queda detenida
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300), 'E7: simula otra vez');
  const piezas = () => win.evaluate(() => simulador.lienzo.circuito().componentes.length);
  const piezasAntes = await piezas();
  c0 = await corrida(win);
  await win.locator('#herrIzq').selectOption('monitor');
  await pausa(win, 800);
  w = await donde(win);
  c1 = await corrida(win);
  revisar(w.monitor.lado === 'izq' && w.monitor.ve && w.circuito.lado === 'almacen' && c1.id === c0.id && c1.ms > c0.ms, 'E7: con el monitor en su lugar, el circuito sale de la vista y su simulación sigue');
  await win.locator('#herrIzq').selectOption('circuito');
  await pausa(win, 800);
  c2 = await corrida(win);
  revisar(c2.id === c0.id && c2.ms > c1.ms && c2.iniciadas === c0.iniciadas && await piezas() === piezasAntes, `E7: el circuito vuelve con sus ${piezasAntes} piezas y la misma simulación`);
  await win.locator('#btnDetenerSim').click();
  await pausa(win, 300);
  await win.locator('#herrIzq').selectOption('codigo');
  await pausa(win, 300);
  await win.locator('#herrIzq').selectOption('circuito');
  await pausa(win, 500);
  revisar(await win.evaluate(() => !simulador.sim && simulador.lienzo && $('estadoSim').textContent === 'Arma el circuito y pulsa Simular'), 'E7: detenida, vuelve detenida');

  // ---- E9. Editar después de simular: la corrida queda atrás; nada va a la placa
  await win.locator('#btnSimularBarra').click();
  await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300);
  await win.evaluate(() => { $('editor').value += '// cambio\n'; $('editor').dispatchEvent(new Event('input')); uiSimulador(); });
  const e9 = await win.evaluate(() => ({ ...$('estadoSim').dataset }));
  revisar(e9.desactualizada === 'true' && e9.destino === 'simulacion', 'E9: editar después de simular marca la corrida como de una revisión anterior, sin cambiar el destino');
  await win.evaluate(() => detenerSimulacion());

  // ---- E8. Cambiar de nivel, abrir un ejemplo y pasar a «Editar C++»: los espacios no se mueven
  await win.locator('#herrDer').selectOption('codigo');
  await pausa(win, 300);
  const fija = JSON.stringify(await disp(win));
  const anchoFijo = await win.evaluate(() => $('ladoDer').getBoundingClientRect().width);
  await win.locator('#niveles button[data-nivel="1"]').click();
  await pausa(win, 400);
  await win.locator('#niveles button[data-nivel="2"]').click();
  await pausa(win, 400);
  revisar(JSON.stringify(await disp(win)) === fija, 'E8: cambiar de nivel no mueve los espacios');
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => !e.texto && e.placa === 'uno')));
  await pausa(win, 600);
  revisar(JSON.stringify(await disp(win)) === fija, 'E8: abrir un ejemplo no mueve los espacios');
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => e.texto && e.placa === 'uno')));
  await pausa(win, 600);
  revisar(JSON.stringify(await disp(win)) === fija && await win.evaluate(() => !!estado.texto), 'E8: un ejemplo en C++ entra a «Editar C++» y los espacios siguen igual');
  revisar(Math.abs(await win.evaluate(() => $('ladoDer').getBoundingClientRect().width) - anchoFijo) < 2, 'E8: el ancho tampoco cambia');
  revisar(await win.evaluate((v) => (leerLocal(CLAVE_PREF) || {}).vista || null, null) === vistaC0Antes, `E8: la vista guardada de C0 sigue siendo «${vistaC0Antes}»`);

  // ---- E11. Teclado, foco y contraste en 1536 × 864 (aquí) y 1366 × 768 (más abajo)
  async function teclado(etiqueta) {
    await win.evaluate(() => $('herrIzq').focus());
    const vistos = [];
    for (let i = 0; i < 40; i++) {
      const f = await win.evaluate(() => {
        const a = document.activeElement;
        const r = a.getBoundingClientRect();
        const cs = getComputedStyle(a);
        const dentro = r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
        const color = (v) => { const t = document.createElement('i'); t.style.color = v; document.body.append(t); const c = getComputedStyle(t).color; t.remove(); return c; };
        // El foco se ve: un contorno de 2 píxeles de la pantalla o más, o, en el divisor, su color de acento (style.css, #divisor:focus-visible)
        const foco = a.id === 'divisor' ? cs.backgroundColor === color('var(--accent)') : cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) * devicePixelRatio >= 2; // a 125 %, Chromium ajusta los 2 px a 2 píxeles de la pantalla (1,6 px)
        return { id: a.id, foco, visible: a.matches(':focus-visible'), dentro };
      });
      vistos.push(f);
      await win.keyboard.press('Tab');
    }
    const ids = ['herrIzq', 'intercambiarIzq', 'ampliarIzq', 'divisor', 'herrDer', 'intercambiarDer', 'ampliarDer'];
    const halla = ids.map((id) => vistos.find((v) => v.id === id));
    revisar(halla.every(Boolean), `E11 ${etiqueta}: con Tab se llega a ${ids.join(', ')}${halla.every(Boolean) ? '' : ' (faltan: ' + ids.filter((id, i) => !halla[i]).join(', ') + ')'}`);
    const sinFoco = halla.filter((v) => v && !(v.foco && v.dentro));
    revisar(sinFoco.length === 0, `E11 ${etiqueta}: cada uno muestra el foco y queda dentro de la ventana${sinFoco.length ? ' (no: ' + JSON.stringify(sinFoco) + ')' : ''}`);
    const orden = ids.map((id) => vistos.findIndex((v) => v.id === id));
    revisar(orden.every((n, i) => i === 0 || n > orden[i - 1]), `E11 ${etiqueta}: el orden del teclado sigue el de la pantalla (${orden.join(' < ')})`);
    const barra = await win.evaluate(() => [...document.querySelectorAll('.barra button, .barra select, .barra input')].filter((b) => b.offsetParent !== null)
      .filter((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight; }).map((b) => b.id));
    revisar(barra.length === 0, `E11 ${etiqueta}: ninguna acción de la barra queda fuera de la ventana${barra.length ? ' (' + barra.join(', ') + ')' : ''}`);
    await win.evaluate(() => $('divisor').focus());
    const v0 = await win.evaluate(() => Number($('divisor').getAttribute('aria-valuenow')));
    await win.keyboard.press('ArrowLeft');
    await pausa(win, 200);
    const v1 = await win.evaluate(() => Number($('divisor').getAttribute('aria-valuenow')));
    await win.keyboard.press('ArrowRight');
    await pausa(win, 200);
    const v2 = await win.evaluate(() => Number($('divisor').getAttribute('aria-valuenow')));
    revisar(v1 < v0 && v2 === v0 && await win.evaluate(() => $('divisor').getAttribute('aria-controls') === 'ladoIzq' && /%/.test($('divisor').getAttribute('aria-valuetext'))),
      `E11 ${etiqueta}: el divisor se mueve con las flechas y dice su valor (${v0} → ${v1} → ${v2} %)`);
  }
  // Contraste de lo nuevo, medido en la página (WCAG 1.4.3): texto contra el fondo real de su espacio
  async function contraste(etiqueta) {
    const r = await win.evaluate(() => {
      const rgb = (c) => (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const fondo = (n) => { for (let x = n; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return 'rgb(255,255,255)'; };
      const razon = (n) => { const a = lum(getComputedStyle(n).color), b = lum(fondo(n)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      return [...document.querySelectorAll('.cabeza-lado label, .cabeza-lado select, .cabeza-lado button, .lado-vacio .pregunta-lado, .lado-vacio button b, .lado-vacio button small, #estadoSimBarra')]
        .filter((n) => n.offsetParent !== null).map((n) => ({ que: n.className || n.tagName, razon: Math.round(razon(n) * 100) / 100 }));
    });
    const malos = r.filter((x) => x.razon < 4.5);
    revisar(r.length > 0 && malos.length === 0, `E11 ${etiqueta}: contraste de ${r.length} textos nuevos ≥ 4,5:1${malos.length ? ' (bajos: ' + JSON.stringify(malos) + ')' : ' (mínimo ' + Math.min(...r.map((x) => x.razon)) + ')'}`);
  }
  await teclado('1536 × 864');
  await contraste('1536 × 864, claro');
  await win.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await pausa(win, 200);
  await contraste('1536 × 864, oscuro');
  await win.screenshot({ path: path.join(SALIDA, 'paneles_4_oscuro.png') });
  await win.evaluate(() => document.documentElement.removeAttribute('data-theme'));

  // Un espacio vacío también se mide (el otro con su herramienta)
  await win.locator('#herrDer').selectOption('');
  await pausa(win, 300);
  await contraste('1536 × 864, con un espacio vacío');
  revisar((await disp(win)).der === null && await win.evaluate(() => $('pCodigo').closest('#almacenA') !== null), 'quitar la herramienta de un espacio lo deja vacío y la herramienta espera fuera');

  // ---- D2. «Monitor serial» de la barra abre el monitor en el espacio vacío
  await win.evaluate(() => { serial.conectado = true; }); // sin placa: que no intente conectarse aquí
  await win.locator('#btnMonitor').click();
  await pausa(win, 400);
  revisar((await disp(win)).der === 'monitor' && (await donde(win)).monitor.ve, 'D2: «Monitor serial» de la barra lo abre en el espacio vacío');
  await win.locator('#ampliarIzq').click();
  await pausa(win, 300);
  await win.locator('#btnMonitor').click();
  await pausa(win, 400);
  revisar((await disp(win)).ampliado === null && (await donde(win)).monitor.ve, 'D2: si el monitor está tras el espacio ampliado, el botón vuelve a mostrar los dos');
  await win.evaluate(() => { serial.conectado = false; });

  // ---- E10. Recordar la disposición: Circuito | C++, con el divisor movido; cerrar y abrir
  await win.locator('#herrDer').selectOption('codigo');
  await win.evaluate(() => $('divisor').focus());
  await win.keyboard.press('ArrowRight');
  await win.keyboard.press('ArrowRight');
  await pausa(win, 300);
  const guardada = await disp(win);
  const anchoGuardado = await win.evaluate(() => $('ladoIzq').getBoundingClientRect().width);
  await win.evaluate(({ circuito, programa }) => { const p = proyectoActual(); p.circuito = circuito; p.texto = programa; cargarProyecto(p, true); autoguardar(); }, { circuito: X, programa: PROGRAMA_X });
  await pausa(win, 1500);
  await app.close();
  await new Promise((r) => setTimeout(r, 500));
  ({ app, win } = await abrir());
  const otra = await disp(win);
  revisar(otra.izq === guardada.izq && otra.der === guardada.der && otra.ampliado === null && Math.abs(otra.proporcion - guardada.proporcion) < 0.005,
    `E10: al abrir otra vez vuelve la misma disposición (${otra.izq} | ${otra.der}, ${Math.round(otra.proporcion * 100)} %)`);
  revisar(Math.abs(await win.evaluate(() => $('ladoIzq').getBoundingClientRect().width) - anchoGuardado) < 3, 'E10: con el mismo ancho');
  revisar(await win.evaluate(() => codigoActual()) === PROGRAMA_X && await win.evaluate(() => simulador.lienzo.circuito().componentes.length) === 3, 'E10: vuelven el programa y el circuito del proyecto');

  // ---- E11 en 1366 × 768 al 100 %
  await tamano(app, win, 1366, 768);
  await win.locator('#herrIzq').selectOption('bloques');
  await win.locator('#herrDer').selectOption('circuito');
  await pausa(win, 500);
  const minimos = await win.evaluate(() => [$('ladoIzq').getBoundingClientRect().width, $('ladoDer').getBoundingClientRect().width]);
  revisar(minimos.every((x) => x >= 320), `E11 1366 × 768: cada espacio tiene al menos 320 px (${minimos.map(Math.round)})`);
  await teclado('1366 × 768');
  await win.screenshot({ path: path.join(SALIDA, 'paneles_5_1366.png') });

  // ---- r1, F01 (COD-20261109-001): en todo el recorrido del divisor, la cabeza de cada espacio se ve, se alcanza y responde
  const cabezas = () => win.evaluate(() => {
    const malos = [];
    for (const s of ['Izq', 'Der']) {
      const lado = $('lado' + s).getBoundingClientRect();
      for (const id of ['herr' + s, 'intercambiar' + s, 'ampliar' + s]) {
        const n = $(id), r = n.getBoundingClientRect();
        const dentro = r.left >= lado.left - 0.5 && r.right <= lado.right + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5;
        const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!dentro || !(arriba === n || n.contains(arriba)) || r.width < 24) malos.push({ id, x: [Math.round(r.left), Math.round(r.right)], espacio: [Math.round(lado.left), Math.round(lado.right)], encima: arriba && (arriba.id || arriba.className) });
      }
    }
    return { malos, izq: Math.round($('ladoIzq').getBoundingClientRect().width), der: Math.round($('ladoDer').getBoundingClientRect().width), pagina: document.documentElement.scrollWidth, ventana: innerWidth };
  });
  const docs = () => win.evaluate(() => JSON.stringify([Blockly.serialization.workspaces.save(espacio), codigoActual(), simulador.lienzo.circuito().componentes.length]));
  // Tab desde el selector de un espacio: sus tres controles muestran el foco y quedan dentro de la ventana
  async function focoCabeza(s) {
    await win.evaluate((s) => $('herr' + s).focus(), s);
    const vistos = [];
    for (let i = 0; i < 3; i++) {
      vistos.push(await win.evaluate(() => {
        const a = document.activeElement, cs = getComputedStyle(a), r = a.getBoundingClientRect();
        return { id: a.id, foco: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) * devicePixelRatio >= 2, dentro: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
      }));
      await win.keyboard.press('Tab');
    }
    return vistos;
  }
  async function extremo(etiqueta, s, nombre) {
    const c = await cabezas();
    revisar(c.malos.length === 0 && c.pagina <= c.ventana, `F01 ${etiqueta}, ${nombre} (${c.izq} | ${c.der} px): selector, Intercambiar y Ampliar se ven dentro de su espacio y responden en su centro${c.malos.length ? ' (no: ' + JSON.stringify(c.malos) + ')' : ''}${c.pagina > c.ventana ? ` · la página mide ${c.pagina} de ${c.ventana} px` : ''}`);
    const foco = await focoCabeza(s);
    revisar(foco.map((f) => f.id).join() === ['herr', 'intercambiar', 'ampliar'].map((x) => x + s).join() && foco.every((f) => f.foco && f.dentro), `F01 ${etiqueta}, ${nombre}: con Tab, los tres controles del espacio angosto muestran el foco (${JSON.stringify(foco)})`);
    const d0 = await disp(win), ancho0 = s === 'Izq' ? c.izq : c.der, pasos = [];
    try {
      await win.locator('#intercambiar' + s).click({ timeout: 3000 }); await pausa(win, 300);
      pasos.push((await disp(win)).izq === d0.der);
      await win.locator('#intercambiar' + s).click({ timeout: 3000 }); await pausa(win, 300);
      pasos.push((await disp(win)).izq === d0.izq);
      await win.locator('#ampliar' + s).click({ timeout: 3000 }); await pausa(win, 300);
      pasos.push(await win.evaluate((s) => $('ampliar' + s).textContent === 'Reducir' && $('lado' + s).getBoundingClientRect().width > innerWidth - 2, s));
      await win.locator('#ampliar' + s).click({ timeout: 3000 }); await pausa(win, 300);
      pasos.push(Math.abs(await win.evaluate((s) => $('lado' + s).getBoundingClientRect().width, s) - ancho0) <= 1);
    } catch (e) { pasos.push('clic: ' + e.message.split('\n')[0]); }
    revisar(pasos.length === 4 && pasos.every((p) => p === true), `F01 ${etiqueta}, ${nombre}: clic real en Intercambiar (ida y vuelta) y en Ampliar / Reducir, que vuelve al mismo ancho (${JSON.stringify(pasos)})`);
  }
  async function recorrido(etiqueta) {
    const antes = await docs();
    // Con el teclado, hasta cada extremo
    await win.evaluate(() => $('divisor').focus());
    for (const [tecla, s, nombre] of [['ArrowLeft', 'Izq', 'espacio izquierdo al mínimo'], ['ArrowRight', 'Der', 'espacio derecho al mínimo']]) {
      await win.evaluate(() => $('divisor').focus());
      for (let i = 0, v = -1; i < 40; i++) {
        const ahora = await win.evaluate(() => $('divisor').getAttribute('aria-valuenow'));
        if (ahora === v) break;
        v = ahora;
        await win.keyboard.press(tecla);
        await pausa(win, 40);
      }
      await pausa(win, 300);
      await extremo(`${etiqueta}, teclado`, s, nombre);
    }
    // Con el ratón, arrastrando el divisor hasta cada borde de la ventana
    for (const [hacia, s, nombre] of [[0, 'Izq', 'espacio izquierdo al mínimo'], [1, 'Der', 'espacio derecho al mínimo']]) {
      const r = await win.evaluate(() => { const b = $('divisor').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: innerWidth }; });
      await win.mouse.move(r.x, r.y);
      await win.mouse.down();
      await win.mouse.move(hacia ? r.w - 2 : 2, r.y, { steps: 12 });
      await win.mouse.up();
      await pausa(win, 300);
      await extremo(`${etiqueta}, ratón`, s, nombre);
    }
    revisar(await docs() === antes, `F01 ${etiqueta}: después del recorrido, el programa, los bloques y el circuito son los mismos`);
    await win.evaluate(() => $('divisor').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    await pausa(win, 300);
  }
  await recorrido('1366 × 768');
  await win.screenshot({ path: path.join(SALIDA, 'paneles_7_1366_angosto.png') });
  await tamano(app, win, 1536, 864);
  await recorrido('1536 × 864');
  // Zoom real al 200 %: la ventana de 1536 × 864 queda en 768 × 432 de CSS
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2));
  await pausa(win, 800);
  const z = await cabezas();
  revisar(z.malos.length === 0 && z.pagina <= z.ventana, `F01 zoom 200 % (${z.ventana} px de ancho, ${z.izq} | ${z.der}): la cabeza de los dos espacios se ve y responde, sin desplazamiento horizontal${z.malos.length ? ' (no: ' + JSON.stringify(z.malos) + ')' : ''}${z.pagina > z.ventana ? ` · la página mide ${z.pagina}` : ''}`);
  // Con zoom, la captura de Playwright toma un recorte a otra escala: se captura con Electron
  const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  fs.writeFileSync(path.join(SALIDA, 'paneles_8_zoom200.png'), Buffer.from(png, 'base64'));
  const zb = await win.evaluate(() => ({ fuera: [...document.querySelectorAll('.barra button, .barra select, .barra input')].filter((b) => b.offsetParent !== null)
    .filter((b) => { const q = b.getBoundingClientRect(); return q.right > innerWidth + 0.5 || q.bottom > innerHeight + 0.5; }).map((b) => b.id),
    barra: Math.round(document.querySelector('.barra').getBoundingClientRect().height), cuerpo: Math.round(document.querySelector('#ladoIzq .cuerpo-lado').getBoundingClientRect().height) }));
  revisar(zb.fuera.length === 0 && zb.cuerpo >= 150, `F01 zoom 200 %: ninguna acción de la barra queda fuera (la barra mide ${zb.barra} px) y el espacio conserva ${zb.cuerpo} px para su herramienta`);
  await recorrido('zoom 200 %');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
  await pausa(win, 500);

  // ---- r1, F02 (COD-20261109-001): con el circuito fuera de la vista, la barra dice qué se simula
  const barra = () => win.evaluate(() => { const b = $('estadoSimBarra') || document.createElement('i'); return { ve: b.offsetParent !== null, texto: b.textContent, vivo: b.getAttribute('role') === 'status',
    detener: $('btnDetenerBarra').offsetParent !== null, desactualizada: $('estadoSim').dataset.desactualizada, circuito: $('estadoSim').offsetParent !== null ? $('estadoSim').textContent : null }; });
  await win.locator('#herrIzq').selectOption('codigo');
  await win.locator('#herrDer').selectOption('circuito');
  await win.evaluate(({ circuito, programa }) => { const p = proyectoActual(); p.circuito = circuito; p.texto = programa; cargarProyecto(p, true); }, { circuito: X, programa: PROGRAMA_X });
  await pausa(win, 500);
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300), 'F02: simula el ejercicio X con C++ | Circuito');
  let b = await barra();
  revisar(!b.ve && !b.detener && /^Simulando/.test(b.circuito), `F02: con el circuito a la vista, su estado está en el circuito y la barra no lo repite («${b.circuito}»)`);
  c0 = await corrida(win);
  await win.locator('#herrDer').selectOption('monitor');
  await pausa(win, 700);
  b = await barra();
  revisar(b.ve && b.vivo && b.detener && b.texto === 'Simulando', `F02: con el circuito sustituido, la barra dice «${b.texto}» junto a «Detener», como aviso accesible`);
  await win.evaluate(() => { $('editor').value += '// cambio sin simular\n'; $('editor').dispatchEvent(new Event('input')); });
  await pausa(win, 1200);
  b = await barra();
  revisar(b.ve && /anterior/.test(b.texto) && b.desactualizada === 'true', `F02: editar el C++ sin volver a simular: la barra dice «${b.texto}»`);
  await win.screenshot({ path: path.join(SALIDA, 'paneles_9_barra_anterior.png') });
  await contraste('F02, aviso en la barra, claro');
  await win.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await pausa(win, 200);
  await contraste('F02, aviso en la barra, oscuro');
  await win.screenshot({ path: path.join(SALIDA, 'paneles_10_barra_anterior_oscuro.png') });
  await win.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await win.locator('#herrDer').selectOption('circuito');
  await pausa(win, 700);
  b = await barra();
  revisar(!b.ve && /cambiaste el programa/.test(b.circuito || ''), `F02: con el circuito de vuelta, su propio aviso se ve y la barra no lo repite («${b.circuito}»)`);
  await win.locator('#ampliarIzq').click();
  await pausa(win, 700);
  b = await barra();
  revisar(b.ve && /anterior/.test(b.texto) && b.detener, `F02: con el C++ ampliado, la barra conserva «${b.texto}» y «Detener»`);
  c1 = await corrida(win);
  revisar(c1.id === c0.id && c1.ms > c0.ms && c1.iniciadas === c0.iniciadas, `F02: mover el circuito no reinicia la simulación (${Math.round(c0.ms)} → ${Math.round(c1.ms)} ms, sin otro simulacion_iniciada)`);
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300 && codigoActual() === simulador.codigo), 'F02: «Simular» de la barra vuelve a simular con el C++ nuevo');
  await pausa(win, 700);
  b = await barra();
  c2 = await corrida(win);
  revisar(b.ve && b.texto === 'Simulando' && b.desactualizada === 'false' && c2.iniciadas === c0.iniciadas + 1 && (await disp(win)).ampliado === 'izq',
    `F02: después de simular de nuevo, la barra dice «${b.texto}», hay una sola corrida nueva y el C++ sigue ampliado`);
  await win.locator('#btnDetenerBarra').click();
  await pausa(win, 500);
  b = await barra();
  revisar(!b.ve && !b.detener, 'F02: al detener, el estado y «Detener» se van de la barra');
  await win.locator('#ampliarIzq').click();
  await pausa(win, 300);
  // Con bloques: editar un número sin volver a simular
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => !e.texto && e.placa === 'uno' && /math_number/.test(e.xml || ''))));
  await pausa(win, 800);
  await win.locator('#herrIzq').selectOption('bloques');
  await pausa(win, 300);
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300), 'F02: simula un ejemplo de bloques');
  await win.locator('#herrDer').selectOption('monitor');
  await pausa(win, 500);
  const cambioBloque = await win.evaluate(() => { const n = espacio.getAllBlocks(false).find((x) => x.type === 'math_number'); if (!n) return false; n.setFieldValue(String(Number(n.getFieldValue('NUM')) + 1), 'NUM'); return true; });
  await pausa(win, 1500);
  b = await barra();
  revisar(cambioBloque && b.ve && /anterior/.test(b.texto), `F02: editar un bloque sin volver a simular: la barra dice «${b.texto}»`);
  await win.locator('#btnDetenerBarra').click();
  await pausa(win, 300);

  // ---- r1, DISENO en los controles nuevos de A: un h1 (solo A), presión de los botones y hover solo con ratón
  const dis = await win.evaluate(() => {
    const reglas = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch (e) { return []; } });
    const texto = (r) => r.cssText + (r.cssRules ? [...r.cssRules].map((x) => x.cssText).join(' ') : '');
    return { h1: [...document.querySelectorAll('h1')].map((h) => h.textContent),
      presion: reglas.some((r) => /cabeza-lado/.test(texto(r)) && /:active/.test(texto(r)) && /scale\(0?\.97\)/.test(texto(r))),
      hover: reglas.some((r) => /hover: hover/.test(r.conditionText || r.media && r.media.mediaText || '') && /cabeza-lado/.test(texto(r))),
      transicion: getComputedStyle($('intercambiarIzq')).transitionProperty };
  });
  revisar(dis.h1.length === 1 && dis.presion && dis.hover && /transform/.test(dis.transicion), `DISENO en A: un h1 («${dis.h1.join(' | ')}»), presión scale(.97) y hover solo con puntero fino (${JSON.stringify(dis)})`);

  // ---- r2, F03 (COD-20261109-002): con «reducir movimiento», los botones nuevos de A no se encogen al presionarlos; sin él, sí.
  // Se presiona de verdad 180 ms y se lee el transform; se suelta fuera del botón, así no hace clic.
  async function presion(selector) {
    const b = await win.locator(selector).boundingBox();
    await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await win.mouse.down();
    await pausa(win, 180);
    const t = await win.evaluate((s) => getComputedStyle(document.querySelector(s)).transform, selector);
    await win.mouse.move(2, 2);
    await win.mouse.up();
    return t;
  }
  const ESCALA = 'matrix(0.97, 0, 0, 0.97, 0, 0)';
  await win.locator('#herrDer').selectOption('');
  await pausa(win, 300);
  const botonesA = ['#intercambiarIzq', '#ampliarIzq', '#ladoDer .lado-vacio button[data-herr="codigo"]'];
  for (const [modo, espera] of [['no-preference', ESCALA], ['reduce', 'none']]) {
    await win.emulateMedia({ reducedMotion: modo });
    await pausa(win, 300);
    const t = [];
    for (const s of botonesA) t.push(await presion(s));
    revisar(t.every((x) => x === espera), `F03, «reducir movimiento» ${modo === 'reduce' ? 'activo' : 'apagado'}: presionar Intercambiar, Ampliar y un botón del espacio vacío da ${espera === 'none' ? 'ninguna escala' : 'scale(.97)'} (${JSON.stringify(t)})`);
  }
  // «Detener» de la barra: simular con el circuito fuera de la vista (D2 lo trae al espacio vacío; luego se amplían los bloques)
  await win.emulateMedia({ reducedMotion: null });
  await win.locator('#btnSimularBarra').click();
  await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 200);
  await win.locator('#ampliarIzq').click();
  await pausa(win, 600);
  for (const [modo, espera] of [['no-preference', ESCALA], ['reduce', 'none']]) {
    await win.emulateMedia({ reducedMotion: modo });
    await pausa(win, 300);
    const t = await presion('#btnDetenerBarra');
    revisar(t === espera && await win.evaluate(() => !!simulador.sim), `F03, «reducir movimiento» ${modo === 'reduce' ? 'activo' : 'apagado'}: presionar «Detener» de la barra da ${espera === 'none' ? 'ninguna escala' : 'scale(.97)'} (${t}) y, soltado fuera, no detiene`);
  }
  await win.emulateMedia({ reducedMotion: null });
  await win.evaluate(() => detenerSimulacion());
  await win.locator('#ampliarIzq').click();
  await pausa(win, 300);

  // ---- Cambiar de variante con la app abierta: A → C0 → A (lo que hace el panel del instructor)
  await win.locator('#herrIzq').selectOption('bloques');
  await win.locator('#herrDer').selectOption('circuito');
  const vistaC0 = await win.evaluate(() => { aplicarVariante('C0'); return { vista: $('principal').dataset.vista, lados: document.querySelectorAll('.lado').length, h1: document.querySelectorAll('h1').length, barra: !$('estadoSimBarra') || $('estadoSimBarra').offsetParent === null,
    vistas: $('vistas').offsetParent !== null, bloques: $('zonaBloques').parentNode === $('principal'), panel: ['pCodigo', 'pSerial', 'pCircuito'].every((id) => $(id).parentNode === $('panel')),
    roles: ['pCodigo', 'pSerial', 'pCircuito'].every((id) => $(id).getAttribute('role') === 'tabpanel'), detener: $('btnDetenerBarra').offsetParent === null, divisor: $('divisor').getAttribute('aria-label') }; });
  revisar(vistaC0.vista === vistaC0Antes && vistaC0.lados === 0 && vistaC0.h1 === 0 && vistaC0.barra && vistaC0.vistas && vistaC0.bloques && vistaC0.panel && vistaC0.roles && vistaC0.detener && vistaC0.divisor === 'Tamaño del panel',
    `E10: volver a C0 deja la interfaz de siempre, con su vista «${vistaC0.vista}» (${JSON.stringify(vistaC0)})`);
  await win.screenshot({ path: path.join(SALIDA, 'paneles_6_vuelta_c0.png') });
  await win.evaluate(() => aplicarVariante('A'));
  await pausa(win, 400);
  const vuelta = await disp(win);
  revisar(vuelta.izq === 'bloques' && vuelta.der === 'circuito' && (await donde(win)).bloques.ve, 'volver a A recupera su disposición');
  await app.close();
  await new Promise((r) => setTimeout(r, 400));

  // ---- Una disposición guardada dañada no rompe A: vuelve a los espacios vacíos
  ({ app, win } = await abrir());
  await win.evaluate(() => { guardarLocal(CLAVE_PREF, Object.assign(leerLocal(CLAVE_PREF) || {}, { disposicionA: { izq: 'circuito', der: 'circuito', proporcion: 7, ampliado: 'der' } })); });
  await app.close();
  await new Promise((r) => setTimeout(r, 400));
  ({ app, win } = await abrir());
  const sana = await disp(win);
  revisar(sana.izq === 'circuito' && sana.der === null && sana.ampliado === null && sana.proporcion === 0.5, `una disposición guardada dañada se limpia: ${JSON.stringify(sana)}`);
  await app.close();
  await new Promise((r) => setTimeout(r, 400));

  // ---- C0 sigue igual: sin estudio no hay espacios ni «Detener» en la barra
  ponerVariante('C0');
  ({ app, win } = await abrir());
  const c0Final = await win.evaluate(() => ({ activo: panelesA.activo(), lados: document.querySelectorAll('.lado, #almacenA').length, vistas: $('vistas').offsetParent !== null, vista: $('principal').dataset.vista }));
  revisar(!c0Final.activo && c0Final.lados === 0 && c0Final.vistas && c0Final.vista === vistaC0Antes, `en C0 no aparece nada de A y vuelve la vista «${c0Final.vista}»`);
  await app.close();

  revisar(errores.length === 0, `sin errores en la página${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(`\n${fallos ? fallos + ' FALLAS' : 'Todo bien'} · capturas en test/salida/paneles_*.png`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
