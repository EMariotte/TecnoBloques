// Prueba de punta a punta del panel de misiones (EST-003; diseño y ejemplos E1–E11 en
// TecnoSuite/EstrategíaTecno/DISENO-MISIONES.md). Con la variante A o B, la tarea del estudio abre su misión en una
// columna a la derecha, la misma en las dos variantes; en C0 no hay panel. Comprueba los pasos, lo obligatorio, que las
// predicciones quedan fijas, los eventos mision_* en el registro (contra contrato/evento.schema.json de TecnoCircuito),
// volver donde iba al reabrir, la misión de cada equipo, el plegado, el teclado, el contraste, el zoom y «reducir movimiento».
// La r1 (COD-20261111-001) suma F01 («tras simular» desde que la simulación arranca, no desde el clic), F02 (un número
// que se vuelve Infinity no pasa) y F03 (el resumen muestra el texto tal cual).
// EST-004 suma «Descargar respuestas» (E1–E8 de DISENO-RESPUESTAS-JSON.md), y su r1 (COD-20261111-006): F01, cada paso y
// cada respuesta dicen su sesión del registro, también tras reabrir, retomar o alternar equipos; F02, simular después de
// terminar no cambia la entrega; F03, el aviso del equipo no tapa el botón a 1366 px con zoom al 200 %.
// Uso: npm run test:misiones   (arma con --simulador-local)
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(__dirname, 'salida');
const REVISOR = path.join(RAIZ, '..', 'TecnoCircuito', 'prototipo', 'pruebas', 'contrato_eventos.js');
fs.mkdirSync(SALIDA, { recursive: true });
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}

