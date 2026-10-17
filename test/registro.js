// Prueba con Node lo que no depende de la página en el registro de eventos (src/registro.js; contrato con
// TecnoCircuito, sección 6.1): el C++ sin comentarios, el código del equipo en el nombre del archivo, el resumen de
// bloques y el sobre. Las líneas que arma el registro se revisan contra contrato/evento.schema.json con el revisor de
// TecnoCircuito (..\TecnoCircuito\prototipo\pruebas\contrato_eventos.js, el mismo de su probar:contrato).
// Uso: npm run test:registro
'use strict';
const path = require('path');
const fs = require('fs');
const { quitarComentarios, codigoParaArchivo, limpiarEquipo, resumenBloques, fechaArchivo, crearRegistroEventos } = require('../src/registro.js');

let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('— El C++ sin comentarios');
const CASOS = [
  ['un comentario de línea', 'int a = 1; // mi nombre\nint b;', 'int a = 1;\nint b;'],
  ['un comentario de bloque en una línea', 'int /* nota */ a;', 'int   a;'],
  ['un comentario de bloque de varias líneas conserva las líneas', 'a;\n/* uno\ndos */\nb;', 'a;\n\n\nb;'],
  ['a/**/b no se pega', 'a/**/b', 'a b'],
  ['una URL entre comillas no se corta', 'Serial.println("http://sena.edu.co"); // ver', 'Serial.println("http://sena.edu.co");'],
  ['/* dentro de un texto', 'const char* t = "/* no es comentario */";', 'const char* t = "/* no es comentario */";'],
  ['una comilla escapada dentro del texto', 'Serial.print("dijo \\"hola\\" // ok"); // fin', 'Serial.print("dijo \\"hola\\" // ok");'],
  ['una barra escapada al final del texto', 'char* r = "C:\\\\"; // ruta', 'char* r = "C:\\\\";'],
  ['un carácter entre comillas simples', "char c = '/'; char d = '\\''; // x", "char c = '/'; char d = '\\'';"],
  ['un texto crudo R"(…)"', 'auto s = R"(a // b /* c */)"; // x', 'auto s = R"(a // b /* c */)";'],
  ['un texto crudo con marca', 'auto s = R"x(a )" // b)x"; // c', 'auto s = R"x(a )" // b)x";'],
  ['saltos de línea de Windows (CRLF)', 'a; // uno\r\nb; /* dos\r\ntres */ c;\r\n', 'a;\r\nb; \r\n c;\r\n'],
  ['una barra al final del comentario lo continúa (sin perder la línea)', 'a; // uno \\\nsigue\nb;', 'a;\n\nb;'],
  ['un comentario de bloque sin cerrar', 'a; /* nunca', 'a;  '],
  ['un texto sin cerrar no se come el resto', 'Serial.print("hola\nint b; // x', 'Serial.print("hola\nint b;'],
  ['la división no es un comentario', 'int x = a / b / c;', 'int x = a / b / c;'],
  ['un programa sin comentarios queda igual', 'void setup() {\n  pinMode(13, OUTPUT);\n}\n', 'void setup() {\n  pinMode(13, OUTPUT);\n}\n'],
];
for (const [nombre, entra, sale] of CASOS) {
  const r = quitarComentarios(entra);
  revisar(r === sale, `${nombre}` + (r === sale ? '' : `: ${JSON.stringify(r)} (esperado ${JSON.stringify(sale)})`));
}
{
  // El código que genera TecnoBloques trae comentarios con el nombre del proyecto y los textos de los bloques.
  const generado = '// Proyecto: LED de Sofía\n// Hecho con TecnoBloques\n#include <Servo.h>\n/* Calibración\n   de Otto */\nvoid setup() {\n  Serial.begin(9600); // velocidad\n  Serial.println("Hola, soy Otto");\n}\nvoid loop() {}\n';
  const r = quitarComentarios(generado);
  revisar(!/Sofía|Hecho con|Calibración|velocidad/.test(r) && r.includes('"Hola, soy Otto"') && r.split('\n').length === generado.split('\n').length,
    'un programa generado: sin los comentarios, con los textos entre comillas y con el mismo número de líneas');
  const largo = ('int a = 1; // x\n' + 'Serial.print("// y");\n').repeat(5000);
  const t0 = Date.now();
  const rl = quitarComentarios(largo);
  revisar(Date.now() - t0 < 500 && !rl.includes('// x') && rl.includes('"// y"'), `un programa de ${(largo.length / 1024).toFixed(0)} KB se limpia en ${Date.now() - t0} ms`);
}

