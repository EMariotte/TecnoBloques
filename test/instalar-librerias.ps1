# Instala en arduino-cli el núcleo AVR y las librerías que usa TecnoBloques.
# Ejecutar en PowerShell desde la carpeta del proyecto: .\test\instalar-librerias.ps1

arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli lib install "DHT sensor library" "Adafruit Unified Sensor" "LiquidCrystal I2C" "Servo"

# AFMotor_R4 y OttoDIYLib se instalan desde GitHub (requiere permitir instalaciones por git)
arduino-cli config set library.enable_unsafe_install true
arduino-cli lib install --git-url https://github.com/PhoenixSmaug/AFMotor-Shield-R4-Compatible.git
arduino-cli lib install --git-url https://github.com/OttoDIY/OttoDIYLib.git
