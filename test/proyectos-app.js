// Abrir, guardar y recuperar proyectos en la app de escritorio, con datos sintéticos (verificación de Codex del 24 oct):
// AUD-19, el C++ escrito a mano se conserva también vacío, al reabrir, al rechazar un proyecto que no abre y al reiniciar
// la app; AUD-24, los bloques propios que usa el programa viajan en el proyecto aunque se guarde enseguida; AUD-25, el
// selector de archivo abre solo lo del archivo elegido ahora, para proyectos y para librerías.
// Uso: npm run test:proyectos   (arma con --simulador-local)
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const RAIZ = path.join(__dirname, '..');
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const BASE = { app: 'TecnoBloques', version: 1, placa: 'uno', nivel: 3, nombre: 'Base', bloques: { blocks: { languageVersion: 0, blocks: [{ type: 'programa', id: 'inicio', x: 40, y: 40 }] } } };
const MALO = { app: 'TecnoBloques', version: 1, placa: 'nano', nivel: 1, nombre: 'Malo', bloques: { blocks: { languageVersion: 0, blocks: [{ type: 'bloque_que_no_existe', x: 0, y: 0 }] } } };
const llamada = (nombre) => ({ type: 'fn_call', extraState: { nombre, tipo: 'void', params: [] } });
const definicion = (nombre, llamaA) => ({ nombre, tipo: 'void', params: [], cuerpo: { type: 'fn_def', fields: { NAME: nombre, TIPO: 'void', NPARAM: '0' },
  ...(llamaA ? { inputs: { BODY: { block: llamada(llamaA) } } } : {}) } });
// Un programa que llama a «saludo», que a su vez llama a «otro»: dos bloques propios, uno directo y uno transitivo
const CON_PROPIOS = { ...BASE, nombre: 'Con bloques propios', embebidos: { saludo: definicion('saludo', 'otro'), otro: definicion('otro') },
  bloques: { blocks: { languageVersion: 0, blocks: [{ type: 'programa', id: 'inicio', x: 40, y: 40, inputs: { SETUP: { block: llamada('saludo') } } }] } } };

