@echo off
echo ========================================
echo Alerto Mobile App - APK Location
echo ========================================

echo.
echo Checking if APK exists...
if not exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    echo ERROR: APK file not found!
    echo Please run build-apk-debug.bat first to build the APK.
    pause
    exit /b 1
)

echo APK Details:
echo ========================================
dir android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Full Path: %CD%\android\app\build\outputs\apk\debug\app-debug.apk
echo Size: ~7.3 MB
echo.

echo Opening APK location in File Explorer...
explorer android\app\build\outputs\apk\debug

echo.
echo ========================================
echo INSTALLATION INSTRUCTIONS:
echo ========================================
echo.
echo 1. COPY the app-debug.apk file to your phone
echo    (via USB, cloud storage, or email)
echo.
echo 2. ON YOUR PHONE:
echo    - Go to Settings > Security
echo    - Enable "Unknown sources" or "Install unknown apps"
echo.
echo 3. INSTALL:
echo    - Open file manager on phone
echo    - Find app-debug.apk in Downloads
echo    - Tap the file and select "Install"
echo.
echo 4. LAUNCH:
echo    - Find "Alerto" in your app drawer
echo    - Grant location permissions
echo    - Test the new features!
echo.
echo ========================================
echo NEW FEATURES TO TEST:
echo ========================================
echo - Clean map display (tabs/map)
echo - Disaster-specific evacuation centers
echo - Improved search functionality  
echo - Better offline detection
echo.
pause
