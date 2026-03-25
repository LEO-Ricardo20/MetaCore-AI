@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   ╔══════════════════════════════════════╗
echo   ║      MetaCore AI v1.5.2 启动中...     ║
echo   ╚══════════════════════════════════════╝
echo.

:: 检查 node_modules 是否存在
if not exist "node_modules" (
    echo   [*] 首次运行，正在安装依赖...
    npm install
    echo.
)

:: 启动 Vite 并自动打开浏览器
echo   [*] 启动开发服务器...
echo   [*] 浏览器将自动打开，请稍候...
echo.
npm run dev -- --open
