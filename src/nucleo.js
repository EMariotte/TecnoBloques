/* =====================================================================
   TecnoBloques — núcleo: placas, campos, generador Arduino C++
   ===================================================================== */
'use strict';

/* ---------- Placas ---------- */
function rango(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }
const PLACAS = {
  uno: {
    nombre: 'Arduino Uno R3', fqbn: 'arduino:avr:uno', nDig: 14,
    digitales: rango(0, 13), analogicos: rango(0, 5).map(n => 'A' + n), soloAnalog: [],
    pwm: [3, 5, 6, 9, 10, 11], i2c: { sda: 'A4', scl: 'A5' }, serialesHW: [], swRx: null,
    carga: 'STK500v1 a 115200 baudios', servoSinPWM: [9, 10]
  },
  nano: {
    nombre: 'Arduino Nano', fqbn: 'arduino:avr:nano:cpu=atmega328', nDig: 14,
    digitales: rango(0, 13), analogicos: rango(0, 7).map(n => 'A' + n), soloAnalog: ['A6', 'A7'],
    pwm: [3, 5, 6, 9, 10, 11], i2c: { sda: 'A4', scl: 'A5' }, serialesHW: [], swRx: null,
    carga: 'STK500v1 a 115200 baudios', servoSinPWM: [9, 10]
  },
  nano_old: {
    nombre: 'Arduino Nano (bootloader antiguo)', fqbn: 'arduino:avr:nano:cpu=atmega328old', nDig: 14,
    digitales: rango(0, 13), analogicos: rango(0, 7).map(n => 'A' + n), soloAnalog: ['A6', 'A7'],
    pwm: [3, 5, 6, 9, 10, 11], i2c: { sda: 'A4', scl: 'A5' }, serialesHW: [], swRx: null,
    carga: 'STK500v1 a 57600 baudios', servoSinPWM: [9, 10]
  },
  mega: {
    nombre: 'Arduino Mega 2560', fqbn: 'arduino:avr:mega:cpu=atmega2560', nDig: 54,
    digitales: rango(0, 53), analogicos: rango(0, 15).map(n => 'A' + n), soloAnalog: [],
    pwm: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46], i2c: { sda: '20', scl: '21' },
    serialesHW: [{ nombre: 'Serial1', rx: '19', tx: '18' }, { nombre: 'Serial2', rx: '17', tx: '16' }, { nombre: 'Serial3', rx: '15', tx: '14' }],
    swRx: ['10', '11', '12', '13', '14', '15', '50', '51', '52', '53', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15'],
    carga: 'STK500v2 a 115200 baudios', servoSinPWM: [11, 12]
  }
};
let placaActual = 'uno';
/** Nivel del aprendiz: 1 Explorador, 2 Constructor, 3 Inventor. Solo cambia lo que se ofrece, nunca lo que se genera. */
let nivelActual = 3;
const placa = () => PLACAS[placaActual];

function opcionesPin(tipo) {
  const p = placa();
  let lista;
  if (tipo === 'analogico') lista = p.analogicos;
  else if (tipo === 'pwm') lista = p.pwm.map(String);
  else if (tipo === 'fisico') lista = p.digitales.map(String).concat(p.analogicos);
  else lista = p.digitales.map(String).concat(p.analogicos.filter(a => !p.soloAnalog.includes(a)));
  const opts = lista.map(v => [String(v), String(v)]);
  if (tipo === 'fisico') return opts;
  // Primero los pines con nombre que sirven para este uso: "LedRojo (13)"
  const vistos = new Set();
  const nombres = nombresDePines().filter(n => lista.includes(n.pin) && !vistos.has(n.nombre) && vistos.add(n.nombre))
    .map(n => [`${n.nombre} (${n.pin})`, n.nombre]);
  return nombres.concat(opts);
}

