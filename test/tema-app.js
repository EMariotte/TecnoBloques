// Prueba de punta a punta del interruptor de tema (UX-005; ejemplos E1–E6 aceptados por Efraín el 11 nov, en
// TecnoSuite/tareas/UX-005.md). Al final de la barra, ☀ ( ● ) ☾, igual en A, B y C0. Sigue al tema de Windows hasta que
// se toca; al tocarlo, guarda la elección en el equipo. El tema de Windows se simula con colorScheme de Playwright, desde
// el arranque y con emulateMedia después: Playwright fija «claro» por defecto, y eso tapa a nativeTheme.themeSource.
// Uso: npm run test:tema   (arma con --simulador-local)
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

(async () => {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')) };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-tema-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  fs.mkdirSync(datos, { recursive: true });
  const errores = [];
  const pausa = (win, ms) => win.waitForTimeout(ms);
  let app, win;
  async function sistema(tema) { // 'dark' | 'light': lo que diría Windows
    await win.emulateMedia({ colorScheme: tema });
    await pausa(win, 400);
  }
  async function tamano(ancho, alto, zoom = 1) {
    for (let i = 0; i < 4; i++) {
      await app.evaluate(({ BrowserWindow }, [w, h, z]) => { const v = BrowserWindow.getAllWindows()[0]; if (v.isMinimized()) v.restore(); v.unmaximize(); v.setContentSize(w, h); v.webContents.setZoomFactor(z); }, [ancho, alto, zoom]);
      await pausa(win, 700);
      if (Math.abs(await win.evaluate(() => innerWidth) - Math.floor(ancho / zoom)) <= 2) return true; // al 125 %, 1366 → 1368
    }
    return false;
  }
  async function abrir(temaSistema) {
    app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], cwd: RAIZ, env, colorScheme: temaSistema });
    win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await win.waitForLoadState('load');
    await tamano(1536, 864);
    await pausa(win, 1200);
  }
  // Lo que se ve: el interruptor, la interfaz, los bloques y el lienzo
  const estado = () => win.evaluate(() => {
    const b = $('btnTema'), raiz = [...$('lienzoCircuito').querySelectorAll('*')].find((n) => n.shadowRoot);
    const tc = raiz ? raiz.shadowRoot.querySelector('.tc-oscuro, .tc-claro') : null;
    return {
      existe: !!b, marcado: b ? b.getAttribute('aria-checked') : null, atributo: document.documentElement.getAttribute('data-theme'),
      oscuro: esOscuro(), fondo: getComputedStyle(document.body).backgroundColor, bloques: espacio ? espacio.getTheme().name : null,
      lienzo: tc ? (tc.classList.contains('tc-oscuro') ? 'oscuro' : 'claro') : null,
      guardado: (leerLocal(CLAVE_PREF) || {}).tema,
    };
  });
  // Sin el interruptor (el «antes»), cada caso falla en vez de cortar la prueba
  const pulsar = () => win.locator('#btnTema').click({ timeout: 3000 }).catch(() => {});
  const oscuroEn = (e) => e.marcado === 'true' && e.oscuro && e.bloques === 'tecno_oscuro' && e.lienzo === 'oscuro';
  const claroEn = (e) => e.marcado === 'false' && !e.oscuro && e.bloques === 'tecno_claro' && e.lienzo === 'claro';

  // ---- E1. Sin elección guardada, la app abre con el tema de Windows y el interruptor lo refleja
  await abrir('dark');
  await win.evaluate(() => { if ($('tCircuito') && !$('tCircuito').hidden) $('tCircuito').click(); });
  await pausa(win, 800);
  let e = await estado();
  revisar(e.existe && e.atributo === null && e.guardado === undefined && oscuroEn(e), `E1: con Windows en oscuro y nada guardado, abre en oscuro (interruptor, bloques y lienzo) y sigue al sistema (${JSON.stringify(e)})`);
  await sistema('light');
  e = await estado();
  revisar(e.atributo === null && claroEn(e), `E1: si Windows pasa a claro, la app y el interruptor lo siguen (${JSON.stringify(e)})`);

  // ---- E2. Al pulsarlo cambian a la vez la interfaz, los bloques y el circuito; se guarda y gana al sistema
  const fondoClaro = e.fondo;
  await pulsar();
  await pausa(win, 400);
  e = await estado();
  revisar(e.atributo === 'dark' && e.guardado === 'oscuro' && oscuroEn(e) && e.fondo !== fondoClaro, `E2: al pulsarlo pasa a oscuro la interfaz (fondo ${e.fondo}), los bloques y el lienzo, y guarda «oscuro» (${JSON.stringify(e)})`);
  await app.close();
  ({ app, win } = { app: null, win: null });
  await abrir('light');
  await win.evaluate(() => { if ($('tCircuito') && !$('tCircuito').hidden) $('tCircuito').click(); });
  await pausa(win, 800);
  e = await estado();
  revisar(e.atributo === 'dark' && oscuroEn(e), `E2: al reabrir con Windows en claro, sigue en oscuro (${JSON.stringify(e)})`);
  await pulsar();
  await pausa(win, 400);
  await sistema('dark');
  e = await estado();
  revisar(e.atributo === 'light' && e.guardado === 'claro' && claroEn(e), `E2: elegido claro, se queda en claro aunque Windows pase a oscuro (${JSON.stringify(e)})`);

  // ---- E3. Teclado y lector: role="switch", aria-checked, nombre «Tema oscuro», Tab + Espacio o Enter, foco visible
  const a11y = await win.evaluate(() => { const b = $('btnTema'); if (!b) return {}; return { tag: b.tagName, rol: b.getAttribute('role'), nombre: b.getAttribute('aria-label'), titulo: b.title, iconos: [...b.querySelectorAll('svg')].every((s) => s.getAttribute('aria-hidden') === 'true') }; });
  revisar(a11y.tag === 'BUTTON' && a11y.rol === 'switch' && a11y.nombre === 'Tema oscuro' && a11y.titulo === 'Tema oscuro' && a11y.iconos, `E3: es un botón con role="switch", nombre y título «Tema oscuro», y los íconos ocultos al lector (${JSON.stringify(a11y)})`);
  await win.evaluate(() => $('btnSubir').focus());
  await win.keyboard.press('Tab');
  const foco = await win.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { id: a.id, visible: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) * devicePixelRatio >= 2 }; });
  revisar(foco.id === 'btnTema' && foco.visible, `E3: con Tab desde «Subir a la placa» se llega al interruptor, con el foco visible (${JSON.stringify(foco)})`);
  await win.keyboard.press('Space');
  await pausa(win, 300);
  const conEspacio = await estado();
  await win.keyboard.press('Enter');
  await pausa(win, 300);
  const conEnter = await estado();
  revisar(oscuroEn(conEspacio) && claroEn(conEnter) && await win.evaluate(() => document.activeElement.id) === 'btnTema',
    `E3: Espacio lo pasa a oscuro y Enter a claro, y el foco se queda en él (${conEspacio.marcado} → ${conEnter.marcado})`);

  // ---- E4. Contraste en los dos temas y lugar en la barra: no tapa ni empuja nada
  const medir = () => win.evaluate(() => {
    const rgb = (x) => (x.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = (x) => { const [r, g, b] = rgb(x).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const razon = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const fondo = (n) => { for (let x = n; x; x = x.parentElement) { const k = getComputedStyle(x).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(k)) return k; } return 'rgb(255,255,255)'; };
    const b = $('btnTema'), pista = b && b.querySelector('.tema-pista'), perilla = b && b.querySelector('.tema-perilla');
    if (!pista || !perilla) return { borde: 0, perilla: 0, activo: 0, inactivo: 0, distintos: false };
    const barra = fondo(b);
    const activo = b.querySelector(b.getAttribute('aria-checked') === 'true' ? '.tema-luna' : '.tema-sol'), otro = b.querySelector(b.getAttribute('aria-checked') === 'true' ? '.tema-sol' : '.tema-luna');
    return {
      borde: razon(getComputedStyle(pista).borderTopColor, barra), perilla: razon(getComputedStyle(perilla).backgroundColor, fondo(pista)),
      activo: razon(getComputedStyle(activo).color, barra), inactivo: razon(getComputedStyle(otro).color, barra), distintos: getComputedStyle(activo).color !== getComputedStyle(otro).color,
    };
  });
  for (const tema of ['claro', 'oscuro']) {
    if ((await estado()).marcado !== (tema === 'oscuro' ? 'true' : 'false')) { await pulsar(); await pausa(win, 300); }
    const c = await medir();
    revisar(c.borde >= 3 && c.perilla >= 3 && c.activo >= 3 && c.inactivo >= 3 && c.distintos,
      `E4 ${tema}: borde de la pista ${c.borde.toFixed(2)}, perilla ${c.perilla.toFixed(2)}, ícono activo ${c.activo.toFixed(2)} e inactivo ${c.inactivo.toFixed(2)} (≥ 3:1), y el activo se distingue`);
    await win.screenshot({ path: path.join(SALIDA, `tema_barra_${tema}.png`), clip: await win.locator('.barra').boundingBox() });
  }
  // Con y sin el interruptor (display: none), la barra mide lo mismo y los demás controles no se mueven; nada se cruza
  const lugar = () => win.evaluate(() => {
    if (!$('btnTema')) return { dentro: false, cruza: [], mismoAlto: false, quietos: false };
    const otros = () => [...document.querySelectorAll('.barra button, .barra select, .barra input, .barra .segmentado')].filter((n) => n.id !== 'btnTema' && !$('btnTema').contains(n) && n.offsetParent !== null);
    // Cada control conserva su renglón (su y) y no sale de la ventana. Los del renglón de acciones se corren a la izquierda
    // lo que mide el interruptor, porque ese renglón se alinea a la derecha: se anota cuánto (corrimiento)
    const cajas = () => otros().map((n) => { const r = n.getBoundingClientRect(); return [n.id || n.className, Math.round(r.y), r.left >= 0 && r.right <= innerWidth + 0.5]; });
    const xs = () => otros().map((n) => Math.round(n.getBoundingClientRect().x));
    const b = $('btnTema'), r = b.getBoundingClientRect();
    const cruza = otros().filter((n) => { const q = n.getBoundingClientRect(); return q.left < r.right && r.left < q.right && q.top < r.bottom && r.top < q.bottom; }).map((n) => n.id || n.className);
    const con = { alto: Math.round(document.querySelector('.barra').getBoundingClientRect().height), cajas: JSON.stringify(cajas()), xs: xs() };
    b.style.display = 'none';
    const sin = { alto: Math.round(document.querySelector('.barra').getBoundingClientRect().height), cajas: JSON.stringify(cajas()), xs: xs() };
    b.style.display = '';
    const corrimiento = Math.max(0, ...sin.xs.map((x, i) => x - con.xs[i]));
    return { dentro: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight, cruza, mismoAlto: con.alto === sin.alto, quietos: con.cajas === sin.cajas && JSON.parse(con.cajas).every((c) => c[2]), corrimiento, alto: con.alto, ancho: Math.round(r.width), ventana: innerWidth };
  });
  for (const [w, h, z] of [[1536, 864, 1], [1366, 768, 1], [1366, 768, 2], [1536, 864, 2]]) {
    const ok = await tamano(w, h, z);
    const l = await lugar();
    const pide = z === 1 ? l.mismoAlto && l.quietos : true; // con zoom la barra ya va en varios renglones: basta que se vea y no se cruce
    revisar(ok && l.dentro && l.cruza.length === 0 && pide,
      `E4 ${w} × ${h}, zoom ${z * 100} % (${l.ventana} px): el interruptor (${l.ancho} px) se ve entero y no se cruza con nada${z === 1 ? '; la barra mide lo mismo con y sin él, cada control sigue en su renglón y dentro de la ventana' : ''} (${JSON.stringify(l)})`);
  }
  await tamano(1536, 864, 1);

  // ---- E5. «Reducir movimiento»: la perilla salta sin animarse; sin la preferencia, se desliza (menos de 300 ms)
  for (const [modo, espera] of [['no-preference', true], ['reduce', false]]) {
    await win.emulateMedia({ reducedMotion: modo });
    await pausa(win, 200);
    const t = await win.evaluate(() => { const n = document.querySelector('#btnTema .tema-perilla'); if (!n) return { prop: 'ninguna', dur: 0 }; const cs = getComputedStyle(n); return { prop: cs.transitionProperty, dur: Math.max(...cs.transitionDuration.split(',').map((x) => parseFloat(x) * (/ms/.test(x) ? 1 : 1000))) }; });
    const anima = /transform|all/.test(t.prop) && t.dur > 0;
    revisar(anima === espera && t.dur < 300, `E5: con «reducir movimiento» ${modo === 'reduce' ? 'activo, la perilla no se anima' : 'apagado, la perilla se desliza'} (${t.prop} ${t.dur} ms)`);
  }
  await win.emulateMedia({ reducedMotion: null });

  // ---- El mismo interruptor en C0, A y B (no es un tratamiento del estudio)
  const enVariantes = [];
  for (const v of ['A', 'B', 'C0']) {
    await win.evaluate((x) => aplicarVariante(x), v);
    await pausa(win, 500);
    enVariantes.push(await win.evaluate(() => { const b = $('btnTema'); return !!b && b.offsetParent !== null && !!b.closest('.barra'); }));
  }
  revisar(enVariantes.every(Boolean), `C0, A y B: el interruptor está en la barra en las tres (${JSON.stringify(enVariantes)})`);

  // ---- E6. Si la elección guardada se daña o se borra, la app vuelve a seguir a Windows, sin error
  for (const [nombre, dano] of [['un valor que no existe', { tema: 'morado' }], ['un número', { tema: 7 }], ['borrada', { tema: undefined }]]) {
    await win.evaluate((d) => { const p = leerLocal(CLAVE_PREF) || {}; if (d.tema === undefined) delete p.tema; else p.tema = d.tema; guardarLocal(CLAVE_PREF, p); }, dano);
    await app.close();
    await abrir('dark');
    await win.evaluate(() => { if ($('tCircuito') && !$('tCircuito').hidden) $('tCircuito').click(); });
    await pausa(win, 600);
    e = await estado();
    revisar(e.atributo === null && oscuroEn(e), `E6: con la elección ${nombre}, abre siguiendo a Windows (oscuro) y sin error (${JSON.stringify(e)})`);
  }
  // Las preferencias enteras dañadas (no son JSON) tampoco rompen nada
  await win.evaluate(() => localStorage.setItem(CLAVE_PREF, '{tema: oscuro'));
  await app.close();
  await abrir('light');
  e = await estado();
  revisar(e.atributo === null && e.marcado === 'false' && !e.oscuro, `E6: con las preferencias ilegibles, abre siguiendo a Windows (claro) (${JSON.stringify(e)})`);
  await app.close();

  revisar(errores.length === 0, `sin errores en la página${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(`\n${fallos ? fallos + ' FALLAS' : 'Todo bien'} · capturas en test/salida/tema_*.png`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
