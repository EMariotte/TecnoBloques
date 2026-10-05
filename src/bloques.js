/* =====================================================================
   TecnoBloques — definición de bloques y su traducción a C++
   ===================================================================== */
'use strict';

const COL = {
  programa: '#2f6b4f', logica: '#3f73c8', bucles: '#2f9463', mate: '#5a62c4', texto: '#b3603f',
  variables: '#c04a86', funciones: '#8a55c4', mis: '#6d45b0', es: '#16889c', tiempo: '#8a7a12',
  serial: '#27708f', bt: '#2a5fa8', motores: '#c05d22', servos: '#cc8420', sensores: '#23907e',
  lcd: '#4d6a8c', otto: '#cf4d3a', cpp: '#56616a', listas: '#9d3d8f', i2c: '#4f5bb0', matriz: '#a8323a'
};

function bloque(tipo, color, init, gen) {
  Blockly.Blocks[tipo] = { init() { this.setColour(color); init.call(this); } };
  if (gen) Ard.forBlock[tipo] = gen;
}
function sentencia(b) { b.setPreviousStatement(true); b.setNextStatement(true); }
const dd = (pares) => new Blockly.FieldDropdown(pares);

/* ================= Programa ================= */
Blockly.Blocks.programa = {
  init() {
    this.setColour(COL.programa);
    this.appendDummyInput().appendField('al iniciar');
    this.appendStatementInput('SETUP');
    this.appendDummyInput().appendField('repetir por siempre');
    this.appendStatementInput('LOOP');
    this.setDeletable(false);
    this.setTooltip('"Al iniciar" corre una vez (setup). "Repetir por siempre" se repite sin parar (loop).');
  }
};
Ard.forBlock.programa = () => '';

/* ================= Lógica (bloques de Blockly) ================= */
Ard.forBlock.controls_if = function (b) {
  let n = 0, code = '';
  do {
    const cond = G.val(b, 'IF' + n, O.NONE, 'false');
    code += (n > 0 ? ' else ' : '') + `if (${cond}) {\n${G.sentencias(b, 'DO' + n)}}`;
    n++;
  } while (b.getInput('IF' + n));
  if (b.getInput('ELSE')) code += ` else {\n${G.sentencias(b, 'ELSE')}}`;
  return code + '\n';
};
Ard.forBlock.controls_ifelse = Ard.forBlock.controls_if;
Ard.forBlock.logic_compare = function (b) {
  const ops = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
  const op = ops[b.getFieldValue('OP')];
  const ord = (op === '==' || op === '!=') ? O.EQ : O.REL;
  return [`${G.val(b, 'A', ord)} ${op} ${G.val(b, 'B', ord)}`, ord];
};
Ard.forBlock.logic_operation = function (b) {
  const and = b.getFieldValue('OP') === 'AND';
  const ord = and ? O.AND : O.OR;
  return [`${G.val(b, 'A', ord, 'false')} ${and ? '&&' : '||'} ${G.val(b, 'B', ord, 'false')}`, ord];
};
Ard.forBlock.logic_negate = (b) => ['!' + G.val(b, 'BOOL', O.UNARY, 'true'), O.UNARY];
Ard.forBlock.logic_boolean = (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC];

