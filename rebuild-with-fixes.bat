@echo off
echo ========================================
echo ALERTO - Rebuild with All Fixes
echo ========================================
echo.
echo This script will:
echo 1. Build the Ionic app
echo 2. Sync with Capacitor
echo 3. Build Android APK with new icon
echo 4. Install to connected device
echo.
echo FIXES INCLUDED:
echo - Mapbox routing (no more straight lines!)
echo - Custom app icon (alerto_launcher)
echo - Fire and landslide disaster icons
echo.

echo [1/4] Building Ionic app...
call ionic build
if %errorlevel% neq 0 (
    echo ERROR: Ionic build failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Syncing with Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Building Android APK...
cd android
call gradlew assembleDebug
if %errorlevel% neq 0 (
    echo ERROR: Android build failed!
    pause
    exit /b 1
)
cd ..

echo.
echo [4/4] Installing to device...
call adb install -r android\app\build\outputs\apk\debug\app-debug.apk
if %errorlevel% neq 0 (
    echo ERROR: Installation failed! Make sure device is connected and USB debugging is enabled.
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! ALERTO has been rebuilt and installed with:
echo - Mapbox routing (replaces OpenStreetMap)
echo - Custom app icon (alerto_launcher)
echo - Fire and landslide disaster icons
echo ========================================
echo.
echo To test routing:
echo 1. Open the app and navigate to any disaster map
echo 2. Click on an evacuation center marker
echo 3. Select a transport mode (walking/cycling/driving)
echo 4. Routes should now follow roads instead of straight lines
echo.
echo To test Mapbox API directly, open: test-mapbox-routing.html
echo ========================================
echo.
pause
