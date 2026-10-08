// Prueba de integración con el simulador TecnoCircuito (proyecto hermano): abre la app de escritorio con la
// copia local del simulador, arma programas en TecnoBloques, los compila con arduino-cli y los simula.
// Uso: npm run test:simulador   (arma con --simulador-local; necesita ..\TecnoCircuito\prototipo\dist\tecnocircuito.js)
// Las capturas quedan en test/salida/sim_*.png.
'use strict';
const { _electron: electron } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(__dirname, 'salida');
fs.mkdirSync(SALIDA, { recursive: true });
let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}

// Circuitos en el formato del contrato (sección 4): LED con 220 Ω en un pin, y el de la tarea T2 con potenciómetro.
const LED = (pin, x) => ({
  formato: 1, placa: 'uno', protoboard: null,
  componentes: [
    { id: 'r1', tipo: 'resistencia', x: 300, y: -26, rot: 0, props: { ohmios: 220 } },
    { id: 'led1', tipo: 'led', x: 380, y: -100, rot: 0, props: { color: 'rojo' } }
  ],
  cables: [
    { de: 'placa.' + pin, a: 'r1.1', color: 'naranja', puntos: [[x, -20.35]] },
    { de: 'r1.2', a: 'led1.anodo', color: 'naranja', puntos: [[405, -20.35]] },
    { de: 'led1.catodo', a: 'placa.GND1', color: 'negro', puntos: [[395, -40], [115.5, -40]] }
  ]
});
const T2 = (posicion) => {
  const c = LED('D9', 163);
  c.componentes.push({ id: 'pot1', tipo: 'potenciometro', x: 250, y: 215, rot: 0, props: { ohmios: 10000, posicion } });
  c.cables.push(
    { de: 'placa.GND3', a: 'pot1.GND', color: 'negro', puntos: [[179, 310], [279, 310]] },
    { de: 'placa.A0', a: 'pot1.SIG', color: 'verde', puntos: [[208, 300], [289, 300]] },
    { de: 'placa.5V', a: 'pot1.VCC', color: 'rojo', puntos: [[160, 320], [299, 320]] }
  );
  return c;
};
const LIENZO = "document.querySelector('#lienzoCircuito .tecnocircuito').shadowRoot";