/* ================= Bucles ================= */
function profundidad(b, tipo) { let d = 0, p = b.getSurroundParent(); while (p) { if (p.type === tipo) d++; p = p.getSurroundParent(); } return d; }
Ard.forBlock.controls_repeat_ext = function (b) {
  const i = '_i' + profundidad(b, 'controls_repeat_ext');
  return `for (int ${i} = 0; ${i} < ${G.val(b, 'TIMES', O.REL, '0')}; ${i}++) {\n${G.sentencias(b, 'DO')}}\n`;
};
Ard.forBlock.controls_whileUntil = function (b) {
  const hasta = b.getFieldValue('MODE') === 'UNTIL';
  let c = G.val(b, 'BOOL', hasta ? O.UNARY : O.NONE, 'false');
  if (hasta) c = '!' + c;
  return `while (${c}) {\n${G.sentencias(b, 'DO')}}\n`;
};
Ard.forBlock.controls_flow_statements = (b) => (b.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n');

bloque('bucle_para', COL.bucles, function () {
  this.appendDummyInput().appendField('contar con').appendField(new Blockly.FieldVariable(null, undefined, ['int', 'long'], 'int'), 'VAR');
  this.appendValueInput('DESDE').appendField('desde');
  this.appendValueInput('HASTA').appendField('hasta');
  this.appendValueInput('PASO').appendField('de a');
  this.appendStatementInput('DO').appendField('hacer');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Repite contando: la variable toma cada valor desde el inicio hasta el final (incluido).');
}, function (b) {
  const v = nombreC(b.getField('VAR').getVariable().getName());
  const d = G.val(b, 'DESDE'), h = G.val(b, 'HASTA', O.REL), p = G.val(b, 'PASO', O.ASSIGN, '1');
  return `for (${v} = ${d}; ${v} <= ${h}; ${v} += ${p}) {\n${G.sentencias(b, 'DO')}}\n`;
});

/* ================= Matemáticas ================= */
Ard.forBlock.math_number = function (b) {
  const n = Number(b.getFieldValue('NUM'));
  return [String(n), n < 0 ? O.UNARY : O.ATOMIC];
};
Ard.forBlock.math_arithmetic = function (b) {
  const op = b.getFieldValue('OP');
  if (op === 'POWER') return [`pow(${G.val(b, 'A')}, ${G.val(b, 'B')})`, O.POSTFIX];
  const [s, ord] = { ADD: ['+', O.ADD], MINUS: ['-', O.ADD], MULTIPLY: ['*', O.MULT], DIVIDE: ['/', O.MULT] }[op];
  const ordB = (s === '-' || s === '/') ? ord - 0.5 : ord;
  return [`${G.val(b, 'A', ord)} ${s} ${G.val(b, 'B', ordB)}`, ord];
};
Ard.forBlock.math_single = function (b) {
  const op = b.getFieldValue('OP');
  if (op === 'NEG') return ['-' + G.val(b, 'NUM', O.UNARY), O.UNARY];
  const f = { ROOT: 'sqrt', ABS: 'abs', LN: 'log', LOG10: 'log10', EXP: 'exp' }[op];
  if (op === 'POW10') return [`pow(10, ${G.val(b, 'NUM')})`, O.POSTFIX];
  return [`${f}(${G.val(b, 'NUM')})`, O.POSTFIX];
};
Ard.forBlock.math_modulo = (b) => [`${G.val(b, 'DIVIDEND', O.MULT)} % ${G.val(b, 'DIVISOR', O.MULT - 1, '1')}`, O.MULT];
Ard.forBlock.math_constrain = (b) => [`constrain(${G.val(b, 'VALUE')}, ${G.val(b, 'LOW')}, ${G.val(b, 'HIGH')})`, O.POSTFIX];
Ard.forBlock.math_random_int = (b) => [`random(${G.val(b, 'FROM')}, ${G.val(b, 'TO', O.ADD)} + 1)`, O.POSTFIX];
Ard.forBlock.math_round = function (b) {
  const f = { ROUND: 'round', ROUNDUP: 'ceil', ROUNDDOWN: 'floor' }[b.getFieldValue('OP')];
  return [`${f}(${G.val(b, 'NUM')})`, O.POSTFIX];
};
bloque('mapear', COL.mate, function () {
  this.appendValueInput('V').appendField('mapear');
  this.appendValueInput('A').appendField('de');
  this.appendValueInput('B').appendField('–');
  this.appendValueInput('C').appendField('a');
  this.appendValueInput('D').appendField('–');
  this.setInputsInline(true); this.setOutput(true, 'Number');
  this.setTooltip('Pasa un valor de un rango a otro. Ejemplo: de 0–1023 (potenciómetro) a 0–255 (PWM).');
}, (b) => [`map(${G.val(b, 'V')}, ${G.val(b, 'A')}, ${G.val(b, 'B')}, ${G.val(b, 'C')}, ${G.val(b, 'D')})`, O.POSTFIX]);
bloque('es_valido', COL.mate, function () {
  this.appendValueInput('V').appendField('¿es un número válido?');
  this.setOutput(true, 'Boolean');
  this.setTooltip('Falso cuando la lectura falló (NaN), por ejemplo si el DHT11 está mal conectado.');
}, (b) => [`!isnan(${G.val(b, 'V')})`, O.UNARY]);

/* ================= Texto ================= */
Ard.forBlock.text = (b) => [cadenaC(b.getFieldValue('TEXT')), O.ATOMIC];
Ard.forBlock.text_length = (b) => [`String(${G.val(b, 'VALUE', O.NONE, '""')}).length()`, O.POSTFIX];
bloque('texto_unir', COL.texto, function () {
  this.appendValueInput('A').appendField('unir');
  this.appendValueInput('B').appendField('con');
  this.setInputsInline(true); this.setOutput(true, 'String');
  this.setTooltip('Pega dos valores como texto. Sirve con números: "Temp: " + 25.4');
}, (b) => [`String(${G.val(b, 'A', O.NONE, '""')}) + String(${G.val(b, 'B', O.NONE, '""')})`, O.ADD]);
bloque('caracter', COL.texto, function () {
  this.appendDummyInput().appendField('carácter').appendField(new Blockly.FieldTextInput('A', v => (v ? v.charAt(0) : null)), 'C');
  this.setOutput(true, 'Char');
  this.setTooltip('Un solo carácter, por ejemplo la letra que envía la app de Bluetooth.');
}, (b) => [caracterC(b.getFieldValue('C')), O.ATOMIC]);
bloque('texto_a_numero', COL.texto, function () {
  this.appendValueInput('V').appendField('convertir texto a número');
  this.setOutput(true, 'Number');
}, (b) => [`String(${G.val(b, 'V', O.NONE, '""')}).toFloat()`, O.POSTFIX]);

/* ================= Variables tipadas ================= */
const TIPOS_CODIGO = TIPOS_VAR.map(t => t[1]);
bloque('var_set', COL.variables, function () {
  this.appendValueInput('V').appendField('fijar').appendField(new Blockly.FieldVariable(null, undefined, TIPOS_CODIGO, 'int'), 'VAR').appendField('a');
  sentencia(this);
}, (b) => `${nombreC(b.getField('VAR').getVariable().getName())} = ${G.val(b, 'V', O.ASSIGN, valorInicial(b.getField('VAR').getVariable().getType()))};\n`);
bloque('var_cambiar', COL.variables, function () {
  this.appendValueInput('V').appendField('sumar a').appendField(new Blockly.FieldVariable(null, undefined, ['int', 'long', 'float', 'char'], 'int'), 'VAR').appendField('el valor');
  sentencia(this);
}, (b) => `${nombreC(b.getField('VAR').getVariable().getName())} += ${G.val(b, 'V', O.ASSIGN, '1')};\n`);
bloque('var_get', COL.variables, function () {
  this.appendDummyInput().appendField(new Blockly.FieldVariable(null, undefined, TIPOS_CODIGO, 'int'), 'VAR');
  this.setOutput(true);
}, (b) => [nombreC(b.getField('VAR').getVariable().getName()), O.ATOMIC]);

/* ================= Entradas y salidas ================= */
/** Nombre de pin válido en C++ mientras se escribe: sin tildes ni espacios, y que no parezca un pin real. */
function validarNombrePin(v) {
  let s = nombreC(v);
  if (/^[AD]\d+$/.test(s)) s += '_';
  return s;
}
bloque('pin_nombre', COL.es, function () {
  this.appendDummyInput().appendField('el pin').appendField(new CampoPin('fisico', '13'), 'PIN')
    .appendField('se llama').appendField(new Blockly.FieldTextInput('LedRojo', validarNombrePin), 'NOMBRE');
  this.setTooltip('Ponle al pin el nombre de lo que conectaste: LedRojo, Boton, Sensor… El nombre aparece en los menús de pines. Si cambias el número aquí, cambia en todo el programa.');
}, () => '');
bloque('pin_valor', COL.es, function () {
  this.appendDummyInput().appendField('pin').appendField(new CampoPin('digital', '13'), 'PIN');
  this.setOutput(true, 'Number');
  this.setTooltip('El número de un pin (o su nombre). Sirve para pasarlo a tus propios bloques, por ejemplo parpadear(LedRojo).');
}, (b) => [b.getFieldValue('PIN'), O.ATOMIC]);
bloque('pin_modo', COL.es, function () {
  this.appendDummyInput().appendField('configurar pin').appendField(new CampoPin('digital', '2'), 'PIN').appendField('como')
    .appendField(dd([['entrada', 'INPUT'], ['entrada con pull-up', 'INPUT_PULLUP'], ['salida', 'OUTPUT']]), 'MODO');
  sentencia(this);
}, (b) => { const p = b.getFieldValue('PIN'); G.pin(p, 'E/S digital', b); return `pinMode(${p}, ${b.getFieldValue('MODO')});\n`; });
bloque('escribir_digital', COL.es, function () {
  this.appendDummyInput().appendField('escribir en pin').appendField(new CampoPin('digital', '13'), 'PIN')
    .appendField(dd([['ALTO (encendido)', 'HIGH'], ['BAJO (apagado)', 'LOW']]), 'EST');
  sentencia(this);
  this.setTooltip('Enciende o apaga un pin digital (LED, relé, zumbador activo). El pin se configura como salida solo.');
}, (b) => {
  const p = b.getFieldValue('PIN'); G.pin(p, 'E/S digital', b); G.setup('pinMode_' + pinReal(p), `pinMode(${p}, OUTPUT);`);
  return `digitalWrite(${p}, ${b.getFieldValue('EST')});\n`;
});
bloque('escribir_digital_valor', COL.es, function () {
  this.appendValueInput('V').appendField('escribir en pin').appendField(new CampoPin('digital', '13'), 'PIN').appendField('el valor lógico');
  sentencia(this);
}, (b) => {
  const p = b.getFieldValue('PIN'); G.pin(p, 'E/S digital', b); G.setup('pinMode_' + pinReal(p), `pinMode(${p}, OUTPUT);`);
  return `digitalWrite(${p}, ${G.val(b, 'V', O.NONE, 'LOW')} ? HIGH : LOW);\n`;
});
bloque('leer_digital', COL.es, function () {
  this.appendDummyInput().appendField('leer pin digital').appendField(new CampoPin('digital', '2'), 'PIN');
  this.setOutput(true, 'Boolean');
  this.setTooltip('Verdadero si el pin está en ALTO (5 V).');
}, (b) => { const p = b.getFieldValue('PIN'); G.pin(p, 'E/S digital', b); return [`digitalRead(${p})`, O.POSTFIX]; });
bloque('escribir_pwm', COL.es, function () {
  this.appendValueInput('V').appendField('escribir PWM en pin').appendField(new CampoPin('pwm', '9'), 'PIN').appendField('valor (0–255)');
  sentencia(this);
  this.setTooltip('Brillo de un LED o velocidad de un motor. Solo en pines con ~ (PWM).');
}, (b) => {
  const p = b.getFieldValue('PIN'); G.pin(p, 'E/S digital', b);
  if (!placa().pwm.map(String).includes(pinReal(p))) G.aviso(`El pin ${pinTexto(p)} no tiene PWM en ${placa().nombre}. Usa uno de: ${placa().pwm.join(', ')}.`, b);
  Ard.banderas_.pwmPines = (Ard.banderas_.pwmPines || []).concat([{ p, b }]);
  G.setup('pinMode_' + pinReal(p), `pinMode(${p}, OUTPUT);`);
  return `analogWrite(${p}, constrain(${G.val(b, 'V')}, 0, 255));\n`;
});
bloque('leer_analogo', COL.es, function () {
  this.appendDummyInput().appendField('leer pin analógico').appendField(new CampoPin('analogico', 'A0'), 'PIN');
  this.setOutput(true, 'Number');
  this.setTooltip('Valor de 0 a 1023 (0 a 5 V).');
}, (b) => { const p = b.getFieldValue('PIN'); G.pin(p, 'Entrada analógica', b); return [`analogRead(${p})`, O.POSTFIX]; });
bloque('tono', COL.es, function () {
  this.appendValueInput('F').appendField('sonar en pin').appendField(new CampoPin('digital', '8'), 'PIN').appendField('frecuencia (Hz)');
  this.appendValueInput('D').appendField('durante (ms)');
  this.setInputsInline(true); sentencia(this);
}, (b) => { const p = b.getFieldValue('PIN'); G.pin(p, 'Zumbador', b); return `tone(${p}, ${G.val(b, 'F')}, ${G.val(b, 'D')});\n`; });
bloque('sin_tono', COL.es, function () {
  this.appendDummyInput().appendField('silenciar pin').appendField(new CampoPin('digital', '8'), 'PIN');
  sentencia(this);
}, (b) => `noTone(${b.getFieldValue('PIN')});\n`);

/* ================= Listas y matrices (nivel 3) ================= */
// Se crean con bloques sueltos (son globales en C++). generarPrograma las lee antes de generar
// (leerListas en nucleo.js), así cualquier bloque conoce su tipo y tamaño.
const TIPOS_LISTA = TIPOS_VAR;
const TIPOS_MATRIZ = TIPOS_VAR.filter(t => t[1] !== 'String');

/** Menú con los nombres de las listas (o matrices) del programa; acepta cualquier nombre. */
class CampoLista extends Blockly.FieldDropdown {
  constructor(clase, valor) { super(function () { return [[valor, valor]]; }); this.clase_ = clase; this.setValue(valor); }
  doClassValidation_(v) { return v === null || v === undefined ? null : String(v); }
  getOptions() {
    const tipos = this.clase_ === 'matriz' ? ['matriz_crear'] : ['lista_crear', 'lista_vacia'];
    const nombres = [];
    if (typeof espacio !== 'undefined' && espacio) {
      tipos.forEach(t => espacio.getBlocksByType(t, true).forEach(b => { const n = b.getFieldValue('NAME'); if (!nombres.includes(n)) nombres.push(n); }));
    }
    const v = this.getValue();
    if (v && !nombres.includes(v)) nombres.push(v);
    if (!nombres.length) nombres.push(this.clase_ === 'matriz' ? 'matriz' : 'lista');
    return nombres.map(n => [n, n]);
  }
}

bloque('lista_crear', COL.listas, function () {
  this.appendDummyInput().appendField('lista').appendField(new Blockly.FieldTextInput('notas', validarNombrePin), 'NAME')
    .appendField('de').appendField(new Blockly.FieldDropdown(TIPOS_LISTA), 'TIPO');
  this.appendDummyInput().appendField('con los valores').appendField(new Blockly.FieldTextInput('262, 294, 330, 349'), 'VALORES');
  this.setTooltip('Una lista guarda varios valores del mismo tipo, separados por comas. Las posiciones empiezan en 0: el primero es la posición 0. En C++ esto se llama arreglo (array); en Python, lista.');
}, () => '');
bloque('lista_vacia', COL.listas, function () {
  this.appendDummyInput().appendField('lista').appendField(new Blockly.FieldTextInput('lecturas', validarNombrePin), 'NAME')
    .appendField('de').appendField(new Blockly.FieldDropdown(TIPOS_LISTA), 'TIPO')
    .appendField('con').appendField(new Blockly.FieldNumber(10, 1, 200, 1), 'N').appendField('espacios');
  this.setTooltip('Una lista vacía para ir guardando valores, por ejemplo mediciones. Empieza llena de ceros. En C++ se llama arreglo (array).');
}, () => '');

/* La matriz guarda sus valores en un campo oculto (JSON) y los muestra fila por fila sobre el bloque. */
const ICONO_TABLA = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#ffffff" fill-opacity=".22"/><path d="M5 6h14v12H5zM5 10h14M5 14h14M10 6v12M15 6v12" fill="none" stroke="#fff" stroke-width="1.6"/></svg>');
function datosMatriz(b) {
  let d;
  try { d = JSON.parse(b.getFieldValue('DATOS') || '[]'); } catch (e) { d = []; }
  const f = Number(b.getFieldValue('F')) || 1, c = Number(b.getFieldValue('C')) || 1;
  const r = [];
  for (let i = 0; i < f; i++) { r.push([]); for (let j = 0; j < c; j++) r[i].push(d[i] && d[i][j] !== undefined && d[i][j] !== '' ? String(d[i][j]) : '0'); }
  return r;
}
Blockly.Blocks.matriz_crear = {
  init() {
    this.setColour(COL.listas);
    const repintar = (v) => { setTimeout(() => !this.isDeadOrDying() && this.pintarFilas_(), 0); return v; };
    this.appendDummyInput('CAB').appendField('matriz').appendField(new Blockly.FieldTextInput('baile', validarNombrePin), 'NAME')
      .appendField('de').appendField(new Blockly.FieldDropdown(TIPOS_MATRIZ), 'TIPO')
      .appendField(new Blockly.FieldNumber(4, 1, 16, 1, repintar), 'F').appendField('filas ×')
      .appendField(new Blockly.FieldNumber(4, 1, 16, 1, repintar), 'C').appendField('columnas')
      .appendField(new Blockly.FieldImage(ICONO_TABLA, 18, 18, 'editar valores', () => editarMatriz(this)), 'EDIT')
      .appendField(new Blockly.FieldTextInput('[[90,90,90,90],[60,120,90,90],[90,90,60,120],[90,90,90,90]]', repintar), 'DATOS');
    this.getField('DATOS').setVisible(false);
    this.setTooltip('Una tabla de valores: por ejemplo, cada fila es una pose de Otto y cada columna un servo. Toca la tabla para editar los valores. Filas y columnas empiezan en 0.');
    this.pintarFilas_();
  },
  pintarFilas_() {
    let i = 0;
    while (this.getInput('R' + i)) { this.removeInput('R' + i); i++; }
    const d = datosMatriz(this);
    const ancho = Math.max(...d.flat().map(x => x.length), 1);
    d.slice(0, 8).forEach((fila, k) => {
      const t = fila.map(x => x.padStart(ancho)).join('  ');
      this.appendDummyInput('R' + k).appendField(new Blockly.FieldLabel(t.length > 60 ? t.slice(0, 58) + '…' : t, 'cpp-linea'));
    });
    if (d.length > 8) this.appendDummyInput('R8').appendField(new Blockly.FieldLabel(`… ${d.length - 8} filas más`, 'cpp-linea'));
  }
};
Ard.forBlock.matriz_crear = () => '';
/** Editor de la matriz: una tabla con un campo por celda. */
function editarMatriz(b) {
  if (b.isInFlyout) return;
  const d = datosMatriz(b);
  const tabla = el('table', { class: 'tb-matriz' },
    el('tr', null, el('th', null, ''), d[0].map((_, j) => el('th', null, String(j)))),
    d.map((fila, i) => el('tr', null, el('th', null, String(i)), fila.map((x, j) => el('td', null,
      el('input', { class: 'entrada', value: x, 'data-f': i, 'data-c': j, 'aria-label': `fila ${i}, columna ${j}`, size: 4 }))))));
  modal({
    titulo: `Matriz "${b.getFieldValue('NAME')}"`,
    cuerpo: [el('p', { class: 'muted' }, 'Filas y columnas empiezan en 0. Usa Tab para pasar a la celda siguiente.'), el('div', { class: 'tb-matriz-caja' }, tabla)],
    botones: [{ texto: 'Cancelar' }, { texto: 'Guardar', primario: true, accion: () => {
      const n = d.map(f => f.slice());
      tabla.querySelectorAll('input').forEach(inp => { n[inp.dataset.f][inp.dataset.c] = inp.value.trim() || '0'; });
      b.setFieldValue(JSON.stringify(n), 'DATOS');
    } }]
  });
}

bloque('lista_elemento', COL.listas, function () {
  this.appendValueInput('I').appendField('elemento');
  this.appendDummyInput().appendField('de').appendField(new CampoLista('lista', 'notas'), 'LISTA');
  this.setInputsInline(true); this.setOutput(true);
  this.setTooltip('El valor guardado en esa posición. La primera posición es 0.');
}, (b) => {
  const n = b.getFieldValue('LISTA');
  usarLista(b, n, 'lista', 'I');
  return [`${n}[${G.val(b, 'I')}]`, O.POSTFIX];
});
bloque('lista_poner', COL.listas, function () {
  this.appendDummyInput().appendField('poner en').appendField(new CampoLista('lista', 'notas'), 'LISTA');
  this.appendValueInput('I').appendField('posición');
  this.appendValueInput('V').appendField('el valor');
  this.setInputsInline(true); sentencia(this);
}, (b) => {
  const n = b.getFieldValue('LISTA');
  usarLista(b, n, 'lista', 'I');
  return `${n}[${G.val(b, 'I')}] = ${G.val(b, 'V', O.ASSIGN)};\n`;
});
bloque('lista_largo', COL.listas, function () {
  this.appendDummyInput().appendField('largo de').appendField(new CampoLista('lista', 'notas'), 'LISTA');
  this.setOutput(true, 'Number');
  this.setTooltip('Cuántos elementos tiene la lista. La última posición es el largo menos 1.');
}, (b) => {
  const n = b.getFieldValue('LISTA');
  usarLista(b, n, 'lista');
  Ard.banderas_.largoUsado = (Ard.banderas_.largoUsado || new Set()).add(n);
  return [`${n}_largo`, O.ATOMIC];
});
bloque('lista_para_cada', COL.listas, function () {
  this.appendDummyInput().appendField('para cada').appendField(new Blockly.FieldVariable(null, undefined, TIPOS_CODIGO, 'int'), 'VAR')
    .appendField('en').appendField(new CampoLista('lista', 'notas'), 'LISTA');
  this.appendStatementInput('DO').appendField('hacer');
  sentencia(this);
  this.setTooltip('Repite una vez por cada elemento: la variable toma el valor de cada uno, en orden.');
}, (b) => {
  const n = b.getFieldValue('LISTA');
  const vb = b.getField('VAR').getVariable();
  const v = nombreC(vb.getName());
  const l = usarLista(b, n, 'lista');
  if (l && ((l.tipo === 'String') !== (vb.getType() === 'String'))) G.aviso(`La variable "${vb.getName()}" es de otro tipo que la lista "${n}". Usa una variable de tipo ${NOMBRE_TIPO[l.tipo]}.`, b);
  Ard.banderas_.largoUsado = (Ard.banderas_.largoUsado || new Set()).add(n);
  const i = '_k' + profundidad(b, 'lista_para_cada');
  return `for (int ${i} = 0; ${i} < ${n}_largo; ${i}++) {\n${Ard.INDENT}${v} = ${n}[${i}];\n${G.sentencias(b, 'DO')}}\n`;
});
bloque('matriz_elemento', COL.listas, function () {
  this.appendDummyInput().appendField('de').appendField(new CampoLista('matriz', 'baile'), 'M');
  this.appendValueInput('F').appendField('fila');
  this.appendValueInput('C').appendField('columna');
  this.setInputsInline(true); this.setOutput(true);
  this.setTooltip('El valor en esa fila y columna. Ambas empiezan en 0.');
}, (b) => {
  const n = b.getFieldValue('M');
  usarLista(b, n, 'matriz', 'F', 'C');
  return [`${n}[${G.val(b, 'F')}][${G.val(b, 'C')}]`, O.POSTFIX];
});
bloque('matriz_poner', COL.listas, function () {
  this.appendDummyInput().appendField('poner en').appendField(new CampoLista('matriz', 'baile'), 'M');
  this.appendValueInput('F').appendField('fila');
  this.appendValueInput('C').appendField('columna');
  this.appendValueInput('V').appendField('el valor');
  this.setInputsInline(true); sentencia(this);
}, (b) => {
  const n = b.getFieldValue('M');
  usarLista(b, n, 'matriz', 'F', 'C');
  return `${n}[${G.val(b, 'F')}][${G.val(b, 'C')}] = ${G.val(b, 'V', O.ASSIGN)};\n`;
});
bloque('matriz_tamano', COL.listas, function () {
  this.appendDummyInput().appendField('número de').appendField(dd([['filas', 'filas'], ['columnas', 'columnas']]), 'Q')
    .appendField('de').appendField(new CampoLista('matriz', 'baile'), 'M');
  this.setOutput(true, 'Number');
}, (b) => {
  const n = b.getFieldValue('M'), q = b.getFieldValue('Q');
  usarLista(b, n, 'matriz');
  Ard.banderas_.largoUsado = (Ard.banderas_.largoUsado || new Set()).add(n + ':' + q);
  return [`${n}_${q}`, O.ATOMIC];
});

/* ================= Tiempo ================= */
bloque('esperar', COL.tiempo, function () {
  this.appendValueInput('MS').appendField('esperar');
  this.appendDummyInput().appendField('milisegundos');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('1000 milisegundos = 1 segundo. Mientras espera, la placa no hace nada más.');
}, (b) => `delay(${G.val(b, 'MS')});\n`);
bloque('esperar_seg', COL.tiempo, function () {
  this.appendValueInput('S').appendField('esperar');
  this.appendDummyInput().appendField('segundos');
  this.setInputsInline(true); sentencia(this);
}, (b) => `delay((unsigned long)(${G.val(b, 'S', O.MULT)} * 1000));\n`);
bloque('millis', COL.tiempo, function () {
  this.appendDummyInput().appendField('milisegundos desde que arrancó');
  this.setOutput(true, 'Number');
}, () => ['millis()', O.POSTFIX]);
bloque('cada_ms', COL.tiempo, function () {
  this.appendValueInput('MS').appendField('cada');
  this.appendDummyInput().appendField('ms hacer');
  this.appendStatementInput('DO');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Hace algo cada cierto tiempo sin detener el resto del programa (usa millis, no delay). Ponlo dentro de "repetir por siempre".');
}, (b) => {
  const t = '_t' + G.nuevoId();
  return `{\n${Ard.INDENT}static unsigned long ${t} = 0;\n${Ard.INDENT}if (millis() - ${t} >= (unsigned long)(${G.val(b, 'MS')})) {\n${Ard.INDENT}${Ard.INDENT}${t} = millis();\n${Ard.prefixLines(G.sentencias(b, 'DO'), Ard.INDENT)}${Ard.INDENT}}\n}\n`;
});

/* ================= Monitor serial ================= */
const BAUDIOS = [['9600', '9600'], ['19200', '19200'], ['38400', '38400'], ['57600', '57600'], ['115200', '115200']];
bloque('serial_iniciar', COL.serial, function () {
  this.appendDummyInput().appendField('iniciar monitor serial a').appendField(dd(BAUDIOS), 'B').appendField('baudios');
  sentencia(this);
}, (b) => { Ard.banderas_.serialIniciado = true; return `Serial.begin(${b.getFieldValue('B')});\n`; });
bloque('serial_imprimir', COL.serial, function () {
  this.appendValueInput('V').appendField('imprimir en serial');
  this.appendDummyInput().appendField('y saltar línea').appendField(new Blockly.FieldCheckbox('TRUE'), 'NL');
  this.setInputsInline(true); sentencia(this);
}, (b) => { Ard.banderas_.serialUsado = true; return `Serial.${b.getFieldValue('NL') === 'TRUE' ? 'println' : 'print'}(${G.val(b, 'V', O.NONE, '""')});\n`; });
bloque('serial_disponible', COL.serial, function () {
  this.appendDummyInput().appendField('¿llegaron datos por serial?');
  this.setOutput(true, 'Boolean');
}, () => { Ard.banderas_.serialUsado = true; return ['Serial.available() > 0', O.REL]; });
bloque('serial_leer_texto', COL.serial, function () {
  this.appendDummyInput().appendField('leer texto del serial (hasta Enter)');
  this.setOutput(true, 'String');
  this.setTooltip('Lee un mensaje completo enviado desde el monitor. Quita espacios y saltos de línea del final.');
}, () => {
  Ard.banderas_.serialUsado = true;
  G.ayuda('leerTextoSerial', 'String leerTextoSerial() {\n  String s = Serial.readStringUntil(\'\\n\');\n  s.trim();\n  return s;\n}');
  return ['leerTextoSerial()', O.POSTFIX];
});
bloque('serial_leer_caracter', COL.serial, function () {
  this.appendDummyInput().appendField('leer un carácter del serial');
  this.setOutput(true, 'Char');
}, () => { Ard.banderas_.serialUsado = true; return ['(char)Serial.read()', O.UNARY]; });
bloque('serial_leer_numero', COL.serial, function () {
  this.appendDummyInput().appendField('leer número').appendField(dd([['entero', 'parseInt'], ['decimal', 'parseFloat']]), 'T').appendField('del serial');
  this.setOutput(true, 'Number');
}, (b) => { Ard.banderas_.serialUsado = true; return [`Serial.${b.getFieldValue('T')}()`, O.POSTFIX]; });

/* ================= Bluetooth (HC-05 / HC-06) ================= */
function configurarBT(rx, tx, b) {
  Ard.banderas_.btConfig = true;
  const hw = placa().serialesHW.find(s => s.rx === pinReal(rx) && s.tx === pinReal(tx));
  if (hw) {
    G.global('bt', `#define BT ${hw.nombre}  // Bluetooth en el puerto serie ${hw.nombre} (RX ${rx}, TX ${tx})`);
  } else {
    G.incluir('SoftwareSerial', '#include <SoftwareSerial.h>');
    G.global('bt', `SoftwareSerial BT(${rx}, ${tx});  // RX del Arduino (va al TX del módulo), TX del Arduino`);
    const p = placa();
    if (p.swRx && !p.swRx.includes(pinReal(rx))) {
      G.aviso(`En ${p.nombre} el RX de Bluetooth por software solo funciona en ${p.swRx.join(', ')}. Mejor usa Serial1: RX 19 y TX 18.`, b);
    }
  }
  G.pin(rx, 'Bluetooth', b); G.pin(tx, 'Bluetooth', b);
}
bloque('bt_iniciar', COL.bt, function () {
  this.appendDummyInput().appendField('iniciar Bluetooth  RX').appendField(new CampoPin('digital', 'A1'), 'RX')
    .appendField('TX').appendField(new CampoPin('digital', 'A2'), 'TX').appendField('a').appendField(dd(BAUDIOS), 'B').appendField('baudios');
  sentencia(this);
  this.setTooltip('Conecta el TX del módulo al pin RX y el RX del módulo al pin TX. En el Mega, RX 19 y TX 18 usan Serial1 (más estable).');
}, (b) => { configurarBT(b.getFieldValue('RX'), b.getFieldValue('TX'), b); return `BT.begin(${b.getFieldValue('B')});\n`; });
bloque('bt_enviar', COL.bt, function () {
  this.appendValueInput('V').appendField('enviar por Bluetooth');
  this.appendDummyInput().appendField('y saltar línea').appendField(new Blockly.FieldCheckbox('TRUE'), 'NL');
  this.setInputsInline(true); sentencia(this);
}, (b) => { Ard.banderas_.btUsado = true; return `BT.${b.getFieldValue('NL') === 'TRUE' ? 'println' : 'print'}(${G.val(b, 'V', O.NONE, '""')});\n`; });
bloque('bt_disponible', COL.bt, function () {
  this.appendDummyInput().appendField('¿llegó un dato por Bluetooth?');
  this.setOutput(true, 'Boolean');
}, () => { Ard.banderas_.btUsado = true; return ['BT.available() > 0', O.REL]; });
bloque('bt_leer_caracter', COL.bt, function () {
  this.appendDummyInput().appendField('leer carácter de Bluetooth');
  this.setOutput(true, 'Char');
  this.setTooltip('Guárdalo en una variable de tipo carácter y compáralo con el bloque "carácter".');
}, () => { Ard.banderas_.btUsado = true; return ['(char)BT.read()', O.UNARY]; });
bloque('bt_leer_texto', COL.bt, function () {
  this.appendDummyInput().appendField('leer texto de Bluetooth (hasta Enter)');
  this.setOutput(true, 'String');
}, () => {
  Ard.banderas_.btUsado = true;
  G.ayuda('leerTextoBT', 'String leerTextoBT() {\n  String s = BT.readStringUntil(\'\\n\');\n  s.trim();\n  return s;\n}');
  return ['leerTextoBT()', O.POSTFIX];
});

/* ================= Motores (shield L293D, librería AFMotor_R4) ================= */
const PINES_MOTOR = { 1: '11', 2: '3', 3: '6', 4: '5' };
function usarShield(b) {
  G.incluir('AFMotor_R4', '#include <AFMotor_R4.h>');
  ['4', '7', '8', '12'].forEach(p => G.pin(p, 'Shield de motores', b));
}
function declararMotor(m, b) {
  usarShield(b);
  Ard.motores_.add(m);
  G.global('motor' + m, `AF_DCMotor motor${m}(${m});`);
  G.pin(PINES_MOTOR[m], 'Shield de motores', b);
}
const MOTORES = [['M1', '1'], ['M2', '2'], ['M3', '3'], ['M4', '4']];
bloque('motor_dc', COL.motores, function () {
  this.appendValueInput('VEL').appendField('motor').appendField(dd(MOTORES), 'M')
    .appendField(dd([['adelante', 'FORWARD'], ['atrás', 'BACKWARD']]), 'DIR').appendField('a velocidad');
  sentencia(this);
  this.setTooltip('Velocidad de 0 (quieto) a 255 (máxima). Usa la shield L293D con la librería AFMotor_R4.');
}, (b) => {
  const m = b.getFieldValue('M'); declararMotor(m, b);
  return `motor${m}.setSpeed(constrain(${G.val(b, 'VEL', O.NONE, '200')}, 0, 255));\nmotor${m}.run(${b.getFieldValue('DIR')});\n`;
});
bloque('motor_detener', COL.motores, function () {
  this.appendDummyInput().appendField('detener motor').appendField(dd(MOTORES), 'M');
  sentencia(this);
}, (b) => { const m = b.getFieldValue('M'); declararMotor(m, b); return `motor${m}.run(RELEASE);\n`; });
bloque('motores_detener_todos', COL.motores, function () {
  this.appendDummyInput().appendField('detener todos los motores');
  sentencia(this);
}, () => { Ard.banderas_.detenerTodos = true; return 'detenerMotores();\n'; });
bloque('motor_paso', COL.motores, function () {
  this.appendDummyInput().appendField('motor paso a paso en').appendField(dd([['puerto 1 (M1-M2)', '1'], ['puerto 2 (M3-M4)', '2']]), 'P')
    .appendField('de').appendField(new Blockly.FieldNumber(200, 1, 10000, 1), 'SPR').appendField('pasos/vuelta');
  this.appendValueInput('RPM').appendField('velocidad (RPM)');
  this.appendValueInput('N').appendField('mover');
  this.appendDummyInput().appendField('pasos').appendField(dd([['adelante', 'FORWARD'], ['atrás', 'BACKWARD']]), 'DIR')
    .appendField('modo').appendField(dd([['simple', 'SINGLE'], ['doble', 'DOUBLE'], ['intercalado', 'INTERLEAVE'], ['micropasos', 'MICROSTEP']]), 'MODO');
  this.setInputsInline(true); sentencia(this);
}, (b) => {
  const p = b.getFieldValue('P'); usarShield(b);
  G.global('paso' + p, `AF_Stepper paso${p}(${b.getFieldValue('SPR')}, ${p});`);
  (p === '1' ? ['11', '3'] : ['6', '5']).forEach(x => G.pin(x, 'Shield de motores', b));
  return `paso${p}.setSpeed(${G.val(b, 'RPM', O.NONE, '10')});\npaso${p}.step(${G.val(b, 'N', O.NONE, '100')}, ${b.getFieldValue('DIR')}, ${b.getFieldValue('MODO')});\n`;
});

/* ================= Servos ================= */
bloque('servo_mover', COL.servos, function () {
  this.appendValueInput('A').appendField('mover servo en pin').appendField(new CampoPin('digital', '10'), 'PIN').appendField('a');
  this.appendDummyInput().appendField('grados');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Ángulo de 0 a 180. En la shield L293D los conectores SERVO_1 y SERVO_2 son los pines 10 y 9.');
}, (b) => {
  const p = b.getFieldValue('PIN'), s = 'servo_' + sufijoPin(p);  // un objeto por pin físico
  G.incluir('Servo', '#include <Servo.h>');
  G.global(s, `Servo ${s};`);
  G.setup(s, `${s}.attach(${p});`);
  G.pin(p, 'Servo', b);
  Ard.banderas_.servoUsado = true;
  return `${s}.write(constrain(${G.val(b, 'A', O.NONE, '90')}, 0, 180));\n`;
});

/* ================= Sensores ================= */
bloque('dht_leer', COL.sensores, function () {
  this.appendDummyInput().appendField('sensor').appendField(dd([['DHT11', 'DHT11'], ['DHT22', 'DHT22']]), 'T')
    .appendField('en pin').appendField(new CampoPin('digital', 'A0'), 'PIN').appendField('leer')
    .appendField(dd([['temperatura °C', 'C'], ['humedad %', 'H'], ['temperatura °F', 'F']]), 'M');
  this.setOutput(true, 'Number');
  this.setTooltip('Usa la librería DHT de Adafruit. El sensor entrega un dato nuevo cada 1–2 segundos; si falla da NaN (revisa con "¿es un número válido?").');
}, (b) => {
  const p = b.getFieldValue('PIN'), t = b.getFieldValue('T'), n = 'dht_' + sufijoPin(p);
  G.incluir('DHT', '#include <DHT.h>');
  const previo = Ard.globales_.get(n);
  if (previo && !previo.includes(`, ${t})`)) G.aviso(`En el pin ${pinTexto(p)} hay un DHT11 y un DHT22 a la vez. Elige uno.`, b);
  G.global(n, `DHT ${n}(${p}, ${t});`);
  G.setup(n, `${n}.begin();`);
  G.pin(p, 'Sensor ' + t, b);
  const m = b.getFieldValue('M');
  return [m === 'H' ? `${n}.readHumidity()` : m === 'F' ? `${n}.readTemperature(true)` : `${n}.readTemperature()`, O.POSTFIX];
});
bloque('ultrasonido', COL.sensores, function () {
  this.appendDummyInput().appendField('distancia en cm  Trig').appendField(new CampoPin('digital', '8'), 'TRIG')
    .appendField('Echo').appendField(new CampoPin('digital', '9'), 'ECHO');
  this.setOutput(true, 'Number');
  this.setTooltip('Sensor HC-SR04. Si no hay nada al frente (más de ~5 m) devuelve 999.');
}, (b) => {
  const tr = b.getFieldValue('TRIG'), ec = b.getFieldValue('ECHO');
  G.ayuda('leerDistanciaCM', 'float leerDistanciaCM(int trig, int echo) {\n  digitalWrite(trig, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trig, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trig, LOW);\n  unsigned long d = pulseIn(echo, HIGH, 30000UL);\n  if (d == 0) return 999;  // sin eco: nada al frente\n  return d / 58.0;\n}');
  G.setup('us_' + tr + '_' + ec, `pinMode(${tr}, OUTPUT);\npinMode(${ec}, INPUT);`);
  G.pin(tr, 'Ultrasonido', b); G.pin(ec, 'Ultrasonido', b);
  return [`leerDistanciaCM(${tr}, ${ec})`, O.POSTFIX];
});

/* ================= Bus I2C (Wire) — compartido por LCD, MPU6050 y PCA9685 ================= */
/** Registra el bus I2C (A4/A5 en Uno/Nano, 20/21 en Mega) y la dirección del módulo, para avisar si dos chocan. */
function usarI2C(b, quien, dir) {
  G.incluir('Wire', '#include <Wire.h>');
  G.setup('wire', 'Wire.begin();');
  const i2c = placa().i2c;
  G.pin(i2c.sda, 'Bus I2C (SDA)', b); G.pin(i2c.scl, 'Bus I2C (SCL)', b);
  if (!dir) return;
  const m = Ard.banderas_.i2cDirs || (Ard.banderas_.i2cDirs = new Map());
  const d = String(dir).toLowerCase();
  if (m.has(d) && m.get(d) !== quien) G.aviso(`${quien} y ${m.get(d)} usan la misma dirección I2C (${dir}). Cambia la de uno (con los puentes del módulo).`, b);
  else m.set(d, quien);
}
/** Dirección I2C escrita a mano: acepta 0x27 o 39; la deja como 0x27. Las válidas van de 0x08 a 0x77. */
function validarDirI2C(v) {
  const s = String(v).trim();
  const n = /^0x[0-9a-f]{1,2}$/i.test(s) ? parseInt(s, 16) : /^\d{1,3}$/.test(s) ? parseInt(s, 10) : NaN;
  if (isNaN(n) || n < 8 || n > 0x77) return null;
  return '0x' + n.toString(16).toUpperCase().padStart(2, '0');
}
const BUSCAR_I2C = `void i2cBuscar() {
  Serial.println(F("Buscando dispositivos I2C..."));
  byte encontrados = 0;
  for (byte dir = 8; dir < 120; dir++) {
    Wire.beginTransmission(dir);
    if (Wire.endTransmission() == 0) {
      Serial.print(F("  0x"));
      if (dir < 16) Serial.print('0');
      Serial.print(dir, HEX);
      if (dir == 0x27 || dir == 0x3F) Serial.print(F("  pantalla LCD"));
      if (dir == 0x3C || dir == 0x3D) Serial.print(F("  pantalla OLED"));
      if (dir >= 0x40 && dir <= 0x47) Serial.print(F("  PCA9685 (16 servos)"));
      if (dir == 0x68 || dir == 0x69) Serial.print(F("  MPU6050 (o reloj RTC)"));
      Serial.println();
      encontrados++;
    }
  }
  if (encontrados == 0) Serial.println(F("  Ninguno. Revisa los cables SDA y SCL y la alimentación."));
}`;
bloque('i2c_buscar', COL.i2c, function () {
  this.appendDummyInput().appendField('buscar dispositivos I2C y mostrarlos en el monitor serial');
  sentencia(this);
  this.setTooltip('Escribe en el monitor serial la dirección de cada módulo conectado al bus I2C (por ejemplo, si tu pantalla es 0x27 o 0x3F). Ponlo en "al iniciar".');
}, (b) => {
  usarI2C(b, '', null);
  Ard.banderas_.serialUsado = true;
  G.ayuda('i2cBuscar', BUSCAR_I2C);
  return 'i2cBuscar();\n';
});
bloque('i2c_enviar', COL.i2c, function () {
  this.appendValueInput('V').appendField('I2C enviar a').appendField(new Blockly.FieldTextInput('0x08', validarDirI2C), 'DIR').appendField('el byte');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Envía un byte (0 a 255) al dispositivo con esa dirección.');
}, (b) => {
  usarI2C(b, '', null);
  const d = b.getFieldValue('DIR');
  return `Wire.beginTransmission(${d});\nWire.write((byte) ${G.val(b, 'V', O.UNARY)});\nWire.endTransmission();\n`;
});
bloque('i2c_pedir', COL.i2c, function () {
  this.appendValueInput('N').appendField('I2C pedir');
  this.appendDummyInput().appendField('bytes a').appendField(new Blockly.FieldTextInput('0x08', validarDirI2C), 'DIR');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Pide bytes a un dispositivo. Después léelos con "leer byte I2C" mientras haya datos.');
}, (b) => { usarI2C(b, '', null); return `Wire.requestFrom((uint8_t) ${b.getFieldValue('DIR')}, (uint8_t) ${G.val(b, 'N', O.UNARY, '1')});\n`; });
bloque('i2c_disponible', COL.i2c, function () {
  this.appendDummyInput().appendField('¿hay bytes I2C por leer?');
  this.setOutput(true, 'Boolean');
}, (b) => { usarI2C(b, '', null); return ['(Wire.available() > 0)', O.ATOMIC]; });
bloque('i2c_leer', COL.i2c, function () {
  this.appendDummyInput().appendField('leer byte I2C');
  this.setOutput(true, 'Number');
}, (b) => { usarI2C(b, '', null); return ['Wire.read()', O.POSTFIX]; });

/* ================= MPU6050 (librería MPU6050_light) ================= */
function configurarMPU(dir, calibrar, b) {
  Ard.banderas_.mpuConfig = true;
  usarI2C(b, 'MPU6050', dir);
  G.incluir('MPU6050_light', '#include <MPU6050_light.h>');
  G.global('mpu', 'MPU6050 mpu(Wire);');
  G.setup('mpu', (dir !== '0x68' ? `mpu.setAddress(${dir});\n` : '') + 'mpu.begin();' +
    (calibrar ? '\ndelay(1000);         // el sensor debe estar quieto mientras calibra\nmpu.calcOffsets();' : ''));
}
function mpuUsado() { Ard.banderas_.mpuUsado = true; G.ayuda('mpuLeido', 'MPU6050& mpuLeido() {\n  mpu.update();  // lee el sensor y actualiza los ángulos\n  return mpu;\n}'); }
bloque('mpu_iniciar', COL.sensores, function () {
  this.appendDummyInput().appendField('iniciar sensor de movimiento MPU6050  dirección').appendField(dd([['0x68', '0x68'], ['0x69', '0x69']]), 'DIR')
    .appendField('calibrar').appendField(new Blockly.FieldCheckbox('TRUE'), 'CAL');
  sentencia(this);
  this.setTooltip('Calibrar toma 1 segundo: deja el robot quieto y plano. La dirección es 0x69 solo si el pin AD0 del módulo está en 5 V.');
}, (b) => {
  if (Ard.banderas_.mpuConfig) { G.aviso('Hay más de un bloque "iniciar MPU6050".', b); return ''; }
  configurarMPU(b.getFieldValue('DIR'), b.getFieldValue('CAL') === 'TRUE', b);
  return '';
});
bloque('mpu_angulo', COL.sensores, function () {
  this.appendDummyInput().appendField('MPU6050 ángulo').appendField(dd([['X', 'X'], ['Y', 'Y'], ['Z (giro)', 'Z']]), 'EJE').appendField('en grados');
  this.setOutput(true, 'Number');
  this.setTooltip('Cuánto está inclinado el sensor. X e Y: inclinación (0 = plano). Z: cuánto ha girado desde que arrancó; se va corriendo poco a poco.');
}, (b) => { mpuUsado(); return [`mpuLeido().getAngle${b.getFieldValue('EJE')}()`, O.POSTFIX]; });
bloque('mpu_dato', COL.sensores, function () {
  this.appendDummyInput().appendField('MPU6050 leer').appendField(dd([
    ['aceleración X (g)', 'getAccX'], ['aceleración Y (g)', 'getAccY'], ['aceleración Z (g)', 'getAccZ'],
    ['velocidad de giro X (°/s)', 'getGyroX'], ['velocidad de giro Y (°/s)', 'getGyroY'], ['velocidad de giro Z (°/s)', 'getGyroZ'],
    ['temperatura (°C)', 'getTemp']]), 'D');
  this.setOutput(true, 'Number');
  this.setTooltip('Aceleración en g (quieto y plano, Z vale cerca de 1). Velocidad de giro en grados por segundo.');
}, (b) => { mpuUsado(); return [`mpuLeido().${b.getFieldValue('D')}()`, O.POSTFIX]; });

/* ================= PCA9685: controlador de 16 servos (Adafruit_PWMServoDriver) ================= */
const DIRS_PCA = [0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47].map(n => { const t = '0x' + n.toString(16).toUpperCase(); return [t, t]; });
const CANALES = Array.from({ length: 16 }, (_, i) => [String(i), String(i)]);
const PULSO_0 = 500, PULSO_180 = 2500;  // valores típicos (µs) para los canales sin calibrar
function configurarPCA(dir, b) {
  Ard.banderas_.pcaConfig = true;
  usarI2C(b, 'PCA9685', dir);
  G.incluir('Adafruit_PWMServoDriver', '#include <Adafruit_PWMServoDriver.h>');
  G.global('pca', `Adafruit_PWMServoDriver pca(${dir});`);
  G.setup('pca', 'pca.begin();\npca.setOscillatorFrequency(27000000);\npca.setPWMFreq(50);  // 50 Hz: la frecuencia de los servos');
}
function pcaUsado() { Ard.banderas_.pcaUsado = true; }

/* ---- Calibración por canal: una fila por servo (canal, nombre, pulso para 0°, pulso para 180°) ---- */
const NOMBRES_SERVO = ['base', 'hombro', 'codo', 'pinza'];
function validarNombreServo(v) { return String(v).replace(/[\r\n\/\\*]+/g, ' ').slice(0, 20); }
function leerFilasCalibracion(b) {
  const n = parseInt(b.getFieldValue('N') || '0', 10), filas = [];
  for (let i = 0; i < n; i++) {
    if (!b.getField('S' + i + 'C')) break;
    filas.push({ canal: b.getFieldValue('S' + i + 'C'), nombre: (b.getFieldValue('S' + i + 'N') || '').trim(),
      a: Number(b.getFieldValue('S' + i + 'A')), b: Number(b.getFieldValue('S' + i + 'B')) });
  }
  return filas;
}
/** Canal → nombre del servo, según el bloque de calibración del programa (para los menús de canal). */
function nombresDeCanales() {
  const r = {};
  if (typeof espacio === 'undefined' || !espacio) return r;
  const b = espacio.getBlocksByType('pca_calibracion', true).find(x => x.isEnabled());
  if (b) leerFilasCalibracion(b).forEach(f => { if (f.nombre && !(f.canal in r)) r[f.canal] = f.nombre; });
  return r;
}
/** Menú de canales 0–15; si el canal tiene nombre en la calibración, lo muestra: "hombro (1)". */
class CampoCanal extends Blockly.FieldDropdown {
  constructor(valor) { super(function () { return CANALES; }); if (valor !== undefined) this.setValue(String(valor)); }
  getOptions() {
    const nombres = nombresDeCanales();
    return CANALES.map(([t, v]) => [nombres[v] ? `${nombres[v]} (${v})` : t, v]);
  }
}
/** Lo lee generarPrograma antes de generar: {bloque, canales: {canal: fila}} o null. */
function leerCalibracionPCA(ws) {
  const bs = ws.getBlocksByType('pca_calibracion', true).filter(b => b.isEnabled());
  if (!bs.length) return null;
  if (bs.length > 1) G.aviso('Hay más de un bloque de calibración del PCA9685; se usa el primero.', bs[1]);
  const b = bs[0], canales = {};
  for (const f of leerFilasCalibracion(b)) {
    const nom = f.nombre || `canal ${f.canal}`;
    if (f.canal in canales) G.aviso(`El canal ${f.canal} está dos veces en la calibración ("${canales[f.canal].nombre || 'sin nombre'}" y "${nom}"). Cada servo va en un canal distinto.`, b);
    else canales[f.canal] = f;
    if (f.a === f.b) G.aviso(`En la calibración, "${nom}" tiene el mismo pulso para 0° y para 180°: el servo no se movería.`, b);
  }
  return { bloque: b, canales };
}
const comentarioCanal = (c) => { const x = Ard.calPCA_ && Ard.calPCA_.canales[c]; return x && x.nombre ? `  // ${x.nombre}` : ''; };
/** Escribe la función pcaServo(): con la tabla de calibración si existe, o con los pulsos típicos. */
function definirPcaServo() {
  const cal = Ard.calPCA_;
  if (!cal) {
    Ard.ayudas_.set('pcaServo', `void pcaServo(uint8_t canal, int grados) {\n  grados = constrain(grados, 0, 180);\n  pca.writeMicroseconds(canal, map(grados, 0, 180, ${PULSO_0}, ${PULSO_180}));  // ${PULSO_0} µs = 0°, ${PULSO_180} µs = 180°\n}`);
    return;
  }
  const filas = [];
  for (let c = 0; c < 16; c++) {
    const x = cal.canales[c];
    filas.push(`  { ${x ? x.a : PULSO_0}, ${x ? x.b : PULSO_180} }${c < 15 ? ',' : ' '}  // canal ${c}${x ? ': ' + (x.nombre || 'calibrado') : ''}`);
  }
  G.global('pcaCalibracion', '// Calibración del PCA9685: una fila por canal = { pulso para 0°, pulso para 180° } en microsegundos\n' +
    'int pcaCalibracion[16][2] = {\n' + filas.join('\n') + '\n};');
  Ard.ayudas_.set('pcaServo', 'void pcaServo(uint8_t canal, int grados) {\n  grados = constrain(grados, 0, 180);\n' +
    '  int pulso0 = pcaCalibracion[canal][0];    // fila del canal, columna 0\n  int pulso180 = pcaCalibracion[canal][1];  // fila del canal, columna 1\n' +
    '  pca.writeMicroseconds(canal, map(grados, 0, 180, pulso0, pulso180));\n}');
}
Blockly.Blocks.pca_calibracion = {
  init() {
    this.setColour(COL.servos);
    const self = this;
    this.appendDummyInput('CAB').appendField('calibración de servos del PCA9685 para')
      .appendField(new Blockly.FieldDropdown(Array.from({ length: 16 }, (_, i) => [String(i + 1), String(i + 1)]),
        function (v) { self.actualizarFilas_(parseInt(v, 10)); return v; }), 'N')
      .appendField('servos');
    this.getField('N').setValue('4');
    this.actualizarFilas_(4);
    this.setTooltip('Cada servo es distinto. Para cada canal escribe el pulso (en microsegundos) que lo lleva a 0° y a 180°. ' +
      'Si en 90° no queda derecho, sube o baja los dos valores por igual. Para invertir el giro, intercambia los dos valores. ' +
      `Los canales que no estén aquí usan ${PULSO_0} y ${PULSO_180}.`);
  },
  /** Agrega o quita filas para que haya n servos. Una fila nueva toma el primer canal libre. */
  actualizarFilas_(n) {
    for (let i = 0; i < 16; i++) {
      const existe = this.getInput('S' + i);
      if (i < n && !existe) {
        const usados = new Set();
        for (let k = 0; k < i; k++) { const f = this.getField('S' + k + 'C'); if (f) usados.add(f.getValue()); }
        let libre = 0;
        while (usados.has(String(libre)) && libre < 15) libre++;
        this.appendDummyInput('S' + i).appendField('canal')
          .appendField(new Blockly.FieldDropdown(CANALES), 'S' + i + 'C')
          .appendField(new Blockly.FieldTextInput(NOMBRES_SERVO[i] || 'servo ' + (i + 1), validarNombreServo), 'S' + i + 'N')
          .appendField('  0° →').appendField(new Blockly.FieldNumber(PULSO_0, 300, 2800, 1), 'S' + i + 'A')
          .appendField('µs   180° →').appendField(new Blockly.FieldNumber(PULSO_180, 300, 2800, 1), 'S' + i + 'B')
          .appendField('µs');
        this.setFieldValue(String(libre), 'S' + i + 'C');
      } else if (i >= n && existe) {
        this.removeInput('S' + i);
      }
    }
  }
};
Ard.forBlock.pca_calibracion = () => '';

bloque('pca_iniciar', COL.servos, function () {
  this.appendDummyInput().appendField('iniciar controlador de 16 servos PCA9685  dirección').appendField(dd(DIRS_PCA), 'DIR');
  sentencia(this);
  this.setTooltip('Los servos se alimentan por el borne V+ del módulo (no desde el Arduino). La dirección cambia con los puentes A0–A5 del módulo.');
}, (b) => {
  if (Ard.banderas_.pcaConfig) { G.aviso('Hay más de un bloque "iniciar PCA9685".', b); return ''; }
  configurarPCA(b.getFieldValue('DIR'), b);
  return '';
});
bloque('pca_servo', COL.servos, function () {
  this.appendValueInput('A').appendField('PCA9685 mover servo del canal').appendField(new CampoCanal('0'), 'C').appendField('a');
  this.appendDummyInput().appendField('grados');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Ángulo de 0 a 180. Si el servo no llega a los extremos, zumba o no queda derecho, ajústalo con el bloque "calibración de servos".');
}, (b) => {
  pcaUsado(); Ard.banderas_.pcaServo = true;
  const c = b.getFieldValue('C');
  return `pcaServo(${c}, ${G.val(b, 'A', O.NONE, '90')});${comentarioCanal(c)}\n`;
});
bloque('pca_soltar', COL.servos, function () {
  this.appendDummyInput().appendField('PCA9685 soltar servo del canal').appendField(new CampoCanal('0'), 'C');
  sentencia(this);
  this.setTooltip('El servo deja de hacer fuerza (se puede mover con la mano y gasta menos batería).');
}, (b) => {
  pcaUsado();
  const c = b.getFieldValue('C'), x = comentarioCanal(c);
  return `pca.setPWM(${c}, 0, 4096);  // ${x ? 'soltar ' + x.replace('  // ', '') + ' ' : ''}(4096 = apagado)\n`;
});
bloque('pca_pwm', COL.servos, function () {
  this.appendValueInput('V').appendField('PCA9685 canal').appendField(new CampoCanal('0'), 'C').appendField('PWM (0–4095)');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Para LEDs u otros usos: 0 apagado, 4095 encendido del todo. Funciona a 50 Hz (la frecuencia de los servos).');
}, (b) => { pcaUsado(); const c = b.getFieldValue('C'); return `pca.setPin(${c}, constrain(${G.val(b, 'V')}, 0, 4095));${comentarioCanal(c)}\n`; });

/* ================= Pantalla LCD 16x2 I2C ================= */
/** Dibujo de 5x8 puntos para un símbolo de la LCD: 40 caracteres '0'/'1', fila por fila. */
const DIBUJOS_LCD = [
  ['corazón', '0000001010111111111111111011100010000000'],
  ['carita', '0000001010010100000010001011100000000000'],
  ['grado °', '0110010010100100110000000000000000000000'],
  ['flecha', '0010001110101010010000100001000010000000'],
  ['nota', '0001000011000100001001110111100110000000'],
  ['batería', '0111011111100011000111111111111111111111'],
  ['campana', '0010001110011100111011111000000010000000'],
  ['persona', '0111001110001001111100100010101000100000']
];
const DIBUJO_VACIO = '0'.repeat(40);
/** Opciones del campo de dibujo. Por defecto: símbolo de la LCD (5 x 8, azul). */
const OP_LCD = { ancho: 5, alto: 8, T: 6, celda: 24, fondo: '#1e4fa8', apagado: '#2b5fbf', encendido: '#eef4ff', dibujos: DIBUJOS_LCD };
class CampoDibujo extends Blockly.Field {
  constructor(valor, opciones) {
    // SKIP_SETUP: el valor se valida después de conocer el tamaño (5 x 8 o 8 x 8)
    super(Blockly.Field.SKIP_SETUP);
    this.op_ = Object.assign({}, OP_LCD, opciones || {});
    this.SERIALIZABLE = true;
    this.CURSOR = 'pointer';
    this.setValue(valor || '0'.repeat(this.op_.ancho * this.op_.alto));
  }
  get total_() { const op = this.op_ || OP_LCD; return op.ancho * op.alto; }
  doClassValidation_(v) { return typeof v === 'string' && /^[01]+$/.test(v) && v.length === this.total_ ? v : null; }
  initView() {
    const { ancho, alto, T, fondo } = this.op_, dom = Blockly.utils.dom;
    // Dentro de un grupo propio: el CSS de Blockly pinta de blanco los <rect> hijos directos del campo.
    const g = dom.createSvgElement('g', {}, this.fieldGroup_);
    dom.createSvgElement('rect', { width: ancho * T + 3, height: alto * T + 3, rx: 3, fill: fondo }, g);
    this.puntos_ = [];
    for (let i = 0; i < ancho * alto; i++) {
      this.puntos_.push(dom.createSvgElement('rect', { x: 2 + (i % ancho) * T, y: 2 + Math.floor(i / ancho) * T, width: T - 1, height: T - 1 }, g));
    }
  }
  render_() {
    const { ancho, alto, T, apagado, encendido } = this.op_;
    const v = this.getValue() || '';
    if (this.puntos_) this.puntos_.forEach((r, i) => r.setAttribute('fill', v[i] === '1' ? encendido : apagado));
    this.size_ = new Blockly.utils.Size(ancho * T + 3, alto * T + 3);
  }
  getText_() { return 'dibujo'; }
  showEditor_() {
    const { ancho, alto, celda, fondo, apagado, encendido, dibujos } = this.op_;
    const total = ancho * alto;
    const div = Blockly.DropDownDiv.getContentDiv();
    div.textContent = '';
    const caja = document.createElement('div');
    caja.className = 'tb-dibujo';
    const rejilla = document.createElement('div');
    rejilla.className = 'tb-dibujo-rejilla';
    rejilla.style.gridTemplateColumns = `repeat(${ancho}, ${celda}px)`;
    rejilla.style.background = fondo;
    rejilla.style.setProperty('--apagado', apagado);
    rejilla.style.setProperty('--encendido', encendido);
    let pintando = null;
    const celdas = [];
    const poner = (i, on) => {
      const v = this.getValue();
      if ((v[i] === '1') === on) return;
      this.setValue(v.slice(0, i) + (on ? '1' : '0') + v.slice(i + 1));
      pintarCeldas();
    };
    const pintarCeldas = () => { const v = this.getValue(); celdas.forEach((c, i) => c.classList.toggle('on', v[i] === '1')); };
    const soltar = () => { if (pintando !== null) { pintando = null; Blockly.Events.setGroup(false); } };
    for (let i = 0; i < total; i++) {
      const c = document.createElement('div');
      c.className = 'tb-dibujo-celda';
      c.style.width = c.style.height = celda + 'px';
      c.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        Blockly.Events.setGroup(true);
        pintando = this.getValue()[i] !== '1';
        poner(i, pintando);
      });
      c.addEventListener('pointerenter', () => { if (pintando !== null) poner(i, pintando); });
      celdas.push(c); rejilla.appendChild(c);
    }
    rejilla.addEventListener('pointerup', soltar);
    rejilla.addEventListener('pointerleave', soltar);
    const acciones = document.createElement('div');
    acciones.className = 'tb-dibujo-acciones';
    const boton = (texto, titulo, fn) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = texto; btn.title = titulo;
      btn.addEventListener('click', () => { Blockly.Events.setGroup(true); fn(); Blockly.Events.setGroup(false); pintarCeldas(); });
      acciones.appendChild(btn);
    };
    const punto = (v, x, y) => v[y * ancho + x];
    boton('Borrar', 'Apagar todos los puntos', () => this.setValue('0'.repeat(total)));
    boton('Invertir', 'Cambiar puntos encendidos por apagados', () => this.setValue(this.getValue().replace(/[01]/g, (d) => (d === '1' ? '0' : '1'))));
    boton('Espejo', 'Voltear de izquierda a derecha', () => {
      const v = this.getValue(); let n = '';
      for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) n += punto(v, ancho - 1 - x, y);
      this.setValue(n);
    });
    if (ancho === alto) boton('Girar', 'Girar el dibujo 90° a la derecha', () => {
      const v = this.getValue(); let n = '';
      for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) n += punto(v, y, ancho - 1 - x);
      this.setValue(n);
    });
    const listos = document.createElement('div');
    listos.className = 'tb-dibujo-listos';
    dibujos.forEach(([nombre, bits]) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.title = nombre;
      const esc = 24 / (alto * 2);
      btn.innerHTML = `<svg viewBox="0 0 ${ancho * 2} ${alto * 2}" width="${Math.round(ancho * 2 * esc)}" height="24">` +
        [...bits].map((d, i) => (d === '1' ? `<rect x="${(i % ancho) * 2}" y="${Math.floor(i / ancho) * 2}" width="1.7" height="1.7"/>` : '')).join('') + '</svg>';
      btn.addEventListener('click', () => { this.setValue(bits); pintarCeldas(); });
      listos.appendChild(btn);
    });
    const ayuda = document.createElement('p');
    ayuda.textContent = 'Toca o arrastra para pintar. Abajo hay dibujos listos.';
    caja.append(ayuda, rejilla, acciones, listos);
    div.appendChild(caja);
    pintarCeldas();
    Blockly.DropDownDiv.setColour('var(--panel)', 'var(--line)');
    Blockly.DropDownDiv.showPositionedByField(this, soltar);
  }
}
CampoDibujo.T = 6;