/* ---------- Nombres de pines (#define) ---------- */
/** Pines con nombre del programa: [{nombre, pin, bloque}]. Solo bloques activos. */
function nombresDePines(ws) {
  ws = ws || (typeof espacio !== 'undefined' ? espacio : null);
  if (!ws) return [];
  return ws.getBlocksByType('pin_nombre', true).filter(b => b.isEnabled())
    .map(b => ({ nombre: b.getFieldValue('NOMBRE'), pin: b.getFieldValue('PIN'), bloque: b }));
}
/** "LedRojo" → "13". Un pin sin nombre se devuelve igual. */
function pinReal(v) {
  const s = String(v);
  const n = Ard.nombresPin_ && Ard.nombresPin_.get(s);
  return n ? n.pin : s;
}
/** Para avisos: "LedAzul (9)" o "9". */
function pinTexto(v) { const r = pinReal(v); return r !== String(v) ? `${v} (${r})` : String(v); }
/** Sufijo para objetos que van uno por pin físico: el primer nombre de ese pin o su número (servo_Pinza, servo__10). */
function sufijoPin(v) {
  const r = pinReal(v);
  const n = Ard.nombresPin_ && [...Ard.nombresPin_.values()].find(x => x.pin === r);
  return n ? n.nombre : nombreC(r);
}
/** Convierte "A0" o "13" a un número único de pin para detectar choques. */
function pinNumero(pin) {
  const s = String(pin).trim();
  if (/^A\d+$/.test(s)) return placa().nDig + parseInt(s.slice(1), 10);
  const n = parseInt(s, 10);
  return isNaN(n) ? s : n;
}

/* ---------- Campos ---------- */
/** Menú de pines que acepta cualquier valor (para que cambiar de placa no borre la elección). */
class CampoPin extends Blockly.FieldDropdown {
  constructor(tipo, valor) {
    super(function () { return opcionesPin('digital'); });
    this.tipoPin = tipo || 'digital';
    if (valor !== undefined) this.setValue(String(valor));
  }
  doClassValidation_(v) { return v === null || v === undefined ? null : String(v); }
  getOptions() {
    const opts = opcionesPin(this.tipoPin || 'digital');
    const v = this.getValue && this.getValue();
    if (v !== null && v !== undefined && !opts.some(o => o[1] === v)) opts.push([v + ' ?', v]);
    return opts;
  }
}

/**
 * Menú cuyas opciones dependen del nivel. Acepta siempre cualquier valor de la lista completa,
 * para que un proyecto hecho en un nivel más alto se abra sin perder nada.
 */
class MenuNivel extends Blockly.FieldDropdown {
  constructor(completas, permitida, validador) {
    super(completas, validador);
    this.completas_ = completas;
    this.permitida_ = permitida;
  }
  getOptions(useCache) {
    if (!this.completas_) return super.getOptions(useCache);  // aún dentro del constructor de Blockly
    const v = this.getValue();
    const opts = this.completas_.filter(o => this.permitida_(o[1]) || o[1] === v);
    return opts.length ? opts : this.completas_;
  }
  doClassValidation_(v) { return (this.completas_ || this.getOptions()).some(o => o[1] === v) ? v : null; }
}

/** Menú con los parámetros de la función que contiene al bloque. */
class CampoParam extends Blockly.FieldDropdown {
  constructor() { super(function () { return [['param', 'param']]; }); }
  doClassValidation_(v) { return v === null || v === undefined ? null : String(v); }
  getOptions() {
    const b = this.getSourceBlock && this.getSourceBlock();
    let p = b ? b.getSurroundParent() : null;
    while (p && p.type !== 'fn_def') p = p.getSurroundParent();
    const opts = p ? leerParams(p).map(x => [x.nombre, x.nombre]) : [];
    const v = this.getValue && this.getValue();
    if (v && !opts.some(o => o[1] === v)) opts.push([v, v]);
    if (!opts.length) opts.push(['param', 'param']);
    return opts;
  }
}

