@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo MetaCore AI 启动脚本
echo ====================
echo.

echo 检查 Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set APP_VERSION=%%v
echo 当前版本: v%APP_VERSION%
echo.

if not exist "node_modules" (
    echo 安装项目依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo 启动 Web 前端...
call npm run dev -- --open

pause
