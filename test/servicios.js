// Prueba con Node los servicios del prototipo A/B (src/servicios.js; EST-002, I2): revisión de documentos, autoridad
// de ejecución, estado visible e identificación de la clase. Diseño: TecnoSuite/EstrategíaTecno/DISENO-I2-SERVICIOS.md.
// Uso: npm run test:servicios
'use strict';
const S = require('../src/servicios.js');

let fallos = 0;
function revisar(condicion, texto) {
  console.log((condicion ? 'OK    ' : 'FALLA ') + texto);
  if (!condicion) fallos++;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('— Documentos con revisión');
{
  const d = S.crearDocumento('programa');
  const vistos = [];
  const quitar = d.alCambiar((c) => vistos.push(c.revision));
  revisar(d.revision() === 0, 'un documento nuevo empieza en la revisión 0');
  d.cambio('bloques'); d.cambio('bloques');
  revisar(d.revision() === 2 && igual(vistos, [1, 2]), 'cada cambio sube la revisión una vez y avisa una vez');
  quitar();
  d.cambio('texto');
  revisar(d.revision() === 3 && vistos.length === 2 && d.oyentes() === 0, 'quien se desuscribe ya no recibe avisos (sin suscripciones duplicadas)');
  const otro = S.crearDocumento('circuito');
  otro.alCambiar(() => { throw new Error('roto'); });
  let llego = false;
  otro.alCambiar(() => { llego = true; });
  otro.cambio();
  revisar(llego && otro.revision() === 1, 'un oyente que falla no frena a los demás');
  revisar(typeof d.alCambiar(null) === 'function' && d.oyentes() === 0, 'suscribir algo que no es función no hace nada');
}

console.log('— Autoridad de ejecución');
{
  const e = S.crearEjecucion();
  revisar(igual(e.estado({ revisionPrograma: 0 }), { destino: null, revisionEjecutada: null, desactualizada: false, iniciada: false, cancelada: null }), 'sin corrida: sin destino');
  revisar(!e.empezar({ revisionPrograma: 1, destino: 'nube' }).ok && e.empezar({ revisionPrograma: 1, destino: 'nube' }).motivo === 'destino-invalido', 'el destino es la simulación o la placa, nada más');
  revisar(e.empezar({ destino: 'simulacion' }).motivo === 'revision-invalida', 'sin revisión del programa no empieza');
  const a = e.empezar({ revisionPrograma: 4, revisionCircuito: 2, placa: 'uno', destino: 'simulacion' });
  revisar(a.ok && e.vigente(a.turno), 'la corrida nueva es la vigente');
  const b = e.empezar({ revisionPrograma: 4, revisionCircuito: 2, placa: 'uno', destino: 'simulacion' });
  revisar(!e.vigente(a.turno) && e.vigente(b.turno), 'al empezar otra, la respuesta tardía de la anterior ya no vale');
  revisar(e.iniciada(a.turno).motivo === 'turno-vencido' && e.iniciada(b.turno).ok, 'solo la corrida vigente puede marcarse como iniciada');
  let s = e.estado({ revisionPrograma: 4, revisionCircuito: 2 });
  revisar(s.destino === 'simulacion' && s.revisionEjecutada === 4 && !s.desactualizada && s.iniciada, 'mientras no se edite, la corrida está al día');
  s = e.estado({ revisionPrograma: 5, revisionCircuito: 2 });
  revisar(s.desactualizada && s.cambioPrograma && !s.cambioCircuito, 'editar el programa después de simular la marca como de una revisión anterior');
  s = e.estado({ revisionPrograma: 4, revisionCircuito: 3 });
  revisar(s.desactualizada && s.cambioCircuito, 'editar el circuito también');
  revisar(S.textoEstadoEjecucion(e.estado({ revisionPrograma: 5 })) === 'Simulación · revisión 4 · cambiaste el programa o el circuito después', 'el texto del estado lo dice en palabras');
  revisar(e.estado({ revisionPrograma: 5 }).destino === 'simulacion', 'editar no cambia el destino por su cuenta (no sube nada a la placa)');
  const c = e.cancelar('cambio-de-proyecto');
  revisar(c.ok && c.habia && !e.vigente(b.turno) && e.estado({}).cancelada === 'cambio-de-proyecto', 'cambiar de proyecto cancela: lo que llegue tarde no alcanza al nuevo');
  revisar(e.cancelar('cierre').habia === false, 'cancelar sin corrida no hace nada');
  const p = e.empezar({ revisionPrograma: 7, placa: 'uno', destino: 'placa' });
  revisar(S.textoEstadoEjecucion(e.estado({ revisionPrograma: 7 })) === 'Placa real · revisión 7' && e.vigente(p.turno), 'la placa real es otro destino, con su revisión');
  revisar(S.textoEstadoEjecucion(null) === 'Sin ejecutar', 'sin estado: «Sin ejecutar»');
}

console.log('— Código de clase');
{
  let n = 0;
  const azar = () => ((n++ * 0.37) % 1);
  const codigos = Array.from({ length: 200 }, () => S.nuevoCodigoClase(azar));
  revisar(codigos.every((c) => c.length === 6 && S.codigoClaseValido(c)), 'seis caracteres del alfabeto de la clase');
  revisar(codigos.every((c) => !/[O0I1]/.test(c)), 'sin O, 0, I ni 1 (no se confunden al dictarlos)');
  revisar(S.nuevoCodigoClase(() => 0.9999999) === '999999' && S.nuevoCodigoClase(() => 0) === 'AAAAAA', 'los extremos del azar dan caracteres válidos');
  revisar(!S.codigoClaseValido('K7Q2M') && !S.codigoClaseValido('K7Q2MO') && !S.codigoClaseValido(123456) && S.codigoClaseValido('K7Q2MX'), 'el validador rechaza largos y letras fuera del alfabeto');
  revisar(new Set(Array.from({ length: 50 }, () => S.nuevoCodigoClase())).size > 45, 'con Math.random, los códigos casi nunca se repiten');
}

console.log('— Lista blanca de grupos');
{
  let v = S.validarListaBlanca('G1\nG2\n\n  G3  \r\nLos   Rayos');
  revisar(v.ok && igual(v.lista, ['G1', 'G2', 'G3', 'Los Rayos']), 'un nombre por renglón; los vacíos no cuentan y se juntan los espacios');
  v = S.validarListaBlanca(['G1', 'g1']);
  revisar(!v.ok && v.motivo === 'lista-invalida' && v.errores[0].motivo === 'repetido', 'un repetido sin distinguir mayúsculas se rechaza');
  v = S.validarListaBlanca(['x'.repeat(33), 'y'.repeat(34)]);
  revisar(!v.ok && v.errores.length === 1 && v.errores[0].motivo === 'muy-largo', '33 caracteres entran; 34 no (la clase y el guion ocupan 7 de 40)');
  v = S.validarListaBlanca(['Grupo\u0007', 'Ok', 'Al' + String.fromCharCode(0x202e) + 'Revés']);
  revisar(!v.ok && v.errores.length === 2 && v.errores.every((e) => e.motivo === 'caracter-invalido'), 'los caracteres de control y de dirección se rechazan');
  revisar(S.validarListaBlanca('').errores[0].motivo === 'vacia', 'una lista vacía no sirve');
  revisar(S.validarListaBlanca(null).motivo === 'lista-invalida' && S.validarListaBlanca([3]).errores[0].motivo === 'no-es-texto', 'algo que no es texto se rechaza sin excepción');
  revisar(S.validarListaBlanca(Array.from({ length: 61 }, (_, i) => 'G' + i)).errores.some((e) => e.motivo === 'demasiados'), 'más de 60 grupos se rechaza');
  revisar(S.validarListaBlanca(['Los-Rayos']).ok, 'un guion en el nombre se acepta: la clase siempre tiene 6 caracteres');
}

console.log('— Código del equipo');
{
  const lista = ['G1', 'Los Rayos', 'x'.repeat(33)];
  let r = S.equipoDe('K7Q2MX', 'g1', lista);
  revisar(r.ok && r.equipo === 'K7Q2MX-G1' && r.grupo === 'G1', 'el grupo se escribe como en la lista: «K7Q2MX-G1»');
  r = S.equipoDe('K7Q2MX', '  los   rayos ', lista);
  revisar(r.ok && r.equipo === 'K7Q2MX-Los Rayos', 'sin distinguir mayúsculas ni espacios');
  r = S.equipoDe('K7Q2MX', 'x'.repeat(33), lista);
  revisar(r.ok && r.equipo.length === 40, 'con el nombre más largo, el código del equipo tiene 40 caracteres y no se corta');
  revisar(S.equipoDe('K7Q2MX', 'G9', lista).motivo === 'grupo-desconocido', 'un grupo fuera de la lista no entra');
  revisar(S.equipoDe('', 'G1', lista).motivo === 'sin-clase' && S.equipoDe('K7Q2MX', 'G1', []).motivo === 'sin-lista', 'sin código de clase o sin lista, lo dice');
  revisar(S.equipoDe('K7Q2MX', '', lista).motivo === 'sin-grupo' && S.equipoDe('K7Q2MX', null, lista).motivo === 'sin-grupo', 'sin nombre, lo pide');
  const msj = S.equipoDe('K7Q2MX', 'G9', lista).mensaje;
  revisar(typeof msj === 'string' && msj.includes('lista del instructor'), `el mensaje es en palabras: «${msj}»`);
}

console.log('— Configuración del estudio');
{
  revisar(S.configEstudioValida(S.ESTUDIO_INICIAL), 'la inicial es C0, sin lista ni clase');
  revisar(S.configEstudioValida({ formato: 1, variante: 'B', listaBlanca: ['G1', 'G2'], clase: { codigo: 'K7Q2MX', desde: '2026-11-06T13:00:00Z' } }), 'una completa es válida');
  for (const [mala, nombre] of [[null, 'null'], [[], 'una lista'], [{ formato: 2, variante: 'A' }, 'otro formato'], [{ formato: 1, variante: 'D' }, 'otra variante'],
    [{ formato: 1, variante: 'A', listaBlanca: ['G1', 'g1'] }, 'una lista con repetidos'], [{ formato: 1, variante: 'A', listaBlanca: ['  G1'] }, 'una lista sin limpiar'],
    [{ formato: 1, variante: 'A', clase: { codigo: 'K7Q2M0', desde: 'x' } }, 'un código de clase con 0'], [{ formato: 1, variante: 'A', clase: 'K7Q2MX' }, 'una clase sin su fecha']]) {
    revisar(!S.configEstudioValida(mala), `${nombre}: no es válida (la app usa C0)`);
  }
}

console.log(fallos ? `\n${fallos} FALLAS` : '\nTodo bien.');
process.exit(fallos ? 1 : 0);
