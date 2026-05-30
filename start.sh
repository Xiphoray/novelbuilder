#!/bin/bash

echo "========================================"
echo "  NovelBuilder 启动脚本"
echo "========================================"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js"
    exit 1
fi

echo "[1/4] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
    echo "依赖安装完成"
else
    echo "依赖已存在"
fi

echo ""
echo "[2/4] 启动后端服务 (端口 5299)..."
cd server
node index.js &
BACKEND_PID=$!
cd ..

echo ""
echo "[3/4] 等待后端启动..."
sleep 3

echo ""
echo "[4/4] 启动前端开发服务器..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  服务已启动！"
echo "  后端: http://localhost:5299"
echo "  前端: http://localhost:5298 (或终端显示的端口)"
echo "  按 Ctrl+C 停止所有服务"
echo "========================================"
echo ""

# 等待用户中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '服务已停止'; exit" INT TERM
wait
