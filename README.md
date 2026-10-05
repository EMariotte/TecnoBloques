# TecnoBloques

Editor web de **programación por bloques en español para Arduino**, hecho en la
TecnoAcademia Tolima (SENA). Arma el programa con bloques, mira el C++ que se
genera en vivo y ábrelo en tu placa. Funciona con **Arduino Uno R3, Nano y Mega 2560**.

![Editor en vista dividida](docs/capturas/editor-claro.png)

## Qué trae

- **Bloques de la TecnoAcademia:**
  - Shield de motores L293D (AFMotor_R4)
  - Sensor DHT11/DHT22
  - Pantalla LCD 16x2 o 20x4 por I2C, con **símbolos propios** que se dibujan con el mouse
  - Monitor serial
  - Bluetooth HC-05/HC-06
  - Servos
  - Ultrasonido HC-SR04
  - **Otto humanoide** (caminar, bailar, gestos, sonidos y brazos)
- **Nombres para los pines:** "el pin 13 se llama LedRojo" (`#define`). Luego eliges LedRojo en cualquier menú de pines.
- **Variables con tipo** (entero, decimal, texto, carácter…) y **funciones propias** con parámetros y valor de retorno.
- **Mis bloques:** guarda tus funciones y úsalas en cualquier otro programa. Se pueden exportar e importar como archivo.
- **C++ libre:** mezcla bloques con líneas de código escritas a mano.
- **Vista dividida:** el C++ se actualiza con cada bloque. También puedes editar el C++ directamente.
- **Avisos de pines:** te dice cuando dos cosas usan el mismo pin o cuando un pin no sirve para lo que pides.
- **Monitor serial** que recibe y **envía** mensajes a la placa (Web Serial).
- Proyectos que se guardan en un archivo `.tbq.json` y ejemplos listos.

![Bloques de Otto humanoide](docs/capturas/bloques-otto.png)

## Usarlo

1. `npm install` y luego `npm run build`.
2. Abre `dist/TecnoBloques.html` en **Chrome o Edge** de computador. Funciona sin internet.
3. Para subir el programa, por ahora: **Copiar** o **Descargar .ino** y abrirlo en Arduino IDE.
   La carga con un botón llega en la fase 2, con la app de escritorio para el aula.

> Web Serial (monitor y, más adelante, la carga) no funciona en Firefox, Safari ni celulares.

## Desarrollo

```powershell
npm install
npm run build          # genera dist/TecnoBloques.html
pip install -r test/requirements.txt
python -m playwright install chromium
npm test               # genera el C++ de los ejemplos y de todos los bloques
npm run compilar       # compila ese C++ con arduino-cli (ver test/instalar-librerias.ps1)
```

La documentación técnica completa está en [`CLAUDE.md`](CLAUDE.md): arquitectura, cómo agregar
bloques o placas, decisiones y hoja de ruta. El historial del proyecto está en [`BITACORA.md`](BITACORA.md).

## Hoja de ruta

- [x] **Fase 1:** editor, generador C++, funciones, Mis bloques, C++ libre, monitor serial
- [ ] **Fase 2:** app de escritorio (Electron + arduino-cli) que compila y sube con un botón, con instalador, drivers CH340 y actualización automática
- [ ] **Niveles 1 · 2 · 3** de bloques y nombres para los pines (`#define LedRojo 13`)
- [ ] **Librerías nuevas:** MPU6050, PCA9685 (Adafruit_PWMServoDriver) e I2C
- [ ] **Fase 3:** Arduino Uno R4
- [ ] **Fase 4:** pantallas OLED
- [ ] **Fase 5:** diseñador de bloques para instructores

## Créditos

Hecho con [Blockly](https://developers.google.com/blockly) (Apache 2.0). Los bloques de Otto
generan código para [OttoDIYLib](https://github.com/OttoDIY/OttoDIYLib). Los de motores
generan código para [AFMotor R4 Compatible](https://github.com/PhoenixSmaug/AFMotor-Shield-R4-Compatible).

Efraín Guillermo Mariotte Parra — Facilitador de Robótica, TecnoAcademia Tolima (SENA).

## Licencia

[Apache 2.0](LICENSE). © 2026 SENA – TecnoAcademia Tolima. Ver [`NOTICE`](NOTICE).