/** Menú con los nombres de los símbolos creados en el programa (acepta cualquier nombre). */
class CampoSimbolo extends Blockly.FieldDropdown {
  constructor(valor) { super(function () { return [[valor, valor]]; }); this.setValue(valor); }
  doClassValidation_(v) { return v === null || v === undefined ? null : String(v); }
  getOptions() {
    const b = this.getSourceBlock && this.getSourceBlock();
    const ws = b && b.workspace;
    const nombres = ws ? [...new Set(ws.getBlocksByType('lcd_simbolo_crear', true).map(x => x.getFieldValue('NAME')))] : [];
    const v = this.getValue();
    if (v && !nombres.includes(v)) nombres.push(v);
    if (!nombres.length) nombres.push('corazón');
    return nombres.map(n => [n, n]);
  }
}

/** Número de 0 a 7 que la pantalla le da a cada símbolo (en el orden en que aparecen). */
function indiceSimbolo(nombre) {
  const m = Ard.banderas_.lcdSimbolos || (Ard.banderas_.lcdSimbolos = new Map());
  if (!m.has(nombre)) m.set(nombre, m.size);
  return m.get(nombre);
}
/** Guarda las posiciones escritas con números fijos para revisarlas contra el tamaño de la pantalla. */
function anotarPosLCD(b, entradaCol, entradaFila) {
  const fijo = (n) => { const t = n && b.getInputTargetBlock(n); return t && t.type === 'math_number' ? Number(t.getFieldValue('NUM')) : null; };
  (Ard.banderas_.lcdPos || (Ard.banderas_.lcdPos = [])).push({ b, c: fijo(entradaCol), f: fijo(entradaFila) });
}
function usarLCD() { Ard.banderas_.lcdUsado = true; }

