@echo off
echo ========================================
echo    ALERTO - Clean Rebuild Process
echo ========================================
echo.

echo Step 1: Cleaning previous builds...
call npx cap clean android
if %errorlevel% neq 0 (
    echo WARNING: Clean command failed, continuing...
)

echo.
echo Step 2: Building the app...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Copying Google Services configuration...
copy /Y google-services.json android\app\
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy google-services.json to app directory!
    pause
    exit /b 1
)

REM Also copy to capacitor-cordova-android-plugins directory
copy /Y google-services.json android\capacitor-cordova-android-plugins\
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy google-services.json to plugins directory!
    pause
    exit /b 1
)

echo.
echo Step 4: Syncing with Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Clean rebuild completed successfully!
echo Google Services files copied to both locations.
echo You can now open Android Studio with:
echo npx cap open android
echo ========================================
pause
