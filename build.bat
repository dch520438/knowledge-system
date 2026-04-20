@echo off
cd /d "%~dp0"
echo ================================
echo   Build KnowledgeWorkstation.exe
echo ================================

echo.
echo [Step 1] Installing build tools...
pip install pyinstaller

echo.
echo [Step 2] Installing runtime dependencies...
cd backend
pip install -r requirements.txt

echo.
echo [Step 3] Building frontend (if Node.js available)...
where npm >nul 2>&1
if errorlevel 1 (
    if not exist static\index.html (
        echo WARNING: Node.js not found and frontend not built.
        echo Please ensure backend\static\index.html exists.
        pause
        exit /b 1
    )
    echo Frontend already built, skipping.
) else (
    cd ..\frontend
    if not exist node_modules npm install
    call npm run build
    if errorlevel 1 (
        echo ERROR: Frontend build failed
        pause
        exit /b 1
    )
    cd ..
    echo Deploying static files...
    if exist backend\static rmdir /s /q backend\static
    xcopy /e /i /q frontend\dist backend\static
    cd backend
)

echo.
echo [Step 4] Building EXE with PyInstaller...
pyinstaller --clean KnowledgeWorkstation.spec

echo.
echo ================================
echo   Build complete!
echo   Output: backend\dist\KnowledgeWorkstation.exe
echo ================================
echo.
echo To distribute, copy the following folder:
echo   backend\dist\
echo.
pause