(async () => {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')), TB_HERRAMIENTAS: 'instructor' };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-misiones-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  fs.mkdirSync(datos, { recursive: true });
  fs.writeFileSync(path.join(datos, 'estudio-config.json'), JSON.stringify({ formato: 1, variante: 'B' }));
  const registros = path.join(datos, 'registros');
  const leerRegistro = () => (fs.existsSync(registros) ? fs.readdirSync(registros).filter((f) => f.endsWith('.jsonl')) : [])
    .flatMap((f) => fs.readFileSync(path.join(registros, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
  const deMision = () => leerRegistro().filter((l) => /^mision_/.test(l.tipo));
  const errores = [];
  const pausa = (win, ms) => win.waitForTimeout(ms);
  const esperar = (win, condicion, ms = 40000) => win.waitForFunction(condicion, null, { timeout: ms, polling: 200 }).then(() => true, () => false);
  async function tamano(app, win, ancho, alto) {
    await app.evaluate(({ BrowserWindow }, [w, h]) => { const v = BrowserWindow.getAllWindows()[0]; v.unmaximize(); v.setContentSize(w, h); }, [ancho, alto]);
    await pausa(win, 500);
  }
  async function abrir() {
    const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], cwd: RAIZ, env });
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await win.waitForLoadState('load');
    await tamano(app, win, 1536, 864);
    await pausa(win, 1500);
    return { app, win };
  }
  // El equipo confirma su código, como en el registro de siempre (cierra el pedido del código si estaba abierto)
  const serEquipo = (win, codigo) => win.evaluate(async (c) => {
    if (!$('modal').hidden) cerrarModal(false);
    confirmarEquipo(c);
    document.querySelector('#modalAcciones .primario').click();
    await cambioDeEquipo;
    await new Promise((r) => setTimeout(r, 300));
  }, codigo);
  async function abrirTarea(win, nombre) {
    await win.locator('#btnEjemplos').click();
    await pausa(win, 200);
    await win.locator('#listaEjemplos button', { hasText: nombre }).click();
    await pausa(win, 300);
    await win.locator('#modalAcciones button', { hasText: 'Abrir ejemplo' }).click();
    await pausa(win, 900);
  }
  const panel = (win) => win.evaluate(() => {
    const a = $('misiones');
    if (!a) return null;
    const r = a.getBoundingClientRect(), t = $('misionTitulo'), av = $('misionAvance'), h3 = $('misionPasoTitulo');
    return { caja: [r.x, r.y, r.width, r.height].map(Math.round), titulo: t ? t.textContent : null, avance: av ? av.textContent : null,
      paso: h3 ? h3.textContent : null, hechos: $('misionCuerpo').querySelector('.mision-hechos') ? $('misionCuerpo').querySelector('.mision-hechos').textContent : '',
      foco: document.activeElement ? document.activeElement.id : null, plegada: a.classList.contains('plegada') };
  });
  const seguir = (win) => win.locator('#misionSeguir').click().then(() => pausa(win, 250));

  // ---- Preparación: el registro encendido (PIN del instructor) y el equipo A7
  let { app, win } = await abrir();
  await win.evaluate(async () => {
    await escritorio.registro.instructor({ accion: 'crear-pin', pin: '2468' });
    const r = await escritorio.registro.instructor({ accion: 'activar', pin: '2468', activo: true });
    registroEncendido = !!r.activo;
  });
  await serEquipo(win, 'A7');
  revisar(await win.evaluate(() => registroEventos.equipo()) === 'A7', 'preparación: el registro está encendido y trabaja el equipo A7');

  // ---- Sin misión abierta: el panel conserva su marco y su título, con el siguiente paso (DISENO, estado vacío)
  let p = await panel(win);
  revisar(p && p.titulo === 'Ninguna misión abierta', `estado vacío: «${p && p.titulo}», con la frase para abrir la tarea`);

  // ---- E1 (B). Abrir X1: su misión a la derecha, en el paso 1
  await abrirTarea(win, 'X1 · Luces en secuencia');
  p = await panel(win);
  const cajaB = p.caja;
  revisar(p.titulo === 'X1 · Luces en secuencia' && p.avance === 'Paso 1 de 5' && p.paso === 'Predecir', `E1: en B, la misión de X1 en el paso 1 (${p.avance}, «${p.paso}»)`);
  const lugar = await win.evaluate(() => {
    const a = $('misiones').getBoundingClientRect(), f = $('franjaActividad').getBoundingClientRect(), pr = $('principal').getBoundingClientRect(), b = document.querySelector('.barra').getBoundingClientRect();
    return { aLaDerecha: Math.abs(a.right - innerWidth) < 1, bajoLaBarra: Math.abs(a.top - b.bottom) < 1, franjaAlLado: f.right <= a.left + 0.5, espaciosAlLado: pr.right <= a.left + 0.5, ancho: Math.round(a.width) };
  });
  revisar(Object.values(lugar).every((v) => v === true || v === 300), `E1: en B, una columna de 300 px a la derecha, bajo la barra; la franja y los espacios a su lado (${JSON.stringify(lugar)})`);
  await win.screenshot({ path: path.join(SALIDA, 'misiones_1_paso1.png') });

  // ---- E5. Lo obligatorio: sin responder no se sigue, y cada campo dice qué falta
  await seguir(win);
  let f = await win.evaluate(() => ['mision0q0', 'mision0q1'].map((id) => {
    const c = $(id), notas = (c.getAttribute('aria-describedby') || '').split(' ').map((x) => $(x)).filter(Boolean);
    return { invalido: c.getAttribute('aria-invalid') === 'true', nota: notas.map((n) => n.textContent).join(' ') };
  }));
  p = await panel(win);
  revisar(p.avance === 'Paso 1 de 5' && f.every((x) => x.invalido && /Escribe un número/.test(x.nota)) && p.foco === 'mision0q0' && await win.evaluate(() => $('misionAviso').textContent === 'Faltan 2 respuestas.'),
    `E5: sin respuestas sigue en el paso 1; los dos campos dicen qué falta por aria-describedby y el foco va al primero (${JSON.stringify(f)})`);
  await win.fill('#mision0q0', 'once');
  await win.fill('#mision0q1', '3');
  await seguir(win);
  f = await win.evaluate(() => $('mision0q0Error').textContent);
  revisar((await panel(win)).avance === 'Paso 1 de 5' && /solo un número/.test(f), `E5: un número mal escrito no pasa («${f}»)`);

  // ---- E3. Responder y seguir: lo predicho queda fijo y va al registro antes de simular
  await win.fill('#mision0q0', '11');
  await win.fill('#mision0q1', '3');
  await seguir(win);
  p = await panel(win);
  revisar(p.avance === 'Paso 2 de 5' && p.paso === 'Simular' && /11/.test(p.hechos) && /3 s/.test(p.hechos) && p.foco === 'misionPasoTitulo',
    `E3: pasa al paso 2; el paso 1 queda cerrado con lo predicho («${p.hechos.trim()}») y el foco va al título del paso`);
  revisar(await win.evaluate(() => !$('mision0q0')), 'E3 (D4): lo predicho ya no se puede cambiar: el campo no existe');
  let ev = deMision();
  const resp = (pregunta) => ev.find((l) => l.tipo === 'mision_respuesta' && l.datos.pregunta === pregunta);
  revisar(ev.some((l) => l.tipo === 'mision_abierta' && l.datos.id === 'estudio_x1') && resp('primero') && resp('primero').datos.valor === 11
    && resp('primero').datos.tras_simular === false && resp('duracion').datos.valor === 3 && ev.some((l) => l.tipo === 'mision_paso' && l.datos.paso === 1),
    `E3: el registro tiene mision_abierta, las dos respuestas (11 y 3, tras_simular: false) y mision_paso 1 (${ev.map((l) => l.tipo).join(', ')})`);

  // ---- E4. Simular (no se bloquea, D3) y responder: la respuesta llega «tras simular»
  await win.locator('#btnSimularBarra').click();
  await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 300);
  await win.locator('#mision1q0o0').check();
  await seguir(win);
  ev = deMision();
  revisar(resp('acierto') && resp('acierto').datos.valor === 'si' && resp('acierto').datos.tras_simular === true, 'E4: después de simular, «¿Acertaste?» va al registro con tras_simular: true');
  await win.evaluate(() => detenerSimulacion());
  // Los pasos sin pregunta se cierran con «Listo»
  revisar(await win.evaluate(() => $('misionSeguir').textContent) === 'Listo', 'organizar la pantalla: un paso sin preguntas se cierra con «Listo»');
  await seguir(win);
  await seguir(win);
  p = await panel(win);
  revisar(p.avance === 'Paso 5 de 5' && await win.evaluate(() => $('misionSeguir').textContent) === 'Terminar misión', `el último paso se cierra con «Terminar misión» (${p.avance})`);
  // El texto: hasta 200 caracteres (el campo no deja escribir más) y el aviso de no escribir nombres
  await win.fill('#mision4q0', '4');
  await win.fill('#mision4q1', 'Porque ahora son cuatro pasos de un segundo: añadí el del pin 12 al final. ' + 'ñ'.repeat(200));
  const texto = await win.evaluate(() => ({ largo: $('mision4q1').value.length, ayuda: $('mision4q1Ayuda').textContent }));
  revisar(texto.largo === 200 && /No escribas nombres/.test(texto.ayuda), `el texto se corta en 200 caracteres y el campo avisa «${texto.ayuda}»`);
  await win.locator('#mision4q2o1').check();
  await seguir(win);
  p = await panel(win);
  ev = deMision();
  const lineas = leerRegistro();
  const { revisarEvento } = require(REVISOR);
  const problemas = lineas.filter((l) => /^mision_/.test(l.tipo)).flatMap((l) => revisarEvento(l).map((x) => `${l.tipo}: ${x}`));
  revisar(p.avance === 'Misión terminada' && ev.some((l) => l.tipo === 'mision_terminada' && l.datos.id === 'estudio_x1') && resp('porque').datos.valor.length === 200
    && resp('dificultad').datos.valor === 2 && !resp('comentario'),
    `terminar: «${p.avance}»; mision_terminada, el texto de 200 caracteres, la dificultad 2 y sin comentario (era opcional)`);
  revisar(!problemas.length, `las ${ev.length} líneas mision_* cumplen contrato/evento.schema.json${problemas.length ? ': ' + problemas.slice(0, 3).join(' | ') : ''}`);

  // ---- E1 (A). La misma columna, del mismo tamaño, en A
  await win.evaluate(() => aplicarVariante('A'));
  await pausa(win, 500);
  await abrirTarea(win, 'X1 · Luces en secuencia');
  p = await panel(win);
  revisar(JSON.stringify(p.caja) === JSON.stringify(cajaB) && p.titulo === 'X1 · Luces en secuencia' && p.avance === 'Misión terminada',
    `E1: en A, el mismo panel en el mismo lugar (${p.caja} = ${cajaB}); X1 sigue terminada`);
  await win.evaluate(() => aplicarVariante('B'));
  await pausa(win, 500);

  // ---- E6. A mitad de Y1, cerrar la app y abrirla: vuelve en el mismo paso
  await abrirTarea(win, 'Y1 · Semáforo');
  await win.fill('#mision0q0', '11');
  await win.fill('#mision0q1', '5');
  await seguir(win);
  await app.close();
  await new Promise((r) => setTimeout(r, 500));
  ({ app, win } = await abrir());
  await esperar(win, () => !$('modal').hidden, 8000); // al abrir, la app pide el código del equipo
  await serEquipo(win, 'A7');
  p = await panel(win);
  revisar(p.titulo === 'Y1 · Semáforo' && p.avance === 'Paso 2 de 5' && /5 s/.test(p.hechos), `E6: al abrir otra vez, Y1 vuelve en el paso 2 con lo respondido («${p.hechos.trim()}»)`);

  // ---- E7. Otro equipo ve su misión, no la de A7; al volver A7, la suya
  await serEquipo(win, 'B9');
  p = await panel(win);
  revisar(p.titulo === 'Ninguna misión abierta', `E7: el equipo B9 no ve la misión de A7 («${p.titulo}»)`);
  await serEquipo(win, 'A7');
  p = await panel(win);
  revisar(p.titulo === 'Y1 · Semáforo' && p.avance === 'Paso 2 de 5', 'E7: de vuelta A7, su Y1 en el paso 2');

  // ---- Lo guardado no se cree: basura en las preferencias no rompe el panel ni inventa misiones
  for (const basura of [null, 'x', [], { equipos: { 'e:A7': { actual: 'constructor', misiones: { constructor: { paso: 1 }, estudio_x1: { paso: 99, respuestas: { primero: 'once', duracion: [3] } } } } } }]) {
    await win.evaluate((b) => { guardarPreferencias({ misiones: b }); misiones.aplicar('C0'); misiones.aplicar('B'); }, basura);
    p = await panel(win);
    revisar(p && p.titulo === 'Ninguna misión abierta', `lo guardado roto (${JSON.stringify(basura).slice(0, 60)}) deja el panel vacío, sin error`);
  }
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => e.id === 'estudio_x1')));
  await pausa(win, 600);
  p = await panel(win);
  revisar(p.avance === 'Paso 1 de 5' && !p.hechos, `con lo guardado roto, X1 empieza de nuevo en el paso 1, sin respuestas inventadas (${p.avance})`);

  // ---- E8. Plegar: una pestaña de 44 px; los espacios ganan el ancho; sigue plegada al pasar a A
  const anchoAntes = await win.evaluate(() => Math.round($('principal').getBoundingClientRect().width));
  await win.locator('#plegarMision').click();
  await pausa(win, 500);
  let pl = await win.evaluate(() => ({ ancho: Math.round($('misiones').getBoundingClientRect().width), principal: Math.round($('principal').getBoundingClientRect().width),
    oculto: $('misionCuerpo').hidden, expandido: $('plegarMision').getAttribute('aria-expanded'), texto: $('plegarMision').textContent }));
  revisar(pl.ancho === 44 && pl.principal > anchoAntes + 200 && pl.oculto && pl.expandido === 'false' && pl.texto === 'Misión', `E8: plegada mide 44 px y los espacios crecen de ${anchoAntes} a ${pl.principal} px (${JSON.stringify(pl)})`);
  await win.evaluate(() => aplicarVariante('A'));
  await pausa(win, 500);
  pl = await win.evaluate(() => ({ ancho: Math.round($('misiones').getBoundingClientRect().width), plegada: $('misiones').classList.contains('plegada') }));
  revisar(pl.ancho === 44 && pl.plegada, 'E8: al pasar a A sigue plegada');
  await win.locator('#plegarMision').click();
  await pausa(win, 400);
  revisar(await win.evaluate(() => Math.round($('misiones').getBoundingClientRect().width)) === 300 && await win.evaluate(() => document.activeElement.id) === 'plegarMision',
    'E8: desplegar vuelve a 300 px y el foco sigue en el botón');
  await win.evaluate(() => aplicarVariante('B'));
  await pausa(win, 400);

  // ---- E9. 1366 × 768: teclado, foco visible, contraste y nada fuera de la ventana; zoom al 200 %
  async function revisarPanel(etiqueta) {
    // Con Tab desde el último control de los espacios se llega a los del panel, en orden y con el foco visible
    const ids = await win.evaluate(() => [...$('misiones').querySelectorAll('button, input, textarea')].filter((n) => n.offsetParent !== null).map((n) => n.id));
    await win.evaluate(() => $('btnAcerca').focus());
    const vistos = [];
    for (let i = 0; i < 70 && vistos.filter((v) => ids.includes(v.id)).length < ids.length; i++) {
      await win.keyboard.press('Tab');
      vistos.push(await win.evaluate(() => {
        const a = document.activeElement, cs = getComputedStyle(a), r = a.getBoundingClientRect();
        return { id: a.id, foco: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) * devicePixelRatio >= 2, dentro: r.left >= 0 && r.right <= innerWidth + 0.5 };
      }));
    }
    const delPanel = vistos.filter((v) => ids.includes(v.id));
    revisar(ids.every((id) => delPanel.some((v) => v.id === id)) && delPanel.every((v) => v.foco && v.dentro),
      `E9 ${etiqueta}: con Tab se llega a los ${ids.length} controles del panel, con el foco visible y dentro de la ventana`);
    const c = await win.evaluate(() => {
      const rgb = (x) => (x.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const lum = (x) => { const [r, g, b] = rgb(x).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const fondo = (n) => { for (let x = n; x; x = x.parentElement) { const k = getComputedStyle(x).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(k)) return k; } return 'rgb(255,255,255)'; };
      const razon = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const textos = [...$('misiones').querySelectorAll('h2, h3, p, label, legend, span, strong, b, button')].filter((n) => n.offsetParent !== null && n.textContent.trim() && [...n.childNodes].some((k) => k.nodeType === 3 && k.textContent.trim()));
      const bordes = [...$('misiones').querySelectorAll('input[type="text"], textarea, .mision-accion')].filter((n) => n.offsetParent !== null).map((n) => razon(getComputedStyle(n).borderTopColor, fondo(n.parentElement)));
      return { texto: Math.min(...textos.map((n) => razon(getComputedStyle(n).color, fondo(n)))), n: textos.length, borde: bordes.length ? Math.min(...bordes) : 99, nb: bordes.length };
    });
    revisar(c.n >= 4 && c.texto >= 4.5 && c.borde >= 3, `E9 ${etiqueta}: contraste de ${c.n} textos ≥ 4,5:1 (mínimo ${c.texto.toFixed(2)}) y de ${c.nb} bordes de controles ≥ 3:1 (mínimo ${c.borde.toFixed(2)})`);
  }
  await revisarPanel('1536 × 864, claro');
  await win.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await pausa(win, 200);
  await revisarPanel('1536 × 864, oscuro');
  await win.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await tamano(app, win, 1366, 768);
  await revisarPanel('1366 × 768');
  const espacios = await win.evaluate(() => ['ladoIzq', 'ladoDer'].map((id) => Math.round($(id).getBoundingClientRect().width)));
  revisar(espacios.every((w) => w >= 320), `E9 1366 × 768: con el panel, los dos espacios siguen con 320 px o más (${espacios.join(' y ')} px)`);
  await win.screenshot({ path: path.join(SALIDA, 'misiones_2_1366.png') });
  await tamano(app, win, 1536, 864);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2));
  await pausa(win, 800);
  // Con zoom al 200 % la ventana mide 768 px: el panel se pliega y los espacios conservan sus 320 px o más
  const zoom = () => win.evaluate(() => {
    const a = $('misiones'), r = a.getBoundingClientRect();
    return { ancho: Math.round(r.width), plegada: a.classList.contains('plegada'), flotante: a.classList.contains('flotante'), ventana: innerWidth,
      espacios: ['ladoIzq', 'ladoDer'].map((id) => Math.round($(id).getBoundingClientRect().width)), pref: (leerLocal(CLAVE_PREF) || {}).misiones.plegada,
      fuera: [...a.querySelectorAll('button, input, textarea')].filter((n) => n.offsetParent !== null).filter((n) => { const q = n.getBoundingClientRect(); return q.right > innerWidth + 0.5 || q.left < r.left - 0.5; }).map((n) => n.id),
      encima: (() => { const b = $('misionSeguir'); if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return e === b || b.contains(e); })() };
  });
  let z = await zoom();
  revisar(z.ventana <= 960 && z.plegada && z.ancho === 44 && z.espacios.every((w) => w >= 320), `E9 zoom 200 % (${z.ventana} px): el panel se pliega y los espacios conservan su ancho (${z.espacios.join(' y ')} px)`);
  const espaciosPlegado = z.espacios;
  await win.locator('#plegarMision').click();
  await pausa(win, 500);
  z = await zoom();
  revisar(!z.plegada && z.flotante && z.ancho === 300 && JSON.stringify(z.espacios) === JSON.stringify(espaciosPlegado) && z.fuera.length === 0 && z.encima === true && z.pref === false,
    `E9 zoom 200 %: desplegado, el panel flota encima (300 px), los espacios no cambian, sus controles se ven y responden, y la preferencia no cambia (${JSON.stringify(z)})`);
  await win.locator('#mision0q0').focus();
  await win.keyboard.press('Escape');
  await pausa(win, 300);
  z = await zoom();
  revisar(z.plegada && await win.evaluate(() => document.activeElement.id) === 'plegarMision', 'E9 zoom 200 %: Escape lo pliega y el foco vuelve al botón');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
  await pausa(win, 400);

  // ---- E10. «Reducir movimiento»: presionar un botón del panel no lo escala (sin la reducción, sí)
  for (const [modo, espera] of [['no-preference', 'matrix(0.97, 0, 0, 0.97, 0, 0)'], ['reduce', 'none']]) {
    await win.emulateMedia({ reducedMotion: modo });
    await pausa(win, 300);
    const b = await win.locator('#plegarMision').boundingBox();
    let t = null, intentos = 0;
    while (intentos < (modo === 'reduce' ? 1 : 3) && t !== espera) {
      intentos++;
      await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await win.mouse.down();
      if (modo === 'reduce') await pausa(win, 400);
      else await win.waitForFunction((e) => getComputedStyle($('plegarMision')).transform === e, espera, { timeout: 600, polling: 50 }).catch(() => {});
      t = await win.evaluate(() => getComputedStyle($('plegarMision')).transform);
      await win.mouse.move(2, 2);
      await win.mouse.up();
    }
    revisar(t === espera, `E10: presionar «Plegar» con «reducir movimiento» ${modo === 'reduce' ? 'activo' : 'apagado'} da ${t} (intentos: ${intentos})`);
  }
  await win.emulateMedia({ reducedMotion: null });

  // ---- r1, F01 (COD-20261111-001): «tras simular» cuenta desde que la simulación arranca de verdad, no desde el clic.
  // Cada caso, con un equipo nuevo, así su X1 empieza sin haber simulado.
  const ERRONEO = 'void setup() { ERROR_SINTETICO; }\nvoid loop() {}';
  const respuestasDesde = (n) => deMision().slice(n).filter((l) => l.tipo === 'mision_respuesta');
  const predecir = async () => { await win.fill('#mision0q0', '11'); await win.fill('#mision0q1', '3'); await seguir(win); };
  const simularBarra = () => win.locator('#btnSimularBarra').click();
  const arranco = () => esperar(win, () => !!simulador.sim && simulador.sim.medidas().msSimulados > 300);
  const preparado = () => esperar(win, () => !simulador.compilando, 60000);
  const fallaCompilando = async () => {
    const ok = await esperar(win, () => !simulador.compilando && !$('modal').hidden, 60000);
    const sin = await win.evaluate(() => !simulador.sim);
    await win.evaluate(() => cerrarModal(false));
    await pausa(win, 200);
    return ok && sin;
  };
  async function nuevaX1(equipo) {
    await serEquipo(win, equipo);
    await abrirTarea(win, 'X1 · Luces en secuencia');
    return deMision().length;
  }
  const todasFalsas = (r) => r.length === 2 && r.every((l) => l.datos.tras_simular === false);
  const todasCiertas = (r) => r.length === 2 && r.every((l) => l.datos.tras_simular === true);
  const vistas = (r) => JSON.stringify(r.map((l) => [l.datos.pregunta, l.datos.tras_simular]));

  // 1. Simular con un error del compilador real: no hubo simulación, la predicción no es «tras simular»
  let n = await nuevaX1('F1');
  await win.evaluate((c) => entrarModoTexto(c, ''), ERRONEO);
  await simularBarra();
  const fallo1 = await fallaCompilando();
  await predecir();
  let r = respuestasDesde(n);
  revisar(fallo1 && todasFalsas(r), `F01: tras un error de compilación, sin simulación, la predicción va con tras_simular: false (${vistas(r)})`);
  await win.evaluate(() => salirModoTexto(true));

  // 2. Responder mientras se prepara: la simulación todavía no arrancó
  n = await nuevaX1('F2');
  await simularBarra();
  const preparando = await win.evaluate(() => {
    const c = simulador.compilando && !simulador.sim;
    $('mision0q0').value = '11'; $('mision0q1').value = '3';
    $('misionForm').requestSubmit();
    return c;
  });
  const arranco2 = await arranco();
  r = respuestasDesde(n);
  await win.locator('#mision1q0o0').check();
  await seguir(win);
  const despues2 = respuestasDesde(n).filter((l) => l.datos.pregunta === 'acierto');
  revisar(preparando && todasFalsas(r) && arranco2 && despues2.length === 1 && despues2[0].datos.tras_simular === true,
    `F01: respondida mientras se preparaba, la predicción va con false; la del paso 2, ya simulando, con true (preparando: ${preparando}, ${vistas(r)}, ${vistas(despues2)})`);
  await win.evaluate(() => detenerSimulacion());

  // 3. Detener mientras se prepara: no hubo simulación
  n = await nuevaX1('F3');
  await simularBarra();
  const detenida = await win.evaluate(() => { const c = simulador.compilando; detenerSimulacion(); return c; });
  await preparado();
  await pausa(win, 300);
  const sin3 = await win.evaluate(() => !simulador.sim);
  await predecir();
  r = respuestasDesde(n);
  revisar(detenida && sin3 && todasFalsas(r), `F01: detenida mientras se preparaba, la predicción va con false (${vistas(r)})`);

  // 4. Abrir otro proyecto (la misma tarea otra vez) mientras se prepara: esa simulación ya no vale
  n = await nuevaX1('F4');
  await simularBarra();
  const cambiada = await win.evaluate(() => { const c = simulador.compilando; cargarEjemplo(EJEMPLOS.find((e) => e.id === 'estudio_x1')); return c; });
  await preparado();
  await pausa(win, 600);
  const sin4 = await win.evaluate(() => !simulador.sim);
  await predecir();
  r = respuestasDesde(n);
  revisar(cambiada && sin4 && todasFalsas(r), `F01: con otro proyecto abierto mientras se preparaba, la predicción va con false (${vistas(r)})`);

  // 5. Simular bien antes de responder: la predicción sí es «tras simular»
  n = await nuevaX1('F5');
  await simularBarra();
  const arranco5 = await arranco();
  await win.evaluate(() => detenerSimulacion());
  await predecir();
  r = respuestasDesde(n);
  revisar(arranco5 && todasCiertas(r), `F01 (control): con una simulación que arrancó antes, la predicción va con true (${vistas(r)})`);

  // 6. Una simulación que arrancó y después un intento fallido: sigue siendo «tras simular»
  n = await nuevaX1('F6');
  await simularBarra();
  const arranco6 = await arranco();
  await win.evaluate(() => detenerSimulacion());
  await win.evaluate((c) => entrarModoTexto(c, ''), ERRONEO);
  await simularBarra();
  const fallo6 = await fallaCompilando();
  await predecir();
  r = respuestasDesde(n);
  revisar(arranco6 && fallo6 && todasCiertas(r), `F01: una simulación que arrancó y después un error de compilación: la predicción sigue con true (${vistas(r)})`);
  await win.evaluate(() => salirModoTexto(true));

  // ---- r1, F02: un número que no cabe (Infinity) no pasa, no se registra y el paso no avanza
  n = await nuevaX1('F7');
  await win.fill('#mision0q0', '9'.repeat(309));
  await win.fill('#mision0q1', '3');
  await seguir(win);
  const grande = await win.evaluate(() => {
    const c = $('mision0q0');
    return c ? { invalido: c.getAttribute('aria-invalid') === 'true', nota: $('mision0q0Error').textContent, foco: document.activeElement.id } : { avanzo: true };
  });
  p = await panel(win);
  const deMas = respuestasDesde(n);
  revisar(p.avance === 'Paso 1 de 5' && grande.invalido && grande.nota && grande.foco === 'mision0q0' && deMas.length === 0 && !deMision().slice(n).some((l) => l.tipo === 'mision_paso'),
    `F02: 309 nueves no pasan: sigue en el paso 1, el campo lo dice («${grande.nota || ''}») y no se registra nada (${p.avance}; ${JSON.stringify(deMas.map((l) => l.datos.valor))})`);
  // Los números que caben siguen pasando: negativos y con coma decimal, sin corregir la predicción
  const n2 = deMision().length;
  if (!grande.avanzo) {
    await win.fill('#mision0q0', '-2,5');
    await win.fill('#mision0q1', '1000000');
    await seguir(win);
  }
  r = respuestasDesde(n2);
  p = await panel(win);
  revisar(p.avance === 'Paso 2 de 5' && r.length === 2 && r[0].datos.valor === -2.5 && r[1].datos.valor === 1000000 && /-2,5/.test(p.hechos),
    `F02: -2,5 y 1000000 pasan tal cual (${JSON.stringify(r.map((l) => l.datos.valor))}; «${p.hechos.trim()}»)`);

  // ---- r1, F03: el resumen muestra el texto confirmado tal cual; la coma decimal es solo de los números
  await win.locator('#mision1q0o0').check();
  await seguir(win);
  await seguir(win); // organizar: «Listo»
  await seguir(win); // cambiar: «Listo»
  const EXPLICACION = 'Primera frase. Segunda frase. Son 4.5 s; ñandú «x» & <b>3.0</b>.';
  await win.fill('#mision4q0', '4,5');
  await win.fill('#mision4q1', EXPLICACION);
  await win.locator('#mision4q2o1').check();
  await seguir(win);
  const resumen = await win.evaluate(() => [...document.querySelectorAll('.mision-hechos .mision-dicho strong')].map((s) => s.textContent));
  r = respuestasDesde(n).filter((l) => l.datos.pregunta === 'porque');
  revisar(resumen.includes(EXPLICACION) && resumen.includes('4,5 s') && r.length === 1 && r[0].datos.valor === EXPLICACION && await win.evaluate(() => !document.querySelector('.mision-hechos b b, .mision-dicho strong b')),
    `F03: el resumen muestra la explicación tal cual y el número con coma (${JSON.stringify(resumen.slice(-3))})`);
  const problemasR1 = deMision().flatMap((l) => revisarEvento(l).map((x) => `${l.tipo}: ${x}`));
  revisar(!problemasR1.length, `r1: todas las líneas mision_* siguen cumpliendo el esquema${problemasR1.length ? ': ' + problemasR1.slice(0, 3).join(' | ') : ''}`);

  // ---- EST-004 (DISENO-RESPUESTAS-JSON.md, E1–E8): al terminar, «Descargar respuestas» guarda un JSON con lo respondido.
  // La descarga real abre el cuadro de guardar de Windows (la misma descargar() de «Descargar .ino»): aquí se reemplaza
  // por una que anota el nombre y el contenido, para leerlos.
  const { revisarRespuestas } = require(path.join(RAIZ, '..', 'TecnoCircuito', 'prototipo', 'pruebas', 'contrato_respuestas.js'));
  await win.evaluate(() => { window.__descargas = []; descargar = (nombre, contenido, tipo) => { window.__descargas.push({ nombre, contenido, tipo }); }; });
  const descargarAhora = () => win.evaluate(() => {
    const b = $('misionDescargar');
    if (!b) return null;
    window.__descargas = [];
    b.click();
    return window.__descargas.pop() || { vacio: true };
  });
  const botonDescargar = () => win.evaluate(() => { const b = $('misionDescargar'); return b ? b.textContent : null; });
  const leerArchivo = (d) => { try { return JSON.parse(d.contenido); } catch (e) { return null; } };
  // Cerrar X1 o Y1 de punta a punta; `simular` lo hace en el paso 2, antes de responder «¿Acertaste?»
  async function terminarMision({ simular = false, primero = '11', vuelta = '3', final = '4', porque = 'Ahora son cuatro pasos. Uno más.' } = {}) {
    const durante = [];
    durante.push(await botonDescargar());
    await win.fill('#mision0q0', primero); await win.fill('#mision0q1', vuelta); await seguir(win);
    durante.push(await botonDescargar());
    if (simular) { await simularBarra(); await arranco(); await win.evaluate(() => detenerSimulacion()); }
    await win.locator('#mision1q0o0').check(); await seguir(win);
    await seguir(win); await seguir(win); // organizar y cambiar: «Listo»
    durante.push(await botonDescargar());
    await win.fill('#mision4q0', final); await win.fill('#mision4q1', porque); await win.locator('#mision4q2o1').check();
    await seguir(win);
    return durante;
  }

  // E1: el botón aparece solo al terminar
  n = await nuevaX1('D1');
  const antesDeTerminar = await terminarMision({ simular: true });
  const rotulo = await botonDescargar();
  revisar(antesDeTerminar.every((x) => x === null) && rotulo === 'Descargar respuestas',
    `E1 (EST-004): «Descargar respuestas» no está durante los pasos (${JSON.stringify(antesDeTerminar)}) y aparece al terminar («${rotulo}»)`);
  // E2: el archivo cumple el esquema y dice lo mismo que el registro
  let bajada = await descargarAhora();
  let archivo = bajada && leerArchivo(bajada);
  // Por equipo y no por posición: el registro se lee archivo por archivo en orden alfabético, y el de D1 (nuevo) queda
  // antes que los de F1–F7, así que cortar por cantidad de líneas lo dejaría fuera
  const delRegistro = deMision().filter((l) => l.equipo === 'D1' && l.tipo === 'mision_respuesta');
  const enArchivo = archivo ? archivo.pasos.flatMap((q) => q.respuestas) : [];
  const malArchivo = archivo ? revisarRespuestas(archivo) : ['no hubo archivo'];
  const sesionD1 = await win.evaluate(() => registroEventos.sesion());
  revisar(!!archivo && !malArchivo.length, `E2 (EST-004): el archivo cumple respuestas.schema.json${malArchivo.length ? ': ' + malArchivo.slice(0, 3).join(' | ') : ''}`);
  const sesionesDe = (doc) => (doc && Array.isArray(doc.sesiones) ? doc.sesiones.length : -1);
  const listaDe = (doc) => (doc && Array.isArray(doc.sesiones) ? doc.sesiones : []);
  const todoEn = (doc, s) => doc.pasos.every((q) => q.sesion === s && q.respuestas.every((x) => x.sesion === s));
  revisar(!!archivo && archivo.equipo === 'D1' && !Object.hasOwn(archivo, 'sesion') && JSON.stringify(archivo.sesiones) === JSON.stringify([sesionD1]) && todoEn(archivo, sesionD1)
    && archivo.tarea.id === 'estudio_x1' && archivo.simulo === true && archivo.pasos.length === 5
    && JSON.stringify(archivo.pasos.map((q) => q.respuestas.map((x) => x.pregunta))) === JSON.stringify([['primero', 'duracion'], ['acierto'], [], [], ['duracion_nueva', 'porque', 'dificultad']])
    && archivo.abierta <= archivo.pasos[0].t && archivo.pasos[4].t <= archivo.terminada && archivo.pasos.every((q, i) => q.paso === i + 1 && Number.isInteger(q.t)),
    `E2 (EST-004): equipo, sus sesiones (la de cada paso y respuesta), tarea, los cinco pasos en orden con sus preguntas y sus horas (${archivo ? JSON.stringify(archivo.pasos.map((q) => q.respuestas.map((x) => x.pregunta))) : 'sin archivo'})`);
  const iguales = delRegistro.length === 6 && delRegistro.length === enArchivo.length && delRegistro.every((l) => {
    const x = enArchivo.find((y) => y.pregunta === l.datos.pregunta);
    return x && x.valor === l.datos.valor && x.tras_simular === l.datos.tras_simular && Math.abs(x.t - l.t) < 1000 && x.sesion === l.sesion;
  });
  revisar(iguales, `E2 (EST-004): las 6 respuestas, con el mismo valor, «tras simular», hora y sesión que su mision_respuesta del registro (registro: ${delRegistro.length}; archivo: ${enArchivo.map((x) => `${x.pregunta}:${x.tras_simular}`).join(', ')})`);
  const opcion = enArchivo.find((x) => x.pregunta === 'acierto'), numero = enArchivo.find((x) => x.pregunta === 'duracion');
  revisar(opcion && opcion.rotulo === 'Sí' && opcion.texto === '¿Acertaste?' && numero && numero.unidad === 's' && bajada.tipo === 'application/json',
    `E2 (EST-004): las opciones con su rótulo, los números con su unidad, el texto de cada pregunta y el tipo application/json (${bajada && bajada.tipo})`);
  // E3: el nombre del archivo
  const hoy = new Date(), dos = (v) => String(v).padStart(2, '0');
  const fecha = `${hoy.getFullYear()}${dos(hoy.getMonth() + 1)}${dos(hoy.getDate())}`;
  revisar(!!bajada && new RegExp(`^respuestas-D1-estudio_x1-${fecha}-\\d{4}\\.json$`).test(bajada.nombre), `E3 (EST-004): el nombre lleva el equipo, la tarea y la fecha (${bajada && bajada.nombre})`);
  await serEquipo(win, 'Ñandú 7/b');
  await abrirTarea(win, 'X1 · Luces en secuencia');
  await terminarMision();
  bajada = await descargarAhora();
  revisar(!!bajada && /^respuestas-Nandu_7_b-estudio_x1-\d{8}-\d{4}\.json$/.test(bajada.nombre) && leerArchivo(bajada).equipo === 'Ñandú 7/b',
    `E3 (EST-004): un código con tilde y barra se limpia en el nombre como en el registro y va tal cual adentro (${bajada && bajada.nombre})`);
  // E4 y E5: el archivo no dice la variante: en A sale igual que en B
  await serEquipo(win, 'D1');
  await abrirTarea(win, 'X1 · Luces en secuencia');
  const enB = await descargarAhora();
  await win.evaluate(() => aplicarVariante('A'));
  await pausa(win, 500);
  await abrirTarea(win, 'X1 · Luces en secuencia');
  const enA = await descargarAhora();
  const sinVariante = (d) => !!d && !/variante|"A"|"B"/.test(d.contenido);
  // Con la r1, ni la sesión cambia: el archivo dice las de las respuestas, no la del momento de descargar
  const mismoDoc = (a, b) => !!a && !!b && !!leerArchivo(a) && a.contenido === b.contenido;
  revisar(sinVariante(enB) && sinVariante(enA) && mismoDoc(enA, enB), 'E4/E5 (EST-004): el archivo no menciona la variante; descargado en A es idéntico al de B');
  await win.evaluate(() => aplicarVariante('B'));
  await pausa(win, 500);
  // E8: teclado, foco y contraste con la misión terminada
  await abrirTarea(win, 'X1 · Luces en secuencia');
  const bordeBoton = await win.evaluate(() => { const b = $('misionDescargar'); return b ? b.classList.contains('mision-accion') && !b.classList.contains('primario') : null; });
  revisar(bordeBoton === true, `E8 (EST-004): con la misión terminada está «Descargar respuestas», con el estilo de «Seguir» y no como botón principal (${bordeBoton})`);
  await revisarPanel('terminada, claro (EST-004)');
  await win.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await pausa(win, 200);
  await revisarPanel('terminada, oscuro (EST-004)');
  await win.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await tamano(app, win, 1366, 768);
  await revisarPanel('terminada, 1366 × 768 (EST-004)');
  await tamano(app, win, 1536, 864);

  // ---- r1 de EST-004, F03 (COD-20261111-006): el aviso del equipo (fijo abajo a la izquierda) no tapa «Descargar
  // respuestas». Con 1366 px y zoom al 200 % la ventana mide 684 px: el panel va al final de la página, bajo los espacios.
  // Se lleva el botón a la vista de tres formas (bajar hasta el final, scrollIntoView y el foco con el teclado) y en cada
  // una el centro debe ser el botón y su caja no debe cruzar la del aviso; al final, un clic de Playwright descarga.
  async function descargaLibre(etiqueta, conAviso) {
    // Entre 761 y 960 px el panel empieza plegado: se despliega, como lo haría el equipo
    if (await win.evaluate(() => $('misiones').classList.contains('plegada'))) { await win.locator('#plegarMision').click(); await pausa(win, 400); }
    const formas = [];
    for (const forma of ['final', 'scrollIntoView', 'foco']) {
      formas.push(await win.evaluate((f) => {
        const b = $('misionDescargar');
        if (!b) return { forma: f, sinBoton: true };
        // «final»: la página y el panel, cada uno hasta abajo (el panel tiene su propio desplazamiento en las ventanas anchas)
        const hasta = (fin) => { for (let x = b.parentElement; x; x = x.parentElement) x.scrollTop = fin ? x.scrollHeight : 0; const s = document.scrollingElement; s.scrollTop = fin ? s.scrollHeight : 0; };
        hasta(f === 'final');
        if (f === 'scrollIntoView') b.scrollIntoView({ block: 'end' });
        if (f === 'foco') { b.blur(); b.focus(); }
        const q = b.getBoundingClientRect(), a = $('avisoRegistro'), qa = a.hidden ? null : a.getBoundingClientRect();
        const centro = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        const cruza = !!qa && q.left < qa.right && qa.left < q.right && q.top < qa.bottom && qa.top < q.bottom;
        return { forma: f, centro: centro === b || b.contains(centro), cruza, visible: q.top >= 0 && q.bottom <= innerHeight + 0.5, aviso: !!qa,
          caja: [q.top, q.bottom].map((v) => Math.round(v * 10) / 10), avisoCaja: qa && [qa.top, qa.bottom].map((v) => Math.round(v * 10) / 10), alto: innerHeight };
      }, forma));
    }
    const intento = await win.evaluate(() => { window.__descargas = []; return true; });
    const clic = await win.locator('#misionDescargar').click({ timeout: 4000 }).then(() => true, () => false);
    const bajo = clic && intento && await win.evaluate(() => window.__descargas.length === 1);
    const ventana = await win.evaluate(() => innerWidth);
    revisar(formas.every((f) => f.centro && !f.cruza && f.visible && f.aviso === conAviso) && bajo,
      `F03 (r1 de EST-004) ${etiqueta} (${ventana} px): el botón se ve entero, el aviso ${conAviso ? 'no lo tapa' : 'no está'} y el clic descarga (${JSON.stringify(formas.map((f) => [f.forma, f.centro, f.cruza, f.visible, f.caja, f.avisoCaja, f.alto]))}; clic: ${bajo})`);
  }
  // El tamaño se comprueba (ancho en px de CSS = ancho de la ventana / zoom) y se reintenta: a veces Windows no lo aplica
  // a la primera, y entonces la prueba mediría otra ventana. Devuelve los intentos, o 0 si no se logró.
  // Si Windows la minimizó (su tamaño sale [0, 0] y no cambia), se restaura antes, y se cuenta
  let restauradas = 0;
  const conZoom = async (ancho, alto, factor) => {
    for (let i = 1; i <= 4; i++) {
      if (await app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0]; if (!v.isMinimized()) return false; v.restore(); v.show(); return true; })) { restauradas++; await pausa(win, 500); }
      await tamano(app, win, ancho, alto);
      await app.evaluate(({ BrowserWindow }, z) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(z), factor);
      await pausa(win, 800);
      // Con la escala de Windows al 125 %, 1366 px quedan en 1368 (píxeles físicos enteros): hasta 2 px de diferencia
      if (Math.abs(await win.evaluate(() => innerWidth) - Math.floor(ancho / factor)) <= 2) return i;
    }
    const v = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows(); return w.map((x) => ({ cont: x.getContentSize(), min: x.getMinimumSize(), max: x.isMaximized(), full: x.isFullScreen(), zoom: x.webContents.getZoomFactor() })); });
    console.log(`      ventana tras 4 intentos: ${JSON.stringify(v)}; innerWidth ${await win.evaluate(() => innerWidth)}`);
    return 0;
  };
  const tieneAviso = await win.evaluate(() => !$('avisoRegistro').hidden);
  for (const [ancho, alto, factor, tema] of [[1366, 768, 2, 'claro'], [1366, 768, 2, 'oscuro'], [1536, 864, 2, 'claro'], [1366, 768, 1, 'claro'], [1536, 864, 1, 'oscuro']]) {
    await win.evaluate((t) => { if (t === 'oscuro') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme'); }, tema);
    const intentos = await conZoom(ancho, alto, factor);
    revisar(intentos > 0, `F03 (r1 de EST-004): la ventana queda en ${ancho} × ${alto} con zoom ${factor * 100} % (${Math.floor(ancho / factor)} px de CSS; intentos: ${intentos || 'no se logró'})`);
    await descargaLibre(`${ancho} × ${alto}, zoom ${factor * 100} %, ${tema}, con registro`, tieneAviso);
  }
  await win.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await conZoom(1536, 864, 1);
  // E6: una misión terminada antes de EST-004 (solo valores, sin horas ni «tras simular») también se descarga
  await serEquipo(win, 'D2');
  await win.evaluate(() => {
    const g = (leerLocal(CLAVE_PREF) || {}).misiones || {};
    const equipos = { ...(g.equipos || {}), 'e:D2': { actual: 'estudio_y1', misiones: { estudio_y1: { paso: 5, simulo: true,
      respuestas: { primero: 11, duracion: 5, acierto: 'no', duracion_nueva: 6, porque: 'Se agregó el amarillo.', dificultad: 3 } } } } };
    guardarPreferencias({ misiones: { ...g, equipos } });
    misiones.aplicar('C0'); misiones.aplicar('B');
  });
  bajada = await descargarAhora();
  archivo = bajada && leerArchivo(bajada);
  const todasNull = archivo && archivo.abierta === null && archivo.terminada === null && Array.isArray(archivo.sesiones) && archivo.sesiones.length === 0
    && archivo.pasos.every((q) => q.t === null && q.sesion === null && q.respuestas.every((x) => x.t === null && x.tras_simular === null && x.sesion === null));
  const malViejo = archivo ? revisarRespuestas(archivo) : ['no hubo archivo'];
  revisar(!!archivo && todasNull && !malViejo.length && archivo.pasos[4].respuestas.length === 3,
    `E6 (EST-004): una misión guardada antes se descarga con horas, «tras simular» y sesiones en null, sin inventarlas, y cumple el esquema${malViejo.length ? ': ' + malViejo.slice(0, 2).join(' | ') : ''}`);
  // Lo guardado por la entrega de EST-004 antes de la r1 (horas y «tras simular», sin sesión): las horas se conservan y
  // la sesión va en null, porque no se sabe
  await serEquipo(win, 'D3');
  await win.evaluate(() => {
    const g = (leerLocal(CLAVE_PREF) || {}).misiones || {}, t = 1764168250000;
    const marcas = Object.fromEntries(['primero', 'duracion', 'acierto', 'duracion_nueva', 'porque', 'dificultad'].map((q) => [q, { t, tras: false }]));
    const equipos = { ...(g.equipos || {}), 'e:D3': { actual: 'estudio_x1', misiones: { estudio_x1: { paso: 5, simulo: false, abierta: t - 1000, terminada: t, pasosT: [t, t, t, t, t], marcas,
      respuestas: { primero: 11, duracion: 3, acierto: 'si', duracion_nueva: 4, porque: 'Uno más.', dificultad: 2 } } } } };
    guardarPreferencias({ misiones: { ...g, equipos } });
    misiones.aplicar('C0'); misiones.aplicar('B');
  });
  bajada = await descargarAhora();
  archivo = bajada && leerArchivo(bajada);
  const malSinSesion = archivo ? revisarRespuestas(archivo) : ['no hubo archivo'];
  revisar(!!archivo && !malSinSesion.length && sesionesDe(archivo) === 0 && archivo.pasos.every((q) => q.t === 1764168250000 && q.sesion === null && q.respuestas.every((x) => x.t === 1764168250000 && x.sesion === null)),
    `F01 (r1 de EST-004): lo guardado antes de la r1 conserva sus horas y sale con la sesión en null${malSinSesion.length ? ': ' + malSinSesion.slice(0, 2).join(' | ') : ''}`);

  // ---- r1 de EST-004, F02 (COD-20261111-006): lo que pasa después de terminar no cambia la entrega
  const SINSIM = { primero: '12', vuelta: '3', final: '4', porque: 'Terminada sin simular.' };
  n = await nuevaX1('G1');
  await terminarMision(SINSIM);
  const g1 = await descargarAhora();
  const g1doc = g1 && leerArchivo(g1);
  // Simular de verdad con la misión terminada abierta
  await simularBarra();
  const arrancoG1 = await arranco();
  await win.evaluate(() => detenerSimulacion());
  const g1b = await descargarAhora();
  revisar(!!g1doc && g1doc.simulo === false && arrancoG1 && !!g1b && g1b.contenido === g1.contenido,
    `F02 (r1 de EST-004): terminada sin simular, una simulación después (arrancó: ${arrancoG1}) no la cambia: simulo sigue en ${g1b && leerArchivo(g1b) && leerArchivo(g1b).simulo} y el archivo es idéntico`);
  // Reabrir la misión cerrada desde Ejemplos y simular otra vez; y un error de compilación con ella abierta
  await abrirTarea(win, 'X1 · Luces en secuencia');
  await simularBarra();
  const arrancoG1c = await arranco();
  await win.evaluate(() => detenerSimulacion());
  await win.evaluate((c) => entrarModoTexto(c, ''), ERRONEO);
  await simularBarra();
  const falloG1 = await fallaCompilando();
  await win.evaluate(() => salirModoTexto(true));
  const g1c = await descargarAhora();
  revisar(arrancoG1c && falloG1 && !!g1c && g1c.contenido === g1.contenido,
    `F02 (r1 de EST-004): reabierta desde Ejemplos, otra simulación y un error de compilación tampoco la cambian (arrancó: ${arrancoG1c}, error: ${falloG1})`);
  // Con otra misión abierta del mismo equipo, simular marca esa y no la terminada
  await abrirTarea(win, 'Y1 · Semáforo');
  await simularBarra();
  const arrancoY1 = await arranco();
  await win.evaluate(() => detenerSimulacion());
  const marcadas = await win.evaluate(() => { const m = ((leerLocal(CLAVE_PREF) || {}).misiones.equipos['e:G1'] || {}).misiones || {}; return [m.estudio_y1 && m.estudio_y1.simulo, m.estudio_x1 && m.estudio_x1.simulo]; });
  revisar(arrancoY1 && marcadas[0] === true && marcadas[1] === false, `F02 (r1 de EST-004): simular con Y1 abierta marca Y1 y deja X1 terminada como estaba (Y1, X1: ${JSON.stringify(marcadas)})`);
  // Al alternar equipos y volver, sigue igual
  await serEquipo(win, 'G2');
  await simularBarra();
  await arranco();
  await win.evaluate(() => detenerSimulacion());
  await serEquipo(win, 'G1');
  await abrirTarea(win, 'X1 · Luces en secuencia');
  const g1d = await descargarAhora();
  revisar(!!g1d && g1d.contenido === g1.contenido, 'F02 (r1 de EST-004): otro equipo simula y, de vuelta G1, su X1 terminada sale idéntica');

  // ---- r1 de EST-004, F01 (COD-20261111-006): cada paso y cada respuesta dicen la sesión del registro en que se
  // respondieron; arriba, `sesiones` las lista en orden (la de abrir primero). Se compara cada una con su evento.
  const delEquipo = (eq) => deMision().filter((l) => l.equipo === eq && l.datos && l.datos.id === 'estudio_x1').sort((a, b) => a.t - b.t);
  function cuadra(doc, eq) {
    if (!doc) return 'sin archivo';
    const ev = delEquipo(eq), malos = [];
    for (const q of doc.pasos) {
      if (!ev.some((l) => l.tipo === 'mision_paso' && l.datos.paso === q.paso && l.sesion === q.sesion)) malos.push(`paso ${q.paso} en ${q.sesion}`);
      for (const x of q.respuestas) {
        if (x.sesion !== q.sesion) malos.push(`${x.pregunta} no va en la sesión de su paso`);
        if (!ev.some((l) => l.tipo === 'mision_respuesta' && l.datos.pregunta === x.pregunta && l.sesion === x.sesion && l.datos.valor === x.valor && Math.abs(l.t - x.t) < 1000)) malos.push(`${x.pregunta} sin su evento en ${x.sesion}`);
      }
    }
    const abierta = ev.find((l) => l.tipo === 'mision_abierta');
    const esperadas = [...new Set([abierta && abierta.sesion, ...doc.pasos.map((q) => q.sesion)].filter(Boolean))];
    if (JSON.stringify(doc.sesiones) !== JSON.stringify(esperadas)) malos.push(`sesiones ${JSON.stringify(doc.sesiones)} y no ${JSON.stringify(esperadas)}`);
    const mal = revisarRespuestas(doc);
    return malos.concat(mal).join(' | ');
  }
  const restoX1 = async () => {
    await win.locator('#mision1q0o0').check(); await seguir(win);
    await seguir(win); await seguir(win);
    await win.fill('#mision4q0', '4'); await win.fill('#mision4q1', 'Retomada.'); await win.locator('#mision4q2o1').check();
    await seguir(win);
  };
  const ponerDescargar = () => win.evaluate(() => { window.__descargas = []; descargar = (nombre, contenido, tipo) => { window.__descargas.push({ nombre, contenido, tipo }); }; });
  async function reabrir(eq) {
    await app.close();
    await new Promise((r) => setTimeout(r, 500));
    ({ app, win } = await abrir());
    await esperar(win, () => !$('modal').hidden, 8000);
    await serEquipo(win, eq);
    await ponerDescargar();
  }
  // 1. Alternar equipos a mitad de la misión: el paso 1 queda en la primera sesión y el resto en la de la vuelta
  await nuevaX1('H3');
  await predecir();
  const sH3a = await win.evaluate(() => registroEventos.sesion());
  await serEquipo(win, 'H4');
  await serEquipo(win, 'H3');
  const sH3b = await win.evaluate(() => registroEventos.sesion());
  await restoX1();
  let h = await descargarAhora();
  let hdoc = h && leerArchivo(h);
  let malH = cuadra(hdoc, 'H3');
  revisar(!malH && sH3a !== sH3b && JSON.stringify(hdoc.sesiones) === JSON.stringify([sH3a, sH3b]) && hdoc.pasos[0].sesion === sH3a && hdoc.pasos.slice(1).every((q) => q.sesion === sH3b),
    `F01 (r1 de EST-004): con otro equipo en medio, el paso 1 dice la primera sesión y los demás la segunda, cada una como su evento (${malH || sesionesDe(hdoc) + ' sesiones'})`);
  // Descargar dos veces da el mismo archivo
  const h2 = await descargarAhora();
  revisar(!!h && !!h2 && h.contenido === h2.contenido, 'F01 (r1 de EST-004): descargar otra vez da el mismo archivo');
  // 2. Una misión entera en una sesión, descargada; cerrar la app, abrirla y descargar: el mismo archivo
  await nuevaX1('H1');
  await terminarMision();
  const h1 = await descargarAhora();
  const h1doc = h1 && leerArchivo(h1);
  const malH1 = cuadra(h1doc, 'H1');
  revisar(!malH1 && sesionesDe(h1doc) === 1, `F01 (r1 de EST-004): la misión de H1, en una sola sesión, cuadra con el registro (${malH1 || 'una sesión'})`);
  // 3. H2 responde el paso 1, se cierra la app y termina en la siguiente
  await nuevaX1('H2');
  await predecir();
  await reabrir('H1');
  const sNueva = await win.evaluate(() => registroEventos.sesion());
  const h1r = await descargarAhora();
  revisar(!!h1r && !!h1 && h1r.contenido === h1.contenido && listaDe(leerArchivo(h1r)).length > 0 && !listaDe(leerArchivo(h1r)).includes(sNueva),
    `F01 (r1 de EST-004): tras cerrar y abrir la app, la misión terminada de H1 sale idéntica, con su sesión y no la nueva (${h1r ? listaDe(leerArchivo(h1r)).join(', ') : 'sin archivo'})`);
  await serEquipo(win, 'H2');
  const pH2 = await panel(win);
  await restoX1();
  h = await descargarAhora();
  hdoc = h && leerArchivo(h);
  malH = cuadra(hdoc, 'H2');
  revisar(pH2.avance === 'Paso 2 de 5' && !malH && sesionesDe(hdoc) === 2 && hdoc.pasos[0].sesion === listaDe(hdoc)[0] && hdoc.pasos.slice(1).every((q) => q.sesion === listaDe(hdoc)[1]),
    `F01 (r1 de EST-004): retomada tras reabrir (${pH2.avance}), cada respuesta dice su sesión: dos en la primera y cinco en la segunda (${malH || sesionesDe(hdoc) + ' sesiones'})`);

  // ---- E2 y E11. En C0 no hay panel, ni en el DOM, y abrir X1 por código no abre ninguna misión
  const antesC0 = deMision().length;
  await win.evaluate(() => aplicarVariante('C0'));
  await pausa(win, 400);
  await win.evaluate(() => cargarEjemplo(EJEMPLOS.find((e) => e.id === 'estudio_x1')));
  await pausa(win, 600);
  const c0 = await win.evaluate(() => ({ nodo: !!document.querySelector('.misiones, #misiones'), clase: document.body.className, columnas: getComputedStyle($('app')).gridTemplateColumns.split(' ').length }));
  revisar(!c0.nodo && !/con-misiones|mision-plegada/.test(c0.clase) && c0.columnas === 1, `E2/E11: en C0 no hay panel ni sus clases, y #app tiene una sola columna (${JSON.stringify(c0)})`);
  revisar(deMision().length === antesC0, 'E2: abrir X1 en C0 no registra ninguna misión');

  // ---- EST-004, E7: con el registro apagado (sin código de equipo), el archivo sale con equipo y sesión en null
  await win.evaluate(() => aplicarVariante('B'));
  await pausa(win, 400);
  await win.evaluate(async () => {
    await enFilaDeEquipo(async () => {
      await cerrarTrabajoDelEquipo(); registroEventos.terminar();
      const r = await escritorio.registro.instructor({ accion: 'activar', pin: '2468', activo: false });
      registroEncendido = !!r.activo;
    });
    pintarAvisoRegistro();
  });
  await abrirTarea(win, 'Y1 · Semáforo');
  await terminarMision({ vuelta: '5', final: '6', porque: 'Se agregó el amarillo al final.' });
  bajada = await descargarAhora();
  archivo = bajada && leerArchivo(bajada);
  const malSin = archivo ? revisarRespuestas(archivo) : ['no hubo archivo'];
  revisar(!!archivo && archivo.equipo === null && Array.isArray(archivo.sesiones) && archivo.sesiones.length === 0 && todoEn(archivo, null) && !malSin.length && /^respuestas-sin-equipo-estudio_y1-\d{8}-\d{4}\.json$/.test(bajada.nombre),
    `E7 (EST-004): sin registro, equipo en null, sin sesiones y cada sesión en null, cumple el esquema y el nombre dice «sin-equipo» (${bajada && bajada.nombre})${malSin.length ? ': ' + malSin.slice(0, 2).join(' | ') : ''}`);
  // F03 sin registro: no hay aviso y el botón sigue libre a 1366 px con zoom al 200 %
  const intentosSin = await conZoom(1366, 768, 2);
  revisar(intentosSin > 0, `F03 (r1 de EST-004): sin registro, la ventana queda en 1366 × 768 con zoom 200 % (intentos: ${intentosSin || 'no se logró'}; ventanas minimizadas restauradas en F03: ${restauradas})`);
  await descargaLibre('1366 × 768, zoom 200 %, claro, sin registro', false);
  await conZoom(1536, 864, 1);
  await app.close();

  revisar(errores.length === 0, `sin errores en la página${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(`\n${fallos ? fallos + ' FALLAS' : 'Todo bien'} · capturas en test/salida/misiones_*.png`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
