@echo off
echo.
echo   Electromagnetism Suite - Launcher
echo   ==================================
echo.

REM Try Node.js first
where node >nul 2>nul
if %errorlevel% == 0 (
    echo   [Node.js found] Installing dependencies...
    call npm install
    echo   Starting server at http://localhost:3000
    start http://localhost:3000
    node server.js
    goto :end
)

REM Try Python
where python >nul 2>nul
if %errorlevel% == 0 (
    echo   [Python found] Starting Python server...
    python serve.py
    goto :end
)

where python3 >nul 2>nul
if %errorlevel% == 0 (
    echo   [Python3 found] Starting Python server...
    python3 serve.py
    goto :end
)

REM No server - just open index directly
echo   [No server found] Opening index.html directly in browser...
start "" "public\index.html"

:end
