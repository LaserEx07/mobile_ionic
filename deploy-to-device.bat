@echo off
echo ========================================
echo    ALERTO - Deploy to Mobile Device
echo ========================================
echo.

echo Step 1: Building the app...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Copying files to Android...
call npx cap copy android
if %errorlevel% neq 0 (
    echo ERROR: Copy failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Syncing Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Sync failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Choose deployment method:
echo 1. Open Android Studio (manual build APK)
echo 2. Direct USB deployment (phone connected)
echo 3. Live reload development server (debugging)
echo 4. Show computer IP for mobile browser
echo ========================================
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" (
    echo Opening Android Studio...
    call npx cap open android
) else if "%choice%"=="2" (
    echo Deploying to connected device...
    call npx cap run android
) else if "%choice%"=="3" (
    echo Starting development server...
    echo.
    echo IMPORTANT: Make sure your phone and computer are on the same WiFi network
    echo After server starts, open browser on your phone and go to:
    echo http://[YOUR_COMPUTER_IP]:8100
    echo.
    pause
    call npm start
) else if "%choice%"=="4" (
    echo.
    echo Finding your computer's IP address...
    echo.
    ipconfig | findstr "IPv4"
    echo.
    echo Use one of the above IP addresses on your phone browser
    echo Example: http://192.168.1.100:8100
    echo.
    pause
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

echo.
echo Deployment process completed!
pause
