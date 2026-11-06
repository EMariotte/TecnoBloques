// Servicios del prototipo A/B (EST-002, I2; diseño en TecnoSuite/EstrategíaTecno/DISENO-I2-SERVICIOS.md). Aquí va lo que
// no depende de la página: la revisión de cada documento, la autoridad de ejecución (una corrida por proyecto, con
// su revisión, placa y destino), el estado visible común y la identificación de la clase de la comparación (código
// de clase, lista blanca de grupos y código del equipo). app.js lo conecta con la interfaz. Se prueba con Node:
// test/servicios.js. Cada servicio responde { ok: true, … } o { ok: false, motivo, mensaje }; un dato del usuario
// nunca lanza una excepción.

const VARIANTES_ESTUDIO = ['C0', 'A', 'B'];
// Código de clase: seis caracteres sin letras que se confundan (sin O, 0, I ni 1). ADR-002, «Identificación y datos».
const ALFABETO_CLASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO_CLASE = 6;
const LARGO_EQUIPO = 40; // el límite del código del equipo en el registro (limpiarEquipo)
const LARGO_GRUPO = LARGO_EQUIPO - LARGO_CLASE - 1; // 33: «<clase>-<grupo>» cabe entero (observación de Codex en I0)
const MAX_GRUPOS = 60;

const fallaServicio = (motivo, mensaje, extra) => Object.assign({ ok: false, motivo, mensaje }, extra || {});

/**
 * Un documento con identidad y revisión (plan, sección 5, punto 2): cada cambio real sube la revisión una vez y avisa
 * a quien escucha. `cambio()` devuelve la revisión nueva.
 */
