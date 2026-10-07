// Prueba con placas reales a través de la app de escritorio, como lo haría un aprendiz:
// elige placa y puerto, sube un ejemplo, y si se pide abre el monitor serial y envía "on" y "off".
// Uso: npm run build && npm run test:placas -- <caso> [<caso> ...]
//   caso = placa:puerto:ejemplo[:monitor]   p. ej. uno:COM12:eco:monitor   nano:COM5:otto
//          (placa = clave de PLACAS; ejemplo = id de EJEMPLOS; "monitor" solo tiene sentido con eco)
//   caso = sintetico                        revisa el monitor y los mensajes de error sin placa
// Sin casos, solo lista los puertos. Las capturas quedan en test/salida/placas/.
// Con la variable TB_EXE apuntando a win-unpacked\TecnoBloques.exe, prueba la app empaquetada.
'use strict';
const path = require('path');
const fs = require('fs');
const RAIZ = path.join(__dirname, '..');
const { _electron: electron } = require('playwright-core');
const SALIDA = path.join(__dirname, 'salida', 'placas');
fs.mkdirSync(SALIDA, { recursive: true });

(async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'ELECTRON_RUN_AS_NODE'));
  const datos = path.join(require('os').tmpdir(), 'tecnobloques-prueba');
  // Con TB_EXE=<ruta de TecnoBloques.exe> se prueba la app empaquetada en lugar de la de desarrollo
  const app = process.env.TB_EXE
    ? await electron.launch({ executablePath: process.env.TB_EXE, args: [`--user-data-dir=${datos}`], env })
    : await electron.launch({ args: [RAIZ, `--user-data-dir=${datos}`], cwd: RAIZ, env });
  const errores = [];
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errores.push(String(e)));
  await win.waitForLoadState('load');

  // Esperar a que el selector muestre los puertos
  let opciones = [];
  for (let i = 0; i < 20; i++) {
    await win.waitForTimeout(1000);
    opciones = await win.evaluate(() => [...document.querySelectorAll('#puerto option')].map(o => o.textContent));
    if (opciones.some(o => /COM/.test(o))) break;
  }
  console.log('PUERTOS:', JSON.stringify(opciones));
  const lista = await win.evaluate(() => puertos.lista);
  console.log('DETALLE:', JSON.stringify(lista));

  for (const caso of process.argv.slice(2)) {
    if (caso === 'sintetico') {
      const t = await win.evaluate(() => {
        $('salidaSerial').innerHTML = ''; serial.inicioLinea = true; serial.trasCR = false;
        ['\0\0\0Hola\r', '\n', 'Mundo\r\n', 'solo CR\r', 'otra\n', 'fin\r', '\r\n'].forEach(agregarSalida);
        const r = {};
        for (const k of ['nano', 'nano_old', 'uno']) { placaActual = k; r[k] = placaNoResponde().cuerpo[0].innerText.split('\n')[0]; }
        return { salida: JSON.stringify($('salidaSerial').innerText), sugerencias: r };
      });
      console.log('SINTETICO:', JSON.stringify(t, null, 1));
      continue;
    }
    const [placaK, puerto, ej, monitor] = caso.split(':');
    console.log(`\n=== ${caso} ===`);
    const r = await win.evaluate(async ({ placaK, puerto, ej }) => {
      cerrarModal(false);
      cargarEjemplo(EJEMPLOS.find(e => e.id === ej));
      placaActual = placaK; $('placa').value = placaK; refrescarPines(); actualizar();
      $('puerto').value = puerto; await window.tbEscritorio.preferirPuerto(puerto);
      const etapas = [];
      const obs = new MutationObserver(() => {
        const e = document.querySelector('.subir-etapa');
        if (e && etapas[etapas.length - 1] !== e.textContent) etapas.push(e.textContent);
      });
      obs.observe(document.getElementById('modal'), { subtree: true, childList: true, characterData: true });
      const t = Date.now();
      await subirPlaca();
      obs.disconnect();
      return { seg: ((Date.now() - t) / 1000).toFixed(1), placa: placa().nombre, titulo: $('modalTitulo').textContent,
        cuerpo: $('modalCuerpo').innerText.replace(/Ver el mensaje completo[\s\S]*/, '').trim(), etapas };
    }, { placaK, puerto, ej });
    console.log(JSON.stringify(r, null, 1));
    await win.screenshot({ path: path.join(SALIDA, caso.replace(/:/g, '_') + '.png') });

    if (monitor && r.titulo === '¡Listo!') {
      const m = await win.evaluate(async ({ puerto }) => {
        cerrarModal(false);
        $('salidaSerial').textContent = '';
        $('puerto').value = puerto;
        abrirMonitor();
        const esperar = (ms) => new Promise(r => setTimeout(r, ms));
        await esperar(3500); // la placa se reinicia al abrir el puerto
        const inicio = $('salidaSerial').innerText;
        await enviarSerial('on'); await esperar(1200);
        const tras_on = $('salidaSerial').innerText;
        await enviarSerial('off'); await esperar(1200);
        const tras_off = $('salidaSerial').innerText;
        const conectado = serial.conectado;
        await desconectarSerial();
        return { conectado, nota: $('notaSerial').innerText, inicio, tras_on, tras_off };
      }, { puerto });
      console.log('MONITOR:', JSON.stringify(m, null, 1));
      await win.screenshot({ path: path.join(SALIDA, caso.replace(/:/g, '_') + '_monitor.png') });
    }
  }
  console.log('\nERRORES JS:', JSON.stringify(errores));
  await app.close();
})().catch((e) => { console.error('FALLO:', e); process.exit(1); });