(async () => {
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE')) };
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-proyectos');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  const errores = [];
  async function abrir() {
    const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`], cwd: RAIZ, env });
    const win = await app.firstWindow();
    win.on('pageerror', (e) => errores.push(String(e)));
    win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
    await win.waitForLoadState('load');
    await win.waitForTimeout(1500);
    return { app, win };
  }
  let { app, win } = await abrir();
  const pausa = (ms) => win.waitForTimeout(ms);
  const cargar = (p) => win.evaluate((x) => cargarProyecto(x, true), p);
  // Lo que importa del proyecto abierto: el modo, el C++, lo que compila, la base del modo texto, lo demás del proyecto y
  // lo que quedó en el autoguardado
  const vista = () => win.evaluate(() => {
    const p = proyectoActual();
    const auto = leerLocal(CLAVE_AUTO) || {};
    return { modo: !!estado.texto, texto: p.texto, codigo: codigoActual(), base: estado.texto ? estado.texto.base : null, nombre: p.nombre, placa: p.placa,
      nivel: p.nivel, bloques: JSON.stringify(p.bloques), autoTexto: auto.texto, autoNombre: auto.nombre };
  });
  const distintos = (a, b, campos) => campos.filter((k) => a[k] !== b[k]);

  // ---- AUD-19 (F03): una cadena, también vacía o con espacios, es el modo texto; null, los bloques
  for (const [nombre, texto] of [['vacío', ''], ['con solo espacios', '   \n  '], ['con código', 'void setup() { int CONSERVAR = 42; }\nvoid loop() {}\n']]) {
    await cargar(BASE);
    await pausa(300);
    await win.evaluate((t) => entrarModoTexto(t), texto);
    await pausa(800); // el autoguardado espera 600 ms
    const reabre = await win.evaluate(() => cargarProyecto(proyectoActual(), true));
    await pausa(800);
    const tras = await vista();
    revisar(reabre === true && tras.modo && tras.texto === texto && tras.codigo === texto && tras.autoTexto === texto,
      `AUD-19, C++ ${nombre}: guardar y reabrir lo conserva en modo texto, en lo que compila y en el autoguardado`);
    const rechazo = await cargar(MALO);
    await pausa(800);
    const trasRechazo = await vista();
    const cambiaron = distintos(tras, trasRechazo, ['modo', 'texto', 'codigo', 'base', 'nombre', 'placa', 'nivel', 'bloques', 'autoTexto', 'autoNombre']);
    revisar(rechazo !== true && !cambiaron.length, `AUD-19, C++ ${nombre}: un proyecto que no abre deja el anterior igual (${cambiaron.join(', ') || 'todo igual'})`);
  }
  await cargar({ ...BASE, nombre: 'Sin texto', texto: null });
  await pausa(300);
  const sinTexto = await vista();
  revisar(!sinTexto.modo && sinTexto.texto === null && /void setup\(\)/.test(sinTexto.codigo), 'control AUD-19: con texto null el proyecto abre en bloques');
  for (const [nombre, texto] of [['un número', 5], ['un objeto', { a: 1 }], ['verdadero', true]]) {
    const antes = await vista();
    const r = await cargar({ ...BASE, nombre: 'Texto raro', texto });
    await pausa(300);
    const despues = await vista();
    revisar(typeof r === 'string' && /su C\+\+ no es un texto/.test(r) && !distintos(antes, despues, ['modo', 'texto', 'codigo', 'nombre', 'placa', 'nivel', 'bloques']).length,
      `AUD-19: un proyecto cuyo C++ es ${nombre} se rechaza sin cambiar nada («${r}»)`);
  }
  // Al reiniciar la app, el autoguardado vuelve con el C++ vacío en modo texto
  await cargar(BASE);
  await pausa(300);
  await win.evaluate(() => entrarModoTexto(''));
  await pausa(900);
  await app.close();
  ({ app, win } = await abrir());
  const reinicio = await vista();
  revisar(reinicio.modo && reinicio.texto === '' && reinicio.codigo === '' && reinicio.nombre === 'Base', 'AUD-19: al reiniciar la app, el autoguardado vuelve en modo texto con el C++ vacío');

  // ---- AUD-24 (F04): guardar enseguida lleva los bloques propios del programa de ahora, también los transitivos
  await cargar(BASE);
  await pausa(300);
  const inmediato = await win.evaluate((p) => { cargarProyecto(p, true); return Object.keys(proyectoActual().embebidos).sort(); }, CON_PROPIOS);
  revisar(inmediato.join() === 'otro,saludo', `AUD-24: enseguida de abrir, el proyecto ya lleva «saludo» y el transitivo «otro» (${inmediato.join(', ') || 'ninguno'})`);
  const porBoton = await win.evaluate((p) => {
    cargarProyecto({ ...p, nombre: 'Otro antes' }, true);
    cargarProyecto(p, true);
    $('btnGuardar').click();
    const guardado = JSON.parse(document.querySelector('#modal textarea').value);
    cerrarModal(false);
    return guardado;
  }, CON_PROPIOS);
  revisar(Object.keys(porBoton.embebidos).sort().join() === 'otro,saludo', 'AUD-24: el botón Guardar, antes de que se actualice el código, lleva las dos definiciones');
  await cargar(BASE);
  await pausa(300);
  await win.evaluate((p) => cargarProyecto(p, true), CON_PROPIOS);
  await win.keyboard.press('Control+KeyS');
  const porTeclado = await win.evaluate(() => { const t = document.querySelector('#modal textarea'); const g = t && JSON.parse(t.value); cerrarModal(false); return g; });
  revisar(porTeclado && Object.keys(porTeclado.embebidos).sort().join() === 'otro,saludo', 'AUD-24: Ctrl+S, enseguida, también');
  await pausa(400);
  const despuesDeActualizar = await win.evaluate(() => Object.keys(proyectoActual().embebidos).sort().join());
  revisar(despuesDeActualizar === 'otro,saludo', 'control AUD-24: después de actualizar el código, lo mismo');
  // Reabierto en un PC sin esos bloques en Mis bloques: el programa se genera entero
  const reabierto = await win.evaluate(async (g) => {
    cargarProyecto(g, true);
    await new Promise((listo) => setTimeout(listo, 400));
    return { libreria: Object.keys(leerLibreria()).length, codigo: codigoActual(), avisos: ultimo.avisos.map((a) => a.msg) };
  }, porBoton);
  revisar(reabierto.libreria === 0 && /void saludo\(\)/.test(reabierto.codigo) && /void otro\(\)/.test(reabierto.codigo) && !reabierto.avisos.some((a) => /No encuentro el bloque/.test(a)),
    'AUD-24: lo guardado abre en un computador sin esos bloques en Mis bloques, con los dos en el programa');
  // Agregar o quitar una llamada y guardar enseguida
  const conLlamada = await win.evaluate((p) => {
    cargarProyecto({ ...p, bloques: { blocks: { languageVersion: 0, blocks: [{ type: 'programa', id: 'inicio', x: 40, y: 40 }] } } }, true);
    const sin = Object.keys(proyectoActual().embebidos).join();
    Blockly.serialization.workspaces.load(p.bloques, espacio); // ahora el programa llama a «saludo»
    const con = Object.keys(proyectoActual().embebidos).sort().join();
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [{ type: 'programa', id: 'inicio', x: 40, y: 40 }] } }, espacio);
    const quitada = Object.keys(proyectoActual().embebidos).join();
    return { sin, con, quitada };
  }, CON_PROPIOS);
  revisar(conLlamada.sin === '' && conLlamada.con === 'otro,saludo' && conLlamada.quitada === '', `AUD-24: agregar y quitar la llamada se ve al guardar enseguida (${JSON.stringify(conLlamada)})`);
  const enTexto = await win.evaluate((p) => { cargarProyecto(p, true); entrarModoTexto('void setup() {}\nvoid loop() {}\n'); const g = proyectoActual(); return { embebidos: Object.keys(g.embebidos).sort().join(), texto: g.texto }; }, CON_PROPIOS);
  revisar(enTexto.embebidos === 'otro,saludo' && enTexto.texto === 'void setup() {}\nvoid loop() {}\n', 'AUD-24: en modo texto, el proyecto conserva su C++ y los bloques propios de sus bloques');
  await win.evaluate(() => salirModoTexto(true));

  // ---- AUD-25 (F05): el selector de archivo abre solo lo del archivo elegido ahora
  // Un FileReader de prueba: cada lectura se termina a mano, con su contenido, un error o (si lo tiene) abort()
  await win.evaluate(() => {
    window._lectorReal = FileReader;
    window._lecturas = [];
    window.FileReader = class {
      readAsText(f) { this.archivo = f.name; this.abortado = false; window._lecturas.push(this); }
      abort() { this.abortado = true; if (this.onabort) this.onabort(); }
    };
    window._terminar = (i, contenido) => { const r = window._lecturas[i]; r.result = contenido; r.onload(); };
    window._fallar = (i) => { const r = window._lecturas[i]; r.error = new Error('lectura sintética fallida'); r.onerror(); };
  });
  const elegir = async (nombre) => win.locator('#archivoModal').setInputFiles({ name: nombre, mimeType: 'application/json', buffer: Buffer.from('{}') });
  const dialogoProyecto = () => win.evaluate(() => {
    window._abiertos = [];
    modalAbrirTexto({ titulo: 'Abrir proyecto', explicacion: 'Prueba', alLeer: (d) => { window._abiertos.push(d.nombre); return cargarProyecto(d, true); } });
  });
  const proyecto = (nombre) => JSON.stringify({ ...BASE, nombre });
  const estadoDialogo = () => win.evaluate(() => ({ caja: document.querySelector('#modal textarea').value, error: document.querySelector('#modal p.error').textContent,
    archivos: $('archivoModal').files.length, abiertos: window._abiertos.slice(), lecturas: window._lecturas.length, abortadas: window._lecturas.filter((r) => r.abortado).length }));
  const pulsarAbrir = () => win.locator('#modalAcciones .primario').click();
  const desde = () => win.evaluate(() => window._lecturas.length);

  for (const orden of ['B termina antes que A', 'A termina antes que B']) {
    await dialogoProyecto();
    const i = await desde();
    await elegir('A.tbq.json');
    await elegir('B.tbq.json');
    const trasElegir = await estadoDialogo();
    if (orden === 'B termina antes que A') { await win.evaluate((k) => { _terminar(k + 1, JSON.stringify({ app: 'TecnoBloques', version: 1, placa: 'uno', nivel: 3, nombre: 'B', bloques: { blocks: { languageVersion: 0, blocks: [] } } })); }, i); await win.evaluate((k) => _terminar(k, '{"app":"TecnoBloques","nombre":"A","bloques":{}}'), i); }
    else { await win.evaluate((k) => _terminar(k, '{"app":"TecnoBloques","nombre":"A","bloques":{}}'), i); await win.evaluate((k) => { _terminar(k + 1, JSON.stringify({ app: 'TecnoBloques', version: 1, placa: 'uno', nivel: 3, nombre: 'B', bloques: { blocks: { languageVersion: 0, blocks: [] } } })); }, i); }
    const caja = (await estadoDialogo()).caja;
    await pulsarAbrir();
    await pausa(200);
    const fin = await estadoDialogo().catch(() => null);
    const abiertos = await win.evaluate(() => window._abiertos.slice());
    revisar(trasElegir.abortadas >= 1 && JSON.parse(caja).nombre === 'B' && abiertos.join() === 'B' && await win.evaluate(() => $('nombreProyecto').value) === 'B',
      `AUD-25, A y luego B, ${orden}: se abre B, el elegido (${abiertos.join() || 'nada'}; la lectura de A se soltó: ${trasElegir.abortadas})`);
    if (fin) await win.evaluate(() => cerrarModal(false));
  }
  {
    // Abrir mientras se lee: no abre lo de antes; espera la lectura del archivo elegido
    await dialogoProyecto();
    const i = await desde();
    await elegir('C.tbq.json');
    await win.evaluate(({ k, c }) => _terminar(k, c), { k: i, c: proyecto('C') });
    await elegir('D.tbq.json');
    await pulsarAbrir();
    const mientras = await estadoDialogo();
    await win.evaluate(({ k, c }) => _terminar(k + 1, c), { k: i, c: proyecto('D') });
    await pulsarAbrir();
    await pausa(200);
    const abiertos = await win.evaluate(() => window._abiertos.slice());
    revisar(!mientras.abiertos.length && mientras.caja === '' && /Todavía se está leyendo/.test(mientras.error) && abiertos.join() === 'D',
      `AUD-25: Abrir mientras se lee D no abre C; al terminar, se abre D («${mientras.error}»)`);
  }
  {
    // Un error de la lectura vigente se dice y no abre nada; el de una lectura vieja no importa
    await dialogoProyecto();
    const i = await desde();
    await elegir('E.tbq.json');
    await win.evaluate((k) => _fallar(k), i);
    const conError = await estadoDialogo();
    await pulsarAbrir();
    const trasAbrir = await estadoDialogo();
    revisar(/No se pudo leer el archivo/.test(conError.error) && conError.caja === '' && !trasAbrir.abiertos.length, `AUD-25: si falla la lectura del archivo elegido, se dice y no se abre nada («${conError.error}»)`);
    await elegir('F.tbq.json');
    await elegir('G.tbq.json');
    await win.evaluate((k) => _fallar(k + 1), i); // F, ya vieja
    await win.evaluate(({ k, c }) => _terminar(k + 2, c), { k: i, c: proyecto('G') });
    const sinError = await estadoDialogo();
    await pulsarAbrir();
    await pausa(200);
    revisar(sinError.error === '' && JSON.parse(sinError.caja).nombre === 'G' && (await win.evaluate(() => window._abiertos.slice())).join() === 'G',
      'AUD-25: el error de una lectura vieja no se muestra y se abre el archivo elegido');
  }
  {
    // Escribir a mano mientras se lee: manda lo escrito; la lectura se suelta y el archivo deja de estar elegido
    await dialogoProyecto();
    const i = await desde();
    await elegir('H.tbq.json');
    await win.locator('#modal textarea').fill(proyecto('Escrito a mano'));
    const trasEscribir = await estadoDialogo();
    await win.evaluate(({ k, c }) => _terminar(k, c), { k: i, c: proyecto('H') });
    await pulsarAbrir();
    await pausa(200);
    revisar(trasEscribir.archivos === 0 && trasEscribir.abortadas >= 1 && (await win.evaluate(() => window._abiertos.slice())).join() === 'Escrito a mano',
      'AUD-25: lo escrito a mano mientras se leía manda: la lectura se suelta, el archivo deja de estar elegido y se abre lo escrito');
  }
  {
    // Cancelar el diálogo con una lectura pendiente y abrir otro: la lectura vieja no escribe en el nuevo
    await dialogoProyecto();
    const i = await desde();
    await elegir('I.tbq.json');
    await win.locator('#modalAcciones button', { hasText: 'Cancelar' }).click();
    await dialogoProyecto();
    await win.evaluate(({ k, c }) => { try { _terminar(k, c); } catch (e) { /* ya soltada */ } }, { k: i, c: proyecto('I') });
    const nuevo = await estadoDialogo();
    revisar(nuevo.caja === '' && !nuevo.abiertos.length, 'AUD-25: cancelar con una lectura pendiente y abrir otro diálogo: la lectura vieja no escribe en el nuevo');
    await win.evaluate(() => cerrarModal(false));
  }
  {
    // Las librerías usan el mismo diálogo: con A y B invertidos se importa B
    await win.evaluate(() => importarLibreria());
    const i = await desde();
    await elegir('A.tblib.json');
    await elegir('B.tblib.json');
    const lib = (nombre) => JSON.stringify({ app: 'TecnoBloques', bloques: { [nombre]: definicion(nombre) } });
    await win.evaluate(({ k, c }) => _terminar(k + 1, c), { k: i, c: lib('deB') });
    await win.evaluate(({ k, c }) => _terminar(k, c), { k: i, c: lib('deA') });
    await pulsarAbrir();
    await pausa(300);
    const nombres = await win.evaluate(() => Object.keys(leerLibreria()).sort());
    revisar(nombres.includes('deB') && !nombres.includes('deA'), `AUD-25: al importar una librería con lecturas invertidas, se importa la elegida (${nombres.join(', ')})`);
  }
  {
    // Control con el lector de verdad y un archivo real
    await win.evaluate(() => { window.FileReader = window._lectorReal; });
    await dialogoProyecto();
    await win.locator('#archivoModal').setInputFiles({ name: 'Real.tbq.json', mimeType: 'application/json', buffer: Buffer.from(proyecto('Real')) });
    await win.waitForFunction(() => document.querySelector('#modal textarea').value.length > 0, null, { timeout: 5000 });
    await pulsarAbrir();
    await pausa(200);
    revisar((await win.evaluate(() => window._abiertos.slice())).join() === 'Real' && await win.evaluate(() => $('nombreProyecto').value) === 'Real',
      'control AUD-25: con el lector de verdad, se abre el archivo elegido');
  }

  await app.close();
  revisar(!errores.length, 'sin errores en la consola' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
  fs.rmSync(datos, { recursive: true, force: true });
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