function crearDocumento(id) {
  let revision = 0;
  const oyentes = new Set();
  return {
    id,
    revision: () => revision,
    cambio(origen) {
      revision++;
      for (const fn of [...oyentes]) { try { fn({ id, revision, origen: origen || null }); } catch (e) { /* un oyente roto no frena a los demás */ } }
      return revision;
    },
    alCambiar(fn) {
      if (typeof fn !== 'function') return () => {};
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
    oyentes: () => oyentes.size,
  };
}

/**
 * La autoridad de ejecución del proyecto (plan, sección 5, punto 3): una sola corrida a la vez, con la revisión del
 * programa y del circuito, la placa y el destino. Una respuesta tardía (de un turno anterior, de otra placa o de otro
 * proyecto) no es vigente. Nunca cambia el destino por su cuenta: la placa real solo recibe lo que el aprendiz sube.
 */
function crearEjecucion() {
  let turno = 0;
  let corrida = null; // { turno, revisionPrograma, revisionCircuito, placa, destino, iniciada }
  let motivoCancelada = null;
  const DESTINOS = ['simulacion', 'placa'];
  return {
    empezar({ revisionPrograma, revisionCircuito, placa, destino } = {}) {
      if (!DESTINOS.includes(destino)) return fallaServicio('destino-invalido', 'El destino tiene que ser la simulación o la placa real.');
      if (!Number.isInteger(revisionPrograma) || revisionPrograma < 0) return fallaServicio('revision-invalida', 'Falta la revisión del programa.');
      turno++;
      motivoCancelada = null;
      corrida = { turno, revisionPrograma, revisionCircuito: Number.isInteger(revisionCircuito) ? revisionCircuito : null, placa: placa || null, destino, iniciada: false };
      return { ok: true, turno };
    },
    /** La corrida de este turno ya está andando (por ejemplo, el simulador arrancó). */
    iniciada(t) {
      if (!corrida || corrida.turno !== t) return fallaServicio('turno-vencido', 'Esa corrida ya no es la actual.');
      corrida.iniciada = true;
      return { ok: true };
    },
    vigente: (t) => !!corrida && corrida.turno === t,
    /** Cambio de proyecto, de placa o de equipo, o cierre: lo que estaba en curso deja de ser vigente. */
    cancelar(motivo) {
      if (!corrida) return { ok: true, habia: false };
      corrida = null;
      motivoCancelada = motivo || 'cancelada';
      turno++;
      return { ok: true, habia: true };
    },
    /** Lo que se muestra: el destino, la revisión que se ejecuta y si el programa o el circuito cambiaron desde entonces. */
    estado({ revisionPrograma, revisionCircuito } = {}) {
      if (!corrida) return { destino: null, revisionEjecutada: null, desactualizada: false, iniciada: false, cancelada: motivoCancelada };
      const cambioPrograma = Number.isInteger(revisionPrograma) && revisionPrograma !== corrida.revisionPrograma;
      const cambioCircuito = Number.isInteger(revisionCircuito) && corrida.revisionCircuito !== null && revisionCircuito !== corrida.revisionCircuito;
      return { destino: corrida.destino, placa: corrida.placa, revisionEjecutada: corrida.revisionPrograma, desactualizada: cambioPrograma || cambioCircuito,
        cambioPrograma, cambioCircuito, iniciada: corrida.iniciada, cancelada: null };
    },
    turnoActual: () => (corrida ? corrida.turno : null),
  };
}

/** El texto del estado visible común (plan, sección 5, punto 6): destino, revisión ejecutada y si quedó atrás. */
function textoEstadoEjecucion(e) {
  if (!e || !e.destino) return 'Sin ejecutar';
  const donde = e.destino === 'placa' ? 'Placa real' : 'Simulación';
  return `${donde} · revisión ${e.revisionEjecutada}` + (e.desactualizada ? ' · cambiaste el programa o el circuito después' : '');
}

/** Código de clase nuevo. `azar()` da un número en [0, 1); en la app, crypto.getRandomValues (ver app.js). */
function nuevoCodigoClase(azar) {
  const r = typeof azar === 'function' ? azar : Math.random;
  let codigo = '';
  for (let i = 0; i < LARGO_CLASE; i++) codigo += ALFABETO_CLASE[Math.min(ALFABETO_CLASE.length - 1, Math.floor(r() * ALFABETO_CLASE.length))];
  return codigo;
}
const codigoClaseValido = (c) => typeof c === 'string' && c.length === LARGO_CLASE && [...c].every((x) => ALFABETO_CLASE.includes(x));

/** Un nombre de grupo como se compara: espacios juntos y sin mayúsculas. */
const claveGrupo = (n) => String(n).replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
const limpiarGrupo = (n) => String(n).replace(/\s+/g, ' ').trim();
// Control, separadores de línea y los que cambian la dirección del texto: no van en un nombre que viaja al registro.
const CONTROL_GRUPO = new RegExp('[' + [[0x00, 0x1f], [0x7f, 0x9f], [0x200e, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069]]
  .map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']');

/**
 * La lista blanca del instructor: un nombre por renglón (o una lista). Los renglones vacíos no cuentan. Rechaza los
 * repetidos, los demasiado largos (más de 33 caracteres, para que «<clase>-<grupo>» quepa en 40) y los que tienen
 * caracteres de control. La clase tiene siempre 6 caracteres, así que un guion en el nombre del grupo no confunde.
 * Devuelve { ok, lista } o { ok: false, motivo: 'lista-invalida', errores: [{ nombre, motivo, mensaje }] }.
 */
function validarListaBlanca(entrada) {
  const crudos = Array.isArray(entrada) ? entrada : typeof entrada === 'string' ? entrada.split(/\r?\n/) : null;
  if (!crudos) return fallaServicio('lista-invalida', 'La lista de grupos no se pudo leer.', { errores: [] });
  const lista = [];
  const vistos = new Map();
  const errores = [];
  for (const crudo of crudos) {
    if (typeof crudo !== 'string') { errores.push({ nombre: String(crudo), motivo: 'no-es-texto', mensaje: 'Cada grupo es un nombre.' }); continue; }
    if (CONTROL_GRUPO.test(crudo.replace(/[\r\n\t]/g, ' '))) { errores.push({ nombre: crudo, motivo: 'caracter-invalido', mensaje: `«${limpiarGrupo(crudo.replace(CONTROL_GRUPO, ''))}» tiene un carácter que no se puede usar.` }); continue; }
    const nombre = limpiarGrupo(crudo);
    if (!nombre) continue; // un renglón vacío no es un grupo
    if (nombre.length > LARGO_GRUPO) { errores.push({ nombre, motivo: 'muy-largo', mensaje: `«${nombre}» tiene ${nombre.length} caracteres: el máximo es ${LARGO_GRUPO}.` }); continue; }
    const k = claveGrupo(nombre);
    if (vistos.has(k)) { errores.push({ nombre, motivo: 'repetido', mensaje: `«${nombre}» está repetido (igual que «${vistos.get(k)}»).` }); continue; }
    vistos.set(k, nombre);
    lista.push(nombre);
  }
  if (lista.length > MAX_GRUPOS) errores.push({ nombre: '', motivo: 'demasiados', mensaje: `Son ${lista.length} grupos: el máximo es ${MAX_GRUPOS}.` });
  if (!lista.length && !errores.length) errores.push({ nombre: '', motivo: 'vacia', mensaje: 'Escribe por lo menos un grupo.' });
  if (errores.length) return fallaServicio('lista-invalida', errores.map((e) => e.mensaje).join(' '), { errores });
  return { ok: true, lista };
}

/**
 * El código del equipo de la comparación: «<clase>-<grupo>», solo si el grupo está en la lista blanca (sin distinguir
 * mayúsculas ni espacios). El grupo queda escrito como en la lista.
 */
function equipoDe(clase, grupo, lista) {
  if (!codigoClaseValido(clase)) return fallaServicio('sin-clase', 'Todavía no hay código de clase: pídeselo al instructor.');
  if (!Array.isArray(lista) || !lista.length) return fallaServicio('sin-lista', 'El instructor todavía no escribió la lista de grupos.');
  const nombre = typeof grupo === 'string' ? limpiarGrupo(grupo) : '';
  if (!nombre) return fallaServicio('sin-grupo', 'Escriban el nombre de su grupo.');
  const k = claveGrupo(nombre);
  const enLista = lista.find((n) => claveGrupo(n) === k);
  if (!enLista) return fallaServicio('grupo-desconocido', 'Ese nombre de grupo no está en la lista del instructor. Revísenlo.');
  const equipo = `${clase}-${enLista}`;
  if (equipo.length > LARGO_EQUIPO) return fallaServicio('muy-largo', 'El nombre del grupo es demasiado largo.');
  return { ok: true, equipo, grupo: enLista };
}

/** La configuración del estudio, como la guarda la app de escritorio (estudio-config.json). Sin ella o dañada: C0. */
function configEstudioValida(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c) || c.formato !== 1 || !VARIANTES_ESTUDIO.includes(c.variante)) return false;
  if (c.listaBlanca !== undefined && c.listaBlanca !== null) {
    // Guardada, la lista ya está limpia: cada nombre tal como lo dejó validarListaBlanca, en el mismo orden
    if (!Array.isArray(c.listaBlanca)) return false;
    const v = validarListaBlanca(c.listaBlanca);
    if (!v.ok || v.lista.length !== c.listaBlanca.length || v.lista.some((n, i) => n !== c.listaBlanca[i])) return false;
  }
  if (c.clase !== undefined && c.clase !== null) {
    if (typeof c.clase !== 'object' || !codigoClaseValido(c.clase.codigo) || typeof c.clase.desde !== 'string') return false;
  }
  return true;
}
const ESTUDIO_INICIAL = Object.freeze({ formato: 1, variante: 'C0', listaBlanca: null, clase: null });

if (typeof module !== 'undefined') module.exports = {
  VARIANTES_ESTUDIO, ALFABETO_CLASE, LARGO_CLASE, LARGO_GRUPO, LARGO_EQUIPO, MAX_GRUPOS, ESTUDIO_INICIAL,
  crearDocumento, crearEjecucion, textoEstadoEjecucion, nuevoCodigoClase, codigoClaseValido, validarListaBlanca, equipoDe, configEstudioValida,
};
