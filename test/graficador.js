// Prueba con Node el registro del monitor serial: cómo lee cada línea, el tiempo y el CSV para Excel en español.
// Uso: node test/graficador.js
'use strict';
const { leerValores, crearRegistro, marcasEje } = require('../src/graficador.js');

let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const lee = (l) => leerValores(l);

// 1. Los formatos de cada línea
revisar(igual(lee('temp:25.3 luz:512'), [['temp', 25.3], ['luz', 512]]), '«temp:25.3 luz:512» → temp y luz');
revisar(igual(lee('temp=25.3'), [['temp', 25.3]]), '«temp=25.3» → temp');
revisar(igual(lee('Temperatura: 25.3 C'), [['Temperatura', 25.3]]), '«Temperatura: 25.3 C» → Temperatura (la unidad se ignora)');
revisar(igual(lee('min 430 max 431 prom 430.5'), [['min', 430], ['max', 431], ['prom', 430.5]]), '«min 430 max 431 prom 430.5» (validar_adc) → min, max y prom');
revisar(igual(lee('512 3.7 1'), [['valor1', 512], ['valor2', 3.7], ['valor3', 1]]), '«512 3.7 1» → valor1, valor2 y valor3');
revisar(igual(lee('512,3.7\t-1'), [['valor1', 512], ['valor2', 3.7], ['valor3', -1]]), 'separados por coma y tabulación, con negativos');
revisar(igual(lee('Inicio'), []) && igual(lee('Carro listo'), []) && igual(lee(''), []), 'solo texto: sin valores');
revisar(igual(lee('adelante 200'), [['adelante', 200]]), '«adelante 200» → adelante = 200');
revisar(lee('a:nan b:1').length === 2 && Number.isNaN(lee('a:nan b:1')[0][1]), '«nan» queda como un hueco (NaN)');
revisar(igual(lee('x: 1, y: -2.5e1'), [['x', 1], ['y', -25]]), '«x: 1, y: -2.5e1» → x y y (con exponente)');
revisar(igual(lee('a:1 a:2'), [['a', 2]]), 'una etiqueta repetida en la línea: queda la última');

// 2. El registro: líneas completas, en trozos, con \r\n y su tiempo
const r = crearRegistro();
r.agregar('min 430 ma', 'simulador', 1000);
r.agregar('x 431\r', 'simulador', 1016);
r.agregar('\nmin 429 max 430\n', 'simulador', 2016);
revisar(r.lineas.length === 2 && igual(r.lineas[0].valores, { min: 430, max: 431 }) && r.lineas[0].t === 1016,
  'una línea que llega en trozos se arma entera, con la hora de su fin de línea');
revisar(r.lineas[1].t === 2016 && igual(r.etiquetas, ['min', 'max']), 'un fin de línea partido entre dos trozos (retorno y salto) no crea una línea vacía');
r.continuar('simulador'); // simular de nuevo: el tiempo sigue, no vuelve a 0
r.agregar('min 1\n', 'simulador', 5);
revisar(r.lineas[2].t === 2016 + 1 + 5, `al simular de nuevo, el tiempo sigue (${r.lineas[2].t} ms)`);
r.agregar('Inicio\n', 'placa', 0);
revisar(r.lineas[3].origen === 'placa' && igual(r.lineas[3].valores, {}), 'la placa y el simulador quedan en el mismo registro, cada uno con su origen');

// 3. El CSV para Excel en español
const csv = r.csv();
const filas = csv.slice(1).trim().split('\r\n');
revisar(csv.startsWith('﻿'), 'empieza con la marca UTF-8 (Excel lee bien las tildes)');
revisar(filas[0] === 't_ms;origen;linea;"min";"max"', `encabezado: ${filas[0]}`);
revisar(filas[1] === '1016;simulador;"min 430 max 431";430;431', `fila: ${filas[1]}`);
const r2 = crearRegistro();
r2.agregar('prom 430.5 texto "hola"\n', 'simulador', 10);
const fila2 = r2.csv().slice(1).trim().split('\r\n')[1];
revisar(fila2 === '10;simulador;"prom 430.5 texto ""hola""";430,5', `coma decimal y comillas escapadas: ${fila2}`);
r2.agregar('a:nan\n', 'simulador', 20);
revisar(r2.csv().trim().endsWith(';'), 'un «nan» queda como celda vacía');

// 4. Límite y limpiar
const r3 = crearRegistro(5);
for (let i = 0; i < 12; i++) r3.agregar(`v ${i}\n`, 'placa', i);
revisar(r3.lineas.length >= 5 && r3.lineas.length <= 6 && r3.lineas[r3.lineas.length - 1].valores.v === 11, `guarda las últimas líneas: recorta por bloques al pasar el límite (quedan ${r3.lineas.length} de 12, hasta la 11)`);
const antes = r3.version;
r3.limpiar();
revisar(r3.lineas.length === 0 && r3.etiquetas.length === 0 && r3.version > antes, '«Limpiar» vacía el registro');

// 5. Revisión de código del 11 oct
revisar(igual(lee('Lectura 1: 512'), [['Lectura', 1], ['valor1', 512]]), '«Lectura 1: 512»: el «1» no es una etiqueta (no crea una columna por lectura)');
revisar(igual(lee('Hora 12:30'), [['Hora', 12], ['valor1', 30]]), '«Hora 12:30»: dos números, sin etiquetas «12»');
const r4 = crearRegistro();
for (let i = 0; i < 100; i++) r4.agregar(`s${i}:${i}\n`, 'placa', i);
revisar(r4.etiquetas.length === 40 && r4.lineas.length === 100, 'las columnas de números tienen un tope (40); las líneas siguen guardándose');
const r5 = crearRegistro();
r5.agregar('=== Inicio ===\n-- Lectura --\n+5V ok\n@hola\nnormal\n', 'placa', 0);
const lineasCsv = r5.csv().slice(1).trim().split('\r\n').slice(1).map((f) => f.split(';')[2]);
revisar(igual(lineasCsv, ['"\'=== Inicio ==="', '"\'-- Lectura --"', '"\'+5V ok"', '"\'@hola"', '"normal"']),
  'en el CSV, una línea que empieza con = + - @ lleva un apóstrofo (Excel no la toma como fórmula)');
const enorme = marcasEje(1.2e19, 1.2e19, 5);
const grande = marcasEje(0, 1e17, 5);
revisar(enorme.length >= 1 && grande.length <= 50, `marcas del eje con números enormes: terminan (${enorme.length} y ${grande.length} marcas)`);
revisar(igual(marcasEje(0, 1023, 10), [0, 200, 400, 600, 800, 1000]), `marcas «redondas» de 0 a 1023: ${marcasEje(0, 1023, 10).join(', ')}`);

console.log(fallos ? `\n${fallos} FALLA(S)` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
