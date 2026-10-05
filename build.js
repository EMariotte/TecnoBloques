// Construye dos versiones: dist/TecnoBloques.html (local, todo embebido)
// y dist/artefacto.html (fragmento para publicar, Blockly desde jsDelivr).
const fs = require('fs');
const path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const BL = 'node_modules/blockly/';
const VERSION = require('./node_modules/blockly/package.json').version;

const mediaDir = path.join(__dirname, BL, 'media');
const tipos = { svg: 'image/svg+xml', png: 'image/png', gif: 'image/gif' };
const media = {};
for (const f of fs.readdirSync(mediaDir)) {
  const ext = f.split('.').pop();
  if (!tipos[ext]) continue;
  media[f] = `data:${tipos[ext]};base64,` + fs.readFileSync(path.join(mediaDir, f)).toString('base64');
}
const css = R('src/style.css');
const body = R('src/body.html');
const app = ['src/nucleo.js', 'src/bloques.js', 'src/app.js'].map(R).join('\n');
const medioJS = `window.TB_MEDIA = ${JSON.stringify(media)};`;
const fuentes = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=JetBrains+Mono:wght@400;600&display=swap">';
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });

// Versión local: funciona sin internet (las fuentes caen a las del sistema)
const local = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>TecnoBloques</title>
${fuentes}
<style>
[hidden]{display:none!important}
body{margin:0}
${css}
</style>
</head>
<body>
${body}
<script>${esc(R(BL + 'blockly_compressed.js'))}</script>
<script>${esc(R(BL + 'blocks_compressed.js'))}</script>
<script>${esc(R(BL + 'msg/es.js'))}</script>
<script>${medioJS}</script>
<script>
${esc(app)}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'dist/TecnoBloques.html'), local);

const cdn = `https://cdn.jsdelivr.net/npm/blockly@${VERSION}/`;
const artefacto = `<title>TecnoBloques</title>
${fuentes}
<style>
${css}
</style>
${body}
<script src="${cdn}blockly_compressed.js"></script>
<script src="${cdn}blocks_compressed.js"></script>
<script src="${cdn}msg/es.js"></script>
<script>${medioJS}</script>
<script>
${esc(app)}
</script>
`;
fs.writeFileSync(path.join(__dirname, 'dist/artefacto.html'), artefacto);
console.log('Blockly', VERSION, '· local', (local.length / 1024).toFixed(0) + ' KB', '· artefacto', (artefacto.length / 1024).toFixed(0) + ' KB');
