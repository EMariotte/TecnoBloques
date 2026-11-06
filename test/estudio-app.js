// Prueba de punta a punta del estudio A/B en la app de escritorio (EST-002, I2; diseño en
// TecnoSuite/EstrategíaTecno/DISENO-I2-SERVICIOS.md): el instructor elige la variante, escribe la lista de grupos y el
// código de clase con su PIN; un equipo entra con el código y su grupo y el registro anota «<clase>-<grupo>»; la
// simulación pasa por la autoridad de ejecución (revisión, destino y desactualizada); el lienzo se mueve a otro
// contenedor sin reiniciar la simulación (S4); un estudio dañado vale C0. Necesita arduino-cli (como test:simulador).
// Uso: npm run test:estudio-app   (arma con --simulador-local)
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
  const datos = path.join(os.tmpdir(), 'tecnobloques-prueba-estudio-app');
  if (path.dirname(path.resolve(datos)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(datos, { recursive: true, force: true });
  const registros = path.join(datos, 'registros');
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
  const esperar = (win, condicion, ms = 40000) => win.waitForFunction(condicion, null, { timeout: ms, polling: 200 }).then(() => true, () => false);
  const titulo = (win) => win.evaluate(() => ($('modal').hidden ? null : $('modalTitulo').textContent));
  const boton = (win, texto) => win.locator('#modalAcciones button', { hasText: texto }).click();
  const leerRegistro = () => (fs.existsSync(registros) ? fs.readdirSync(registros) : [])
    .flatMap((f) => fs.readFileSync(path.join(registros, f), 'utf8').split('\n').filter(Boolean).map((l) => ({ archivo: f, ...JSON.parse(l) })));
  const entrarComoInstructor = async (win) => {
    await win.keyboard.press('Control+Alt+Shift+KeyR');
    await win.waitForTimeout(300);
    await win.locator('#pinInstructor').fill('2468');
    await boton(win, 'Entrar');
    await win.waitForTimeout(400);
  };

  // 1. Recién instalada: C0 y nada del estudio a la vista
  let { app, win } = await abrir();
  revisar(await win.evaluate(() => document.body.dataset.variante) === 'C0', 'recién instalada: la variante es C0');
  const estadoInicial = await win.evaluate(() => tbEscritorio.estudio.estado());
  revisar(estadoInicial.variante === 'C0' && !estadoInicial.hayClase && !estadoInicial.hayLista && !estadoInicial.danado, 'sin estudio configurado: C0, sin clase ni lista');

  // 2. El instructor crea su PIN y configura el estudio (sin encender todavía el registro)
  await win.keyboard.press('Control+Alt+Shift+KeyR');
  await win.waitForTimeout(300);
  await win.locator('#pinNuevo').fill('2468');
  await win.locator('#pinRepetido').fill('2468');
  await boton(win, 'Crear PIN');
  await win.waitForTimeout(500);
  revisar(await win.locator('#modalAcciones button', { hasText: 'Estudio A/B' }).count() === 1, 'el panel del instructor ofrece «Estudio A/B»');
  await boton(win, 'Estudio A/B');
  await win.waitForTimeout(400);
  revisar(await titulo(win) === 'Estudio A/B (instructor)' && await win.locator('#varianteEstudio').inputValue() === 'C0', 'el panel del estudio abre en C0');
  await win.locator('#listaEstudio').fill('G1\nG2\ng1');
  await boton(win, 'Guardar');
  await win.waitForTimeout(300);
  revisar(/repetido/.test(await win.locator('#errorEstudio').textContent()), `una lista con un repetido no se guarda: «${await win.locator('#errorEstudio').textContent()}»`);
  await win.locator('#varianteEstudio').selectOption('B');
  await win.locator('#listaEstudio').fill('G1\nG2\nLos Rayos');
  await boton(win, 'Guardar');
  await win.waitForTimeout(300);
  revisar(/B · por actividad · 3 grupos/.test(await win.locator('#notaEstudio').textContent()) && await win.evaluate(() => document.body.dataset.variante) === 'B',
    `guarda la variante B y 3 grupos: «${await win.locator('#notaEstudio').textContent()}»`);
  await boton(win, 'Nuevo código de clase');
  await win.waitForTimeout(300);
  const codigo = (await win.locator('#codigoClase').textContent()).trim();
  revisar(/^[A-HJ-NP-Z2-9]{6}$/.test(codigo), `«Nuevo código de clase»: ${codigo}`);
  await win.locator('#otroCodigoClase').fill('K7Q2M0');
  await boton(win, 'Usar este código');
  await win.waitForTimeout(300);
  revisar(/6 caracteres/.test(await win.locator('#errorEstudio').textContent()) && (await win.locator('#codigoClase').textContent()).trim() === codigo, 'un código con 0 se rechaza y el de antes sigue');
  await win.screenshot({ path: path.join(SALIDA, 'estudio_1_panel.png') });
  await boton(win, 'Cerrar');
  revisar(await win.evaluate(() => tbEscritorio.estudio.estado().then((e) => !('listaBlanca' in e) && !('clase' in e) && e.grupos === 3)), 'sin PIN, la página no ve la lista ni el código: solo cuántos grupos hay');

  // 3. Con el registro encendido, el equipo entra con el código de clase y su grupo
  await entrarComoInstructor(win);
  await boton(win, 'Encender el registro');
  await win.waitForTimeout(500);
  revisar(await titulo(win) === 'Código de clase y grupo', 'con el estudio configurado, pide el código de clase y el grupo');
  await win.locator('#claseEstudio').fill(codigo.toLowerCase());
  await win.locator('#grupoEstudio').fill('G7');
  await boton(win, 'Seguir');
  await win.waitForTimeout(300);
  revisar(/no está en la lista/.test(await win.locator('#errorGrupo').textContent()), 'un grupo fuera de la lista no entra');
  await win.locator('#claseEstudio').fill('AAAAAA');
  await win.locator('#grupoEstudio').fill('g1');
  await boton(win, 'Seguir');
  await win.waitForTimeout(300);
  revisar(/código de clase de hoy/.test(await win.locator('#errorGrupo').textContent()), 'con otro código de clase no entra');
  await win.locator('#claseEstudio').fill(codigo.toLowerCase());
  await win.locator('#grupoEstudio').press('Enter');
  await win.waitForTimeout(300);
  revisar(await titulo(win) === `¿Son el equipo ${codigo}-G1?`, `confirma «${await titulo(win)}»`);
  await boton(win, 'Corregir');
  await win.waitForTimeout(300);
  revisar(await titulo(win) === 'Código de clase y grupo' && await win.locator('#grupoEstudio').inputValue() === 'g1', 'Corregir vuelve al código y al grupo escritos');
  await boton(win, 'Seguir');
  await win.waitForTimeout(300);
  await boton(win, 'Sí, somos ese equipo');
  await win.waitForTimeout(300);
  revisar(await win.evaluate(() => registroEventos.equipo()) === `${codigo}-G1`, `el registro trabaja con el equipo ${codigo}-G1`);

  // 4. Simular el ejercicio X: la corrida queda con su revisión y destino; editar la marca como atrasada
  await win.evaluate(({ circuito, programa }) => {
    const p = proyectoActual();
    p.circuito = circuito;
    p.texto = programa;
    cargarProyecto(p, true);
  }, { circuito: X, programa: PROGRAMA_X });
  await win.waitForTimeout(500);
  await win.locator('#btnSimularBarra').click();
  revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 500), 'compila y simula el ejercicio X');
  let ej = await win.evaluate(() => ({ ...$('estadoSim').dataset, estado: estadoEjecucion(), rev: docPrograma.revision() }));
  revisar(ej.destino === 'simulacion' && ej.revision === String(ej.rev) && ej.desactualizada === 'false' && ej.estado.iniciada, `la corrida: simulación, revisión ${ej.revision}, al día`);
  const visible = await win.evaluate(() => $('estadoSim').textContent);
  revisar(/^Simulando/.test(visible), `en C0 lo que se ve no cambia: «${visible}»`);
  await win.evaluate(() => { $('editor').value += '// cambio\n'; $('editor').dispatchEvent(new Event('input')); uiSimulador(); });
  ej = await win.evaluate(() => ({ ...$('estadoSim').dataset }));
  revisar(ej.desactualizada === 'true' && ej.destino === 'simulacion', 'editar después de simular marca la corrida como de una revisión anterior, sin cambiar el destino');

  // 5. S4: mover el lienzo a otro contenedor y devolverlo, con la simulación andando
  const mover = await win.evaluate(async () => {
    const lienzo = $('lienzoCircuito');
    const padre = lienzo.parentNode, siguiente = lienzo.nextSibling;
    const sim = simulador.sim;
    const iniciadas = () => simulador.eventos.filter((e) => e.tipo === 'simulacion_iniciada').length;
    const antes = { ms: sim.medidas().msSimulados, iniciadas: iniciadas() };
    const otro = document.createElement('div');
    otro.id = 'otroPanel';
    otro.style.cssText = 'position:fixed;left:0;top:0;width:700px;height:500px;';
    document.body.append(otro);
    otro.append(lienzo);
    await new Promise((r) => setTimeout(r, 1200));
    const lejos = { ms: sim.medidas().msSimulados, mismo: simulador.sim === sim, mediciones: !!sim.mediciones(), dentro: otro.contains(lienzo) && [...lienzo.querySelectorAll('*')].some((h) => h.shadowRoot && h.shadowRoot.querySelector('svg')) }; // el lienzo vive en un shadow DOM
    padre.insertBefore(lienzo, siguiente);
    otro.remove();
    await new Promise((r) => setTimeout(r, 1200));
    return { antes, lejos, despues: { ms: sim.medidas().msSimulados, mismo: simulador.sim === sim, iniciadas: iniciadas(), devuelto: lienzo.parentNode === padre } };
  });
  revisar(mover.lejos.mismo && mover.lejos.dentro && mover.lejos.ms > mover.antes.ms && mover.lejos.mediciones,
    `S4: en otro contenedor, la misma simulación sigue (${Math.round(mover.antes.ms)} → ${Math.round(mover.lejos.ms)} ms) y el dibujo va con ella`);
  revisar(mover.despues.mismo && mover.despues.ms > mover.lejos.ms && mover.despues.iniciadas === mover.antes.iniciadas && mover.despues.devuelto,
    `S4: devuelto a su lugar, sigue la misma (${Math.round(mover.despues.ms)} ms) y no hubo otro simulacion_iniciada`);
  await win.screenshot({ path: path.join(SALIDA, 'estudio_2_simulando.png') });
  await win.evaluate(() => detenerSimulacion());
  await win.waitForTimeout(400);
  revisar(await win.evaluate(() => $('estadoSim').dataset.destino) === '', 'al detener, ya no hay destino');
  await app.close();
  await new Promise((r) => setTimeout(r, 500));
  const lineas = leerRegistro();
  revisar(lineas.length > 0 && lineas.every((l) => l.equipo === `${codigo}-G1`) && lineas.every((l) => l.archivo.startsWith(`${codigo}-G1-`)),
    `las ${lineas.length} líneas del registro van con el equipo ${codigo}-G1, en su archivo`);
  const textoRegistro = fs.readdirSync(registros).map((f) => fs.readFileSync(path.join(registros, f), 'utf8')).join('');
  revisar(!textoRegistro.includes('Los Rayos') && !textoRegistro.includes('"G2"'), 'el registro no lleva la lista de grupos');

  // 6. Al abrir otra vez: la variante sigue y vuelve a pedir el código y el grupo
  ({ app, win } = await abrir());
  revisar(await win.evaluate(() => document.body.dataset.variante) === 'B' && await titulo(win) === 'Código de clase y grupo', 'al abrir otra vez, sigue en B y pide el código y el grupo');
  await win.evaluate(() => cerrarModal(true));
  await app.close();
  await new Promise((r) => setTimeout(r, 400));

  // 7. Estudio dañado: vale C0, los equipos entran como siempre y el instructor puede empezar de nuevo
  fs.writeFileSync(path.join(datos, 'estudio-config.json'), '{"formato":1,"variante":"A","listaBlanca":["G1","g1"]}');
  ({ app, win } = await abrir());
  revisar(await win.evaluate(() => document.body.dataset.variante) === 'C0' && await titulo(win) === 'Código del equipo', 'con el estudio dañado: C0 y el código del equipo de siempre');
  await win.evaluate(() => cerrarModal(true));
  await entrarComoInstructor(win);
  await boton(win, 'Estudio A/B');
  await win.waitForTimeout(400);
  revisar(await titulo(win) === 'Estudio A/B: la configuración está dañada', 'el panel lo avisa');
  await boton(win, 'Empezar de nuevo');
  await win.waitForTimeout(500);
  revisar(await titulo(win) === 'Estudio A/B (instructor)' && await win.locator('#varianteEstudio').inputValue() === 'C0' && await win.locator('#listaEstudio').inputValue() === '',
    'empezar de nuevo: C0, sin lista');
  revisar(fs.readdirSync(datos).some((f) => f.startsWith('estudio-config-danado-')), 'y la dañada queda aparte');
  await boton(win, 'Cerrar');
  await app.close();

  // 8. La r1 de I2 (COD-20261105-006, F01–F04) y el botón para vaciar la lista (decisión de Efraín, 5 nov). Cada parte
  // sigue aunque falle la anterior, para que la corrida de «antes» muestre todos los casos.
  ({ app, win } = await abrir());
  win.setDefaultTimeout(5000);
  await win.evaluate(() => cerrarModal(true));
  const archivoEstudio = path.join(datos, 'estudio-config.json');
  const enDisco = () => { try { return JSON.parse(fs.readFileSync(archivoEstudio, 'utf8')); } catch (e) { return null; } };
  const variantePagina = () => win.evaluate(() => document.body.dataset.variante);
  const instructor = (peticion) => win.evaluate((p) => tbEscritorio.registro.instructor({ ...p, pin: '2468' }), peticion);
  // modal() pone el foco en el primer campo 20 ms después de abrir: si llega en medio de un fill(), Playwright no borra el
  // campo (13 de 40 veces en una prueba aparte). Se escribe cuando el foco ya está en su lugar, como haría una persona.
  const focoEn = (id) => win.waitForFunction((id) => document.activeElement && document.activeElement.id === id, id, { timeout: 3000, polling: 10 });
  const abrirPanel = async () => { await win.evaluate(() => panelEstudio('2468')); await focoEn('varianteEstudio'); };
  const capturar = async (nombre) => {
    for (const [w, h] of [[1366, 768], [1536, 864]]) {
      await app.browserWindow(win).then((b) => b.evaluate((b, [w, h]) => b.setContentSize(w, h), [w, h]));
      await win.waitForTimeout(300);
      await win.screenshot({ path: path.join(SALIDA, `${nombre}_${w}x${h}.png`) });
    }
  };
  const parte = async (nombre, fn) => {
    try { await fn(); } catch (e) { revisar(false, `${nombre}: ${String(e.message || e).split('\n')[0]}`); await win.evaluate(() => cerrarModal(true)).catch(() => {}); }
  };

  await parte('F01 · Guardar es todo o nada', async () => {
    await abrirPanel();
    await win.locator('#listaEstudio').fill('G1\nLos Rayos');
    await boton(win, 'Guardar');
    await win.waitForTimeout(300);
    revisar(enDisco().variante === 'C0' && enDisco().listaBlanca.join('|') === 'G1|Los Rayos', 'F01: una lista válida en C0 se guarda');
    await win.locator('#varianteEstudio').selectOption('B');
    await win.locator('#listaEstudio').fill('G1\ng1');
    await boton(win, 'Guardar');
    await win.waitForTimeout(300);
    revisar(/repetido/.test(await win.locator('#errorEstudio').textContent()) && enDisco().variante === 'C0' && await variantePagina() === 'C0' && enDisco().listaBlanca.join('|') === 'G1|Los Rayos',
      `F01: C0→B con una lista inválida no guarda nada (archivo ${enDisco().variante}, página ${await variantePagina()})`);
    // F04: el error se anuncia y queda unido a su campo; el foco no salta
    const a11y = await win.evaluate(() => ({ rol: $('errorEstudio').getAttribute('role'), nota: $('notaEstudio').getAttribute('role'),
      describe: ($('listaEstudio').getAttribute('aria-describedby') || '').split(' ').includes('errorEstudio'), invalido: $('listaEstudio').getAttribute('aria-invalid'),
      foco: document.activeElement && document.activeElement.textContent }));
    revisar(a11y.rol === 'alert' && a11y.nota === 'status', `F04: el error del panel es role=alert y la nota role=status (${a11y.rol}, ${a11y.nota})`);
    revisar(a11y.describe && a11y.invalido === 'true', `F04: la lista queda aria-invalid y unida a su error (${a11y.describe}, ${a11y.invalido})`);
    revisar(a11y.foco === 'Guardar', `F04: el foco sigue en «Guardar» (${a11y.foco})`);
    await capturar('r1_panel_error');
    await win.locator('#listaEstudio').fill('G1\nLos Rayos\nG2');
    await boton(win, 'Guardar');
    await win.waitForTimeout(300);
    revisar(enDisco().variante === 'B' && await variantePagina() === 'B' && enDisco().listaBlanca.length === 3 && /B · por actividad · 3 grupos/.test(await win.locator('#notaEstudio').textContent()),
      'F01: el conjunto válido se guarda entero: B y 3 grupos');
    revisar(await win.evaluate(() => $('listaEstudio').getAttribute('aria-invalid')) !== 'true' && await win.locator('#errorEstudio').textContent() === '', 'F04: al guardar bien, se quita la marca del error');
    await win.locator('#varianteEstudio').selectOption('A');
    await win.locator('#listaEstudio').fill('G1\n' + 'x'.repeat(40));
    await boton(win, 'Guardar');
    await win.waitForTimeout(300);
    revisar(enDisco().variante === 'B' && await variantePagina() === 'B' && enDisco().listaBlanca.length === 3, 'F01: B→A con una lista inválida no cambia nada');
    // El disco no deja escribir (una carpeta donde va el temporal): nada cambia y se dice
    fs.mkdirSync(archivoEstudio + '.tmp');
    await win.locator('#listaEstudio').fill('G1\nG2');
    await boton(win, 'Guardar');
    await win.waitForTimeout(300);
    revisar(/No se pudo guardar/.test(await win.locator('#errorEstudio').textContent()) && enDisco().variante === 'B' && await variantePagina() === 'B' && enDisco().listaBlanca.length === 3,
      `F01: con el disco fallando, nada cambia y se avisa («${await win.locator('#errorEstudio').textContent()}»)`);
    fs.rmSync(archivoEstudio + '.tmp', { recursive: true, force: true });
    await win.locator('#varianteEstudio').selectOption('B');
    await win.locator('#listaEstudio').fill('G1\nLos Rayos\nG2');
    await boton(win, 'Guardar');
    await win.waitForTimeout(300);
    revisar(/No hay cambios/.test(await win.locator('#notaEstudio').textContent()), `sin cambios, Guardar lo dice («${await win.locator('#notaEstudio').textContent()}»)`);
    await capturar('r1_panel');
    await boton(win, 'Cerrar');
  });

  await parte('Vaciar la lista de grupos', async () => {
    await abrirPanel();
    await win.locator('#listaEstudio').fill('');
    await boton(win, 'Guardar');
    await win.waitForTimeout(300);
    revisar(/Vaciar la lista/.test(await win.locator('#errorEstudio').textContent()) && enDisco().listaBlanca.length === 3,
      `con el cuadro vacío, Guardar no borra la lista y explica cómo vaciarla («${await win.locator('#errorEstudio').textContent()}», ${enDisco().listaBlanca.length} grupos)`);
    revisar(await win.locator('#modalAcciones button').count() === 4, 'el pie del panel conserva sus cuatro botones: «Vaciar la lista» va junto a la lista');
    await win.locator('#vaciarLista').click();
    await win.waitForTimeout(300);
    revisar(await titulo(win) === '¿Vaciar la lista de grupos?', `pide confirmación: «${await titulo(win)}»`);
    revisar(await win.evaluate(() => document.activeElement && document.activeElement.textContent) === 'Cancelar', 'el foco empieza en «Cancelar»: Enter no vacía la lista');
    await capturar('r1_vaciar_confirmar');
    await boton(win, 'Cancelar');
    await win.waitForTimeout(400);
    revisar(await titulo(win) === 'Estudio A/B (instructor)' && enDisco().listaBlanca.length === 3 && (await win.locator('#listaEstudio').inputValue()).split('\n').length === 3,
      'Cancelar vuelve al panel con la lista intacta');
    await win.locator('#vaciarLista').click();
    await win.waitForTimeout(300);
    await win.keyboard.press('Escape');
    await win.waitForTimeout(400);
    revisar(await titulo(win) === 'Estudio A/B (instructor)' && enDisco().listaBlanca.length === 3, 'Escape en la confirmación también vuelve al panel sin vaciar');
    await win.locator('#vaciarLista').click();
    await win.waitForTimeout(300);
    await boton(win, 'Vaciar la lista');
    await win.waitForTimeout(500);
    const est = await win.evaluate(() => tbEscritorio.estudio.estado());
    revisar(await titulo(win) === 'Estudio A/B (instructor)' && enDisco().listaBlanca === null && enDisco().variante === 'B' && !est.hayLista && await win.locator('#listaEstudio').inputValue() === '',
      'vaciar deja la lista en nada, conserva la variante y vuelve al panel');
    revisar(/vaciada/.test(await win.locator('#notaEstudio').textContent()), `y lo dice: «${await win.locator('#notaEstudio').textContent()}»`);
    await boton(win, 'Cerrar');
    await win.evaluate(() => pedirEquipo());
    await win.waitForTimeout(300);
    revisar(await titulo(win) === 'Código del equipo', 'sin lista, los equipos vuelven a entrar con su código de siempre');
    await win.evaluate(() => cerrarModal(true));
  });

  await parte('F02 · respuestas tardías del grupo', async () => {
    await instructor({ accion: 'estudio-lista', lista: 'G1\nG2' });
    await instructor({ accion: 'estudio-clase', codigo: 'K7Q2MX' });
    // Una sola intercepción, con un retraso por grupo que se cambia (G1, 900 ms; G2 sin retraso)
    await app.evaluate(({ ipcMain }) => {
      const original = ipcMain._invokeHandlers.get('tb:estudio-entrar');
      globalThis.pruebaEntrar = { original, llamadas: 0, retraso: { G1: 900 } };
      ipcMain.removeHandler('tb:estudio-entrar');
      ipcMain.handle('tb:estudio-entrar', async (e, d) => {
        globalThis.pruebaEntrar.llamadas++;
        const ms = globalThis.pruebaEntrar.retraso[String(d && d.grupo).trim()] || 0;
        if (ms) await new Promise((r) => setTimeout(r, ms));
        return original(e, d);
      });
    });
    const llamadas = () => app.evaluate(() => globalThis.pruebaEntrar.llamadas);
    const escribirGrupo = async (g) => {
      await win.evaluate(() => pedirGrupo());
      await focoEn('claseEstudio');
      await win.locator('#claseEstudio').fill('K7Q2MX');
      await win.locator('#grupoEstudio').fill(g);
    };
    // Cancelar con la respuesta en camino: no se vuelve a abrir
    await escribirGrupo('G1');
    await boton(win, 'Seguir');
    await win.waitForTimeout(80);
    await win.keyboard.press('Escape');
    await win.waitForTimeout(1200);
    revisar(await titulo(win) === null, `F02: cancelado, la respuesta tardía no reabre nada (${await titulo(win)})`);
    // Cancelar y abrir otra pantalla: la respuesta no la sustituye
    await escribirGrupo('G1');
    await boton(win, 'Seguir');
    await win.waitForTimeout(80);
    await win.keyboard.press('Escape');
    await win.evaluate(() => modal({ titulo: 'Otra pantalla de prueba', cuerpo: 'Contexto distinto' }));
    await win.waitForTimeout(1200);
    revisar(await titulo(win) === 'Otra pantalla de prueba', `F02: la otra pantalla sigue (${await titulo(win)})`);
    await win.evaluate(() => cerrarModal(true));
    // Un error tardío tampoco escribe en otra pantalla
    await app.evaluate(() => { globalThis.pruebaEntrar.retraso.G7 = 900; });
    await escribirGrupo('G7');
    await boton(win, 'Seguir');
    await win.waitForTimeout(80);
    await win.keyboard.press('Escape');
    await escribirGrupo('G2');
    await win.waitForTimeout(1200);
    revisar(await titulo(win) === 'Código de clase y grupo' && await win.locator('#errorGrupo').textContent() === '', 'F02: el error tardío de una solicitud cancelada no aparece en la nueva');
    await win.evaluate(() => cerrarModal(true));
    // La respuesta vieja frente a una solicitud nueva: se confirma la nueva (G2), y la vieja (G1) no la reemplaza
    await escribirGrupo('G1');
    await boton(win, 'Seguir');
    await win.waitForTimeout(80);
    await win.keyboard.press('Escape');
    await escribirGrupo('G2');
    await boton(win, 'Seguir');
    await win.waitForTimeout(1300);
    revisar(await titulo(win) === '¿Son el equipo K7Q2MX-G2?', `F02: queda la confirmación de la solicitud nueva (${await titulo(win)})`);
    await boton(win, 'Sí, somos ese equipo');
    await win.waitForTimeout(400);
    revisar(await win.evaluate(() => registroEventos.equipo()) === 'K7Q2MX-G2', `F02: el equipo es el de la solicitud nueva (${await win.evaluate(() => registroEventos.equipo())})`);
    // Dos envíos seguidos del mismo formulario: una sola solicitud y una sola confirmación
    const antes = await llamadas();
    await escribirGrupo('G1');
    await win.locator('#grupoEstudio').press('Enter');
    await win.locator('#grupoEstudio').press('Enter').catch(() => {});
    await win.waitForTimeout(1300);
    revisar(await llamadas() - antes === 1 && await titulo(win) === '¿Son el equipo K7Q2MX-G1?', `F02: dos Enter seguidos hacen una sola solicitud (${await llamadas() - antes})`);
    await boton(win, 'Corregir');
    await win.waitForTimeout(300);
    revisar(await titulo(win) === 'Código de clase y grupo' && await win.locator('#grupoEstudio').inputValue() === 'G1', 'F02: Corregir vuelve al grupo escrito');
    // F04: el error del grupo se anuncia y queda unido a sus campos
    await win.locator('#grupoEstudio').fill('G9');
    await boton(win, 'Seguir');
    await win.waitForTimeout(300);
    const a11y = await win.evaluate(() => ({ rol: $('errorGrupo').getAttribute('role'), invalido: $('grupoEstudio').getAttribute('aria-invalid'), claseInvalida: $('claseEstudio').getAttribute('aria-invalid'),
      describe: ['claseEstudio', 'grupoEstudio'].every((id) => ($(id).getAttribute('aria-describedby') || '').split(' ').includes('errorGrupo')) }));
    revisar(a11y.rol === 'alert' && a11y.describe && a11y.invalido === 'true' && a11y.claseInvalida !== 'true',
      `F04: el error del grupo es role=alert, unido a los dos campos y marca solo el grupo (${JSON.stringify(a11y)})`);
    await capturar('r1_grupo_error');
    await win.evaluate(() => cerrarModal(true));
    await app.evaluate(({ ipcMain }) => { ipcMain.removeHandler('tb:estudio-entrar'); ipcMain.handle('tb:estudio-entrar', globalThis.pruebaEntrar.original); });
  });

  await parte('F03 · cambiar el contexto mientras se prepara', async () => {
    await win.evaluate(({ circuito, programa }) => { const p = proyectoActual(); p.circuito = circuito; p.texto = programa; cargarProyecto(p, true); }, { circuito: X, programa: PROGRAMA_X });
    await win.waitForTimeout(500);
    // Una sola intercepción: la compilación espera hasta que la prueba la suelte
    await app.evaluate(({ ipcMain }) => {
      const original = ipcMain._invokeHandlers.get('tb:compilar-hex');
      globalThis.pruebaCompilar = { original, soltar: [] };
      ipcMain.removeHandler('tb:compilar-hex');
      ipcMain.handle('tb:compilar-hex', async (e, d) => {
        await new Promise((r) => globalThis.pruebaCompilar.soltar.push(r));
        return original(e, d);
      });
    });
    const soltar = () => app.evaluate(() => { globalThis.pruebaCompilar.soltar.splice(0).forEach((r) => r()); });
    const esperandoCompilar = () => app.evaluate(async () => {
      for (let i = 0; i < 150 && !globalThis.pruebaCompilar.soltar.length; i++) await new Promise((r) => setTimeout(r, 30));
      return globalThis.pruebaCompilar.soltar.length > 0;
    });
    const cambios = {
      proyecto: () => win.evaluate(() => { cargarProyecto(proyectoActual(), true); }),
      placa: () => win.evaluate(() => { $('placa').value = 'nano'; $('placa').dispatchEvent(new Event('change')); }),
      equipo: () => win.evaluate(() => { cerrarTrabajoDelEquipo(); }),
    };
    for (const [tipo, cambiar] of Object.entries(cambios)) {
      await win.evaluate(() => { globalThis.pruebaCorrida = simular(); });
      revisar(await esperandoCompilar(), `F03 (${tipo}): la compilación quedó esperando`);
      const durante = await win.evaluate(() => estadoEjecucion());
      await cambiar();
      const cancelada = await win.evaluate(() => estadoEjecucion());
      revisar(durante.destino === 'simulacion' && cancelada.destino === null && !!cancelada.cancelada,
        `F03 (${tipo}): la preparación deja de ser vigente al cambiar, sin esperar el resultado (${JSON.stringify({ destino: cancelada.destino, cancelada: cancelada.cancelada })})`);
      await soltar();
      await win.evaluate(() => globalThis.pruebaCorrida);
      await win.waitForTimeout(300);
      revisar(await win.evaluate(() => !simulador.sim && estadoEjecucion().destino === null), `F03 (${tipo}): el HEX que llega después se descarta`);
      if (tipo === 'placa') { await win.evaluate(() => { $('placa').value = 'uno'; $('placa').dispatchEvent(new Event('change')); }); await win.waitForTimeout(500); }
    }
    // Sin cambios, la corrida normal sigue, y Detener la termina
    await win.evaluate(() => { globalThis.pruebaCorrida = simular(); });
    await esperandoCompilar();
    await soltar();
    revisar(await esperar(win, () => simulador.sim && simulador.sim.medidas().msSimulados > 200 && estadoEjecucion().destino === 'simulacion'), 'F03: sin cambios, la corrida sigue y simula');
    await win.evaluate(() => detenerSimulacion());
    await win.waitForTimeout(300);
    revisar(await win.evaluate(() => estadoEjecucion().destino === null && estadoEjecucion().cancelada === 'detenida'), 'F03: Detener la termina');
    await app.evaluate(({ ipcMain }) => { globalThis.pruebaCompilar.soltar.splice(0).forEach((r) => r()); ipcMain.removeHandler('tb:compilar-hex'); ipcMain.handle('tb:compilar-hex', globalThis.pruebaCompilar.original); });
  });
  await app.close();
  fs.rmSync(datos, { recursive: true, force: true });
  revisar(!errores.length, 'sin errores en la consola' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
  console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