console.log('— El código del equipo');
for (const [entra, sale] of [['A7', 'A7'], ['  equipo 3  ', 'equipo_3'], ['Ñandú-2', 'Nandu-2'], ['..\\..\\Windows', '______Windows'],
  ['con:prn?*', 'con_prn__'], ['', 'equipo'], ['../', 'equipo'], ['x'.repeat(60), 'x'.repeat(40)]]) {
  const r = codigoParaArchivo(entra);
  revisar(r === sale && /^[A-Za-z0-9_-]+$/.test(r), `para el archivo, ${JSON.stringify(entra)} → ${JSON.stringify(r)}`);
}
revisar(limpiarEquipo('  Equipo\n 3 ') === 'Equipo 3' && limpiarEquipo('   ') === '', 'en la línea va como se escribió, sin espacios de sobra');
revisar(fechaArchivo(new Date(2026, 9, 6, 23, 59).getTime()) === '2026-10-06', 'la fecha del archivo es la local: 2026-10-06');

console.log('— El resumen de bloques');
revisar(igual(resumenBloques(['arduino_setup', 'digital_write', 'digital_write']), { bloques: 3, tipos: { arduino_setup: 1, digital_write: 2 } }), 'cuenta los bloques de cada tipo');
revisar(igual(resumenBloques([]), { bloques: 0, tipos: {} }), 'sin bloques: 0');

console.log('— El sobre');
const lineas = [];
let reloj = 1760600000000;
const reg = crearRegistroEventos({ escribir: (l) => lineas.push(l), versionTB: '0.4.0', versionTC: '0.2.0', ahora: () => reloj, nuevaSesion: () => 's-' + lineas.length });
reg.registrar({ v: 1, t: reloj, origen: 'circuito', tipo: 'cable_agregado', datos: { de: 'placa.D13', a: 'r1.1' } });
revisar(lineas.length === 0 && !reg.activo(), 'sin equipo no se escribe nada');
revisar(reg.empezar('   ') === false && lineas.length === 0, 'un código vacío no empieza la sesión');
reg.empezar(' A7 ', { placa: 'uno', nivel: 1 });
reg.registrar({ v: 1, t: reloj, origen: 'circuito', tipo: 'cable_agregado', datos: { de: 'placa.D13', a: 'r1.1' } });
reg.editor('codigo_compilado', { ok: true, error: null, bytes: 924, codigo: quitarComentarios('void setup() {} // x\nvoid loop() {}\n') });
reloj += 65000;
reg.empezar('B2', { placa: 'nano', nivel: 2 });
reg.terminar();
reg.registrar({ v: 1, t: reloj, origen: 'editor', tipo: 'ejemplo_cargado', datos: { id: 'x' } });
revisar(igual(lineas.map((l) => [l.equipo, l.tipo]), [['A7', 'sesion_iniciada'], ['A7', 'cable_agregado'], ['A7', 'codigo_compilado'], ['A7', 'sesion_terminada'], ['B2', 'sesion_iniciada'], ['B2', 'sesion_terminada']]),
  'cambiar de equipo termina la sesión del anterior; después de terminar no se escribe');
revisar(lineas[3].datos.ms === 65000, 'sesion_terminada lleva cuánto duró: 65000 ms');
revisar(lineas[0].sesion !== lineas[4].sesion && lineas.slice(0, 4).every((l) => l.sesion === lineas[0].sesion), 'cada equipo tiene su sesión');
revisar(lineas.every((l) => l.v === 1 && l.version_tb === '0.4.0' && l.version_tc === '0.2.0'), 'cada línea lleva v y las dos versiones');
{
  const roto = crearRegistroEventos({ escribir: () => { throw new Error('disco lleno'); }, versionTB: '0.4.0', nuevaSesion: () => 's' });
  let ok = true;
  try { roto.empezar('A1', { placa: 'uno', nivel: 1 }); roto.editor('ejemplo_cargado', { id: 'x' }); } catch (e) { ok = false; }
  revisar(ok, 'si no se puede escribir, el registro no interrumpe el trabajo');
}

