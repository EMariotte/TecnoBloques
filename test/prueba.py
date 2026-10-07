"""Carga el editor, recorre los ejemplos y guarda el C++ generado para compilarlo."""
import json, sys, pathlib
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'test' / 'salida'
SALIDA.mkdir(exist_ok=True)


def guardar(pag, ruta_ino, codigo):
    """Guarda el .ino y, al lado, el proyecto .tbq.json tal como lo guarda el editor (fixtures de TecnoCircuito)."""
    ruta_ino.write_text(codigo, encoding='utf-8')
    proyecto = pag.evaluate("() => JSON.stringify(proyectoActual(), null, 1)")
    ruta_ino.with_suffix('.tbq.json').write_text(proyecto, encoding='utf-8')

with sync_playwright() as p:
    nav = p.chromium.launch()
    pag = nav.new_page(viewport={'width': 1400, 'height': 860})
    errores = []
    pag.on('console', lambda m: errores.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pag.on('pageerror', lambda e: errores.append(f'pageerror: {e}'))
    pag.goto((RAIZ / 'dist' / 'TecnoBloques.html').as_uri())
    pag.wait_for_timeout(1200)
    resultados = {}
    for idx in range(3):
        info = pag.evaluate(f"""() => {{
            const ej = EJEMPLOS[{idx}];
            cargarEjemplo(ej);
            actualizar();
            return {{ id: ej.id, placa: placaActual, codigo: ultimo.codigo, avisos: ultimo.avisos.map(a => a.msg) }};
        }}""")
        resultados[info['id']] = info
        (SALIDA / info['id']).mkdir(exist_ok=True)
        guardar(pag, SALIDA / info['id'] / (info['id'] + '.ino'), info['codigo'])
        pag.wait_for_timeout(300)
        pag.screenshot(path=str(SALIDA / f"{info['id']}.png"))
    # Otras placas para el ejemplo del carro
    for placa in ['mega', 'nano_old']:
        info = pag.evaluate(f"""() => {{
            cargarEjemplo(EJEMPLOS[0]);
            placaActual = '{placa}'; document.getElementById('placa').value = '{placa}';
            actualizar();
            return {{ codigo: ultimo.codigo, avisos: ultimo.avisos.map(a => a.msg) }};
        }}""")
        nombre = 'carro_' + placa
        (SALIDA / nombre).mkdir(exist_ok=True)
        guardar(pag, SALIDA / nombre / (nombre + '.ino'), info['codigo'])
        resultados[nombre] = {'placa': placa, 'avisos': info['avisos']}
    json.dump({k: {'placa': v.get('placa'), 'avisos': v['avisos']} for k, v in resultados.items()}, sys.stdout, indent=1, ensure_ascii=False)
    print('\nERRORES:', *errores, sep='\n')
    nav.close()
