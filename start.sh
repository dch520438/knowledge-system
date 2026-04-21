#!/bin/bash
# 智能知识工作台 - 一键启动脚本

echo "================================"
echo "  智能知识工作台"
echo "================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "错误：未找到 Python3，请先安装 Python 3.8+"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误：未找到 Node.js，请先安装 Node.js 16+"
    exit 1
fi

# 安装后端依赖
echo "[1/4] 安装后端依赖..."
cd backend
pip install -r requirements.txt --break-system-packages -q 2>/dev/null || pip install -r requirements.txt -q 2>/dev/null
cd ..

# 安装前端依赖
echo "[2/4] 安装前端依赖..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# 构建前端
echo "[3/5] 构建前端..."
cd frontend
npm run build
cd ..

# 复制前端构建产物到后端静态目录
echo "[4/5] 部署静态文件..."
rm -rf backend/static
cp -r frontend/dist backend/static

# 启动后端
echo "[5/5] 启动服务..."
cd backend
echo ""
echo "================================"
echo "  服务已启动！"
echo "  访问地址: http://localhost:8000"
echo "  按 Ctrl+C 停止服务"
echo "================================"
echo ""
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!

# 等待服务启动后自动打开浏览器
sleep 2
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8000
elif command -v open &> /dev/null; then
    open http://localhost:8000
fi

# 等待服务进程
wait $SERVER_PID