function configurarLCD(dir, col, fil, b) {
  Ard.banderas_.lcdConfig = true;
  Ard.banderas_.lcdCols = Number(col);
  Ard.banderas_.lcdFilas = Number(fil);
  usarI2C(b, 'Pantalla LCD', dir);
  G.incluir('LiquidCrystal_I2C', '#include <LiquidCrystal_I2C.h>');
  G.global('lcd', `LiquidCrystal_I2C lcd(${dir}, ${col}, ${fil});`);
  G.setup('lcd', 'lcd.init();\nlcd.backlight();');
}
bloque('lcd_iniciar', COL.lcd, function () {
  this.appendDummyInput().appendField('iniciar pantalla LCD I2C  dirección').appendField(dd([['0x27', '0x27'], ['0x3F', '0x3F']]), 'DIR')
    .appendField('tamaño').appendField(dd([['16x2', '16x2'], ['20x4', '20x4']]), 'T');
  sentencia(this);
  this.setTooltip('Si la pantalla no muestra nada, prueba la otra dirección o gira el potenciómetro azul del módulo I2C.');
}, (b) => {
  if (Ard.banderas_.lcdConfig) { G.aviso('Hay más de un bloque "iniciar pantalla LCD".', b); return ''; }
  const [c, f] = b.getFieldValue('T').split('x');
  configurarLCD(b.getFieldValue('DIR'), c, f, b);
  return '';
});
bloque('lcd_escribir', COL.lcd, function () {
  this.appendValueInput('V').appendField('LCD escribir');
  this.appendValueInput('C').appendField('en columna');
  this.appendValueInput('F').appendField('fila');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Columnas y filas empiezan en 0. En 16x2: columnas 0–15, filas 0–1.');
}, (b) => { usarLCD(); anotarPosLCD(b, 'C', 'F'); return `lcd.setCursor(${G.val(b, 'C')}, ${G.val(b, 'F')});\nlcd.print(${G.val(b, 'V', O.NONE, '""')});\n`; });
bloque('lcd_escribir_aqui', COL.lcd, function () {
  this.appendValueInput('V').appendField('LCD escribir');
  this.appendDummyInput().appendField('donde está el cursor');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Escribe seguido de lo último que escribiste. Sirve para poner un número justo después de un texto.');
}, (b) => { usarLCD(); return `lcd.print(${G.val(b, 'V', O.NONE, '""')});\n`; });
bloque('lcd_cursor_mover', COL.lcd, function () {
  this.appendValueInput('C').appendField('LCD mover cursor a columna');
  this.appendValueInput('F').appendField('fila');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Elige dónde aparece lo próximo que escribas. Columnas y filas empiezan en 0.');
}, (b) => { usarLCD(); anotarPosLCD(b, 'C', 'F'); return `lcd.setCursor(${G.val(b, 'C')}, ${G.val(b, 'F')});\n`; });
bloque('lcd_limpiar', COL.lcd, function () {
  this.appendDummyInput().appendField('LCD borrar todo');
  sentencia(this);
}, () => { usarLCD(); return 'lcd.clear();\n'; });
bloque('lcd_borrar_fila', COL.lcd, function () {
  this.appendValueInput('F').appendField('LCD borrar fila');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Borra solo una fila y deja el cursor al comienzo de ella. Así la pantalla no parpadea.');
}, (b) => { usarLCD(); Ard.banderas_.lcdBorrarFila = true; anotarPosLCD(b, null, 'F'); return `lcdBorrarFila(${G.val(b, 'F')});\n`; });
bloque('lcd_simbolo_crear', COL.lcd, function () {
  this.appendDummyInput().appendField('LCD crear símbolo').appendField(new Blockly.FieldTextInput('corazón'), 'NAME')
    .appendField(new CampoDibujo(DIBUJOS_LCD[0][1]), 'DIBUJO');
  sentencia(this);
  this.setTooltip('Toca el dibujo para pintarlo (5 x 8 puntos). Caben hasta 8 símbolos distintos. Ponlo en "al iniciar", después de iniciar la pantalla.');
}, (b) => {
  usarLCD();
  const nombre = (b.getFieldValue('NAME') || '').trim() || 'simbolo';
  const n = indiceSimbolo(nombre);
  const bits = b.getFieldValue('DIBUJO');
  const creados = Ard.banderas_.lcdCreados || (Ard.banderas_.lcdCreados = new Map());
  if (!creados.has(nombre)) creados.set(nombre, new Map());
  const dibujos = creados.get(nombre);
  if (!dibujos.has(bits)) dibujos.set(bits, 'simbolo_' + nombreC(nombre) + (dibujos.size ? '_' + (dibujos.size + 1) : ''));
  const arreglo = dibujos.get(bits);
  const filas = bits.match(/.{5}/g).map(f => '0b' + f).join(', ');
  G.global('lcdsim_' + arreglo, `byte ${arreglo}[8] = { ${filas} };`);
  return `lcd.createChar(${n}, ${arreglo});  // símbolo "${nombre}"\nlcd.setCursor(0, 0);\n`;
});
bloque('lcd_simbolo_mostrar', COL.lcd, function () {
  this.appendDummyInput().appendField('LCD mostrar símbolo').appendField(new CampoSimbolo('corazón'), 'SIM');
  this.appendValueInput('C').appendField('en columna');
  this.appendValueInput('F').appendField('fila');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('Muestra un símbolo creado con "LCD crear símbolo". Cada símbolo ocupa un solo espacio.');
}, (b) => {
  usarLCD(); anotarPosLCD(b, 'C', 'F');
  const nombre = b.getFieldValue('SIM');
  (Ard.banderas_.lcdMostrados || (Ard.banderas_.lcdMostrados = [])).push({ nombre, b });
  return `lcd.setCursor(${G.val(b, 'C')}, ${G.val(b, 'F')});\nlcd.write(byte(${indiceSimbolo(nombre)}));  // ${nombre}\n`;
});
bloque('lcd_desplazar', COL.lcd, function () {
  this.appendDummyInput().appendField('LCD correr el texto 1 lugar a la').appendField(dd([['izquierda', 'scrollDisplayLeft'], ['derecha', 'scrollDisplayRight']]), 'D');
  sentencia(this);
  this.setTooltip('Ponlo en un bucle con una espera para que el texto se mueva como un aviso luminoso.');
}, (b) => { usarLCD(); return `lcd.${b.getFieldValue('D')}();\n`; });
bloque('lcd_pantalla', COL.lcd, function () {
  this.appendDummyInput().appendField('LCD').appendField(dd([['ocultar', 'noDisplay'], ['mostrar', 'display']]), 'M').appendField('el texto');
  sentencia(this);
  this.setTooltip('Oculta el texto sin borrarlo: al mostrarlo vuelve lo que había. Sirve para hacer parpadear un mensaje.');
}, (b) => { usarLCD(); return `lcd.${b.getFieldValue('M')}();\n`; });
bloque('lcd_cursor', COL.lcd, function () {
  this.appendDummyInput().appendField('LCD cursor').appendField(dd([['oculto', 'OCULTO'], ['raya abajo', 'RAYA'], ['cuadro que parpadea', 'CUADRO']]), 'C');
  sentencia(this);
  this.setTooltip('El cursor marca dónde se escribirá lo próximo.');
}, (b) => {
  usarLCD();
  return { OCULTO: 'lcd.noCursor();\nlcd.noBlink();\n', RAYA: 'lcd.cursor();\nlcd.noBlink();\n', CUADRO: 'lcd.noCursor();\nlcd.blink();\n' }[b.getFieldValue('C')];
});
bloque('lcd_luz', COL.lcd, function () {
  this.appendDummyInput().appendField('LCD luz de fondo').appendField(dd([['encender', 'backlight'], ['apagar', 'noBacklight']]), 'L');
  sentencia(this);
  this.setTooltip('La luz solo se enciende o se apaga. Si no se ven las letras, gira con un destornillador el potenciómetro azul de atrás (contraste).');
}, (b) => { usarLCD(); return `lcd.${b.getFieldValue('L')}();\n`; });

