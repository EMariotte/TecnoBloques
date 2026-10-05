"""Mete todos los bloques de la caja de herramientas en un programa, prueba Mis bloques y guarda el C++."""
import json, sys, pathlib
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'test' / 'salida'

JS_TODO = r"""(placa) => {
  nuevoProyecto();
  placaActual = placa; document.getElementById('placa').value = placa;
  const ws = espacio;
  const vm = ws.getVariableMap();
  const vi = vm.createVariable('contador', 'int');
  vm.createVariable('texto_1', 'String');
  const prog = ws.getBlocksByType('programa')[0];
  let cola = null;
  const agregar = (b) => {
    if (!cola) prog.getInput('LOOP').connection.connect(b.previousConnection);
    else cola.nextConnection.connect(b.previousConnection);
    cola = b;
    while (cola.nextConnection && cola.nextConnection.targetBlock()) cola = cola.nextConnection.targetBlock();
  };
  const planos = [];
  TOOLBOX.contents.forEach(c => (c.contents || []).forEach(i => { if (i.kind === 'block') planos.push(i); }));
  const omitidos = [];
  for (const item of planos) {
    const copia = JSON.parse(JSON.stringify(item)); delete copia.kind;
    if (copia.type === 'bucle_para') copia.fields = { VAR: { id: vi.getId() } };
    const b = Blockly.serialization.blocks.append(copia, ws);
    if (b.previousConnection && b.nextConnection) { agregar(b); }
    else if (b.outputConnection) {
      const imp = ws.newBlock('serial_imprimir'); imp.initSvg(); imp.render();
      imp.getInput('V').connection.connect(b.outputConnection);
      agregar(imp);
    } else { omitidos.push(b.type); }
  }
  // Variables tipadas
  const set = Blockly.serialization.blocks.append({ type: 'var_set', fields: { VAR: { id: vi.getId() } }, inputs: { V: { block: { type: 'math_number', fields: { NUM: 5 } } } } }, ws);
  agregar(set);
  const cam = Blockly.serialization.blocks.append({ type: 'var_cambiar', fields: { VAR: { id: vi.getId() } }, inputs: { V: { block: { type: 'math_number', fields: { NUM: 1 } } } } }, ws);
  agregar(cam);
  actualizar();
  return { codigo: ultimo.codigo, avisos: ultimo.avisos.map(a => a.msg), omitidos };
}"""

JS_MIS = r"""() => {
  // 1) Programa con dos bloques propios, uno llama al otro, con variable interna
  nuevoProyecto();
  placaActual = 'uno'; document.getElementById('placa').value = 'uno';
  const ws = espacio;
  const vLocal = ws.getVariableMap().createVariable('pasos', 'int');
  const defA = Blockly.serialization.blocks.append({ type: 'fn_def', x: 500, y: 20,
    fields: { NAME: 'parpadear', TIPO: 'void', NPARAM: '2', P0N: 'pin', P0T: 'int', P1N: 'veces', P1T: 'int' },
    inputs: { BODY: { block: { type: 'bucle_para', fields: { VAR: { id: vLocal.getId() } },
      inputs: { DESDE: { block: { type: 'math_number', fields: { NUM: 1 } } }, HASTA: { block: { type: 'fn_param', fields: { P: 'veces' } } }, PASO: { block: { type: 'math_number', fields: { NUM: 1 } } },
        DO: { block: { type: 'cpp_linea', fields: { CODE: 'digitalWrite(pin, HIGH);\ndelay(200);\ndigitalWrite(pin, LOW);\ndelay(200);' } } } } } } } }, ws);
  const defB = Blockly.serialization.blocks.append({ type: 'fn_def', x: 500, y: 300,
    fields: { NAME: 'señal_lista', TIPO: 'float', NPARAM: '0' },
    inputs: { BODY: { block: { type: 'fn_call', extraState: { nombre: 'parpadear', tipo: 'void', params: [{ nombre: 'pin', tipo: 'int' }, { nombre: 'veces', tipo: 'int' }] },
      inputs: { ARG0: { block: { type: 'math_number', fields: { NUM: 13 } } }, ARG1: { block: { type: 'math_number', fields: { NUM: 3 } } } } } },
      RETURN: { block: { type: 'math_number', fields: { NUM: 1.5 } } } } }, ws);
  guardarEnMisBloques(defB);
  const lib = Object.keys(leerLibreria());
  // 2) Proyecto nuevo que solo usa la llamada de la librería
  nuevoProyecto();
  const prog = ws.getBlocksByType('programa')[0];
  const imp = Blockly.serialization.blocks.append({ type: 'serial_imprimir', inputs: { V: { block: itemLlamadaBloque('señal_lista') } } }, ws);
  prog.getInput('LOOP').connection.connect(imp.previousConnection);
  actualizar();
  const proyecto = proyectoActual();
  const codigo1 = ultimo.codigo;
  // 3) Borrar la librería y abrir el proyecto guardado: debe funcionar con la copia embebida
  escribirLibreria({});
  cargarProyecto(JSON.parse(JSON.stringify(proyecto)), true);
  actualizar();
  return { lib, embebidos: Object.keys(proyecto.embebidos), codigo: ultimo.codigo, igual: ultimo.codigo === codigo1, avisos: ultimo.avisos.map(a => a.msg) };
}"""

