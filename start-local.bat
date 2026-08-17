@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo MetaCore Studio 本地工程模式
echo ========================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 20.19+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major^>20 ^|^| major===20 ^&^& minor^>=19?0:1)"
if %errorlevel% neq 0 (
    echo [错误] MetaCore Studio 需要 Node.js 20.19 或更高版本
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set APP_VERSION=%%v
echo 当前版本: v%APP_VERSION%
echo.

if not exist "node_modules" (
    echo 安装项目依赖...
    call npm ci
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo 启动本地工程服务: http://127.0.0.1:3766
start "MetaCore Local Server" /min cmd /k "cd /d ""%~dp0"" && npm run dev:server"

echo 启动 Web 前端...
call npm run dev -- --open

pause
