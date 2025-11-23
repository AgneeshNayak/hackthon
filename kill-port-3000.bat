@echo off
echo ========================================
echo Kill Process on Port 3000
echo ========================================
echo.

netstat -ano | findstr ":3000.*LISTENING" >nul
if %errorlevel% == 0 (
    echo Found process(es) using port 3000:
    netstat -ano | findstr ":3000.*LISTENING"
    echo.
    
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
        echo Killing process with PID: %%a
        taskkill /PID %%a /F
    )
    
    echo.
    echo Done! Port 3000 is now free.
) else (
    echo No process found using port 3000.
)

echo.
pause

