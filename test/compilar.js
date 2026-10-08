// Compila con arduino-cli los .ino que generan las pruebas (test/salida/<nombre>/<nombre>.ino).
// Deja también <nombre>.hex al lado: con el .tbq.json son las fixtures de TecnoCircuito (ver CONTRATO.md).
// Requisitos: arduino-cli (en el PATH, en la variable ARDUINO_CLI o dentro del Arduino IDE 2 en Windows),
// núcleo arduino:avr y las librerías de test/instalar-librerias.ps1.
// Uso: npm test   (genera los .ino)   y luego   npm run compilar
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const IDE_CLI = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Arduino IDE', 'resources', 'app', 'lib', 'backend', 'resources', 'arduino-cli.exe');
const CLI = process.env.ARDUINO_CLI || (fs.existsSync(IDE_CLI) ? IDE_CLI : 'arduino-cli');

const FQBN = {
  carro: 'arduino:avr:uno',
  eco: 'arduino:avr:uno',
  otto: 'arduino:avr:nano:cpu=atmega328',
  carro_nano_old: 'arduino:avr:nano:cpu=atmega328old',
  carro_mega: 'arduino:avr:mega:cpu=atmega2560',
  todo_uno: 'arduino:avr:uno',
  todo_mega: 'arduino:avr:mega:cpu=atmega2560',
  misbloques: 'arduino:avr:uno',
  pines: 'arduino:avr:uno',
  listas: 'arduino:avr:uno',
  i2c_uno: 'arduino:avr:uno',
  i2c_mega: 'arduino:avr:mega:cpu=atmega2560',
  otto_calibrar: 'arduino:avr:nano:cpu=atmega328',
  otto_calibrado: 'arduino:avr:nano:cpu=atmega328',
  matriz: 'arduino:avr:uno',
  otto_todo: 'arduino:avr:nano:cpu=atmega328',
  t1_protoboard: 'arduino:avr:uno'
};
const salida = path.join(__dirname, 'salida');
if (!fs.existsSync(salida)) { console.error('No hay test/salida. Corre primero: npm test'); process.exit(1); }
let fallas = 0;
for (const [nombre, fqbn] of Object.entries(FQBN)) {
  const dir = path.join(salida, nombre);
  if (!fs.existsSync(path.join(dir, nombre + '.ino'))) { console.log(`- ${nombre}: no generado, se omite`); continue; }
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-hex-'));
    const out = execFileSync(CLI, ['compile', '--fqbn', fqbn, '--warnings', 'default', '--output-dir', tmp, dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    fs.copyFileSync(path.join(tmp, nombre + '.ino.hex'), path.join(dir, nombre + '.hex'));
    fs.rmSync(tmp, { recursive: true, force: true });
    const uso = out.split('\n').filter(l => /Sketch uses|El sketch usa|Global variables|Las variables/.test(l)).join(' | ');
    console.log(`✔ ${nombre} (${fqbn}) ${uso}`);
  } catch (e) {
    fallas++;
    console.log(`✘ ${nombre} (${fqbn})\n${(e.stdout || '') + (e.stderr || '')}`);
  }
}
process.exit(fallas ? 1 : 0);
