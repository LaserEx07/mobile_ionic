@echo off
echo ========================================
echo Installing Alerto App to Mobile Device
echo ========================================

echo.
echo Checking if APK exists...
if not exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    echo ERROR: APK file not found!
    echo Please run build-apk-debug.bat first to build the APK.
    pause
    exit /b 1
)

echo APK found: android\app\build\outputs\apk\debug\app-debug.apk
echo.

echo Checking for ADB...
adb version >nul 2>&1
if %errorlevel% neq 0 (
    echo ADB not found in PATH.
    echo.
    echo MANUAL INSTALLATION REQUIRED:
    echo ========================================
    echo 1. Connect your phone via USB
    echo 2. Copy this file to your phone's Downloads folder:
    echo    android\app\build\outputs\apk\debug\app-debug.apk
    echo 3. On your phone:
    echo    - Go to Settings > Security
    echo    - Enable "Unknown sources" or "Install unknown apps"
    echo 4. Open file manager on phone
    echo 5. Navigate to Downloads folder
    echo 6. Tap on app-debug.apk
    echo 7. Tap "Install"
    echo 8. Grant permissions when prompted
    echo.
    pause
    exit /b 1
)

echo ADB found! Checking for connected devices...
adb devices

echo.
echo Make sure your device is:
echo 1. Connected via USB
echo 2. Developer Options enabled
echo 3. USB Debugging enabled
echo 4. Device authorized (check phone screen)
echo.
echo Press any key to continue with installation...
pause

echo.
echo Installing APK to device...
adb install -r android\app\build\outputs\apk\debug\app-debug.apk

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo INSTALLATION SUCCESSFUL!
    echo ========================================
    echo.
    echo The Alerto app has been installed on your device.
    echo.
    echo NEXT STEPS:
    echo 1. Find "Alerto" in your app drawer
    echo 2. Open the app
    echo 3. Grant location permissions when prompted
    echo 4. Register or login
    echo 5. Test the new features!
    echo.
) else (
    echo.
    echo ========================================
    echo INSTALLATION FAILED!
    echo ========================================
    echo.
    echo Possible solutions:
    echo 1. Make sure USB Debugging is enabled
    echo 2. Check if device is authorized (look at phone screen)
    echo 3. Try disconnecting and reconnecting USB
    echo 4. Use manual installation method instead
    echo.
)

pause
