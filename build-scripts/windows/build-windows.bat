@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"

echo ========================================
echo   智能知识工作台 - Windows 安装包构建
echo ========================================
echo.

:: 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

:: 安装打包工具
echo [1/6] 安装打包工具...
pip install pyinstaller pyinstaller-hooks-contrib --upgrade -q
if errorlevel 1 (
    echo [错误] 安装 PyInstaller 失败
    pause
    exit /b 1
)

:: 安装后端依赖
echo [2/6] 安装后端依赖...
cd backend
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [错误] 安装后端依赖失败
    pause
    exit /b 1
)
cd ..

:: 构建前端
echo [3/6] 构建前端...
cd frontend
if not exist node_modules (
    echo   安装 Node 依赖...
    npm install
)
call npm run build
if errorlevel 1 (
    echo [错误] 前端构建失败
    pause
    exit /b 1
)
cd ..

:: 复制前端构建产物到后端
echo [4/6] 部署静态文件...
if exist backend\static rmdir /s /q backend\static
xcopy /e /i /q frontend\dist backend\static

:: 使用 .spec 文件打包
echo [5/6] 打包可执行文件...
cd build-scripts\windows
pyinstaller --clean KnowledgeWorkstation.spec
if errorlevel 1 (
    echo [错误] PyInstaller 打包失败
    pause
    exit /b 1
)
cd ..\..

:: 复制模板文件到输出目录
echo [6/6] 复制模板文件...
if exist templates (
    xcopy /e /i /q templates build-scripts\windows\dist\templates 2>nul
)

echo.
echo ========================================
echo   构建完成！
echo ========================================
echo.
echo 输出文件:
echo   build-scripts\windows\dist\KnowledgeWorkstation.exe
echo.
echo 分发方式:
echo   1. 直接分发 dist 文件夹（绿色版）
echo   2. 使用 Inno Setup 制作安装程序
echo.
pause
