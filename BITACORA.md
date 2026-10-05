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

## 2026-10-05 — Pantalla LCD ampliada y primera compilación en Windows

**Hecho:**

- **Bloques nuevos de la LCD:**
  - escribir donde está el cursor
  - mover el cursor
  - borrar una fila
  - **crear símbolo**, con un editor de 5x8 puntos que se pinta tocando o arrastrando, botones Borrar e Invertir y 8 dibujos listos (corazón, carita, grado, flecha, nota, batería, campana, persona)
  - mostrar un símbolo
  - correr el texto a la izquierda o a la derecha
  - ocultar o mostrar el texto
  - tipo de cursor
- **Avisos nuevos:** más de 8 símbolos, un símbolo que no existe y una columna o fila que no cabe en 16x2 o 20x4.
- **Hallazgo:** la librería no permite regular el brillo, solo encender o apagar la luz. El contraste se ajusta con el potenciómetro del módulo. Se explica en la ayuda del bloque.
- **Primera compilación real en Windows**, con el arduino-cli que trae el Arduino IDE 2: los 8 programas de prueba compilan. `test/compilar.js` ahora encuentra ese arduino-cli solo. Las pruebas guardan los .ino en UTF-8.

## 2026-10-05 — Nombres de pines (#define)

**Hecho:**

- **Bloque "el pin [13] se llama [LedRojo]"** que genera `#define LedRojo 13`. Los nombres aparecen primero en todos los menús de pines como "LedRojo (13)", y el C++ usa el nombre. Si se cambia el número en ese bloque, cambia en todo el programa. Si se renombra, los bloques que lo usan se actualizan solos y deshacer lo revierte.
- **Bloque de valor "pin [LedRojo]"** para pasar pines a los bloques propios, por ejemplo `parpadear(LedRojo)`.
- **Revisión de choques:** sigue usando el número real y los avisos muestran el nombre y el número, como "LedAzul (9)". Los objetos se nombran por el pin: `servo_Pinza` y `dht_Clima`.
- **Avisos:** nombre repetido, pin inexistente, nombre no definido y nombre igual a una variable.
- **Prueba fija nueva `pines`** en `test/prueba_todo.py` y `test/compilar.js`. Los 9 programas compilan.
- **Falla vieja corregida:** si un bloque de C++ libre se borraba justo después de cambiar su texto (por ejemplo, con "Nuevo"), el redibujo diferido fallaba con `FIELD_TEXT_BASELINE_CENTER`.

## 2026-10-05 — Niveles 1 Explorador · 2 Constructor · 3 Inventor

**Decisiones con Efraín:** se aceptan los nombres de los niveles. En el nivel 1 no hay variables y del monitor serial solo está "imprimir"; el resto del monitor llega en el nivel 2.

**Hecho:**

- **Selector 1 · 2 · 3** en la barra superior. El botón activo muestra el nombre del nivel.
- **Cuántos bloques ve cada nivel:**
  - 1 Explorador: 31 bloques en 13 categorías.
  - 2 Constructor: 65 bloques en 16 categorías.
  - 3 Inventor: 85 bloques en 17 categorías.
  - Los conteos incluyen los bloques que aparecen en dos categorías.
- **Dentro de los bloques:** en el nivel 2, "definir bloque" no tiene parámetros ni retorno, y las variables usan nombres de aprendiz.
- **El proyecto guarda su nivel** y al abrirlo se cambia solo. Un nivel nunca borra bloques: si el programa usa bloques de un nivel más alto, aparece una nota.
- **Vista inicial:** el nivel 1 abre en "Bloques" y el botón "Editar C++" solo está en el nivel 3. La primera vez se abre un proyecto vacío en el nivel 1, en vez del ejemplo del carro.
- **Hallazgo:** el carro Bluetooth (proyecto estrella del nivel 2) necesita una variable de tipo carácter para los comandos. Se agregó "letra (para comandos)" a los tipos del nivel 2. El ejemplo "Carro Bluetooth" queda en nivel 3 porque usa un bloque propio con parámetros.
- **Pruebas:** `npm test` revisa que todo bloque de la caja tenga nivel. `test/ui.py` captura los niveles 1 y 2.

## 2026-10-05 — Fase 2: app de escritorio (Electron + arduino-cli)

**Hecho:**

- **Carpeta `escritorio/`:** Electron 44.5.1 abre el mismo `dist/TecnoBloques.html`. Un puente seguro (`window.tbEscritorio`) da acceso a arduino-cli, sin abrir Node a la página.
- **Selector de puerto:** detecta las placas con `arduino-cli board list` cada 3 s, pone primero las USB y reconoce los clones CH340 por su VID.
- **"Subir a la placa":**
  1. avisa si la placa conectada no es la elegida;
  2. cierra el monitor serial si estaba conectado;
  3. compila con caché (≈7 s la primera vez, ≈3 s después) y sube;
  4. muestra el % de memoria y vuelve a abrir el monitor.
- **Errores explicados en español:** librería faltante, programa muy grande, error de C++ (con número de línea y el texto de esa línea), puerto ocupado o inexistente, y placa que no responde.
- **Monitor serial en la app:** sigue usando Web Serial. La app elige sola el puerto del selector.
- **Paquete de Arduino (`npm run preparar-arduino`):** arduino-cli 1.5.1, núcleo AVR 1.8.8 y las 6 librerías del aula, unos 310 MB. Se quitó el índice de librerías (57 MB), que no hace falta para compilar ni subir.
- **Instalador NSIS** de un clic, por usuario y en español: `TecnoBloques-Setup-0.2.0.exe`, de 175 MB. Ofrece el driver CH340 en la primera instalación si se pone `CH341SER.EXE` en `escritorio/recursos/drivers`. Trae actualización automática con electron-updater desde GitHub Releases. La versión subió a 0.2.0.
- **Versión web (casa):** "Subir a la placa" explica cómo seguir: guardar el proyecto para el aula o usar Arduino IDE.
- **Pruebas:** `test/app.js` y `test/app-empaquetada.js` abren la app con Playwright, compilan y revisan los mensajes de error. Todo pasa.

**Hallazgos:**

- La extensión de VS Code deja puesta `ELECTRON_RUN_AS_NODE=1`, y con ella Electron arranca como Node sin ventana.
- Dentro del proyecto, Windows bloquea el empaquetado (EPERM), así que el instalador se arma en `%LOCALAPPDATA%\TecnoBloques-build`.
- El instalador no está firmado y SmartScreen avisa la primera vez.

**Pendiente:** subir a placas reales, conseguir CH341SER.EXE, publicar el Release v0.2.0 y ligar los errores al bloque que los causa.

**Nota (Efraín, mismo día):** ya está `CH341SER.EXE` en `escritorio/recursos/drivers/`. La prueba con placas reales pasa a la próxima sesión, en el ambiente donde están todas las placas. **No se publica el Release v0.2.0** hasta probarla.