JS_PINES = r"""() => {
  // Pines con nombre (#define): uso en varios bloques, mezcla de número y nombre, y paso a un bloque propio
  nuevoProyecto();
  placaActual = 'uno'; document.getElementById('placa').value = 'uno';
  const ws = espacio;
  const n = (v) => ({ block: { type: 'math_number', fields: { NUM: v } } });
  const nombre = (pin, nom, y) => Blockly.serialization.blocks.append({ type: 'pin_nombre', x: 600, y, fields: { PIN: pin, NOMBRE: nom } }, ws);
  nombre('13', 'LedRojo', 20); nombre('2', 'Boton', 60); nombre('10', 'Pinza', 100); nombre('A0', 'Clima', 140); nombre('9', 'LedAzul', 180);
  Blockly.serialization.blocks.append({ type: 'fn_def', x: 600, y: 260,
    fields: { NAME: 'parpadear', TIPO: 'void', NPARAM: '1', P0N: 'pin', P0T: 'int' },
    inputs: { BODY: { block: { type: 'cpp_linea', fields: { CODE: 'digitalWrite(pin, HIGH);\ndelay(100);\ndigitalWrite(pin, LOW);' } } } } }, ws);
  const prog = ws.getBlocksByType('programa')[0];
  const loop = Blockly.serialization.blocks.append({ type: 'controls_if',
    inputs: { IF0: { block: { type: 'leer_digital', fields: { PIN: 'Boton' } } },
      DO0: { block: { type: 'escribir_digital', fields: { PIN: 'LedRojo', EST: 'HIGH' },
        next: { block: { type: 'escribir_digital', fields: { PIN: '13', EST: 'LOW' },
        next: { block: { type: 'servo_mover', fields: { PIN: 'Pinza' }, inputs: { A: n(90) },
        next: { block: { type: 'escribir_pwm', fields: { PIN: 'LedAzul' }, inputs: { V: n(128) },
        next: { block: { type: 'fn_call', extraState: { nombre: 'parpadear', tipo: 'void', params: [{ nombre: 'pin', tipo: 'int' }] },
          inputs: { ARG0: { block: { type: 'pin_valor', fields: { PIN: 'LedRojo' } } } },
        next: { block: { type: 'serial_imprimir', inputs: { V: { block: { type: 'dht_leer', fields: { PIN: 'Clima', T: 'DHT11', M: 'C' } } } } } } } } } } } } } } } } } }, ws);
  prog.getInput('LOOP').connection.connect(loop.previousConnection);
  actualizar();
  const opciones = ws.getBlocksByType('escribir_digital')[0].getField('PIN').getOptions().slice(0, 6).map(o => o[0]);
  return { codigo: ultimo.codigo, avisos: ultimo.avisos.map(a => a.msg), opciones };
}"""

