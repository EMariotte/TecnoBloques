; TecnoBloques - paso extra del instalador (NSIS, lo incluye electron-builder)
; Ofrece instalar el driver CH340 de las placas clon, solo en la primera instalacion
; (no en las actualizaciones automaticas) y solo si el instalador trae CH341SER.EXE.
; Si el driver ya esta en Windows no pregunta. En la instalacion silenciosa (/S) la
; respuesta es Si y el driver tambien se instala en silencio (decision de Efrain, 25 oct).
; Texto sin tildes: NSIS no siempre lee bien los acentos de este archivo.

!macro customInstall
  ${ifNot} ${isUpdated}
    IfFileExists "$INSTDIR\resources\drivers\CH341SER.EXE" 0 tb_sin_driver
      ; El instalador es de 32 bits: desde el, System32 de Windows de 64 bits se ve como Sysnative
      IfFileExists "$WINDIR\Sysnative\drivers\CH341S64.SYS" tb_sin_driver
      IfFileExists "$WINDIR\System32\drivers\CH341S64.SYS" tb_sin_driver
      IfFileExists "$WINDIR\System32\drivers\CH341SER.SYS" tb_sin_driver
      IfSilent 0 tb_preguntar
        ExecShellWait "open" "$INSTDIR\resources\drivers\CH341SER.EXE" "/S"
        Goto tb_sin_driver
      tb_preguntar:
      MessageBox MB_YESNO|MB_ICONQUESTION "Instalar el driver CH340?$\r$\n$\r$\nLo necesitan las placas clon (Uno o Nano con chip CH340) para aparecer como puerto COM.$\r$\nSi ya esta instalado, puedes responder No." /SD IDYES IDNO tb_sin_driver
      ; "open" pasa por ShellExecute: Windows pide permiso de administrador si el driver lo necesita
      ExecShellWait "open" "$INSTDIR\resources\drivers\CH341SER.EXE"
    tb_sin_driver:
  ${endIf}
!macroend
