/* =====================================================================
   TecnoBloques — definición de bloques y su traducción a C++
   ===================================================================== */
'use strict';

const COL = {
  programa: '#2f6b4f', logica: '#3f73c8', bucles: '#2f9463', mate: '#5a62c4', texto: '#b3603f',
  variables: '#c04a86', funciones: '#8a55c4', mis: '#6d45b0', es: '#16889c', tiempo: '#8a7a12',
  serial: '#27708f', bt: '#2a5fa8', motores: '#c05d22', servos: '#cc8420', sensores: '#23907e',
  lcd: '#4d6a8c', otto: '#cf4d3a', cpp: '#56616a'
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
class CampoDibujo extends Blockly.Field {
  constructor(valor) {
    super(valor || DIBUJO_VACIO);
    this.SERIALIZABLE = true;
    this.CURSOR = 'pointer';
  }
  doClassValidation_(v) { return typeof v === 'string' && /^[01]{40}$/.test(v) ? v : null; }
  initView() {
    const T = CampoDibujo.T, dom = Blockly.utils.dom;
    // Dentro de un grupo propio: el CSS de Blockly pinta de blanco los <rect> hijos directos del campo.
    const g = dom.createSvgElement('g', {}, this.fieldGroup_);
    dom.createSvgElement('rect', { width: 5 * T + 3, height: 8 * T + 3, rx: 3, fill: '#1e4fa8' }, g);
    this.puntos_ = [];
    for (let i = 0; i < 40; i++) {
      this.puntos_.push(dom.createSvgElement('rect', { x: 2 + (i % 5) * T, y: 2 + Math.floor(i / 5) * T, width: T - 1, height: T - 1 }, g));
    }
  }
  render_() {
    const v = this.getValue() || DIBUJO_VACIO;
    if (this.puntos_) this.puntos_.forEach((r, i) => r.setAttribute('fill', v[i] === '1' ? '#eef4ff' : '#2b5fbf'));
    this.size_ = new Blockly.utils.Size(5 * CampoDibujo.T + 3, 8 * CampoDibujo.T + 3);
  }
  getText_() { return 'dibujo'; }
  showEditor_() {
    const div = Blockly.DropDownDiv.getContentDiv();
    div.textContent = '';
    const caja = document.createElement('div');
    caja.className = 'tb-dibujo';
    const rejilla = document.createElement('div');
    rejilla.className = 'tb-dibujo-rejilla';
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
    for (let i = 0; i < 40; i++) {
      const c = document.createElement('div');
      c.className = 'tb-dibujo-celda';
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
      btn.addEventListener('click', () => { fn(); pintarCeldas(); });
      acciones.appendChild(btn);
    };
    boton('Borrar', 'Apagar todos los puntos', () => this.setValue(DIBUJO_VACIO));
    boton('Invertir', 'Cambiar puntos encendidos por apagados', () => this.setValue(this.getValue().replace(/[01]/g, (d) => (d === '1' ? '0' : '1'))));
    const listos = document.createElement('div');
    listos.className = 'tb-dibujo-listos';
    DIBUJOS_LCD.forEach(([nombre, bits]) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.title = nombre;
      btn.innerHTML = '<svg viewBox="0 0 10 16" width="15" height="24">' +
        [...bits].map((d, i) => (d === '1' ? `<rect x="${(i % 5) * 2}" y="${Math.floor(i / 5) * 2}" width="1.7" height="1.7"/>` : '')).join('') + '</svg>';
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
  G.incluir('Wire', '#include <Wire.h>');
  G.incluir('LiquidCrystal_I2C', '#include <LiquidCrystal_I2C.h>');
  G.global('lcd', `LiquidCrystal_I2C lcd(${dir}, ${col}, ${fil});`);
  G.setup('lcd', 'lcd.init();\nlcd.backlight();');
  const i2c = placa().i2c;
  G.pin(i2c.sda, 'Pantalla LCD (I2C SDA)', b); G.pin(i2c.scl, 'Pantalla LCD (I2C SCL)', b);
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

/* ================= Otto humanoide (OttoDIYLib + servos de brazos) ================= */
function configurarOtto(p, b) {
  Ard.banderas_.ottoConfig = true;
  G.incluir('Otto', '#include <Otto.h>');
  G.global('otto', 'Otto Otto;  // piernas y pies con OttoDIYLib');
  G.setup('otto', `Otto.init(${p[0]}, ${p[1]}, ${p[2]}, ${p[3]}, true, ${p[4]});\nOtto.home();`);
  ['Otto pierna izquierda', 'Otto pierna derecha', 'Otto pie izquierdo', 'Otto pie derecho', 'Otto zumbador'].forEach((u, i) => G.pin(p[i], u, b));
}
function configurarBrazos(izq, der, b) {
  Ard.banderas_.brazosConfig = true;
  G.incluir('Servo', '#include <Servo.h>');
  G.global('ottoBrazos', 'Servo ottoBrazoIzq;\nServo ottoBrazoDer;');
  G.setup('ottoBrazos', `ottoBrazoIzq.attach(${izq});\nottoBrazoDer.attach(${der});\nottoBrazos(90, 90);`);
  G.ayuda('ottoBrazos', 'void ottoBrazos(int izq, int der) {\n  ottoBrazoIzq.write(izq);\n  ottoBrazoDer.write(der);\n}');
  G.pin(izq, 'Otto brazo izquierdo', b); G.pin(der, 'Otto brazo derecho', b);
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
  this.setTooltip('Usa OttoDIYLib. Carga la calibración guardada en la EEPROM de la placa.');
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
  G.ayuda('ottoSaludar', 'void ottoSaludar(bool izquierdo) {\n  Servo &brazo = izquierdo ? ottoBrazoIzq : ottoBrazoDer;\n  int arriba = izquierdo ? 160 : 20;\n  int medio = izquierdo ? 120 : 60;\n  for (int i = 0; i < 3; i++) {\n    brazo.write(arriba);\n    delay(250);\n    brazo.write(medio);\n    delay(250);\n  }\n  brazo.write(90);\n}');
  return `ottoSaludar(${a === 'SAL_IZQ' ? 'true' : 'false'});\n`;
});

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
      .appendField(new Blockly.FieldDropdown(TIPOS_RET, function (v) { self.actualizarRetorno_(v); return v; }), 'TIPO');
    this.appendDummyInput('PC').appendField('con')
      .appendField(new Blockly.FieldDropdown([['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], function (v) { self.actualizarParams_(parseInt(v, 10)); return v; }), 'NPARAM')
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
