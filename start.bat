@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title NovelBuilder - 启动服务

echo ========================================
echo   NovelBuilder 启动脚本
echo ========================================
echo.

goto :main

REM ================================
REM 函数：关闭指定端口
REM ================================
:kill_port
set PORT=%1
set PID=

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :!PORT! ^| findstr LISTENING') do (
    set PID=%%a
)

if not "!PID!"=="" (
    echo [端口占用] 端口 !PORT! 被 PID=!PID! 占用，正在结束进程...
    pause >nul
    taskkill /PID !PID! /F >nul 2>&1
    echo [已释放] 端口 !PORT!
) else (
    echo [空闲] 端口 !PORT! 未被占用
)
exit /b

:main
REM ================================
REM 关闭后端与前端端口
REM ================================
echo [0/4] 检查端口占用并释放...
call :kill_port 5299
call :kill_port 5298
echo.

REM 检查 Node.js 是否安装
node -v >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [1/4] 检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo 依赖安装完成
) else (
    echo 依赖已存在
)

echo.
echo [2/4] 启动后端服务 (端口 5299)...
start "NovelBuilder-Backend" cmd /k "npm run server"

echo.
echo [3/4] 等待后端启动...
timeout /t 3 /nobreak >nul

echo.
echo [4/4] 启动前端开发服务器...
start "NovelBuilder-Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo   服务已启动！
echo   后端: http://localhost:5299
echo   前端: http://localhost:5298 (或终端显示的端口)
echo   按任意键关闭此窗口（不影响已启动的服务）
echo ========================================
echo.
pause >nul