(async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE'));
  const datos = path.join(require('os').tmpdir(), 'tecnobloques-prueba-simulador');
  fs.rmSync(datos, { recursive: true, force: true }); // sin autoguardado de otra prueba
  const app = await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`], cwd: RAIZ, env });
  const errores = [];
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errores.push(String(e)));
  win.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  // tbmedia/sprites.svg: Blockly la pide antes de que el editor la cambie por la embebida (ya pasaba sin simulador)
  win.on('requestfailed', (r) => { if (!r.url().includes('/tbmedia/')) errores.push('no cargó ' + r.url().slice(0, 120)); });
  await win.waitForLoadState('load');
  await win.waitForTimeout(1500);

  // Espera a que haya una simulación corriendo y que se cumpla `condicion` (texto JS), con tiempo máximo.
  const esperar = (condicion, ms = 40000) => win.waitForFunction(condicion, null, { timeout: ms, polling: 200 }).then(() => true, () => false);

  // 1. El simulador está en la app
  const info = await win.evaluate(() => ({
    origen: window.TB_SIMULADOR_ORIGEN, contrato: window.TecnoCircuito && TecnoCircuito.CONTRATO,
    disponible: simulador.disponible, pestana: !$('tCircuito').hidden, boton: !$('btnSimularBarra').hidden
  }));
  revisar(info.origen === 'local' && info.contrato === 1 && info.disponible, `TecnoCircuito embebido (copia ${info.origen}, contrato ${info.contrato})`);
  revisar(info.pestana && info.boton, 'aparecen la pestaña «Circuito» y el botón «Simular»');

  // 2. «Eco serial y LED» de los ejemplos, con un LED real en el pin 13
  await win.evaluate((circuito) => {
    cargarEjemplo(EJEMPLOS.find((e) => e.id === 'eco'));
    actualizar();
    const p = proyectoActual();
    p.circuito = circuito;
    cargarProyecto(p, true);
    $('salidaSerial').textContent = '';
  }, LED('D13', 125));
  const enLienzo = await win.evaluate(() => simulador.lienzo.circuito().componentes.map((c) => c.tipo).join(','));
  revisar(enLienzo === 'resistencia,led', `el circuito del proyecto aparece en el lienzo (${enLienzo})`);
  await win.locator('#btnSimularBarra').click();
  const arranco = await esperar(() => simulador.sim && /Escribe on u off/.test($('salidaSerial').textContent));
  revisar(arranco, 'compila con arduino-cli, simula y el monitor muestra «Escribe on u off»');
  const hilo = await win.evaluate(() => simulador.sim && simulador.sim.medidas().hilo);
  revisar(hilo === 'worker', `el chip corre en un Web Worker dentro de la app (${hilo})`);
  revisar(await win.evaluate(() => $('estadoSerial').textContent === 'Simulación' && !$('pCircuito').hidden), 'el monitor dice «Simulación» y se ve la pestaña Circuito');
  await win.locator('#txtSim').fill('on'); // el monitor pequeño de la pestaña Circuito
  await win.locator('#txtSim').press('Enter');
  const prendio = await esperar(`(() => { const r = ${LIENZO}; return r.querySelector('wokwi-led').brightness > 0.7 && r.querySelector('wokwi-arduino-uno').led13; })()`, 5000);
  revisar(prendio, 'enviar «on» desde el monitor prende el LED del circuito y el LED «L» de la placa');
  revisar(await win.evaluate(() => /Recibí: on/.test($('salidaSim').textContent) && /Recibí: on/.test($('salidaSerial').textContent)),
    'el programa simulado responde «Recibí: on», en el monitor de la pestaña Circuito y en el monitor serial');
  await win.screenshot({ path: path.join(SALIDA, 'sim_1_eco.png') });
  await win.locator('#txtSim').fill('off');
  await win.locator('#txtSim').press('Enter');
  const apago = await esperar(`(() => !${LIENZO}.querySelector('wokwi-led').value)()`, 5000);
  revisar(apago, 'enviar «off» lo apaga');

  // 3. Programa hecho con bloques: el potenciómetro en A0 controla el brillo del pin 9 (tarea T2)
  for (const posicion of [0.5, 0.2]) {
    const codigo = await win.evaluate((circuito) => {
      nuevoProyecto();
      placaActual = 'uno'; $('placa').value = 'uno';
      ponerNivel(3);
      const prog = espacio.getBlocksByType('programa')[0];
      const b = Blockly.serialization.blocks.append({
        type: 'escribir_pwm', fields: { PIN: '9' },
        inputs: { V: { block: { type: 'math_arithmetic', fields: { OP: 'DIVIDE' }, inputs: {
          A: { block: { type: 'leer_analogo', fields: { PIN: 'A0' } } },
          B: { block: { type: 'math_number', fields: { NUM: 4 } } } } } } }
      }, espacio);
      prog.getInput('LOOP').connection.connect(b.previousConnection);
      actualizar();
      const p = proyectoActual();
      p.circuito = circuito;
      cargarProyecto(p, true);
      return codigoActual();
    }, T2(posicion));
    if (posicion === 0.5) revisar(/analogWrite\(9, constrain\(analogRead\(A0\) \/ 4, 0, 255\)\)/.test(codigo), 'los bloques generan analogWrite(9, … analogRead(A0) / 4 …)');
    await win.locator('#btnSimularBarra').click();
    const listo = await esperar(() => simulador.sim && simulador.sim.medidas().msSimulados > 800);
    const m = await win.evaluate(() => simulador.sim && simulador.sim._mediciones());
    const util = m && m.pwm ? m.pwm.D9 || 0 : 0;
    const esperado = Math.floor(Math.min(1023, Math.round(posicion * 1024)) / 4) / 255;
    revisar(listo && Math.abs(util - esperado) < 0.01, `perilla al ${posicion * 100} %: el pin 9 queda con PWM al ${(util * 100).toFixed(1)} % (esperado ${(esperado * 100).toFixed(1)} %)`);
    const brillo = await win.evaluate(`${LIENZO}.querySelector('wokwi-led').brightness`);
    revisar(Math.abs(brillo - (0.0125 * esperado * 1000) / 15) < 0.03, `  y el LED brilla al ${(brillo * 100).toFixed(0)} %`);
    if (posicion === 0.5) await win.screenshot({ path: path.join(SALIDA, 'sim_2_t2.png') });
  }

  // 4. El circuito se guarda en el proyecto: un cambio en el lienzo llega a proyectoActual() y vuelve al abrir
  await win.evaluate(`${LIENZO}.querySelector('[data-accion="agregar"][data-tipo="led"]').click()`);
  await win.waitForTimeout(300);
  const guardado = await win.evaluate(() => {
    const p = JSON.parse(JSON.stringify(proyectoActual()));
    const antes = p.circuito.componentes.length;
    nuevoProyecto();
    const vacio = !('circuito' in proyectoActual()) && simulador.lienzo.circuito().componentes.length === 0;
    cargarProyecto(p, true);
    return { antes, vacio, despues: simulador.lienzo.circuito().componentes.length, pot: simulador.lienzo.circuito().componentes.some((c) => c.tipo === 'potenciometro') };
  });
  revisar(guardado.antes === 4 && guardado.despues === 4 && guardado.pot, `agregar un LED en el lienzo se guarda en el proyecto y vuelve al abrirlo (${guardado.antes} → ${guardado.despues} piezas)`);
  revisar(guardado.vacio, 'un proyecto nuevo empieza sin circuito');

  // 4b. Agrandar el circuito: el divisor, la vista «Circuito» y el botón «Ampliar»
  await win.evaluate(() => { cambiarVista('dividido'); seleccionarPestana('circuito'); });
  await win.waitForTimeout(200);
  const ancho = () => win.evaluate(() => Math.round($('panel').getBoundingClientRect().width));
  const antesDivisor = await ancho();
  const caja = await win.locator('#divisor').boundingBox();
  await win.mouse.move(caja.x + caja.width / 2, caja.y + 200);
  await win.mouse.down();
  await win.mouse.move(caja.x + caja.width / 2 - 200, caja.y + 200, { steps: 8 });
  await win.mouse.up();
  const despuesDivisor = await ancho();
  const guardadoDivisor = await win.evaluate(() => leerLocal(CLAVE_PREF).anchoPanel);
  revisar(Math.abs(despuesDivisor - antesDivisor - 200) <= 4 && guardadoDivisor === despuesDivisor,
    `arrastrar el divisor agranda el panel del circuito (${antesDivisor} → ${despuesDivisor} px) y se recuerda`);
  await win.locator('#btnAmpliarCircuito').click();
  await win.waitForTimeout(200);
  const ampliado = await win.evaluate(() => ({
    vista: estado.vista, bloques: getComputedStyle($('zonaBloques')).display, boton: $('btnAmpliarCircuito').textContent,
    lleno: Math.abs($('panel').getBoundingClientRect().width - $('principal').getBoundingClientRect().width) < 2,
  }));
  revisar(ampliado.vista === 'circuito' && ampliado.bloques === 'none' && ampliado.lleno && ampliado.boton === 'Reducir',
    '«Ampliar» deja solo el circuito en toda la ventana y el botón pasa a «Reducir»');
  await win.screenshot({ path: path.join(SALIDA, 'sim_4_circuito_ampliado.png') });
  await win.locator('#tCodigo').click();
  const conCodigo = await win.evaluate(() => estado.vista);
  await win.locator('#vCircuito').click();
  const deNuevo = await win.evaluate(() => ({ vista: estado.vista, pestana: !$('pCircuito').hidden }));
  revisar(conCodigo === 'codigo' && deNuevo.vista === 'circuito' && deNuevo.pestana,
    'en la vista de solo panel, la pestaña C++ pasa a la vista C++ y el botón «Circuito» vuelve al circuito');
  await win.locator('#btnAmpliarCircuito').click();
  await win.locator('#divisor').dblclick();
  revisar(await win.evaluate(() => estado.vista === 'dividido' && leerLocal(CLAVE_PREF).anchoPanel === null),
    '«Reducir» vuelve a la vista dividida y el doble clic en el divisor devuelve el tamaño normal');

  // 4c. Guardar el circuito como imagen SVG (lienzo.exportarSVG, contrato 1)
  await win.locator('#btnImagenCircuito').click();
  const imagen = await esperar(() => !$('modal').hidden && document.querySelector('#modalCuerpo .vista-imagen') &&
    document.querySelector('#modalCuerpo .vista-imagen').naturalWidth > 100);
  revisar(imagen, `«Guardar imagen» muestra la vista previa del SVG («${await win.evaluate(() => $('modalTitulo').textContent)}»)`);
  await win.screenshot({ path: path.join(SALIDA, 'sim_5_imagen.png') });
  await win.evaluate(() => cerrarModal(false));

  // 5. Programa con error: se explica igual que al subir
  await win.evaluate(() => { entrarModoTexto('void setup() { velocidad = 3; }\nvoid loop() {}\n', ''); });
  await win.waitForTimeout(300);
  await win.locator('#btnSimularBarra').click(); // en modo texto el panel muestra el C++: se simula desde la barra
  const error = await esperar(() => !$('modal').hidden && /error/.test($('modalTitulo').textContent));
  revisar(error, `un error de C++ se explica en español al simular («${await win.evaluate(() => $('modalTitulo').textContent)}»)`);
  await win.evaluate(() => { cerrarModal(false); salirModoTexto(true); });

  // 6. Otra placa: el simulador del prototipo solo tiene el Uno
  await win.evaluate(() => { $('placa').value = 'nano'; $('placa').dispatchEvent(new Event('change')); seleccionarPestana('circuito'); });
  await win.waitForTimeout(300);
  const nano = await win.evaluate(() => ({ nota: $('notaCircuito').textContent, oculto: $('notaCircuito').hidden, boton: $('btnSimular').disabled }));
  revisar(!nano.oculto && /solo tiene/.test(nano.nota) && nano.boton, `con el Nano, la pestaña lo explica y «Simular» queda apagado («${nano.nota}»)`);
  await win.screenshot({ path: path.join(SALIDA, 'sim_3_nano.png') });
  await win.evaluate(() => { $('placa').value = 'uno'; $('placa').dispatchEvent(new Event('change')); });

  revisar(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await app.close();
  console.log(fallos ? `\n${fallos} FALLAS` : '\nTodo bien.');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('FALLO:', e); process.exit(1); });
