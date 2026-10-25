@echo off
setlocal
cd /d "%~dp0"
where.exe node >nul 2>nul
if errorlevel 1 goto bundled
node "%~dp0tools\open-game.cjs" %*
goto finished

:bundled
set "LOOTKEEPER_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%LOOTKEEPER_NODE%" goto missing
"%LOOTKEEPER_NODE%" "%~dp0tools\open-game.cjs" %*
goto finished

:missing
echo Node.js was not found. Install Node.js or open this project in Codex and try again.
goto failed

:finished
if errorlevel 1 goto failed
exit /b 0

:failed
if "%~1"=="--check" exit /b 1
if "%~1"=="--headless" exit /b 1
if "%~1"=="--no-browser" exit /b 1
pause
exit /b 1
