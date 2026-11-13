@echo off
REM Cria a .venv (na primeira vez), instala as dependencias e inicia a loja.
cd /d "%~dp0"
if not exist .venv (
    echo Criando ambiente virtual .venv...
    python -m venv .venv || goto :erro
)
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt || goto :erro
python app.py
goto :eof

:erro
echo.
echo Algo deu errado. Verifique se o Python esta instalado e no PATH.
pause