/* ================= Matriz LED 8x8 (MAX7219) con la librería LedControl ================= */
// Los dibujos se guardan "como se ven": 64 caracteres '0'/'1', fila por fila de arriba abajo, cada fila de izquierda a derecha.
// La orientación (giro y espejo) la aplica el programa en la placa: el aprendiz nunca dibuja al revés.
const DIBUJOS_8X8 = [
  ['corazón', '0000000001100110111111111111111101111110001111000001100000000000'],
  ['feliz', '0011110001000010101001011000000110100101100110010100001000111100'],
  ['triste', '0011110001000010101001011000000110011001101001010100001000111100'],
  ['sorpresa', '0011110001000010101001011000000110011001100110010100001000111100'],
  ['robot', '0001100001111110100000011011010110110101100001011000000101111110'],
  ['flecha', '0001100000111100011111101101101100011000000110000001100000011000'],
  ['chulito', '0000000000000001000000111000011011001100011110000011000000000000'],
  ['nota', '0011111100100001001000010010000100100001111001111110011100000000']
];
const OP_MATRIZ = { ancho: 8, alto: 8, T: 5, celda: 22, fondo: '#151515', apagado: '#3b1d1d', encendido: '#ff4136', dibujos: DIBUJOS_8X8 };
/** "0110…" (64) → [ '0b01100110', … ] (8 filas, el bit de la izquierda es x = 0). */
const filasBinarias = (bits) => bits.match(/.{8}/g).map(f => '0b' + f);
/** Declara (una sola vez por dibujo distinto) un arreglo global con las 8 filas y devuelve su nombre. */
function arregloDibujo(bits) {
  const m = Ard.banderas_.dibujos8 || (Ard.banderas_.dibujos8 = new Map());
  if (!m.has(bits)) {
    const n = 'dibujo' + (m.size + 1);
    m.set(bits, n);
    G.global('dib_' + n, `byte ${n}[8] = { ${filasBinarias(bits).join(', ')} };`);
  }
  return m.get(bits);
}

