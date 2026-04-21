@echo off
cd /d "%~dp0"

echo ================================
echo   Knowledge Workstation
echo ================================

echo [1/3] Installing backend dependencies...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)
cd ..

echo [2/3] Checking frontend build...
if not exist backend\static\index.html (
    where npm >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Frontend not built and Node.js not found.
        echo Please install Node.js from https://nodejs.org/
        echo Or run this script on a machine with Node.js first.
        pause
        exit /b 1
    )
    echo Building frontend...
    cd frontend
    if not exist node_modules npm install
    call npm run build
    if errorlevel 1 (
        echo ERROR: Failed to build frontend
        pause
        exit /b 1
    )
    cd ..
    echo Deploying static files...
    if exist backend\static rmdir /s /q backend\static
    xcopy /e /i /q frontend\dist backend\static
) else (
    echo Frontend already built, skipping.
)

echo [3/3] Starting server...
cd backend
REM Kill existing process on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo.
echo ================================
echo   Server started!
echo   URL: http://localhost:8000
echo   Press Ctrl+C to stop
echo ================================
echo.
start http://localhost:8000
python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
