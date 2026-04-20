#!/bin/bash
# 智能知识工作台 - 开发模式启动脚本

echo "================================"
echo "  智能知识工作台（开发模式）"
echo "================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 安装后端依赖
echo "[1/3] 安装后端依赖..."
cd backend
pip install -r requirements.txt --break-system-packages -q 2>/dev/null || pip install -r requirements.txt -q 2>/dev/null
cd ..

# 安装前端依赖
echo "[2/3] 安装前端依赖..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# 启动后端和前端
echo "[3/3] 启动服务..."
echo ""
echo "================================"
echo "  前端: http://localhost:3000"
echo "  后端: http://localhost:8000"
echo "  按 Ctrl+C 停止服务"
echo "================================"
echo ""

# 后台启动后端
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# 前台启动前端
cd frontend
npx vite --host 0.0.0.0 --port 3000

# 清理
kill $BACKEND_PID 2>/dev/null
