@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   ╔══════════════════════════════════════╗
echo   ║   MetaCore AI 本地工程模式启动中...   ║
echo   ╚══════════════════════════════════════╝
echo.

if not exist "node_modules" (
    echo   [*] 首次运行，正在安装依赖...
    npm install
    echo.
)

echo   [*] 启动本地只读文件服务...
start "MetaCore Local Server" /min cmd /k "cd /d \"%~dp0\" && npm run dev:server"

echo   [*] 启动前端开发服务器...
echo   [*] 浏览器将自动打开，请稍候...
echo.
npm run dev -- --open
