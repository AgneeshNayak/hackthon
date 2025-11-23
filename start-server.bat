@echo off
echo ========================================
echo DisasterAlert Server Starter
echo ========================================
echo.

REM Check if port 3000 is in use
netstat -ano | findstr ":3000.*LISTENING" >nul
if %errorlevel% == 0 (
    echo [WARNING] Port 3000 is already in use!
    echo Finding and killing the process...
    
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
        set PID=%%a
        echo Killing process with PID: %%a
        taskkill /PID %%a /F >nul 2>&1
    )
    
    timeout /t 2 /nobreak >nul
    echo Port 3000 is now free.
    echo.
)

echo Starting DisasterAlert server...
echo.
node server/server.js

pause