JS_LISTAS = r"""() => {
  // Listas y matrices: melodía con "para cada", listas de varios tipos (con pines con nombre) y una coreografía en matriz
  nuevoProyecto(); ponerNivel(3);
  placaActual = 'uno'; document.getElementById('placa').value = 'uno';
  const ws = espacio, vm = ws.getVariableMap();
  const vNota = vm.createVariable('nota', 'int'), vMsg = vm.createVariable('mensaje', 'String'), vF = vm.createVariable('f', 'int');
  const n = (v) => ({ block: { type: 'math_number', fields: { NUM: v } } });
  const suelto = (json, y) => Blockly.serialization.blocks.append(Object.assign({ x: 700, y }, json), ws);
  suelto({ type: 'pin_nombre', fields: { PIN: '13', NOMBRE: 'LedRojo' } }, 10);
  suelto({ type: 'pin_nombre', fields: { PIN: '12', NOMBRE: 'LedVerde' } }, 50);
  suelto({ type: 'lista_crear', fields: { NAME: 'leds', TIPO: 'int', VALORES: 'LedRojo, LedVerde, A0' } }, 90);
  suelto({ type: 'lista_crear', fields: { NAME: 'melodia', TIPO: 'int', VALORES: '262, 294, 330, 349, 392' } }, 150);
  suelto({ type: 'lista_crear', fields: { NAME: 'mensajes', TIPO: 'String', VALORES: 'Hola, Adiós' } }, 210);
  suelto({ type: 'lista_crear', fields: { NAME: 'comandos', TIPO: 'char', VALORES: 'A, S, D' } }, 270);
  suelto({ type: 'lista_crear', fields: { NAME: 'encendidos', TIPO: 'bool', VALORES: 'verdadero, falso, sí' } }, 330);
  suelto({ type: 'lista_vacia', fields: { NAME: 'lecturas', TIPO: 'float', N: 5 } }, 390);
  suelto({ type: 'matriz_crear', fields: { NAME: 'baile', TIPO: 'int', F: 3, C: 4, DATOS: '[[90,90,90,90],[60,120,90,90],[90,90,60,120]]' } }, 450);
  const prog = ws.getBlocksByType('programa')[0];
  const cadena = (...bs) => bs.reduceRight((sig, b) => (sig ? Object.assign({}, b, { next: { block: sig } }) : b), null);
  const vg = (v) => ({ block: { type: 'var_get', fields: { VAR: { id: v.getId() } } } });
  const imprimir = (v) => ({ type: 'serial_imprimir', inputs: { V: v } });
  const loop = Blockly.serialization.blocks.append(cadena(
    { type: 'lista_para_cada', fields: { VAR: { id: vNota.getId() }, LISTA: 'melodia' }, inputs: { DO: { block: cadena(
      { type: 'tono', fields: { PIN: '8' }, inputs: { F: vg(vNota), D: n(200) } },
      { type: 'esperar', inputs: { MS: n(250) } }) } } },
    { type: 'lista_poner', fields: { LISTA: 'lecturas' }, inputs: { I: n(0), V: { block: { type: 'leer_analogo', fields: { PIN: 'A0' } } } } },
    { type: 'lista_para_cada', fields: { VAR: { id: vMsg.getId() }, LISTA: 'mensajes' }, inputs: { DO: { block: imprimir(vg(vMsg)) } } },
    { type: 'bucle_para', fields: { VAR: { id: vF.getId() } }, inputs: {
      DESDE: n(0), PASO: n(1),
      HASTA: { block: { type: 'math_arithmetic', fields: { OP: 'MINUS' }, inputs: { A: { block: { type: 'matriz_tamano', fields: { Q: 'filas', M: 'baile' } } }, B: n(1) } } },
      DO: { block: imprimir({ block: { type: 'matriz_elemento', fields: { M: 'baile' }, inputs: { F: vg(vF), C: n(3) } } }) } } },
    { type: 'matriz_poner', fields: { M: 'baile' }, inputs: { F: n(2), C: n(3), V: n(45) } },
    imprimir({ block: { type: 'lista_elemento', fields: { LISTA: 'comandos' }, inputs: { I: n(2) } } })
  ), ws);
  prog.getInput('LOOP').connection.connect(loop.previousConnection);
  actualizar();
  const r = { codigo: ultimo.codigo, avisos: ultimo.avisos.map(a => a.msg) };
  // Guardar y reabrir conserva la matriz
  const proy = JSON.parse(JSON.stringify(proyectoActual()));
  cargarProyecto(proy, true); actualizar();
  r.igualTrasAbrir = ultimo.codigo === r.codigo;
  // Errores: posición fuera de rango, lista inexistente, valor que no es del tipo, nombre repetido con una variable
  nuevoProyecto();
  vm.createVariable('notas', 'int');
  suelto({ type: 'lista_crear', fields: { NAME: 'notas', TIPO: 'int', VALORES: '1, hola, 3' } }, 10);
  suelto({ type: 'matriz_crear', fields: { NAME: 'm', TIPO: 'int', F: 2, C: 2, DATOS: '[[1,2],[3,4]]' } }, 80);
  const b = Blockly.serialization.blocks.append({ type: 'serial_imprimir', inputs: { V: { block: { type: 'lista_elemento', fields: { LISTA: 'notas' }, inputs: { I: n(3) } } } },
    next: { block: { type: 'serial_imprimir', inputs: { V: { block: { type: 'lista_elemento', fields: { LISTA: 'fantasma' }, inputs: { I: n(0) } } } },
    next: { block: { type: 'matriz_poner', fields: { M: 'm' }, inputs: { F: n(0), C: n(2), V: n(1) } } } } } }, ws);
  ws.getBlocksByType('programa')[0].getInput('LOOP').connection.connect(b.previousConnection);
  actualizar();
  r.avisosError = ultimo.avisos.map(a => a.msg);
  return r;
}"""

