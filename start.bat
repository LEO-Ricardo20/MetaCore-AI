@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo MetaCore Studio 一键启动
echo ====================
echo.

call :check_node
if errorlevel 1 goto :failed

call :ensure_dependencies
if errorlevel 1 goto :failed

echo.
echo [1/2] 检查 localhost 工程服务...
call :local_online
if errorlevel 1 (
    echo 启动本地服务: http://127.0.0.1:3766
    start "MetaCore Local Server" /min cmd /d /c "cd /d %~dp0 && npm run dev:server"
    call :wait_for_local
    if errorlevel 1 echo [提示] 本地服务尚未响应，请查看 MetaCore Local Server 窗口。
) else (
    echo 已发现正在运行的本地服务，直接复用。
)

echo.
echo [2/2] 启动 Web 前端并打开浏览器...
call npm run dev -- --open
set EXIT_CODE=%errorlevel%
if not "%EXIT_CODE%"=="0" echo [错误] Web 前端已退出，退出码: %EXIT_CODE%
pause
exit /b %EXIT_CODE%

:check_node
echo 检查 Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js 20.19+
    echo 下载地址: https://nodejs.org/
    exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major<20?1:major===20&&minor<19?1:0)" >nul 2>&1
if errorlevel 1 (
    echo [错误] MetaCore Studio 需要 Node.js 20.19 或更高版本
    exit /b 1
)
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set APP_VERSION=%%v
echo 当前版本: v%APP_VERSION%
exit /b 0

:ensure_dependencies
if exist "node_modules\.bin\vite.cmd" if exist "node_modules\@deepseek-ai\dsh-sdk-client" exit /b 0
echo 安装或修复项目依赖...
call npm ci --no-audit --no-fund
if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络和 npm 输出
    exit /b 1
)
exit /b 0

:local_online
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:3766/api/health' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:wait_for_local
for /l %%i in (1,1,20) do (
    call :local_online
    if not errorlevel 1 exit /b 0
    timeout /t 1 /nobreak >nul
)
exit /b 1

:failed
echo.
echo 启动失败，请根据上面的提示处理后重试。
pause
exit /b 1