/* ---------- Tipos ---------- */
const TIPOS_VAR = [
  ['entero (int)', 'int'], ['entero largo (long)', 'long'], ['decimal (float)', 'float'],
  ['lógico (bool)', 'bool'], ['carácter (char)', 'char'], ['texto (String)', 'String']
];
const TIPOS_RET = [['nada', 'void']].concat(TIPOS_VAR);
/** Tipos que se ofrecen en el nivel 2, con nombres de aprendiz. */
const TIPOS_VAR_N2 = [['número entero', 'int'], ['número decimal', 'float'], ['texto', 'String'], ['letra (para comandos)', 'char'], ['sí / no', 'bool']];
const NOMBRE_TIPO = { void: 'nada', int: 'entero', long: 'entero largo', float: 'decimal', bool: 'lógico', char: 'carácter', String: 'texto' };
function valorInicial(t) {
  return { int: '0', long: '0', float: '0.0', bool: 'false', char: "'\\0'", String: '""' }[t] || '0';
}

/* ---------- Nombres C++ ---------- */
const RESERVADAS = new Set(('setup loop if else for while do switch case default break continue return int long float double bool boolean ' +
  'char byte String void true false HIGH LOW INPUT OUTPUT INPUT_PULLUP delay millis micros Serial class new delete const static unsigned ' +
  'signed short struct union enum goto sizeof this public private protected virtual template typename namespace using auto register ' +
  'volatile extern inline operator friend try catch throw and or not xor min max abs map random constrain round sq sqrt pow lcd BT Otto ' +
  'word size_t main FORWARD BACKWARD RELEASE LEFT RIGHT SMALL MEDIUM BIG').split(' '));
function nombreC(n) {
  let s = String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]/g, '_');
  if (!s) s = 'x';
  if (/^[0-9]/.test(s)) s = '_' + s;
  if (RESERVADAS.has(s)) s += '_';
  return s;
}
function cadenaC(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
}
function caracterC(s) {
  const c = String(s || ' ').charAt(0);
  if (c === "'") return "'\\''";
  if (c === '\\') return "'\\\\'";
  return "'" + c + "'";
}

/* ---------- Generador ---------- */
const Ard = new Blockly.CodeGenerator('Arduino');
const O = { ATOMIC: 0, POSTFIX: 1, UNARY: 2, MULT: 3, ADD: 4, SHIFT: 5, REL: 6, EQ: 7, BAND: 8, BXOR: 9, BOR: 10, AND: 11, OR: 12, COND: 13, ASSIGN: 14, NONE: 99 };
Ard.INDENT = '  ';
Ard.ORDER_OVERRIDES = [];

Ard.init = function (ws) {
  this.incluir_ = new Map();
  this.globales_ = new Map();
  this.setup_ = new Map();
  this.ayudas_ = new Map();
  this.funciones_ = new Map();
  this.prototipos_ = new Map();
  this.pines_ = [];
  this.avisos_ = [];
  this.banderas_ = {};
  this.motores_ = new Set();
  this.generando_ = new Set();
  this.usadosExternos_ = new Set();
  this.contador_ = 0;
  this.isInitialized = true;
};
Ard.scrub_ = function (block, code, thisOnly) {
  let comentario = '';
  if (!block.outputConnection && block.getCommentText) {
    const c = block.getCommentText();
    if (c) comentario = this.prefixLines(c, '// ') + '\n';
  }
  const sig = block.nextConnection && block.nextConnection.targetBlock();
  return comentario + code + (thisOnly ? '' : this.blockToCode(sig));
};
Ard.scrubNakedValue = function (line) { return line + ';\n'; };

