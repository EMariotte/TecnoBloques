# BITACORA — TecnoBloques

> Historial cronológico del proyecto. Append-only: nunca editar ni borrar
> entradas pasadas. El estado *actual* vive en `CLAUDE.md`.

---

## 2026-09-26 — Sesión de arranque: viabilidad, alcance y prototipo v0.1

**Contexto:** Efraín preguntó qué tan viable era construir para la TecnoAcademia
un editor web de bloques tipo MakeCode para Arduino. La idea era generar el código
desde los bloques y subirlo eligiendo el puerto, sin simulador, tomando como
referencia Ottoblockly y Visualino, y con bloques para las librerías más usadas
de la TecnoAcademia.

**Viabilidad (conclusión):** Es viable. Los bloques son la parte fácil con Blockly
(Apache 2.0). Lo delicado es compilar, porque el navegador no puede correr avr-gcc.
Se eligió como ruta un servidor de compilación en la red local (arduino-cli en
Docker) más la carga desde el navegador por Web Serial (STK500). Los planes B son
un agente local o una app Electron. Web Serial solo funciona en Chrome/Edge de
escritorio y requiere HTTPS o localhost.

**Decisiones tomadas con Efraín:**

- Placas: solo Arduino Uno, Nano y Mega. Hoy hay **Uno R3**; se esperan **Uno R4** en
  próximas compras. Primero AVR, con la arquitectura preparada para R4 (perfiles
  de placa y cargadores intercambiables).
- Librerías: **AFMotor_R4** (shield L293D), **DHT11** (Adafruit), **LCD 16x2 I2C**
  (OLED el próximo año), **monitor serial** y **Bluetooth**. Se sumó la librería
  **Otto**, porque hay muchos robots Otto, sobre todo el **Otto humanoide**.
- **Funciones** con parámetros tipados y **bloques propios** que los aprendices
  crean y reutilizan en otros programas llamándolos por su nombre, **de forma local**
  (nivel 1). Diseñador de bloques para instructores y catálogo compartido quedan
  para después.
- **Bloque de C++ libre**, **monitor serial que sí envía** (falla de Ottoblockly),
  **vista del C++ en vivo** y botón para pasar a C++ y volver a los bloques.

**Entregables de esta sesión:**

- Prototipo v0.1 funcionando: `src/` (núcleo, bloques, interfaz), `build.js`,
  `dist/TecnoBloques.html` y un artefacto publicado en Claude para verlo.
- 3 ejemplos: Carro Bluetooth (Uno), Otto humanoide esquiva (Nano), Eco serial y LED (Uno).
- Pruebas con Playwright y compilación real con las librerías: todo compila en
  uno, nano, nano (old) y mega2560.
- Hallazgo y corrección: `BACKWARD` vale -1 en Otto.h y 2 en AFMotor_R4.h. Con
  ambas librerías los motores habrían girado al revés sin avisar. Se resolvió con
  `#undef` y un literal en los bloques de Otto.
- Hallazgo: OttoDIYLib v13 no trae brazos para el humanoide. Se manejan con dos
  Servo aparte.
- Repositorio organizado para GitHub con `CLAUDE.md`, `BITACORA.md`, `ABOUTME.md` y `README.md`.

**Pendiente (antes de la fase 2):**

- Probar el monitor serial (recibir y enviar) con una placa real y clones CH340.
- Validar pines y ángulos de los brazos del Otto humanoide y el sentido de los motores del carro.
- Elegir la licencia del repositorio y si se publica en GitHub Pages.
- Definir en qué equipo corre el servidor de compilación.

---

## 2026-10-05 — Decisiones: app de escritorio + web para casa, niveles y nombres de pines

**Contexto:** Se revisó el proyecto desde lo pedagógico. La conclusión fue que lo
que más motiva es el ciclo corto "armo → subo → el robot se mueve", y hoy el
aprendiz no puede subir su programa sin el Arduino IDE.

**Decisiones:**

- **Dos entregas desde el mismo código.** En el aula, una app de escritorio con
  arduino-cli, el núcleo AVR y las librerías embebidos. Trae instalador para
  Windows con drivers CH340 (hay permisos de administrador) y se actualiza sola
  desde GitHub Releases. En casa, una página web sin compilador ni servidor para
  seguir programando: guardar el proyecto o descargar el .ino. Los retos se
  enlazan más adelante.
- **Se descarta el servidor de compilación en la red local** y el cargador
  STK500 en JavaScript. El R4 también se cargará con arduino-cli.
- **Niveles de bloques** que se desbloquean según el nivel del aprendiz.
- **Bloque para nombrar pines** (`#define LedRojo 13`), con los nombres visibles
  en los menús de pines.
- **Bloques de más librerías.** La lista está pendiente.

**Orden propuesto:** app con botón "Subir" → nombres de pines y niveles → librerías nuevas → web para casa y retos.

## 2026-10-05 — Niveles, librerías, Electron, licencia y repositorio en GitHub

**Decisiones:**

- **Niveles:** selector 1 · 2 · 3 en la barra superior. Cada usuario elige su
  nivel y en clase el instructor indica el nivel de cada reto.
- **Librerías nuevas:** MPU6050, Wire.h (I2C genérico) y Adafruit_PWMServoDriver
  (PCA9685). La LCD I2C 16x2/20x4 ya existía; falta aclarar qué se agrega ahí.
- **App de escritorio:** Electron.
- **Licencia:** Apache 2.0, igual que Blockly. Titular: SENA – TecnoAcademia Tolima.
  Autor: Efraín Guillermo Mariotte Parra. Se creó `NOTICE`. Hay que confirmar la
  titularidad con la coordinación SENNOVA.
- **Repositorio público** en GitHub (`EMariotte/TecnoBloques`), necesario para
  la actualización automática sin tokens.
