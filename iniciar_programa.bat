@echo off
cd /d "%~dp0"
echo A iniciar o Programa de Gestao...
echo.
echo Por favor aguarde enquanto o servidor arranca.
echo Quando aparecer "Local: http://localhost:5173", abra esse link no seu navegador.
echo.
call npm install
call npm run dev
pause