with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={'width': 1400, 'height': 860})
    errores = []
    pag.on('console', lambda m: errores.append(f'{m.type}: {m.text}') if m.type in ('error',) and 'ERR_' not in m.text else None)
    pag.on('pageerror', lambda e: errores.append(f'pageerror: {e} {e.stack[:900]}'))
    pag.goto((RAIZ / 'dist' / 'TecnoBloques.html').as_uri())
    pag.wait_for_timeout(1000)
    pag.evaluate("""() => { window.itemLlamadaBloque = (n) => { const f = firmaDeDef(leerLibreria()[n]); const it = itemLlamada(f); delete it.kind; return it; }; }""")
    sin_nivel = pag.evaluate("() => { const t = []; TOOLBOX.contents.forEach(c => (c.contents || []).forEach(i => i.kind === 'block' && !(i.type in NIVEL_BLOQUE) && t.push(i.type))); return t; }")
    print('Bloques sin nivel asignado (debe estar vacío):', sin_nivel)
    for placa in ['uno', 'mega']:
        r = pag.evaluate(JS_TODO, placa)
        d = SALIDA / f'todo_{placa}'; d.mkdir(exist_ok=True)
        (d / f'todo_{placa}.ino').write_text(r['codigo'], encoding='utf-8')
        print(placa, 'omitidos:', r['omitidos'])
        print(' avisos:', *r['avisos'], sep='\n  ')
    pag.screenshot(path=str(SALIDA / 'todo.png'))
    r = pag.evaluate(JS_MIS)
    d = SALIDA / 'misbloques'; d.mkdir(exist_ok=True)
    (d / 'misbloques.ino').write_text(r['codigo'], encoding='utf-8')
    print('MIS BLOQUES lib:', r['lib'], 'embebidos:', r['embebidos'], 'mismo codigo tras reabrir:', r['igual'])
    print(' avisos:', r['avisos'])
    r = pag.evaluate(JS_PINES)
    d = SALIDA / 'pines'; d.mkdir(exist_ok=True)
    (d / 'pines.ino').write_text(r['codigo'], encoding='utf-8')
    print('PINES opciones:', r['opciones'])
    print(' avisos:', r['avisos'])
    # Renombrar un pin cambia los bloques que lo usan; deshacer lo devuelve
    pag.evaluate("() => espacio.getBlocksByType('pin_nombre').find(b => b.getFieldValue('NOMBRE') === 'LedRojo').getField('NOMBRE').setValue('LedVerde')")
    pag.wait_for_timeout(300)
    tras = pag.evaluate("() => espacio.getBlocksByType('escribir_digital').map(b => b.getFieldValue('PIN'))")
    pag.evaluate("() => espacio.undo(false)")
    pag.wait_for_timeout(300)
    deshecho = pag.evaluate("() => [espacio.getBlocksByType('escribir_digital').map(b => b.getFieldValue('PIN')), espacio.getBlocksByType('pin_nombre').map(b => b.getFieldValue('NOMBRE'))]")
    print(' renombrar LedRojo->LedVerde:', tras, '| deshacer:', deshecho)
    r = pag.evaluate(JS_LISTAS)
    d = SALIDA / 'listas'; d.mkdir(exist_ok=True)
    (d / 'listas.ino').write_text(r['codigo'], encoding='utf-8')
    print('LISTAS avisos:', r['avisos'], '| igual tras reabrir:', r['igualTrasAbrir'])
    print(' avisos de error:', *r['avisosError'], sep='\n   ')
    print('ERRORES:', *errores, sep='\n')
    nav.close()
