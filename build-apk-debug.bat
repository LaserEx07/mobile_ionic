@echo off
echo ========================================
echo Building Alerto Mobile App (Debug APK)
echo ========================================

echo.
echo Step 1: Building Angular app...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Angular build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Syncing with Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Building Android APK...
cd android
call gradlew assembleDebug
if %errorlevel% neq 0 (
    echo ERROR: Android build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD SUCCESSFUL!
echo ========================================
echo.
echo APK Location: android\app\build\outputs\apk\debug\app-debug.apk
echo APK Size:
dir android\app\build\outputs\apk\debug\app-debug.apk | findstr "app-debug.apk"
echo.
echo ========================================
echo INSTALLATION OPTIONS:
echo ========================================
echo.
echo Option 1: USB Transfer
echo   1. Connect your phone via USB
echo   2. Copy app-debug.apk to phone's Downloads folder
echo   3. On phone: Settings > Security > Enable Unknown Sources
echo   4. Open file manager, tap app-debug.apk, install
echo.
echo Option 2: ADB Install (if ADB is available)
echo   1. Enable Developer Options on phone
echo   2. Enable USB Debugging
echo   3. Run: adb install android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Option 3: Cloud Storage
echo   1. Upload app-debug.apk to Google Drive/OneDrive
echo   2. Download on phone and install
echo.
echo ========================================
echo NEXT STEPS:
echo ========================================
echo 1. Choose an installation method above
echo 2. Install the APK on your device
echo 3. Grant location permissions when prompted
echo 4. Test the new features:
echo    - Clean map display (tabs/map)
echo    - Disaster-specific evacuation centers
echo    - Search functionality
echo    - Improved offline detection
echo.
pause