const G = {
  incluir(k, linea) { if (!Ard.incluir_.has(k)) Ard.incluir_.set(k, linea); },
  global(k, codigo) { if (!Ard.globales_.has(k)) Ard.globales_.set(k, codigo); },
  setup(k, codigo) { if (!Ard.setup_.has(k)) Ard.setup_.set(k, codigo); },
  ayuda(k, codigo) { if (!Ard.ayudas_.has(k)) Ard.ayudas_.set(k, codigo); },
  pin(pin, uso, bloque) {
    const s = String(pin), real = pinReal(s);
    Ard.pines_.push({ pin: real, nombre: real !== s ? s : null, uso, id: bloque && bloque.workspace === espacio ? bloque.id : null });
  },
  aviso(msg, bloque, tipo) { Ard.avisos_.push({ msg, id: bloque && bloque.workspace === espacio ? bloque.id : null, tipo: tipo || 'aviso' }); },
  val(b, nombre, orden, defecto) { return Ard.valueToCode(b, nombre, orden === undefined ? O.NONE : orden) || (defecto === undefined ? '0' : defecto); },
  sentencias(b, nombre) { return Ard.statementToCode(b, nombre); },
  nuevoId() { return ++Ard.contador_; }
};

const ORDEN_INCLUDES = ['Wire', 'SPI', 'SoftwareSerial', 'Servo', 'Otto', 'AFMotor_R4', 'DHT', 'LiquidCrystal_I2C'];

