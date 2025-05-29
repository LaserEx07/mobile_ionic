@echo off
echo Building APK for Alerto app...

REM Build the web assets
echo Step 1: Building web assets...
call npm run build
if %errorlevel% neq 0 (
    echo Error: Web build failed
    pause
    exit /b 1
)

REM Sync with Capacitor
echo Step 2: Syncing with Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo Error: Capacitor sync failed
    pause
    exit /b 1
)

echo Build completed successfully!
echo.
echo Next steps:
echo 1. Open Android Studio: npx cap open android
echo 2. In Android Studio, click the green Run button
echo 3. Select your connected device
echo.
echo Or manually build APK in Android Studio:
echo Build → Build Bundle(s) / APK(s) → Build APK(s)
echo.
pause
