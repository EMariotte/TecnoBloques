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

with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={'width': 1400, 'height': 860})
    errores = []
    pag.on('console', lambda m: errores.append(f'{m.type}: {m.text}') if m.type in ('error',) and 'ERR_' not in m.text else None)
    pag.on('pageerror', lambda e: errores.append(f'pageerror: {e}'))
    pag.goto((RAIZ / 'dist' / 'TecnoBloques.html').as_uri())
    pag.wait_for_timeout(1000)
    pag.evaluate("""() => { window.itemLlamadaBloque = (n) => { const f = firmaDeDef(leerLibreria()[n]); const it = itemLlamada(f); delete it.kind; return it; }; }""")
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
    print('ERRORES:', *errores, sep='\n')
    nav.close()