/** Genera el programa completo a partir del espacio de trabajo. */
function generarPrograma(ws) {
  Ard.init(ws);
  // Nombres de pines: se leen antes de generar para que cualquier bloque los pueda usar
  Ard.nombresPin_ = new Map();
  for (const n of nombresDePines(ws)) {
    if (Ard.nombresPin_.has(n.nombre)) { G.aviso(`Hay dos pines con el nombre "${n.nombre}". Cambia uno.`, n.bloque); continue; }
    const p = placa();
    if (!p.digitales.map(String).includes(n.pin) && !p.analogicos.includes(n.pin)) G.aviso(`El pin ${n.pin} no existe en ${p.nombre}.`, n.bloque);
    Ard.nombresPin_.set(n.nombre, n);
  }
  let globalLibre = '';
  const tops = ws.getTopBlocks(true);
  for (const b of tops) {
    if (!b.isEnabled()) continue;
    if (b.type === 'fn_def') generarDefinicion(b, false);
    else if (b.type === 'cpp_global') globalLibre += Ard.blockToCode(b);
  }
  const progs = tops.filter(b => b.type === 'programa' && b.isEnabled());
  let setupUsuario = '', loopUsuario = '';
  if (progs.length) {
    setupUsuario = G.sentencias(progs[0], 'SETUP');
    loopUsuario = G.sentencias(progs[0], 'LOOP');
  } else {
    G.aviso('Falta el bloque "al iniciar / repetir por siempre". Sin él la placa no hace nada.', null);
  }
  const sueltos = tops.filter(b => !['programa', 'fn_def', 'cpp_global', 'pin_nombre'].includes(b.type));
  if (sueltos.length) {
    G.aviso(`Hay ${sueltos.length} bloque(s) suelto(s) fuera del programa; no se incluyen en el código.`, sueltos[0], 'info');
  }
  // Serial usado sin iniciar
  if (Ard.banderas_.serialUsado && !Ard.banderas_.serialIniciado) {
    G.setup('serial_auto', 'Serial.begin(9600);');
    G.aviso('Usas el monitor serial sin el bloque "iniciar monitor serial". Se agregó a 9600 baudios.', null, 'info');
  }
  if (Ard.banderas_.serialUsado || Ard.banderas_.serialIniciado) { G.pin('0', 'Monitor serial (RX)'); G.pin('1', 'Monitor serial (TX)'); }
  finalizarModulos();
  revisarPines();

  // ---- Ensamblar ----
  const includes = [...Ard.incluir_.entries()].sort((a, b) => {
    const ia = ORDEN_INCLUDES.indexOf(a[0]), ib = ORDEN_INCLUDES.indexOf(b[0]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }).map(e => e[1]);
  if (Ard.incluir_.has('Otto') && Ard.incluir_.has('AFMotor_R4')) {
    includes.splice(includes.indexOf(Ard.incluir_.get('AFMotor_R4')), 0, '#undef BACKWARD  // Otto y AFMotor_R4 usan valores distintos; los motores usan el de AFMotor');
  }
  const variables = ws.getVariableMap().getAllVariables().map(v =>
    `${v.getType() || 'int'} ${nombreC(v.getName())} = ${valorInicial(v.getType() || 'int')};`);
  const p = placa();
  const nombresVar = new Set(ws.getVariableMap().getAllVariables().map(v => nombreC(v.getName())));
  for (const [nombre, n] of Ard.nombresPin_) {
    if (nombresVar.has(nombre)) G.aviso(`"${nombre}" es el nombre de un pin y también de una variable. Cambia uno de los dos.`, n.bloque);
    else if (Ard.funciones_.has(nombre)) G.aviso(`"${nombre}" es el nombre de un pin y también de un bloque propio. Cambia uno de los dos.`, n.bloque);
  }
  const defines = [...Ard.nombresPin_.values()].map(n => `#define ${n.nombre} ${n.pin}`);
  let out = `// ${document.getElementById('nombreProyecto').value || 'Proyecto'} · ${p.nombre}\n// Generado con TecnoBloques\n`;
  if (includes.length) out += '\n' + includes.join('\n') + '\n';
  if (defines.length) out += '\n// Nombres de los pines\n' + defines.join('\n') + '\n';
  if (Ard.globales_.size) out += '\n' + [...Ard.globales_.values()].join('\n') + '\n';
  if (variables.length) out += '\n' + variables.join('\n') + '\n';
  if (globalLibre.trim()) out += '\n' + globalLibre.replace(/\s+$/, '') + '\n';
  const protos = [...Ard.prototipos_.values()].concat([...Ard.ayudas_.keys()].map(k => Ard.ayudas_.get(k).split('\n')[0].replace(/\s*\{\s*$/, ';')));
  if (protos.length) out += '\n' + protos.join('\n') + '\n';
  const setupLib = [...Ard.setup_.values()].map(l => Ard.prefixLines(l, Ard.INDENT)).join('\n');
  out += '\nvoid setup() {\n' + (setupLib ? setupLib + '\n' : '') + setupUsuario + '}\n';
  out += '\nvoid loop() {\n' + loopUsuario + '}\n';
  if (Ard.ayudas_.size) out += '\n' + [...Ard.ayudas_.values()].join('\n\n') + '\n';
  if (Ard.funciones_.size) out += '\n' + [...Ard.funciones_.values()].join('\n');
  return { codigo: out, avisos: Ard.avisos_, externos: [...Ard.usadosExternos_] };
}

/* ---------- Funciones del usuario ---------- */
function leerParams(b) {
  const n = parseInt(b.getFieldValue('NPARAM') || '0', 10);
  const r = [];
  for (let i = 0; i < n; i++) {
    if (!b.getField('P' + i + 'N')) break;
    r.push({ nombre: b.getFieldValue('P' + i + 'N'), tipo: b.getFieldValue('P' + i + 'T') });
  }
  return r;
}
function firmaDeBloque(b) {
  return { nombre: b.getFieldValue('NAME'), tipo: b.getFieldValue('TIPO'), params: leerParams(b) };
}

function generarDefinicion(b, esExterna) {
  const firma = firmaDeBloque(b);
  const nombre = nombreC(firma.nombre);
  if (Ard.funciones_.has(nombre)) {
    if (!esExterna) G.aviso(`Hay dos bloques definidos con el nombre "${firma.nombre}".`, b);
    return;
  }
  Ard.funciones_.set(nombre, '');
  const cuerpo = G.sentencias(b, 'BODY');
  let locales = '';
  if (esExterna) {
    const pn = new Set(firma.params.map(p => nombreC(p.nombre)));
    for (const v of b.workspace.getVariableMap().getAllVariables()) {
      const n = nombreC(v.getName());
      if (!pn.has(n)) locales += `${Ard.INDENT}${v.getType() || 'int'} ${n} = ${valorInicial(v.getType() || 'int')};\n`;
    }
  }
  let ret = '';
  if (firma.tipo !== 'void') ret = `${Ard.INDENT}return ${G.val(b, 'RETURN', O.NONE, valorInicial(firma.tipo))};\n`;
  const cab = `${firma.tipo} ${nombre}(${firma.params.map(p => `${p.tipo} ${nombreC(p.nombre)}`).join(', ')})`;
  Ard.prototipos_.set(nombre, cab + ';');
  const origen = esExterna ? `// Bloque propio "${firma.nombre}" (de Mis bloques)\n` : '';
  Ard.funciones_.set(nombre, `${origen}${cab} {\n${locales}${cuerpo}${ret}}\n`);
}

/** Busca la definición de un bloque propio: 1) en el programa, 2) copia del proyecto, 3) Mis bloques. */
function buscarDefinicion(nombre) {
  if (espacio) {
    const b = espacio.getBlocksByType('fn_def', false).find(x => x.getFieldValue('NAME') === nombre);
    if (b) return { fuente: 'programa', bloque: b, firma: firmaDeBloque(b) };
  }
  if (embebidos[nombre]) return { fuente: 'proyecto', def: embebidos[nombre], firma: firmaDeDef(embebidos[nombre]) };
  const lib = leerLibreria();
  if (lib[nombre]) return { fuente: 'libreria', def: lib[nombre], firma: firmaDeDef(lib[nombre]) };
  return null;
}
function firmaDeDef(d) { return { nombre: d.nombre, tipo: d.tipo, params: d.params || [] }; }

function generarExterna(nombre, bloqueLlamada) {
  const n = nombreC(nombre);
  if (Ard.funciones_.has(n)) return true;
  const r = buscarDefinicion(nombre);
  if (!r) { G.aviso(`No encuentro el bloque "${nombre}". Impórtalo en Mis bloques o defínelo.`, bloqueLlamada); return false; }
  if (r.fuente === 'programa') return true; // se genera con los demás bloques del programa
  if (Ard.generando_.has(nombre)) { G.aviso(`El bloque "${nombre}" se llama a sí mismo en círculo.`, bloqueLlamada); return false; }
  Ard.generando_.add(nombre);
  Ard.usadosExternos_.add(nombre);
  const hw = new Blockly.Workspace();
  try {
    Blockly.Events.disable();
    Blockly.serialization.blocks.append(r.def.cuerpo, hw);
    const def = hw.getTopBlocks(false).find(x => x.type === 'fn_def');
    if (def) generarDefinicion(def, true);
  } catch (e) {
    G.aviso(`No se pudo leer el bloque "${nombre}": ${e.message}`, bloqueLlamada);
  } finally {
    Blockly.Events.enable();
    hw.dispose();
    Ard.generando_.delete(nombre);
  }
  return true;
}

/* ---------- Revisión de pines ---------- */
function revisarPines() {
  const mapa = new Map();
  for (const u of Ard.pines_) {
    const k = pinNumero(u.pin);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(u);
  }
  for (const [, usos] of mapa) {
    const distintos = [...new Set(usos.map(u => u.uso))];
    if (distintos.length > 1) {
      const nombres = [...new Set(usos.map(u => u.nombre).filter(Boolean))];
      const pin = usos[0].pin + (nombres.length ? ` (${nombres.join(', ')})` : '');
      const conBloque = usos.find(u => u.id) || {};
      G.aviso(`El pin ${pin} lo usan a la vez: ${distintos.join(', ')}.`, conBloque.id ? espacio.getBlockById(conBloque.id) : null);
    }
  }
  const p = placa();
  for (const u of Ard.pines_) {
    const valido = p.digitales.map(String).includes(u.pin) || p.analogicos.includes(u.pin);
    if (valido) continue;
    const bloque = u.id ? espacio.getBlockById(u.id) : null;
    if (/^A?\d+$/.test(u.pin)) G.aviso(`El pin ${u.pin} no existe en ${p.nombre}.`, bloque);
    else G.aviso(`No hay un pin llamado "${u.pin}". Ponle ese nombre con el bloque "el pin … se llama …".`, bloque);
  }
}

/* ---------- Módulos que se cierran al final ---------- */
function finalizarModulos() {
  const f = Ard.banderas_;
  if (f.btUsado && !f.btConfig) {
    configurarBT(placaActual === 'mega' ? '19' : 'A1', placaActual === 'mega' ? '18' : 'A2', null);
    G.aviso('Usas Bluetooth sin el bloque "iniciar Bluetooth". Se asumió ' + (placaActual === 'mega' ? 'Serial1 (pines 19/18) a 9600.' : 'RX A1 y TX A2 a 9600.'), null, 'info');
    G.setup('bt_begin_auto', 'BT.begin(9600);');
  }
  if (f.lcdUsado && !f.lcdConfig) {
    configurarLCD('0x27', '16', '2', null);
    G.aviso('Usas la pantalla LCD sin el bloque "iniciar pantalla". Se asumió la dirección 0x27 de 16x2.', null, 'info');
  }
  if (f.lcdConfig) {
    const cols = f.lcdCols, filas = f.lcdFilas;
    for (const u of f.lcdPos || []) {
      if (u.c !== null && (u.c < 0 || u.c >= cols)) G.aviso(`La columna ${u.c} no existe en una pantalla de ${cols}x${filas}: usa de 0 a ${cols - 1}.`, u.b);
      if (u.f !== null && (u.f < 0 || u.f >= filas)) G.aviso(`La fila ${u.f} no existe en una pantalla de ${cols}x${filas}: usa de 0 a ${filas - 1}.`, u.b);
    }
    if (f.lcdBorrarFila) G.ayuda('lcdBorrarFila', `void lcdBorrarFila(int fila) {\n  lcd.setCursor(0, fila);\n  for (int i = 0; i < ${cols}; i++) lcd.print(' ');\n  lcd.setCursor(0, fila);\n}`);
  }
  for (const u of f.lcdMostrados || []) {
    if (!(f.lcdCreados && f.lcdCreados.has(u.nombre))) G.aviso(`No hay un bloque "LCD crear símbolo" llamado "${u.nombre}".`, u.b);
  }
  if (f.lcdCreados && f.lcdCreados.size > 8) {
    G.aviso(`La pantalla guarda máximo 8 símbolos distintos y el programa crea ${f.lcdCreados.size}. Reusa un nombre para cambiar el dibujo de un símbolo.`, null);
  }
  if (f.ottoUsado && !f.ottoConfig) {
    configurarOtto(['2', '3', '4', '5', '13'], null);
    G.aviso('Usas bloques de Otto sin "iniciar Otto". Se asumieron los pines 2, 3, 4, 5 y zumbador 13.', null, 'info');
  }
  if (f.brazosUsado && !f.brazosConfig) {
    configurarBrazos('6', '7', null);
    G.aviso('Usas los brazos de Otto sin "iniciar brazos". Se asumieron los pines 6 y 7.', null, 'info');
  }
  if ((f.servoUsado || f.ottoConfig || f.brazosConfig) && f.pwmPines) {
    const sin = placa().servoSinPWM.map(String);
    for (const u of f.pwmPines) {
      if (sin.includes(pinReal(u.p))) G.aviso(`Con servos conectados, el PWM del pin ${pinTexto(u.p)} deja de funcionar (la librería Servo usa ese temporizador). Usa otro pin PWM.`, u.b);
    }
  }
  if (f.detenerTodos) {
    const cuerpo = [...Ard.motores_].sort().map(m => `  motor${m}.run(RELEASE);`).join('\n');
    Ard.ayudas_.set('detenerMotores', `void detenerMotores() {\n${cuerpo || '  // No hay motores configurados'}\n}`);
  }
}
