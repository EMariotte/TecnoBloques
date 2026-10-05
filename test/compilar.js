// Compila con arduino-cli los .ino que generan las pruebas (test/salida/<nombre>/<nombre>.ino).
// Requisitos: arduino-cli en el PATH, núcleo arduino:avr y las librerías de test/instalar-librerias.ps1.
// Uso: npm test   (genera los .ino)   y luego   npm run compilar
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FQBN = {
  carro: 'arduino:avr:uno',
  eco: 'arduino:avr:uno',
  otto: 'arduino:avr:nano:cpu=atmega328',
  carro_nano_old: 'arduino:avr:nano:cpu=atmega328old',
  carro_mega: 'arduino:avr:mega:cpu=atmega2560',
  todo_uno: 'arduino:avr:uno',
  todo_mega: 'arduino:avr:mega:cpu=atmega2560',
  misbloques: 'arduino:avr:uno'
};
const salida = path.join(__dirname, 'salida');
if (!fs.existsSync(salida)) { console.error('No hay test/salida. Corre primero: npm test'); process.exit(1); }
let fallas = 0;
for (const [nombre, fqbn] of Object.entries(FQBN)) {
  const dir = path.join(salida, nombre);
  if (!fs.existsSync(path.join(dir, nombre + '.ino'))) { console.log(`- ${nombre}: no generado, se omite`); continue; }
  try {
    const out = execFileSync('arduino-cli', ['compile', '--fqbn', fqbn, '--warnings', 'default', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const uso = out.split('\n').filter(l => /Sketch uses|El sketch usa|Global variables|Las variables/.test(l)).join(' | ');
    console.log(`✔ ${nombre} (${fqbn}) ${uso}`);
  } catch (e) {
    fallas++;
    console.log(`✘ ${nombre} (${fqbn})\n${(e.stdout || '') + (e.stderr || '')}`);
  }
}
process.exit(fallas ? 1 : 0);
