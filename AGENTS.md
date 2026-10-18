# AGENTS.md — TecnoBloques

## Piloto permanente de desarrollo y supervisión

Por pedido de Efraín (17 oct 2026), todo el trabajo de TecnoBloques y TecnoCircuito sigue el [proceso común v2 de TecnoSuite](../TecnoSuite/PROCESO.md). Complementa las reglas técnicas y decisiones de [CLAUDE.md](CLAUDE.md) y el contrato del simulador. Efraín conserva prioridades y reasignaciones.

1. Al iniciar lee este archivo, el estado técnico de CLAUDE.md, proceso común, [tablero/ficha activa](../TecnoSuite/TABLERO.md) y entradas nuevas de [Codex para Claude](../TecnoSuite/canales/CODEX-A-CLAUDE.md) y [Claude para Codex](../TecnoSuite/canales/CLAUDE-A-CODEX.md). Acusa recibo solo por ti mismo; consulta también COD-20261017-001 enlazado desde el canal nuevo.
2. Comprueba `git status --short`, HEAD/rama, trabajo existente, rol y tarea autorizada. Declara archivos reservados antes de editar; verifica que no cambiaron desde la lectura. No escribas simultáneamente el mismo archivo ni cambies ramas bajo otra sesión.
3. Claude es el único implementador y programador (roles permanentes, Efraín, 18 oct) y entrega regresiones/evidencia; Codex audita, supervisa y verifica, sin implementar código de producto. Codex mantiene el [registro e investigación del piloto](../TecnoSuite/INVESTIGACION.md). No atribuyas a Claude las acciones de subagentes de Codex.
4. **Ambos deben advertirle a Efraín si falta un paso necesario**, con evidencia, consecuencia y solución. Completa lo autorizado sin pedir permisos repetidos y continúa lo independiente ante dependencias reales. Respeta excepciones expresas; no inventes resultados.
5. El estado operativo se edita en fichas; el tablero se genera. El estado técnico sigue en CLAUDE.md y la historia se añade a BITACORA.md, sin reescribirla. No copies toda la cola aquí. Entrega revisión exacta, diff, archivos nuevos/cambiados y resultados; HEAD solo no identifica un árbol sucio.
6. Publicado no significa leído; corregido no significa verificado; software no valida hardware. Los .md no ejecutan ni notifican automáticamente a Claude Code en VS Code. Si falta el hermano o TecnoSuite, declara la limitación y continúa lo independiente.
7. Los archivos nuevos sin commit no aparecen en clones/worktrees desde HEAD: prepara instrucciones mediante copia controlada/hash o commit autorizado antes de trabajar allí. Serializa suites que compartan artefactos o midan velocidad.
8. Usa casos sintéticos. No copies datos de aprendices, registros, alias, investigación privada o credenciales a documentos públicos. Commit, push, etiquetas y publicación requieren autorización expresa vigente de Efraín.
