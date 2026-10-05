# Driver CH340 para el instalador

Las placas clon (Uno o Nano con chip CH340) necesitan este driver para aparecer como puerto COM.
Windows 10 y 11 casi siempre lo instalan solos desde Windows Update cuando hay internet; el
instalador de TecnoBloques lo ofrece para los PC sin internet o donde no se instaló.

1. Descarga **CH341SER.EXE** de la página oficial de WCH, el fabricante del chip:
   https://www.wch-ic.com/downloads/CH341SER_EXE.html
2. Guárdalo en esta carpeta con ese nombre exacto: `escritorio/recursos/drivers/CH341SER.EXE`.
3. Arma el instalador (`npm run instalador`). Si el archivo no está, el instalador simplemente
   no ofrece el driver.

El `.EXE` no se sube al repositorio (está en `.gitignore`): es de WCH y tiene su propia licencia.