/* Letras de 5 x 7 puntos (propias). Cada letra: 7 filas de arriba abajo, 5 columnas de izquierda a derecha. */
const FUENTE_5X7 = {
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####', '3': '#####|...#.|..#..|...#.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.', '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  'A': '.###.|#...#|#...#|#####|#...#|#...#|#...#', 'B': '####.|#...#|#...#|####.|#...#|#...#|####.',
  'C': '.###.|#...#|#....|#....|#....|#...#|.###.', 'D': '###..|#..#.|#...#|#...#|#...#|#..#.|###..',
  'E': '#####|#....|#....|####.|#....|#....|#####', 'F': '#####|#....|#....|####.|#....|#....|#....',
  'G': '.###.|#...#|#....|#.###|#...#|#...#|.####', 'H': '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  'I': '.###.|..#..|..#..|..#..|..#..|..#..|.###.', 'J': '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  'K': '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', 'L': '#....|#....|#....|#....|#....|#....|#####',
  'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', 'N': '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  'O': '.###.|#...#|#...#|#...#|#...#|#...#|.###.', 'P': '####.|#...#|#...#|####.|#....|#....|#....',
  'Q': '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', 'R': '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  'S': '.####|#....|#....|.###.|....#|....#|####.', 'T': '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  'U': '#...#|#...#|#...#|#...#|#...#|#...#|.###.', 'V': '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  'W': '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', 'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', 'Z': '#####|....#|...#.|..#..|.#...|#....|#####',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '.': '.....|.....|.....|.....|.....|.##..|.##..', ',': '.....|.....|.....|.....|.##..|..#..|.#...',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....', '-': '.....|.....|.....|#####|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....', '=': '.....|.....|#####|.....|#####|.....|.....',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.', '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.', ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '*': '.....|..#..|#.#.#|.###.|#.#.#|..#..|.....', '/': '.....|....#|...#.|..#..|.#...|#....|.....',
  '%': '##...|##..#|...#.|..#..|.#...|#..##|...##'
};
/** Tabla de C++ de la fuente: una columna por byte, el bit 0 es la fila de arriba. */
function tablaFuente() {
  const letras = Object.keys(FUENTE_5X7).join('');
  const filas = Object.entries(FUENTE_5X7).map(([ch, dib]) => {
    const r = dib.split('|');
    const cols = [0, 1, 2, 3, 4].map(c => r.reduce((byte, fila, y) => byte | ((fila[c] === '#' ? 1 : 0) << y), 0));
    return `  { ${cols.map(v => '0x' + v.toString(16).toUpperCase().padStart(2, '0')).join(', ')} }`;
  });
  return '// Letras de 5 x 7 puntos para la matriz LED: una columna por byte (el bit 0 es la fila de arriba)\n' +
    `const char matrizLetras[] PROGMEM = ${cadenaC(letras)};\nconst byte matrizFuente[][5] PROGMEM = {\n` +
    filas.map((f, i) => `${f}${i < filas.length - 1 ? ',' : ' '}  // ${cadenaC(letras[i])}`).join('\n') + '\n};';
}
/** Texto fijo → solo lo que la fuente sabe dibujar (sin tildes, en mayúsculas). */
function textoParaMatriz(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^ 0-9A-Z!?.,:\-+=<>()*\/%]/g, ' ');
}

const GIROS_MATRIZ = [['normal', '0'], ['girada 90°', '1'], ['al revés', '2'], ['girada 270°', '3']];
const VEL_TEXTO = [['normal', '80'], ['lenta', '130'], ['rápida', '45']];
function configurarMatriz(din, clk, cs, giro, espejo, brillo, b) {
  Ard.banderas_.matrizConfig = true;
  G.incluir('LedControl', '#include <LedControl.h>');
  G.global('matrizLed', `LedControl matrizLed(${din}, ${clk}, ${cs}, 1);  // DIN, CLK, CS, 1 matriz\n` +
    `const byte matrizGiro = ${giro};  // 0 normal, 1 girada 90°, 2 al revés, 3 girada 270°\n` +
    `const bool matrizEspejo = ${espejo ? 'true' : 'false'};  // true si los dibujos salen al revés de izquierda a derecha`);
  G.setup('matrizLed', `matrizLed.shutdown(0, false);  // la matriz arranca apagada: hay que despertarla\nmatrizLed.setIntensity(0, ${brillo});\nmatrizLed.clearDisplay(0);`);
  [[din, 'DIN'], [clk, 'CLK'], [cs, 'CS']].forEach(([p, n]) => G.pin(p, `Matriz LED (${n})`, b));
  G.ayuda('matrizUbicar', 'void matrizUbicar(byte x, byte y, byte &fila, byte &col) {\n' +
    '  // (x, y) como se ve: x de izquierda a derecha, y de arriba abajo → fila y columna del módulo\n' +
    '  if (matrizEspejo) x = 7 - x;\n' +
    '  if (matrizGiro == 1) { fila = x; col = 7 - y; }\n' +
    '  else if (matrizGiro == 2) { fila = 7 - y; col = 7 - x; }\n' +
    '  else if (matrizGiro == 3) { fila = 7 - x; col = y; }\n' +
    '  else { fila = y; col = x; }\n}');
}
function matrizUsada() { Ard.banderas_.matrizUsada = true; }
function ayudaMatrizDibujo() {
  G.ayuda('matrizDibujo', 'void matrizDibujo(const byte filas[8]) {\n  byte salida[8] = { 0 };\n' +
    '  for (byte y = 0; y < 8; y++)\n    for (byte x = 0; x < 8; x++)\n' +
    '      if (bitRead(filas[y], 7 - x)) { byte f, c; matrizUbicar(x, y, f, c); bitSet(salida[f], 7 - c); }\n' +
    '  for (byte f = 0; f < 8; f++) matrizLed.setRow(0, f, salida[f]);\n}');
}
bloque('matriz_iniciar', COL.matriz, function () {
  this.appendDummyInput().appendField('iniciar matriz LED  DIN').appendField(new CampoPin('digital', '12'), 'DIN')
    .appendField('CLK').appendField(new CampoPin('digital', '11'), 'CLK').appendField('CS').appendField(new CampoPin('digital', '10'), 'CS');
  this.appendDummyInput().appendField('orientación').appendField(dd(GIROS_MATRIZ), 'GIRO')
    .appendField('espejo').appendField(new Blockly.FieldCheckbox('FALSE'), 'ESPEJO')
    .appendField('brillo').appendField(new Blockly.FieldNumber(4, 0, 15, 1), 'BRILLO');
  sentencia(this);
  this.setTooltip('Dibuja siempre como quieres que se vea. Si en la matriz sale girado o al revés, cambia la orientación; si sale volteado de izquierda a derecha, marca "espejo". Brillo de 0 a 15 (alto gasta mucha batería).');
}, (b) => {
  if (Ard.banderas_.matrizConfig) { G.aviso('Hay más de un bloque "iniciar matriz LED".', b); return ''; }
  configurarMatriz(b.getFieldValue('DIN'), b.getFieldValue('CLK'), b.getFieldValue('CS'), b.getFieldValue('GIRO'),
    b.getFieldValue('ESPEJO') === 'TRUE', b.getFieldValue('BRILLO'), b);
  return '';
});
bloque('matriz_dibujo', COL.matriz, function () {
  this.appendDummyInput().appendField('matriz LED mostrar').appendField(new CampoDibujo(DIBUJOS_8X8[1][1], OP_MATRIZ), 'DIBUJO');
  sentencia(this);
  this.setTooltip('Toca el dibujo para pintarlo (8 x 8 puntos). Dibuja como quieres que se vea.');
}, (b) => { matrizUsada(); ayudaMatrizDibujo(); return `matrizDibujo(${arregloDibujo(b.getFieldValue('DIBUJO'))});\n`; });
bloque('matriz_borrar', COL.matriz, function () {
  this.appendDummyInput().appendField('matriz LED borrar');
  sentencia(this);
}, () => { matrizUsada(); return 'matrizLed.clearDisplay(0);\n'; });
bloque('matriz_punto', COL.matriz, function () {
  this.appendDummyInput().appendField('matriz LED').appendField(dd([['encender', 'true'], ['apagar', 'false']]), 'E').appendField('punto');
  this.appendValueInput('X').appendField('x');
  this.appendValueInput('Y').appendField('y');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('x de 0 a 7 (de izquierda a derecha) y y de 0 a 7 (de arriba abajo), como se ve en la matriz.');
}, (b) => {
  matrizUsada();
  G.ayuda('matrizPunto', 'void matrizPunto(byte x, byte y, bool encendido) {\n  byte fila, col;\n  matrizUbicar(x, y, fila, col);\n  matrizLed.setLed(0, fila, col, encendido);\n}');
  return `matrizPunto(${G.val(b, 'X')}, ${G.val(b, 'Y')}, ${b.getFieldValue('E')});\n`;
});
bloque('matriz_brillo', COL.matriz, function () {
  this.appendValueInput('V').appendField('matriz LED brillo (0–15)');
  sentencia(this);
}, (b) => { matrizUsada(); return `matrizLed.setIntensity(0, constrain(${G.val(b, 'V')}, 0, 15));\n`; });
bloque('matriz_texto', COL.matriz, function () {
  this.appendValueInput('V').appendField('matriz LED mostrar texto');
  this.appendDummyInput().appendField('velocidad').appendField(dd(VEL_TEXTO), 'VEL');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('El texto pasa de derecha a izquierda. Sirve para números y palabras (sin tildes ni ñ). Mientras pasa, la placa no hace nada más.');
}, (b) => {
  matrizUsada();
  G.global('matrizFuente', tablaFuente());
  G.ayuda('matrizColumnaLetra', 'byte matrizColumnaLetra(char letra, byte columna) {\n' +
    '  // columna 0 a 4 de una letra; la 5 es el espacio entre letras\n' +
    '  if (letra == 0 || columna > 4) return 0;\n' +
    '  const char *p = strchr_P(matrizLetras, toupper(letra));\n' +
    '  if (p == NULL) return 0;  // letra que no está en la fuente: espacio\n' +
    '  return pgm_read_byte(&matrizFuente[p - matrizLetras][columna]);\n}');
  G.ayuda('matrizTexto', 'void matrizTexto(String texto, int pausa) {\n' +
    '  int columnas = texto.length() * 6;  // 5 columnas por letra + 1 de espacio\n' +
    '  for (int desde = -8; desde <= columnas; desde++) {\n    byte salida[8] = { 0 };\n' +
    '    for (byte x = 0; x < 8; x++) {\n      int i = desde + x;\n      if (i < 0 || i >= columnas) continue;\n' +
    '      byte columna = matrizColumnaLetra(texto[i / 6], i % 6);\n' +
    '      for (byte y = 0; y < 7; y++)\n        if (bitRead(columna, y)) { byte f, c; matrizUbicar(x, y, f, c); bitSet(salida[f], 7 - c); }\n    }\n' +
    '    for (byte f = 0; f < 8; f++) matrizLed.setRow(0, f, salida[f]);\n    delay(pausa);\n  }\n}');
  const t = b.getInputTargetBlock('V');
  let v;
  if (t && t.type === 'text') {
    const limpio = textoParaMatriz(t.getFieldValue('TEXT'));
    if (limpio !== String(t.getFieldValue('TEXT')).toUpperCase()) G.aviso('La matriz no tiene tildes, ñ ni algunos símbolos: se cambiaron por letras simples o espacios.', b, 'info');
    v = cadenaC(limpio);
  } else v = `String(${G.val(b, 'V', O.NONE, '""')})`;
  return `matrizTexto(${v}, ${b.getFieldValue('VEL')});\n`;
});
/* Animación: el bloque se amolda a N cuadros (como la calibración del PCA9685) */
Blockly.Blocks.matriz_animacion = {
  init() {
    this.setColour(COL.matriz);
    const self = this;
    this.appendDummyInput('CAB').appendField('matriz LED animación de')
      .appendField(new Blockly.FieldDropdown([2, 3, 4, 5, 6, 7, 8].map(n => [String(n), String(n)]), function (v) { self.actualizarCuadros_(parseInt(v, 10)); return v; }), 'N')
      .appendField('cuadros, cada uno').appendField(new Blockly.FieldNumber(200, 20, 5000, 1), 'MS').appendField('ms');
    this.getField('N').setValue('2');
    this.actualizarCuadros_(2);
    this.setPreviousStatement(true); this.setNextStatement(true);
    this.setTooltip('Muestra los cuadros uno tras otro, una vez. Ponla en "repetir por siempre" para que no pare. Es una matriz: un dibujo de 8 filas por cada cuadro.');
  },
  actualizarCuadros_(n) {
    const porDefecto = [DIBUJOS_8X8[0][1], '0000000000000000001001000111111001111110001111000001100000000000'];
    for (let i = 0; i < 8; i++) {
      const existe = this.getInput('C' + i);
      if (i < n && !existe) {
        this.appendDummyInput('C' + i).appendField(`cuadro ${i + 1}`)
          .appendField(new CampoDibujo(porDefecto[i] || DIBUJOS_8X8[(i + 1) % DIBUJOS_8X8.length][1], OP_MATRIZ), 'F' + i);
      } else if (i >= n && existe) {
        this.removeInput('C' + i);
      }
    }
  }
};
Ard.forBlock.matriz_animacion = (b) => {
  matrizUsada(); ayudaMatrizDibujo();
  G.ayuda('matrizAnimacion', 'void matrizAnimacion(const byte cuadros[][8], byte cantidad, int pausa) {\n' +
    '  for (byte i = 0; i < cantidad; i++) {\n    matrizDibujo(cuadros[i]);\n    delay(pausa);\n  }\n}');
  const n = parseInt(b.getFieldValue('N'), 10);
  const cuadros = [];
  for (let i = 0; i < n; i++) cuadros.push(b.getFieldValue('F' + i));
  const m = Ard.banderas_.animaciones || (Ard.banderas_.animaciones = new Map());
  const clave = cuadros.join('|');
  if (!m.has(clave)) {
    const nombre = 'animacion' + (m.size + 1);
    m.set(clave, nombre);
    G.global('anim_' + nombre, `byte ${nombre}[${n}][8] = {  // una fila de la matriz por cuadro\n` +
      cuadros.map((c, i) => `  { ${filasBinarias(c).join(', ')} }${i < n - 1 ? ',' : ' '}  // cuadro ${i + 1}`).join('\n') + '\n};');
  }
  return `matrizAnimacion(${m.get(clave)}, ${n}, ${b.getFieldValue('MS')});\n`;
};

/* ================= Otto humanoide (OttoDIYLib + servos de brazos) ================= */
function configurarOtto(p, b) {
  Ard.banderas_.ottoConfig = true;
  G.incluir('Otto', '#include <Otto.h>');
  G.global('otto', 'Otto Otto;  // piernas y pies con OttoDIYLib');
  G.setup('otto', `Otto.init(${p[0]}, ${p[1]}, ${p[2]}, ${p[3]}, true, ${p[4]});\nOtto.home();`);
  ['Otto pierna izquierda', 'Otto pierna derecha', 'Otto pie izquierdo', 'Otto pie derecho', 'Otto zumbador'].forEach((u, i) => G.pin(p[i], u, b));
}
// Memoria del robot (EEPROM): OttoDIYLib guarda piernas y pies en 0–3; los brazos van en 4 y 5, y 6 marca que están guardados
const EE_BRAZO_IZQ = 4, EE_BRAZO_DER = 5, EE_MARCA_BRAZOS = 6, MARCA_BRAZOS = '0x5A';
function configurarBrazos(izq, der, b) {
  Ard.banderas_.brazosConfig = true;
  G.incluir('Servo', '#include <Servo.h>');
  G.incluir('EEPROM', '#include <EEPROM.h>');
  G.global('ottoBrazos', 'Servo ottoBrazoIzq;\nServo ottoBrazoDer;\nint ottoTrimBrazos[2] = { 0, 0 };  // calibración de los brazos en grados: { izquierdo, derecho }');
  G.setup('ottoBrazos', `ottoBrazoIzq.attach(${izq});\nottoBrazoDer.attach(${der});\n` +
    `if (EEPROM.read(${EE_MARCA_BRAZOS}) == ${MARCA_BRAZOS}) {  // el robot tiene guardada la calibración de los brazos\n` +
    `  ottoTrimBrazos[0] = (int8_t) EEPROM.read(${EE_BRAZO_IZQ});\n  ottoTrimBrazos[1] = (int8_t) EEPROM.read(${EE_BRAZO_DER});\n}\nottoBrazos(90, 90);`);
  G.ayuda('ottoBrazo', 'void ottoBrazo(bool izquierdo, int grados) {\n' +
    '  if (izquierdo) ottoBrazoIzq.write(constrain(grados + ottoTrimBrazos[0], 0, 180));\n' +
    '  else ottoBrazoDer.write(constrain(grados + ottoTrimBrazos[1], 0, 180));\n}');
  G.ayuda('ottoBrazos', 'void ottoBrazos(int izq, int der) {\n  ottoBrazo(true, izq);\n  ottoBrazo(false, der);\n}');
  G.pin(izq, 'Otto brazo izquierdo', b); G.pin(der, 'Otto brazo derecho', b);
}