console.log('— El disco (escritorio/registro-disco.js)');
{
  const os = require('os');
  const { crearRegistroDisco } = require('../escritorio/registro-disco.js');
  const base = path.join(os.tmpdir(), 'tecnobloques-prueba-registro');
  if (path.dirname(path.resolve(base)) !== path.resolve(os.tmpdir())) throw new Error('Ruta temporal inesperada');
  fs.rmSync(base, { recursive: true, force: true });
  const carpeta = path.join(base, 'appdata');
  let reloj2 = new Date(2026, 9, 16, 10, 30).getTime();
  const disco = crearRegistroDisco({ carpeta, ahora: () => reloj2 });
  const linea = (equipo, extra) => ({ v: 1, t: reloj2, origen: 'editor', tipo: 'ejemplo_cargado', datos: { id: 'x' }, equipo, sesion: 's1', version_tb: '0.4.0', version_tc: '0.2.0', ...extra });

  revisar(igual(disco.estado(), { activo: false, tienePin: false }), 'recién instalado: apagado y sin PIN');
  revisar(disco.escribir(linea('A7')) === false && !fs.existsSync(path.join(carpeta, 'registros')), 'apagado: no escribe nada ni crea la carpeta');
  revisar(disco.instructor({ accion: 'entrar', pin: '1234' }).motivo === 'sin-pin', 'sin PIN no se puede entrar');
  revisar(disco.instructor({ accion: 'crear-pin', pin: '12a4' }).motivo === 'pin-invalido' && disco.instructor({ accion: 'crear-pin', pin: '123' }).motivo === 'pin-invalido',
    'el PIN es de 4 a 8 dígitos');
  revisar(disco.instructor({ accion: 'crear-pin', pin: '2468' }).ok, 'el instructor crea su PIN');
  const cfg = fs.readFileSync(path.join(carpeta, 'registro-config.json'), 'utf8');
  revisar(!cfg.includes('2468') && /"hash"/.test(cfg), 'el PIN no queda escrito: solo su resumen (scrypt con sal)');
  revisar(disco.instructor({ accion: 'crear-pin', pin: '1111' }).motivo === 'ya-hay-pin', 'no se puede crear otro PIN encima del que hay');
  revisar(disco.instructor({ accion: 'activar', pin: '0000', activo: true }).motivo === 'pin' && !disco.estado().activo, 'con el PIN equivocado no se enciende');
  for (let i = 0; i < 4; i++) disco.instructor({ accion: 'entrar', pin: '9999' });
  const bloqueo = disco.instructor({ accion: 'entrar', pin: '2468' });
  revisar(bloqueo.motivo === 'espera' && bloqueo.segundos === 60, `cinco PIN equivocados seguidos: espera un minuto (${bloqueo.segundos} s), aunque el siguiente sea el correcto`);
  reloj2 += 61000;
  revisar(disco.instructor({ accion: 'activar', pin: '2468', activo: true }).ok && disco.estado().activo, 'pasado el minuto, el instructor enciende el registro');

  revisar(disco.escribir(linea('A7')) && disco.escribir(linea('A7', { tipo: 'sesion_terminada', datos: { ms: 10 } })), 'encendido: escribe');
  const archivo = path.join(carpeta, 'registros', 'A7-2026-10-16.jsonl');
  const leidas = fs.existsSync(archivo) ? fs.readFileSync(archivo, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  revisar(leidas.length === 2 && leidas[1].tipo === 'sesion_terminada', 'una línea JSON por evento en registros/A7-2026-10-16.jsonl, en orden');
  disco.escribir(linea('..\\..\\..\\x'));
  disco.escribir(linea('../../x'));
  const fueraDeRegistros = fs.readdirSync(base).filter((f) => f !== 'appdata').concat(fs.readdirSync(carpeta).filter((f) => !['registros', 'registro-config.json'].includes(f)));
  revisar(!fueraDeRegistros.length && disco.archivos().every((f) => /^[A-Za-z0-9_-]+-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)),
    `un código con ..\\ no escribe fuera de registros\\ (${disco.archivos().join(', ')})`);
  revisar(!disco.escribir(linea('')) && !disco.escribir(linea('A7', { tipo: 3 })) && !disco.escribir(null) && !disco.escribir('texto'), 'sin equipo o sin tipo no se escribe');
  revisar(!disco.escribir(linea('A7', { datos: { codigo: 'x'.repeat(3 * 1024 * 1024) } })), 'una línea de más de 2 MB no se escribe');

  const usb = path.join(base, 'usb');
  fs.mkdirSync(usb);
  revisar(disco.exportar({ pin: '1357', destino: usb }).motivo === 'pin' && !fs.readdirSync(usb).length, 'exportar con el PIN equivocado no copia nada');
  const exp = disco.exportar({ pin: '2468', destino: usb });
  revisar(exp.ok && exp.archivos === disco.archivos().length && fs.readdirSync(exp.carpeta).length === exp.archivos && /TecnoBloques-registros-2026-10-16_1031$/.test(exp.carpeta),
    `exportar copia los ${exp.archivos} archivos a ${exp.carpeta && path.basename(exp.carpeta)}`);
  revisar(disco.instructor({ accion: 'cambiar-pin', pin: '2468', nuevoPin: '13579' }).ok && disco.instructor({ accion: 'entrar', pin: '13579' }).ok && !disco.instructor({ accion: 'entrar', pin: '2468' }).ok,
    'el instructor cambia el PIN');
  revisar(disco.instructor({ accion: 'activar', pin: '13579', activo: false }).ok && !disco.escribir(linea('A7')), 'apagado otra vez: no escribe');
  fs.rmSync(base, { recursive: true, force: true });
}

console.log('— Las líneas cumplen el esquema del contrato');
const REVISOR = path.join(__dirname, '..', '..', 'TecnoCircuito', 'prototipo', 'pruebas', 'contrato_eventos.js');
if (!fs.existsSync(REVISOR)) {
  revisar(false, 'no encuentro el revisor de TecnoCircuito en ' + REVISOR);
} else {
  const { revisarEvento } = require(REVISOR);
  const problemas = lineas.flatMap((l, i) => revisarEvento(l).map((p) => `${i + 1} (${l.tipo}): ${p}`));
  revisar(!problemas.length, `las ${lineas.length} líneas cumplen contrato/evento.schema.json` + (problemas.length ? ':\n  ' + problemas.join('\n  ') : ''));
}

console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTODO BIEN');
process.exit(fallos ? 1 : 0);
