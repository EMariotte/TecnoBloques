// Arma el instalador de Windows con electron-builder.
// Uso: npm run instalador          → solo arma el instalador
//      npm run publicar            → además lo sube como Release de GitHub (necesita GH_TOKEN)
// El instalador queda fuera del proyecto (%LOCALAPPDATA%\TecnoBloques-build) porque dentro de la
// carpeta del proyecto Windows suele bloquear el renombrado (EPERM) mientras VS Code o el antivirus
// revisan los archivos recién extraídos.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
if (!fs.existsSync(path.join(__dirname, 'recursos', 'arduino', 'arduino-cli.exe'))) {
  console.error('Falta el paquete de Arduino. Corre primero: npm run preparar-arduino');
  process.exit(1);
}
// Un simulador en desarrollo nunca llega al aula: si el HTML trae la copia local de TecnoCircuito, no se empaqueta.
// (Contrato con TecnoCircuito, «Mecanismo», punto 5. El simulador solo entra al instalador desde una etiqueta.)
const html = fs.readFileSync(path.join(raiz, 'dist', 'TecnoBloques.html'), 'utf8');
if (html.includes('window.TB_SIMULADOR_ORIGEN = "local"')) {
  console.error('dist/TecnoBloques.html trae la copia LOCAL del simulador (npm run app:simulador). Arma con «node build.js» antes de empaquetar.');
  process.exit(1);
}
const salida = path.join(process.env.LOCALAPPDATA || path.join(raiz, '..'), 'TecnoBloques-build');
fs.rmSync(salida, { recursive: true, force: true });

const env = Object.assign({}, process.env, { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }); // sin certificado de firma por ahora
delete env.ELECTRON_RUN_AS_NODE; // si VS Code la deja puesta, Electron no arranca como app
const publicar = process.argv.includes('--publicar');
const r = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--win', '--publish', publicar ? 'always' : 'never',
  `-c.directories.output=${salida}`], { cwd: raiz, env, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
const exe = fs.readdirSync(salida).find(f => /^TecnoBloques-Setup-.*\.exe$/.test(f));
console.log(`\nInstalador listo: ${path.join(salida, exe)} (${(fs.statSync(path.join(salida, exe)).size / 1048576).toFixed(0)} MB)`);