/* ---- Calibración de Otto: ajuste en grados de cada servo (fijo: piernas, pies y, si hay, brazos) ---- */
const AJUSTE = () => new Blockly.FieldNumber(0, -40, 40, 1);
Blockly.Blocks.otto_calibracion = {
  init() {
    this.setColour(COL.otto);
    const self = this;
    this.appendDummyInput().appendField('calibración de Otto (ajuste en grados)');
    this.appendDummyInput('PIERNAS').appendField('piernas    izquierda').appendField(AJUSTE(), 'YL').appendField('derecha').appendField(AJUSTE(), 'YR');
    this.appendDummyInput('PIES').appendField('pies          izquierdo').appendField(AJUSTE(), 'RL').appendField('derecho').appendField(AJUSTE(), 'RR');
    this.appendDummyInput('CON').appendField(new Blockly.FieldCheckbox('TRUE', function (v) { self.mostrarBrazos_(v === 'TRUE' || v === true); return v; }), 'BRAZOS')
      .appendField('con brazos (humanoide)');
    this.appendDummyInput('FILA_BRAZOS').appendField('brazos     izquierdo').appendField(AJUSTE(), 'BI').appendField('derecho').appendField(AJUSTE(), 'BD');
    this.appendDummyInput().appendField(new Blockly.FieldCheckbox('TRUE'), 'GUARDAR').appendField('guardar en la memoria del robot');
    this.setTooltip('Si Otto no queda derecho en reposo, ajusta cada servo unos grados (+ o −) hasta que las piernas queden rectas, los pies planos y los brazos al frente. ' +
      'Con "guardar", la placa recuerda la calibración y cualquier otro programa la usa sola. Súbelo con este bloque una vez por robot.');
  },
  mostrarBrazos_(v) {
    const i = this.getInput('FILA_BRAZOS');
    if (i) i.setVisible(v);
    if (this.rendered) this.render();
  }
};
Ard.forBlock.otto_calibracion = () => '';
/** Lo lee generarPrograma antes de generar. La calibración sola ya alcanza para un programa (el de calibrar). */
function leerCalibracionOtto(ws) {
  const bs = ws.getBlocksByType('otto_calibracion', true).filter(b => b.isEnabled());
  if (!bs.length) return null;
  if (bs.length > 1) G.aviso('Hay más de un bloque de calibración de Otto; se usa el primero.', bs[1]);
  const b = bs[0], n = (k) => Number(b.getFieldValue(k)) || 0;
  const c = { bloque: b, YL: n('YL'), YR: n('YR'), RL: n('RL'), RR: n('RR'), BI: n('BI'), BD: n('BD'),
    brazos: b.getFieldValue('BRAZOS') === 'TRUE', guardar: b.getFieldValue('GUARDAR') === 'TRUE' };
  Ard.banderas_.ottoUsado = true;
  if (c.brazos) Ard.banderas_.brazosUsado = true;
  return c;
}
/** Escribe la calibración en setup(), después de iniciar Otto y los brazos. */
function definirCalibracionOtto() {
  const c = Ard.calOtto_, f = Ard.banderas_;
  let s = `// Calibración de Otto (grados): pierna izq., pierna der., pie izq., pie der.\nOtto.setTrims(${c.YL}, ${c.YR}, ${c.RL}, ${c.RR});\n`;
  if (c.guardar) s += 'Otto.saveTrimsOnEEPROM();  // queda guardada en el robot: los otros programas la cargan solos\n';
  s += 'Otto.home();';
  if (c.brazos && f.brazosConfig) {
    s += `\nottoTrimBrazos[0] = ${c.BI};  // brazo izquierdo\nottoTrimBrazos[1] = ${c.BD};  // brazo derecho\n`;
    if (c.guardar) s += `EEPROM.update(${EE_BRAZO_IZQ}, (byte) ottoTrimBrazos[0]);\nEEPROM.update(${EE_BRAZO_DER}, (byte) ottoTrimBrazos[1]);\n` +
      `EEPROM.update(${EE_MARCA_BRAZOS}, ${MARCA_BRAZOS});  // marca: los brazos quedaron calibrados\n`;
    s += 'ottoBrazos(90, 90);';
  }
  Ard.setup_.set('ottoCalibracion', s);
}
const VEL_OTTO = [['normal', '1000'], ['lenta', '2000'], ['rápida', '700']];
function ottoUsado() { Ard.banderas_.ottoUsado = true; }
bloque('otto_iniciar', COL.otto, function () {
  this.appendDummyInput().appendField('iniciar Otto');
  this.appendDummyInput().appendField('pierna izq.').appendField(new CampoPin('digital', '2'), 'YL')
    .appendField('pierna der.').appendField(new CampoPin('digital', '3'), 'YR');
  this.appendDummyInput().appendField('pie izq.').appendField(new CampoPin('digital', '4'), 'RL')
    .appendField('pie der.').appendField(new CampoPin('digital', '5'), 'RR')
    .appendField('zumbador').appendField(new CampoPin('digital', '13'), 'BUZ');
  sentencia(this);
  this.setTooltip('Usa OttoDIYLib. Carga sola la calibración guardada en el robot (bloque "calibración de Otto").');
}, (b) => {
  if (Ard.banderas_.ottoConfig) { G.aviso('Hay más de un bloque "iniciar Otto".', b); return ''; }
  configurarOtto(['YL', 'YR', 'RL', 'RR', 'BUZ'].map(f => b.getFieldValue(f)), b); return '';
});
bloque('otto_brazos_iniciar', COL.otto, function () {
  this.appendDummyInput().appendField('iniciar brazos de Otto humanoide  izq.').appendField(new CampoPin('digital', '6'), 'IZQ')
    .appendField('der.').appendField(new CampoPin('digital', '7'), 'DER');
  sentencia(this);
  this.setTooltip('Los brazos son dos servos extra. Revisa que los pines coincidan con tu robot.');
}, (b) => {
  if (Ard.banderas_.brazosConfig) { G.aviso('Hay más de un bloque "iniciar brazos".', b); return ''; }
  configurarBrazos(b.getFieldValue('IZQ'), b.getFieldValue('DER'), b); return '';
});
bloque('otto_caminar', COL.otto, function () {
  this.appendValueInput('N').appendField('Otto caminar');
  this.appendDummyInput().appendField('pasos hacia').appendField(dd([['adelante', 'FORWARD'], ['atrás', 'BACKWARD']]), 'DIR')
    .appendField('velocidad').appendField(dd(VEL_OTTO), 'T');
  this.setInputsInline(true); sentencia(this);
}, (b) => { ottoUsado(); const d = b.getFieldValue('DIR') === 'FORWARD' ? 'FORWARD' : '-1'; return `Otto.walk(${G.val(b, 'N', O.NONE, '2')}, ${b.getFieldValue('T')}, ${d});${d === '-1' ? '  // -1 = hacia atrás' : ''}\n`; });
bloque('otto_girar', COL.otto, function () {
  this.appendValueInput('N').appendField('Otto girar');
  this.appendDummyInput().appendField('pasos a la').appendField(dd([['izquierda', 'LEFT'], ['derecha', 'RIGHT']]), 'DIR')
    .appendField('velocidad').appendField(dd(VEL_OTTO), 'T');
  this.setInputsInline(true); sentencia(this);
}, (b) => { ottoUsado(); return `Otto.turn(${G.val(b, 'N', O.NONE, '2')}, ${b.getFieldValue('T') === '1000' ? '2000' : b.getFieldValue('T') === '2000' ? '3000' : '1000'}, ${b.getFieldValue('DIR')});\n`; });
bloque('otto_pierna', COL.otto, function () {
  this.appendDummyInput().appendField('Otto').appendField(dd([['inclinarse', 'bend'], ['sacudir la pierna', 'shakeLeg']]), 'MOV')
    .appendField('hacia la').appendField(dd([['izquierda', 'LEFT'], ['derecha', 'RIGHT']]), 'DIR');
  sentencia(this);
}, (b) => { ottoUsado(); const m = b.getFieldValue('MOV'); return `Otto.${m}(1, ${m === 'bend' ? 1400 : 2000}, ${b.getFieldValue('DIR')});\n`; });
bloque('otto_baile', COL.otto, function () {
  this.appendValueInput('N').appendField('Otto bailar').appendField(dd([
    ['moonwalker ←', 'moonwalker|LEFT'], ['moonwalker →', 'moonwalker|RIGHT'], ['crusaito', 'crusaito|FORWARD'], ['aleteo', 'flapping|FORWARD'],
    ['balanceo', 'swing|'], ['balanceo en puntillas', 'tiptoeSwing|'], ['temblor', 'jitter|'], ['arriba y abajo', 'updown|'], ['giro ascendente', 'ascendingTurn|']
  ]), 'MOV');
  this.appendDummyInput().appendField('veces  tamaño').appendField(dd([['mediano', 'MEDIUM'], ['pequeño', 'SMALL'], ['grande', 'BIG']]), 'H')
    .appendField('velocidad').appendField(dd(VEL_OTTO), 'T');
  this.setInputsInline(true); sentencia(this);
}, (b) => {
  ottoUsado();
  const [m, dir] = b.getFieldValue('MOV').split('|');
  return `Otto.${m}(${G.val(b, 'N', O.NONE, '2')}, ${b.getFieldValue('T')}, ${b.getFieldValue('H')}${dir ? ', ' + dir : ''});\n`;
});
bloque('otto_saltar', COL.otto, function () {
  this.appendDummyInput().appendField('Otto saltar');
  sentencia(this);
}, () => { ottoUsado(); return 'Otto.jump(1, 2000);\n'; });
bloque('otto_reposo', COL.otto, function () {
  this.appendDummyInput().appendField('Otto posición de reposo');
  sentencia(this);
}, () => { ottoUsado(); return 'Otto.home();\n'; });
bloque('otto_sonido', COL.otto, function () {
  this.appendDummyInput().appendField('Otto sonido').appendField(dd([
    ['conexión', 'S_connection'], ['desconexión', 'S_disconnection'], ['botón', 'S_buttonPushed'], ['modo 1', 'S_mode1'], ['modo 2', 'S_mode2'],
    ['modo 3', 'S_mode3'], ['sorpresa', 'S_surprise'], ['oh-ooh', 'S_OhOoh'], ['oh-ooh 2', 'S_OhOoh2'], ['tierno', 'S_cuddly'],
    ['dormido', 'S_sleeping'], ['feliz', 'S_happy'], ['muy feliz', 'S_superHappy'], ['feliz corto', 'S_happy_short'], ['triste', 'S_sad'],
    ['confundido', 'S_confused'], ['pedorreta 1', 'S_fart1'], ['pedorreta 2', 'S_fart2'], ['pedorreta 3', 'S_fart3']
  ]), 'S');
  sentencia(this);
}, (b) => { ottoUsado(); return `Otto.sing(${b.getFieldValue('S')});\n`; });
bloque('otto_gesto', COL.otto, function () {
  this.appendDummyInput().appendField('Otto gesto').appendField(dd([
    ['feliz', 'OttoHappy'], ['súper feliz', 'OttoSuperHappy'], ['triste', 'OttoSad'], ['dormido', 'OttoSleeping'], ['pedorreta', 'OttoFart'],
    ['confundido', 'OttoConfused'], ['enamorado', 'OttoLove'], ['enojado', 'OttoAngry'], ['inquieto', 'OttoFretful'], ['magia', 'OttoMagic'],
    ['ola', 'OttoWave'], ['victoria', 'OttoVictory'], ['fallo', 'OttoFail']
  ]), 'G');
  sentencia(this);
  this.setTooltip('Movimiento y sonido combinados. Algunos gestos usan la matriz de LED si tu Otto la tiene.');
}, (b) => { ottoUsado(); return `Otto.playGesture(${b.getFieldValue('G')});\n`; });
bloque('otto_tono', COL.otto, function () {
  this.appendValueInput('F').appendField('Otto tono');
  this.appendValueInput('D').appendField('Hz durante (ms)');
  this.setInputsInline(true); sentencia(this);
}, (b) => { ottoUsado(); return `Otto._tone(${G.val(b, 'F', O.NONE, '440')}, ${G.val(b, 'D', O.NONE, '200')}, 1);\n`; });
bloque('otto_brazos', COL.otto, function () {
  this.appendDummyInput().appendField('brazos de Otto').appendField(dd([
    ['arriba', 'ARRIBA'], ['abajo', 'ABAJO'], ['al frente (reposo)', 'FRENTE'], ['saludar con el izquierdo', 'SAL_IZQ'], ['saludar con el derecho', 'SAL_DER'], ['aletear los dos', 'ALETEAR']
  ]), 'A');
  sentencia(this);
}, (b) => {
  Ard.banderas_.brazosUsado = true;
  const a = b.getFieldValue('A');
  if (a === 'ARRIBA') return 'ottoBrazos(160, 20);\ndelay(300);\n';
  if (a === 'ABAJO') return 'ottoBrazos(20, 160);\ndelay(300);\n';
  if (a === 'FRENTE') return 'ottoBrazos(90, 90);\ndelay(300);\n';
  if (a === 'ALETEAR') {
    G.ayuda('ottoAletear', 'void ottoAletear() {\n  for (int i = 0; i < 3; i++) {\n    ottoBrazos(150, 30);\n    delay(250);\n    ottoBrazos(110, 70);\n    delay(250);\n  }\n  ottoBrazos(90, 90);\n}');
    return 'ottoAletear();\n';
  }
  G.ayuda('ottoSaludar', 'void ottoSaludar(bool izquierdo) {\n  int arriba = izquierdo ? 160 : 20;\n  int medio = izquierdo ? 120 : 60;\n  for (int i = 0; i < 3; i++) {\n    ottoBrazo(izquierdo, arriba);\n    delay(250);\n    ottoBrazo(izquierdo, medio);\n    delay(250);\n  }\n  ottoBrazo(izquierdo, 90);\n}');
  return `ottoSaludar(${a === 'SAL_IZQ' ? 'true' : 'false'});\n`;
});

