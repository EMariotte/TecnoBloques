// Arma escritorio/recursos/arduino: arduino-cli + núcleo AVR + librerías de la TecnoAcademia.
// Es lo que el instalador copia dentro de la app, para compilar y subir sin internet.
// Uso (Windows, con internet): npm run preparar-arduino
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DESTINO = path.join(__dirname, 'recursos', 'arduino');
const CLI = path.join(DESTINO, 'arduino-cli.exe');
const URL_CLI = 'https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip';

// Librerías del índice de Arduino (nombre exacto del índice)
const LIBRERIAS = ['DHT sensor library', 'Adafruit Unified Sensor', 'LiquidCrystal I2C', 'Servo'];
// Librerías que se instalan desde su repositorio
const LIBRERIAS_GIT = [
  'https://github.com/PhoenixSmaug/AFMotor-Shield-R4-Compatible.git',
  'https://github.com/OttoDIY/OttoDIYLib.git'
];

const env = Object.assign({}, process.env, {
  ARDUINO_DIRECTORIES_DATA: path.join(DESTINO, 'datos'),
  ARDUINO_DIRECTORIES_USER: path.join(DESTINO, 'usuario'),
  ARDUINO_DIRECTORIES_DOWNLOADS: path.join(DESTINO, 'descargas'),
  ARDUINO_LIBRARY_ENABLE_UNSAFE_INSTALL: 'true', // permite --git-url
  ARDUINO_UPDATER_ENABLE_NOTIFICATION: 'false'
});
const cli = (...args) => { console.log('> arduino-cli', args.join(' ')); execFileSync(CLI, args.concat(['--no-color']), { env, stdio: 'inherit' }); };

function bajar(url, archivo) {
  return new Promise((resolver, rechazar) => {
    https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); bajar(r.headers.location, archivo).then(resolver, rechazar); return; }
      if (r.statusCode !== 200) { rechazar(new Error(`HTTP ${r.statusCode} en ${url}`)); return; }
      const f = fs.createWriteStream(archivo);
      r.pipe(f);
      f.on('finish', () => f.close(resolver));
    }).on('error', rechazar);
  });
}

function tamano(dir) {
  let t = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    t += e.isDirectory() ? tamano(p) : fs.statSync(p).size;
  }
  return t;
}

(async () => {
  if (process.platform !== 'win32') console.warn('Aviso: este script prepara el paquete para Windows.');
  fs.mkdirSync(DESTINO, { recursive: true });
  if (!fs.existsSync(CLI)) {
    const zip = path.join(DESTINO, 'arduino-cli.zip');
    console.log('Descargando arduino-cli…');
    await bajar(URL_CLI, zip);
    // tar de Windows 10+ abre .zip (se usa el de System32: el de Git Bash confunde "C:" con un servidor)
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    execFileSync(fs.existsSync(tar) ? tar : 'tar', ['-xf', zip, '-C', DESTINO], { stdio: 'inherit' });
    fs.rmSync(zip);
  }
  cli('version');
  cli('core', 'update-index');
  cli('core', 'install', 'arduino:avr');
  cli('lib', 'install', ...LIBRERIAS);
  for (const g of LIBRERIAS_GIT) cli('lib', 'install', '--git-url', g);
  cli('core', 'list');
  cli('lib', 'list');
  // Lo descargado ya está instalado: no hace falta llevarlo en el instalador
  fs.rmSync(path.join(DESTINO, 'descargas'), { recursive: true, force: true });
  fs.rmSync(path.join(DESTINO, 'datos', 'staging'), { recursive: true, force: true });
  // El índice de librerías (≈57 MB) solo sirve para descargar librerías nuevas, no para compilar ni subir
  for (const f of ['library_index.json', 'library_index.json.sig']) fs.rmSync(path.join(DESTINO, 'datos', f), { force: true });
  console.log(`\nListo: ${DESTINO} (${(tamano(DESTINO) / 1048576).toFixed(0)} MB)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
