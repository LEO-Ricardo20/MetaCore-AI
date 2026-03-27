@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo MetaCore AI 启动脚本
echo ====================
echo.

:: 检查 Node.js
echo 检查 Node.js...
node -v
if %errorlevel% neq 0 (
    echo Node.js 未安装，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查依赖
if not exist "node_modules" (
    echo 安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo 依赖安装失败
        pause
        exit /b 1
    )
)

:: 启动服务
echo 启动开发服务器...
npm run dev -- --open

pause