/* ---- Boca de Otto: matriz LED 8x8 (MAX7219) con las funciones de OttoDIYLib ---- */
// OttoDIYLib solo gira las bocas predefinidas y el texto (initMATRIX(..., orientación)); Otto.setLed() escribe sin girar.
// ottoBocaPunto() aplica a los dibujos propios EXACTAMENTE el mismo giro que la librería aplica a sus bocas
// (verificado con las 31 bocas en las 4 orientaciones), así se dibuja siempre como se ve en el robot.
const ORIENT_BOCA = [['arriba (1)', '1'], ['abajo (2)', '2'], ['izquierda (3)', '3'], ['derecha (4)', '4']];
const BOCAS_OTTO = [
  ['sonrisa', 'smile'], ['feliz (abierta)', 'happyOpen'], ['feliz (cerrada)', 'happyClosed'], ['corazón', 'heart'],
  ['triste', 'sad'], ['triste (abierta)', 'sadOpen'], ['triste (cerrada)', 'sadClosed'], ['enojado', 'angry'],
  ['sorprendido', 'smallSurprise'], ['muy sorprendido', 'bigSurprise'], ['confundido', 'confused'], ['serio (línea)', 'lineMouth'],
  ['lengua afuera', 'tongueOut'], ['vampiro 1', 'vamp1'], ['vampiro 2', 'vamp2'], ['bien (✓)', 'okMouth'], ['equis (X)', 'xMouth'],
  ['pregunta (?)', 'interrogation'], ['rayo', 'thunder'], ['diagonal', 'diagonal'], ['culito', 'culito'],
  ['número 0', 'zero'], ['número 1', 'one'], ['número 2', 'two'], ['número 3', 'three'], ['número 4', 'four'],
  ['número 5', 'five'], ['número 6', 'six'], ['número 7', 'seven'], ['número 8', 'eight'], ['número 9', 'nine']
];
const VEL_BOCA = [['normal', '100'], ['lenta', '150'], ['rápida', '50']];
function configurarBoca(din, cs, clk, giro, brillo, b) {
  Ard.banderas_.bocaConfig = true;
  G.global('ottoBocaGiro', `const byte ottoBocaGiro = ${giro};  // orientación de la boca: 1 arriba, 2 abajo, 3 izquierda, 4 derecha`);
  G.setup('ottoBoca', `Otto.initMATRIX(${din}, ${cs}, ${clk}, ottoBocaGiro);  // DIN, CS, CLK, orientación\nOtto.matrixIntensity(${brillo});  // la librería arranca al máximo (15)`);
  [[din, 'DIN'], [cs, 'CS'], [clk, 'CLK']].forEach(([p, n]) => G.pin(p, `Boca de Otto (${n})`, b));
}
function bocaUsada() { ottoUsado(); Ard.banderas_.bocaUsada = true; }
function ayudaBocaPunto() {
  G.ayuda('ottoBocaPunto', 'void ottoBocaPunto(byte x, byte y, bool encendido) {\n' +
    '  // (x, y) como se ve en el robot: x de izquierda a derecha, y de arriba abajo.\n' +
    '  // Gira igual que las bocas de la librería (Otto.setLed no gira por sí solo).\n' +
    '  if (ottoBocaGiro == 2) Otto.setLed(7 - x, 7 - y, encendido);\n' +
    '  else if (ottoBocaGiro == 3) Otto.setLed(7 - y, x, encendido);\n' +
    '  else if (ottoBocaGiro == 4) Otto.setLed(y, 7 - x, encendido);\n' +
    '  else Otto.setLed(x, y, encendido);\n}');
}
bloque('otto_boca_iniciar', COL.otto, function () {
  this.appendDummyInput().appendField('iniciar boca de Otto (matriz LED)  DIN').appendField(new CampoPin('digital', 'A3'), 'DIN')
    .appendField('CS').appendField(new CampoPin('digital', 'A2'), 'CS').appendField('CLK').appendField(new CampoPin('digital', 'A1'), 'CLK');
  this.appendDummyInput().appendField('orientación').appendField(dd(ORIENT_BOCA), 'GIRO')
    .appendField('brillo').appendField(new Blockly.FieldNumber(4, 0, 15, 1), 'BRILLO');
  sentencia(this);
  this.setTooltip('Pines de los ejemplos de Otto: DIN A3, CS A2, CLK A1. Orientación como en Otto (arriba 1, abajo 2, izquierda 3, derecha 4): ' +
    'elige la que hace ver bien la sonrisa; tus dibujos y el texto girarán igual. Brillo de 0 a 15.');
}, (b) => {
  if (Ard.banderas_.bocaConfig) { G.aviso('Hay más de un bloque "iniciar boca de Otto".', b); return ''; }
  bocaUsada();
  configurarBoca(b.getFieldValue('DIN'), b.getFieldValue('CS'), b.getFieldValue('CLK'), b.getFieldValue('GIRO'), b.getFieldValue('BRILLO'), b);
  return '';
});
bloque('otto_boca', COL.otto, function () {
  this.appendDummyInput().appendField('Otto boca').appendField(dd(BOCAS_OTTO), 'BOCA');
  sentencia(this);
  this.setTooltip('Una de las bocas que trae Otto.');
}, (b) => { bocaUsada(); return `Otto.putMouth(${b.getFieldValue('BOCA')});\n`; });
bloque('otto_boca_dibujo', COL.otto, function () {
  this.appendDummyInput().appendField('Otto boca dibujar').appendField(new CampoDibujo(DIBUJOS_8X8[1][1], OP_MATRIZ), 'DIBUJO');
  sentencia(this);
  this.setTooltip('Dibuja como quieres que se vea en el robot. El programa lo gira según la orientación de "iniciar boca".');
}, (b) => {
  bocaUsada(); ayudaBocaPunto();
  G.ayuda('ottoBocaDibujo', 'void ottoBocaDibujo(const byte filas[8]) {\n  Otto.clearMouth();\n' +
    '  for (byte y = 0; y < 8; y++)\n    for (byte x = 0; x < 8; x++)\n      if (bitRead(filas[y], 7 - x)) ottoBocaPunto(x, y, true);\n}');
  return `ottoBocaDibujo(${arregloDibujo(b.getFieldValue('DIBUJO'))});\n`;
});
bloque('otto_boca_borrar', COL.otto, function () {
  this.appendDummyInput().appendField('Otto boca borrar');
  sentencia(this);
}, () => { bocaUsada(); return 'Otto.clearMouth();\n'; });
bloque('otto_boca_punto', COL.otto, function () {
  this.appendDummyInput().appendField('Otto boca').appendField(dd([['encender', 'true'], ['apagar', 'false']]), 'E').appendField('punto');
  this.appendValueInput('X').appendField('x');
  this.appendValueInput('Y').appendField('y');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('x de 0 a 7 (de izquierda a derecha) y y de 0 a 7 (de arriba abajo), como se ve en el robot.');
}, (b) => { bocaUsada(); ayudaBocaPunto(); return `ottoBocaPunto(${G.val(b, 'X')}, ${G.val(b, 'Y')}, ${b.getFieldValue('E')});\n`; });
bloque('otto_boca_texto', COL.otto, function () {
  this.appendValueInput('V').appendField('Otto boca mostrar texto');
  this.appendDummyInput().appendField('velocidad').appendField(dd(VEL_BOCA), 'VEL');
  this.setInputsInline(true); sentencia(this);
  this.setTooltip('La boca de Otto muestra hasta 9 caracteres: números, letras sin tilde y espacio.');
}, (b) => {
  bocaUsada();
  G.ayuda('ottoBocaTexto', 'void ottoBocaTexto(String texto, byte velocidad) {\n  if (texto.length() == 0) return;\n' +
    '  texto.toUpperCase();  // la boca solo tiene mayúsculas y números\n  Otto.writeText(texto.c_str(), velocidad);\n}');
  const t = b.getInputTargetBlock('V');
  let v;
  if (t && t.type === 'text') {
    const original = String(t.getFieldValue('TEXT'));
    let limpio = original.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^0-9A-Z :;<=>?@]/g, ' ');
    if (limpio !== original.toUpperCase()) G.aviso('La boca de Otto no tiene tildes, ñ ni algunos símbolos: se cambiaron.', b, 'info');
    if (limpio.length > 9) { G.aviso(`La boca de Otto muestra máximo 9 caracteres: se mostrará "${limpio.slice(0, 9)}".`, b); limpio = limpio.slice(0, 9); }
    v = cadenaC(limpio);
  } else v = `String(${G.val(b, 'V', O.NONE, '""')})`;
  return `ottoBocaTexto(${v}, ${b.getFieldValue('VEL')});\n`;
});
bloque('otto_boca_brillo', COL.otto, function () {
  this.appendValueInput('V').appendField('Otto boca brillo (0–15)');
  sentencia(this);
}, (b) => { bocaUsada(); return `Otto.matrixIntensity(constrain(${G.val(b, 'V')}, 0, 15));\n`; });

/* ================= C++ libre ================= */
const ICONO_LAPIZ = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#ffffff" fill-opacity=".22"/><path d="M5 19l1-4L15.5 5.5a2.1 2.1 0 013 3L9 18z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>');
const MezclaCodigo = {
  /** Muestra el código en varias líneas y guarda el texto real en un campo oculto. */
  initCodigo(titulo, porDefecto) {
    this.appendDummyInput('CAB').appendField(titulo)
      .appendField(new Blockly.FieldImage(ICONO_LAPIZ, 18, 18, 'editar', () => editarCodigoBloque(this)), 'EDIT')
      .appendField(new Blockly.FieldTextInput(porDefecto, (v) => { setTimeout(() => !this.isDeadOrDying() && this.pintarLineas_(), 0); return v; }), 'CODE');
    this.getField('CODE').setVisible(false);
    this.pintarLineas_();
  },
  pintarLineas_() {
    let i = 0;
    while (this.getInput('L' + i)) { this.removeInput('L' + i); i++; }
    const lineas = String(this.getFieldValue('CODE') || '').split('\n');
    const max = 12;
    lineas.slice(0, max).forEach((l, k) => {
      const inp = this.appendDummyInput('L' + k).appendField(new Blockly.FieldLabel(l.length > 60 ? l.slice(0, 58) + '…' : (l || ' '), 'cpp-linea'));
      if (this.getInput('DO')) this.moveInputBefore('L' + k, 'DO');
      return inp;
    });
    if (lineas.length > max) this.appendDummyInput('L' + max).appendField(new Blockly.FieldLabel(`… ${lineas.length - max} líneas más`, 'cpp-linea'));
  }
};
Blockly.Blocks.cpp_linea = Object.assign({
  init() {
    this.setColour(COL.cpp);
    this.initCodigo('C++', 'digitalWrite(13, HIGH);');
    sentencia(this);
    this.setTooltip('Escribe instrucciones de C++ tal cual. Toca el lápiz para editar.');
  }
}, MezclaCodigo);
Ard.forBlock.cpp_linea = (b) => { const c = b.getFieldValue('CODE') || ''; return c.replace(/\s+$/, '') + '\n'; };
Blockly.Blocks.cpp_global = Object.assign({
  init() {
    this.setColour(COL.cpp);
    this.initCodigo('C++ al comienzo del programa', '// #include, variables o funciones propias');
    this.setTooltip('Va arriba de setup(): sirve para #include, variables globales o funciones escritas a mano.');
  }
}, MezclaCodigo);
Ard.forBlock.cpp_global = (b) => (b.getFieldValue('CODE') || '').replace(/\s+$/, '') + '\n';
bloque('cpp_expresion', COL.cpp, function () {
  this.appendDummyInput().appendField('C++').appendField(new Blockly.FieldTextInput('analogRead(A0) / 4'), 'CODE');
  this.setOutput(true);
  this.setTooltip('Una expresión de C++ que devuelve un valor.');
}, (b) => [`(${b.getFieldValue('CODE') || '0'})`, O.ATOMIC]);

/* ================= Funciones (bloques propios) ================= */
function nombreFuncionUnico(bloqueDef, v) {
  v = String(v || '').trim().replace(/\s+/g, '_');
  if (!v) return null;
  const ws = bloqueDef.workspace;
  if (!ws || ws.isFlyout || !espacio || ws !== espacio) return v;
  const otros = ws.getBlocksByType('fn_def', false).filter(x => x !== bloqueDef).map(x => x.getFieldValue('NAME'));
  let base = v, n = 2;
  while (otros.includes(v)) v = base + '_' + (n++);
  return v;
}
Blockly.Blocks.fn_def = {
  init() {
    this.setColour(COL.funciones);
    const self = this;
    this.appendDummyInput('CAB').appendField('definir bloque')
      .appendField(new Blockly.FieldTextInput('mi_bloque', function (v) { return nombreFuncionUnico(self, v); }), 'NAME')
      .appendField('devuelve')
      .appendField(new MenuNivel(TIPOS_RET, (t) => nivelActual >= 3 || t === 'void', function (v) { self.actualizarRetorno_(v); return v; }), 'TIPO');
    this.appendDummyInput('PC').appendField('con')
      .appendField(new MenuNivel([['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], (n) => nivelActual >= 3 || n === '0', function (v) { self.actualizarParams_(parseInt(v, 10)); return v; }), 'NPARAM')
      .appendField('parámetros');
    this.appendStatementInput('BODY').appendField('hacer');
    this.appendValueInput('RETURN').setAlign(Blockly.inputs.Align.RIGHT).appendField('devolver');
    this.getInput('RETURN').setVisible(false);
    this.setTooltip('Crea un bloque propio. Clic derecho → "Guardar en Mis bloques" para usarlo en otros programas.');
  },
  actualizarParams_(n) {
    for (let i = 0; i < 4; i++) {
      const existe = this.getInput('P' + i);
      if (i < n && !existe) {
        this.appendDummyInput('P' + i).appendField('   •')
          .appendField(new Blockly.FieldTextInput('param' + (i + 1), (v) => nombreC(v) === v ? v : nombreC(v)), 'P' + i + 'N')
          .appendField('de tipo').appendField(new Blockly.FieldDropdown(TIPOS_VAR), 'P' + i + 'T');
        this.moveInputBefore('P' + i, 'BODY');
      } else if (i >= n && existe) {
        this.removeInput('P' + i);
      }
    }
  },
  actualizarRetorno_(t) {
    const inp = this.getInput('RETURN');
    if (inp) inp.setVisible(t !== 'void');
    if (this.rendered) this.render();
  },
  customContextMenu(opciones) {
    if (this.isInFlyout) return;
    opciones.push({ text: 'Guardar en Mis bloques', enabled: true, callback: () => guardarEnMisBloques(this) });
  }
};
Ard.forBlock.fn_def = () => '';

Blockly.Blocks.fn_param = {
  init() {
    this.setColour(COL.funciones);
    this.appendDummyInput().appendField('parámetro').appendField(new CampoParam(), 'P');
    this.setOutput(true);
    this.setTooltip('El valor que recibe tu bloque. Úsalo solo dentro de "definir bloque".');
  }
};
Ard.forBlock.fn_param = function (b) {
  let p = b.getSurroundParent();
  while (p && p.type !== 'fn_def') p = p.getSurroundParent();
  if (!p) G.aviso('El bloque "parámetro" solo funciona dentro de "definir bloque".', b);
  return [nombreC(b.getFieldValue('P')), O.ATOMIC];
};

const MezclaLlamada = {
  initLlamada() {
    this.setColour(COL.funciones);
    this.appendDummyInput('CAB').appendField(new Blockly.FieldLabel('mi_bloque'), 'NOMBRE');
    this.firma_ = { nombre: 'mi_bloque', tipo: 'void', params: [] };
  },
  saveExtraState() { return { nombre: this.firma_.nombre, tipo: this.firma_.tipo, params: this.firma_.params }; },
  loadExtraState(s) { this.firma_ = { nombre: s.nombre || 'mi_bloque', tipo: s.tipo || 'void', params: s.params || [] }; this.actualizarForma_(); },
  mutationToDom() {
    const m = Blockly.utils.xml.createElement('mutation');
    m.setAttribute('firma', JSON.stringify(this.saveExtraState()));
    return m;
  },
  domToMutation(x) { this.loadExtraState(JSON.parse(x.getAttribute('firma') || '{}')); },
  actualizarForma_() {
    this.setFieldValue(this.firma_.nombre, 'NOMBRE');
    const n = this.firma_.params.length;
    for (let i = 0; i < n; i++) {
      const etiqueta = this.firma_.params[i].nombre;
      if (!this.getInput('ARG' + i)) {
        this.appendValueInput('ARG' + i).setAlign(Blockly.inputs.Align.RIGHT).appendField(new Blockly.FieldLabel(etiqueta), 'L' + i);
      } else {
        this.setFieldValue(etiqueta, 'L' + i);
      }
    }
    let i = n;
    while (this.getInput('ARG' + i)) {
      const c = this.getInput('ARG' + i).connection.targetBlock();
      if (c) c.unplug();
      this.removeInput('ARG' + i);
      i++;
    }
    this.setInputsInline(n <= 2);
  },
  /** Vuelve a leer la firma (si cambió la definición) y dispara un evento para deshacer. */
  refrescar_() {
    const r = buscarDefinicion(this.firma_.nombre);
    if (!r) { this.setWarningText('No encuentro la definición de este bloque.', 'def'); return; }
    this.setWarningText(null, 'def');
    const nueva = { nombre: r.firma.nombre, tipo: r.firma.tipo, params: r.firma.params.map(p => ({ nombre: p.nombre, tipo: p.tipo })) };
    if (JSON.stringify(nueva) === JSON.stringify(this.firma_)) return;
    const antes = Blockly.Events.BlockChange.getExtraBlockState_(this);
    this.firma_ = nueva;
    this.actualizarForma_();
    const despues = Blockly.Events.BlockChange.getExtraBlockState_(this);
    Blockly.Events.fire(new (Blockly.Events.get(Blockly.Events.BLOCK_CHANGE))(this, 'mutation', null, antes, despues));
  },
  customContextMenu(opciones) {
    if (this.isInFlyout) return;
    const r = buscarDefinicion(this.firma_.nombre);
    opciones.push({
      text: 'Traer la definición para editarla',
      enabled: !!r && r.fuente !== 'programa',
      callback: () => traerDefinicion(this.firma_.nombre)
    });
  }
};
function codigoLlamada(b) {
  const nombre = b.firma_.nombre;
  generarExterna(nombre, b);
  const args = b.firma_.params.map((p, i) => G.val(b, 'ARG' + i, O.NONE, valorInicial(p.tipo)));
  return `${nombreC(nombre)}(${args.join(', ')})`;
}
Blockly.Blocks.fn_call = Object.assign({
  init() { this.initLlamada(); sentencia(this); this.setTooltip('Usa tu bloque propio.'); }
}, MezclaLlamada);
Ard.forBlock.fn_call = (b) => codigoLlamada(b) + ';\n';
Blockly.Blocks.fn_call_val = Object.assign({
  init() { this.initLlamada(); this.setOutput(true); this.setTooltip('Usa tu bloque propio y recibe el valor que devuelve.'); }
}, MezclaLlamada);
Ard.forBlock.fn_call_val = function (b) {
  if (b.firma_.tipo === 'void') G.aviso(`"${b.firma_.nombre}" no devuelve ningún valor; úsalo como instrucción.`, b);
  return [codigoLlamada(b), O.POSTFIX];
};
