; TecnoBloques - paso extra del instalador (NSIS, lo incluye electron-builder)
; Ofrece instalar el driver CH340 de las placas clon, solo en la primera instalacion
; (no en las actualizaciones automaticas) y solo si el instalador trae CH341SER.EXE.
; Texto sin tildes: NSIS no siempre lee bien los acentos de este archivo.

!macro customInstall
  ${ifNot} ${isUpdated}
    IfFileExists "$INSTDIR\resources\drivers\CH341SER.EXE" 0 tb_sin_driver
      MessageBox MB_YESNO|MB_ICONQUESTION "Instalar el driver CH340?$\r$\n$\r$\nLo necesitan las placas clon (Uno o Nano con chip CH340) para aparecer como puerto COM.$\r$\nSi ya esta instalado, puedes responder No." IDNO tb_sin_driver
      ; "open" pasa por ShellExecute: Windows pide permiso de administrador si el driver lo necesita
      ExecShellWait "open" "$INSTDIR\resources\drivers\CH341SER.EXE"
    tb_sin_driver:
  ${endIf}
!macroend
