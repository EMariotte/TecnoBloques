// AUD-31: avisar cuando un archivo no se pudo escribir al guardar o descargar, y confirmar cuando sí se escribió
// (ejemplos E1–E6 de TecnoSuite/tareas/AUD-31.md, acordados con Efraín el 13 nov, con su D1: «Se guardó …»).
// El cuadro de guardar de Windows es del sistema: aquí el proceso principal fija la ruta por él (o lo cancela) y anota cómo
// termina la descarga. El fallo es el de E3 de test:calidad: el archivo elegido está abierto por otro programa sin compartir.
// Lo que se mira es lo que ve el aprendiz: el aviso con role="alert" y «Reintentar» dentro de la pantalla que descargó (o
// junto a «Descargar respuestas»), el toast y el archivo anterior intacto.
// Uso: npm run test:descargas
'use strict';
const { _electron: electron } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const RAIZ = path.join(__dirname, '..');
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const ANTERIOR = '{"app":"TecnoBloques","anterior":true}';

(async () => {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')), TB_HERRAMIENTAS: 'instructor' };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-descargas-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  fs.mkdirSync(datos, { recursive: true });
  const carpeta = path.join(datos, 'guardar');
  fs.mkdirSync(carpeta, { recursive: true });
  const errores = [];
  const pausa = (win, t) => win.waitForTimeout(t);

  async function abrir(variante) {
    // Cada variante con sus datos: la misión de X1 terminada en A no debe llegar terminada a B
    const perfil = path.join(datos, 'perfil-' + variante);
    fs.mkdirSync(perfil, { recursive: true });
    fs.writeFileSync(path.join(perfil, 'estudio-config.json'), JSON.stringify({ formato: 1, variante }));
    const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${perfil}`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'], cwd: RAIZ, env });
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await win.waitForLoadState('load');
    await app.evaluate(({ BrowserWindow }) => { const v = BrowserWindow.getAllWindows()[0]; v.restore(); v.unmaximize(); v.setContentSize(1366, 768); }); // la pantalla más chica del aula: ahí el aviso del panel quedaba fuera de la vista
    await pausa(win, 2000);
    const v = await win.evaluate(() => document.body.dataset.variante || 'C0');
    if (v !== variante) throw new Error(`La app abrió en ${v}, no en ${variante}`);
    return { app, win };
  }
  async function armarA(win) {
    if (!(await win.evaluate(() => [...document.querySelectorAll('.lado-vacio')].some((v) => v.offsetParent !== null)))) return;
    await win.locator('#ladoIzq .lado-vacio button[data-herr="bloques"]').click();
    await pausa(win, 300);
    await win.locator('#ladoDer .lado-vacio button[data-herr="circuito"]').click();
    await pausa(win, 600);
  }
  async function abrirTarea(win, nombre) {
    await win.locator('#btnEjemplos').click();
    await pausa(win, 200);
    await win.locator('#listaEjemplos button', { hasText: nombre }).click();
    await pausa(win, 300);
    await win.locator('#modalAcciones button', { hasText: 'Abrir ejemplo' }).click();
    await pausa(win, 900);
  }

  // Un archivo anterior abierto por otro programa sin compartir (lo más común en Windows: «el archivo está en uso»)
  async function bloquear(win, ruta) {
    fs.writeFileSync(ruta, ANTERIOR);
    const p = spawn('powershell', ['-NoProfile', '-Command', `$f=[System.IO.File]::Open('${ruta.replace(/'/g, "''")}','Open','ReadWrite','None'); Start-Sleep -Seconds 120`], { stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try { fs.closeSync(fs.openSync(ruta, 'r+')); } catch (e) { return p; }
      await pausa(win, 100);
    }
    p.kill();
    throw new Error('No se pudo dejar abierto ' + ruta);
  }
  // El otro programa cierra el archivo; después se mira si el anterior quedó intacto (abierto sin compartir no se puede leer)
  async function soltar(win, candado, ruta) {
    candado.kill();
    for (let i = 0; i < 50; i++) {
      try { return fs.readFileSync(ruta, 'utf8') === ANTERIOR; } catch (e) { await pausa(win, 100); }
    }
    return false;
  }
  // El proceso principal hace de cuadro de guardar: «escribir» elige la ruta; «cancelar» es pulsar Cancelar
  const preparar = (app, modo, ruta) => app.evaluate(({ session }, [modo, ruta]) => {
    global.__d = { inicio: false, estado: null, nombre: null };
    session.defaultSession.once('will-download', (_e, item) => {
      global.__d.inicio = true;
      global.__d.nombre = item.getFilename();
      item.once('done', (_ev, e) => { global.__d.estado = e; });
      item.setSavePath(ruta);
      if (modo === 'cancelar') item.cancel();
    });
  }, [modo, ruta]);
  async function terminada(app, win) {
    for (let i = 0; i < 60; i++) {
      const d = await app.evaluate(() => global.__d);
      if (d.estado) { await pausa(win, 500); return d; }
      await pausa(win, 250);
    }
    return app.evaluate(() => global.__d);
  }
  // Lo que ve el aprendiz: los avisos de «no se pudo guardar» que se anuncian, dónde están y su botón; el toast
  const vista = (win) => win.evaluate(() => {
    const avisos = [...document.querySelectorAll('[role="alert"]')].filter((n) => /No se pudo guardar/.test(n.textContent) && n.offsetParent !== null);
    const t = $('toast');
    return {
      toast: t.hidden ? null : t.textContent,
      modal: $('modal').hidden ? null : $('modalTitulo').textContent,
      avisos: avisos.map((a) => ({
        texto: a.textContent, enModal: $('modalCuerpo').contains(a), enMision: !!$('misiones') && $('misiones').contains(a),
        boton: [...a.querySelectorAll('button')].map((b) => b.textContent),
        // A la vista sin desplazarse: dentro de la ventana y de la caja que se desplaza (la pantalla o el panel)
        enVista: (() => {
          const r = a.getBoundingClientRect(), c = (a.closest('.modal-caja, #misiones') || document.body).getBoundingClientRect();
          return r.top >= Math.max(0, c.top) - 1 && r.bottom <= Math.min(innerHeight, c.bottom) + 1;
        })(),
      })),
    };
  });
  const sinToast = (win) => win.evaluate(() => { $('toast').hidden = true; });
  // Sin «Reintentar» (antes del arreglo) se anota la falla y se descarga con el botón de siempre, para que la descarga
  // preparada no quede esperando a la siguiente y la corrida siga
  async function reintentar(win, alterno) {
    const b = win.locator('[role="alert"] button', { hasText: 'Reintentar' });
    if (await b.count() === 1) return b.click();
    revisar(false, '«Reintentar» está a la vista para pulsarlo');
    return win.locator(alterno).first().click();
  }
  const dice = (v, nombre) => v.avisos.length === 1 && v.avisos[0].texto.includes(`No se pudo guardar ${nombre}.`) && /Prueba en otra carpeta/.test(v.avisos[0].texto) && v.avisos[0].boton.includes('Reintentar') && v.avisos[0].enVista;
  const confirma = (v, nombre) => v.toast === `Se guardó ${nombre}.`;
  const json = (x) => JSON.stringify(x);

  // =====================================================================================================
  // C0: «Guardar proyecto», «Descargar programa», la imagen del circuito y el CSV del monitor
  {
    console.log('\n== C0 ==');
    const { app, win } = await abrir('C0');

    // E6 + D1: sin fallo, «Se guardó …» y nada más: la pantalla y el DOM quedan como estaban
    // Sin las opciones de la lista de puertos: dependen de lo que está conectado al PC y la app las renueva sola (unos 2 s
    // después de abrir apareció un puerto entre los dos conteos y E6 dio 524 → 525 sin relación con la descarga, r1)
    const DOM_PROPIO = '*:not(#puerto > option)';
    const libre = path.join(carpeta, 'C0-libre.tbq.json');
    await win.locator('#btnGuardar').click();
    await pausa(win, 400);
    await sinToast(win);
    const antes = await win.evaluate((DOM_PROPIO) => ({ nodos: document.querySelectorAll(DOM_PROPIO).length, cuerpo: $('modalCuerpo').innerHTML, firmas: [...document.querySelectorAll(DOM_PROPIO)].map((n) => n.tagName + (n.id ? '#' + n.id : '') + (n.parentElement && n.parentElement.id ? '<' + n.parentElement.id : '')) }), DOM_PROPIO);
    await preparar(app, 'escribir', libre);
    await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
    let d = await terminada(app, win);
    let v = await vista(win);
    const despues = await win.evaluate((DOM_PROPIO) => ({ nodos: document.querySelectorAll(DOM_PROPIO).length, cuerpo: $('modalCuerpo').innerHTML, firmas: [...document.querySelectorAll(DOM_PROPIO)].map((n) => n.tagName + (n.id ? '#' + n.id : '') + (n.parentElement && n.parentElement.id ? '<' + n.parentElement.id : '')) }), DOM_PROPIO);
    revisar(d.estado === 'completed' && fs.existsSync(libre), `C0, «Guardar»: la descarga se escribe (${d.estado})`);
    revisar(confirma(v, 'C0-libre.tbq.json'), `D1 (C0): al escribirse, el toast dice «Se guardó C0-libre.tbq.json.» (${json(v.toast)})`);
    revisar(v.avisos.length === 0 && antes.nodos === despues.nodos && antes.cuerpo === despues.cuerpo,
      `E6 (C0): sin fallo no aparece ningún aviso y el DOM no cambia (${antes.nodos} → ${despues.nodos} nodos; pantalla ${antes.cuerpo === despues.cuerpo ? 'igual' : 'distinta'}; nuevos ${json(despues.firmas.filter((f) => !antes.firmas.includes(f)))})`);

    // E3: cancelar el cuadro de guardar no es un fallo
    await sinToast(win);
    await preparar(app, 'cancelar', path.join(carpeta, 'C0-cancelado.tbq.json'));
    await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
    d = await terminada(app, win);
    v = await vista(win);
    revisar(d.estado === 'cancelled' && v.avisos.length === 0 && v.toast === null, `E3 (C0): al cancelar no hay aviso ni toast (${d.estado}; toast ${json(v.toast)}; avisos ${v.avisos.length})`);

    // E1: el archivo está en uso: el aviso dentro de la pantalla, con «Reintentar»; dos fallos seguidos dejan un solo aviso
    const usado = path.join(carpeta, 'C0-usado.tbq.json');
    let candado = await bloquear(win, usado);
    await sinToast(win);
    await preparar(app, 'escribir', usado);
    await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
    d = await terminada(app, win);
    v = await vista(win);
    revisar(d.estado === 'interrupted', `E1 (C0): la escritura falla (${d.estado})`);
    revisar(dice(v, 'C0-usado.tbq.json') && v.avisos[0].enModal && v.modal === 'Guardar proyecto',
      `E1 (C0): «Guardar proyecto» sigue abierta y dice dentro «No se pudo guardar C0-usado.tbq.json. …», con «Reintentar» (${json(v.avisos)})`);
    revisar(!/guardad|se guardó/i.test(v.toast || ''), `E1 (C0): nada dice «guardado» (toast ${json(v.toast)})`);
    await preparar(app, 'escribir', usado);
    await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
    d = await terminada(app, win);
    v = await vista(win);
    revisar(d.estado === 'interrupted' && v.avisos.length === 1, `E1 (C0): un segundo fallo deja un solo aviso (${v.avisos.length})`);
    // «Reintentar» vuelve a abrir el cuadro de guardar; el aprendiz elige otra carpeta y se escribe
    const otra = path.join(carpeta, 'C0-otra.tbq.json');
    await sinToast(win);
    await preparar(app, 'escribir', otra);
    await reintentar(win, '#modalAcciones button:has-text("Descargar")');
    d = await terminada(app, win);
    v = await vista(win);
    const pedido = await win.evaluate(() => nombreArchivoBase() + '.tbq.json');
    revisar(d.inicio && d.nombre === pedido && d.estado === 'completed' && fs.existsSync(otra),
      `E1 (C0): «Reintentar» descarga otra vez el mismo archivo (${d.nombre}, ${d.estado})`);
    revisar(v.avisos.length === 0 && confirma(v, 'C0-otra.tbq.json'), `E1 (C0): al escribirse, el aviso se va y el toast confirma (${json(v.toast)}; avisos ${v.avisos.length})`);
    revisar(await soltar(win, candado, usado), 'E1 (C0): tras los dos fallos, el archivo anterior quedó intacto');
    await win.evaluate(() => cerrarModal(false));
    await pausa(win, 300);

    // «Descargar programa» (.ino), sin fallo
    const ino = path.join(carpeta, 'C0.ino');
    await win.evaluate(() => $('btnIno').click());
    await pausa(win, 400);
    await sinToast(win);
    await preparar(app, 'escribir', ino);
    await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
    d = await terminada(app, win);
    v = await vista(win);
    revisar(d.estado === 'completed' && confirma(v, 'C0.ino') && v.avisos.length === 0, `D1 (C0): «Descargar programa» confirma «Se guardó C0.ino.» (${json(v.toast)})`);
    await win.evaluate(() => cerrarModal(false));
    await pausa(win, 300);

    // La imagen del circuito, con el archivo en uso: el aviso en su pantalla
    const svg = path.join(carpeta, 'C0-circuito.svg');
    candado = await bloquear(win, svg);
    const hayImagen = await win.evaluate(() => { guardarImagenCircuito(); return !$('modal').hidden && $('modalTitulo').textContent; });
    await pausa(win, 400);
    await preparar(app, 'escribir', svg);
    await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
    d = await terminada(app, win);
    v = await vista(win);
    revisar(hayImagen === 'Guardar imagen del circuito' && d.estado === 'interrupted' && dice(v, 'C0-circuito.svg') && v.avisos[0].enModal && await soltar(win, candado, svg),
      `E1 (C0): «Guardar imagen del circuito» con el archivo en uso avisa en su pantalla y el anterior queda intacto (${json(v.avisos)})`);
    await win.evaluate(() => cerrarModal(false));
    await pausa(win, 300);

    // E4: sin pantalla abierta (el CSV del monitor), el aviso va en el toast y dura más que los 3,2 s de los demás
    const csv = path.join(carpeta, 'C0-monitor.csv');
    candado = await bloquear(win, csv);
    await win.evaluate(() => registroSerial.agregar('temperatura: 21\n', 'simulador', 0)); // la línea cuenta al terminar
    await preparar(app, 'escribir', csv);
    const t0 = Date.now();
    await win.evaluate(() => exportarCsvMonitor());
    d = await terminada(app, win);
    v = await vista(win);
    revisar(d.estado === 'interrupted' && v.modal === null && v.avisos.length === 0 && /^No se pudo guardar C0-monitor\.csv\. .*Prueba en otra carpeta/.test(v.toast || ''),
      `E4 (C0): con la pantalla cerrada, el toast dice «No se pudo guardar C0-monitor.csv. …» (${d.inicio ? d.estado : 'sin descarga'}; ${json(v.toast)})`);
    await pausa(win, Math.max(0, 5000 - (Date.now() - t0)));
    v = await vista(win);
    revisar(/^No se pudo guardar/.test(v.toast || ''), `E4 (C0): a los 5 s el aviso sigue a la vista (${json(v.toast)})`);
    revisar(await soltar(win, candado, csv), 'E4 (C0): el CSV anterior quedó intacto');

    // F01 de COD-20261113-003: el campo del proyecto acepta nombres reservados de Windows (CON, aux, LPT1) y Chromium
    // los cambia al descargar (`_CON.tbq.json`). La descarga sigue siendo la que se pidió: con el archivo en uso avisa
    // dentro de la pantalla, y al escribirse confirma. «robot» es el control ordinario.
    for (const nombre of ['CON', 'aux', 'LPT1', 'robot']) {
      await win.fill('#nombreProyecto', nombre);
      await pausa(win, 200);
      const base = await win.evaluate(() => nombreArchivoBase());
      await win.locator('#btnGuardar').click();
      await pausa(win, 400);
      const enUso = path.join(carpeta, `C0-reservado-${nombre}.tbq.json`);
      const candadoR = await bloquear(win, enUso);
      await sinToast(win);
      await preparar(app, 'escribir', enUso);
      await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
      d = await terminada(app, win);
      v = await vista(win);
      revisar(base === nombre && d.estado === 'interrupted' && dice(v, `C0-reservado-${nombre}.tbq.json`) && v.avisos[0].enModal,
        `F01 (${nombre}): el proyecto «${base}» baja como ${d.nombre}; con el archivo en uso avisa dentro, con «Reintentar» (${json(v.avisos)}; toast ${json(v.toast)})`);
      const libreR = path.join(carpeta, `C0-reservado-${nombre}-libre.tbq.json`);
      await sinToast(win);
      await preparar(app, 'escribir', libreR);
      await reintentar(win, '#modalAcciones button:has-text("Descargar")');
      d = await terminada(app, win);
      v = await vista(win);
      revisar(d.estado === 'completed' && fs.existsSync(libreR) && v.avisos.length === 0 && confirma(v, `C0-reservado-${nombre}-libre.tbq.json`),
        `F01 (${nombre}): al escribirse, el aviso se va y el toast confirma (${d.estado}; ${json(v.toast)}; avisos ${v.avisos.length})`);
      revisar(await soltar(win, candadoR, enUso), `F01 (${nombre}): el archivo anterior quedó intacto`);
      // Escritura directa, sin fallo antes: también confirma
      const directo = path.join(carpeta, `C0-reservado-${nombre}-directo.tbq.json`);
      await sinToast(win);
      await preparar(app, 'escribir', directo);
      await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
      d = await terminada(app, win);
      v = await vista(win);
      revisar(d.estado === 'completed' && confirma(v, `C0-reservado-${nombre}-directo.tbq.json`),
        `F01 (${nombre}): escribir sin fallo previo confirma «Se guardó …» (${json(v.toast)})`);
      // Nada queda esperando: cada descarga terminada se retira de las pendientes
      revisar(await win.evaluate(() => descargasPendientes.length) === 0, `F01 (${nombre}): no queda ninguna descarga pendiente sin emparejar`);
      await win.evaluate(() => cerrarModal(false));
      await pausa(win, 300);
    }

    // F02 de COD-20261113-003: un destino válido de 114 caracteres, en uso. El nombre completo sigue en el aviso y se
    // parte dentro de él; texto, «Reintentar» y las acciones quedan dentro de la pantalla, en claro y oscuro.
    const largo = 'Proyecto_de_robotica_'.repeat(5) + '.tbq.json';
    for (const tema of ['light', 'dark']) {
      await win.emulateMedia({ colorScheme: tema });
      await pausa(win, 200);
      await win.locator('#btnGuardar').click();
      await pausa(win, 400);
      const sub = path.join(carpeta, tema);
      fs.mkdirSync(sub, { recursive: true });
      const rutaLarga = path.join(sub, largo);
      const candadoL = await bloquear(win, rutaLarga);
      await sinToast(win);
      await preparar(app, 'escribir', rutaLarga);
      await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
      d = await terminada(app, win);
      v = await vista(win);
      const caja = await win.evaluate(() => {
        const c = document.querySelector('.modal-caja').getBoundingClientRect(), cuerpo = $('modalCuerpo');
        const dentro = (n) => { const r = n.getBoundingClientRect(); return r.left >= c.left - 1 && r.right <= c.right + 1; };
        const aviso = cuerpo.querySelector('.aviso-descarga');
        return {
          ancho: innerWidth, fondo: getComputedStyle(document.body).backgroundColor,
          cuerpo: [cuerpo.scrollWidth, cuerpo.clientWidth], caja: Math.round(c.width),
          pagina: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
          aviso: !!aviso && dentro(aviso) && [...aviso.querySelectorAll('p, button')].every(dentro),
          acciones: [...document.querySelectorAll('#modalAcciones button')].every(dentro),
        };
      });
      revisar(d.estado === 'interrupted' && dice(v, largo) && v.avisos[0].enModal,
        `F02 (${tema}): el aviso dice el nombre completo de ${largo.length} caracteres, con «Reintentar» (${json(v.avisos.map((a) => a.texto.length))})`);
      revisar(caja.cuerpo[0] <= caja.cuerpo[1] && caja.pagina[0] <= caja.pagina[1] && caja.aviso && caja.acciones,
        `F02 (${tema}): texto, «Reintentar» y acciones caben en la pantalla, sin desplazamiento horizontal (${json(caja)})`);
      const otraL = path.join(sub, 'L' + largo);
      await sinToast(win);
      await preparar(app, 'escribir', otraL);
      await reintentar(win, '#modalAcciones button:has-text("Descargar")');
      d = await terminada(app, win);
      v = await vista(win);
      const toastCabe = await win.evaluate(() => { const t = $('toast'); const r = t.getBoundingClientRect(); return !t.hidden && t.scrollWidth <= t.clientWidth && r.left >= 0 && r.right <= innerWidth; });
      revisar(d.estado === 'completed' && v.avisos.length === 0 && confirma(v, 'L' + largo) && toastCabe,
        `F02 (${tema}): «Reintentar» escribe, el aviso se va y el toast con el nombre largo cabe en la ventana (${json(v.toast && v.toast.length)}; cabe ${toastCabe})`);
      revisar(await soltar(win, candadoL, rutaLarga), `F02 (${tema}): el archivo anterior quedó intacto`);
      await win.evaluate(() => cerrarModal(false));
      await pausa(win, 300);
    }
    await win.emulateMedia({ colorScheme: null });
    await app.close();
  }

  // =====================================================================================================
  // A y B: «Guardar proyecto» y «Descargar respuestas» del panel de la misión
  for (const variante of ['A', 'B']) {
    console.log(`\n== ${variante} ==`);
    const { app, win } = await abrir(variante);
    if (variante === 'A') await armarA(win);
    await abrirTarea(win, 'X1 · Luces en secuencia');

    const usado = path.join(carpeta, `${variante}-usado.tbq.json`);
    let candado = await bloquear(win, usado);
    await win.locator('#btnGuardar').click();
    await pausa(win, 400);
    await sinToast(win);
    await preparar(app, 'escribir', usado);
    await win.locator('#modalAcciones button', { hasText: 'Descargar' }).click();
    let d = await terminada(app, win);
    let v = await vista(win);
    revisar(d.estado === 'interrupted' && dice(v, `${variante}-usado.tbq.json`) && v.avisos[0].enModal,
      `E1 (${variante}): «Guardar proyecto» con el archivo en uso avisa dentro, con «Reintentar» (${json(v.avisos)})`);
    const libre = path.join(carpeta, `${variante}-libre.tbq.json`);
    await sinToast(win);
    await preparar(app, 'escribir', libre);
    await reintentar(win, '#modalAcciones button:has-text("Descargar")');
    d = await terminada(app, win);
    v = await vista(win);
    revisar(d.estado === 'completed' && v.avisos.length === 0 && confirma(v, `${variante}-libre.tbq.json`),
      `E1 (${variante}): «Reintentar» escribe en otra carpeta, el aviso se va y el toast confirma (${json(v.toast)})`);
    revisar(await soltar(win, candado, usado), `E1 (${variante}): el archivo anterior quedó intacto`);
    await win.evaluate(() => cerrarModal(false));
    await pausa(win, 300);

    // E2: terminar la misión de X1 y descargar las respuestas con el archivo en uso
    const seguir = () => win.locator('#misionSeguir').click().then(() => pausa(win, 250));
    await win.fill('#mision0q0', '11'); await win.fill('#mision0q1', '3'); await seguir();
    await win.locator('#mision1q0o0').check(); await seguir();
    await seguir(); await seguir();
    await win.fill('#mision4q0', '4'); await win.fill('#mision4q1', 'Ahora son cuatro pasos. Uno más.'); await win.locator('#mision4q2o1').check();
    await seguir();
    const hayBoton = await win.evaluate(() => !!$('misionDescargar'));
    const resp = path.join(carpeta, `${variante}-respuestas.json`);
    candado = await bloquear(win, resp);
    await preparar(app, 'escribir', resp);
    await win.locator('#misionDescargar').click();
    d = await terminada(app, win);
    v = await vista(win);
    revisar(hayBoton && d.estado === 'interrupted' && /^respuestas-.*-estudio_x1-\d{8}-\d{4}\.json$/.test(d.nombre || '') && dice(v, `${variante}-respuestas.json`) && v.avisos[0].enMision,
      `E2 (${variante}): «Descargar respuestas» con el archivo en uso avisa en el panel de la misión, con «Reintentar» (${d.nombre}; ${json(v.avisos)})`);
    const resp2 = path.join(carpeta, `${variante}-respuestas-2.json`);
    await sinToast(win);
    await preparar(app, 'escribir', resp2);
    await reintentar(win, '#misionDescargar');
    d = await terminada(app, win);
    v = await vista(win);
    let leidas = null;
    try { leidas = JSON.parse(fs.readFileSync(resp2, 'utf8')); } catch (e) { /* sin archivo */ }
    revisar(d.estado === 'completed' && v.avisos.length === 0 && confirma(v, `${variante}-respuestas-2.json`) && leidas && leidas.tarea && leidas.tarea.id === 'estudio_x1',
      `E2 (${variante}): «Reintentar» escribe las respuestas, el aviso se va y el toast confirma (${json(v.toast)}; tarea ${leidas && leidas.tarea && leidas.tarea.id})`);
    revisar(await soltar(win, candado, resp), `E2 (${variante}): las respuestas anteriores quedaron intactas`);
    await app.close();
  }

  revisar(errores.length === 0, `sin errores en la página (${json(errores.slice(0, 3))})`);
  console.log(`\n${fallos ? fallos + ' FALLAS' : 'Todo bien'}`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
