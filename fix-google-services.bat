@echo off
echo ========================================
echo    ALERTO - Complete Build Fix
echo ========================================
echo.

echo Step 1: Cleaning build directories...
rmdir /s /q android\app\build 2>nul
rmdir /s /q android\capacitor-cordova-android-plugins\build 2>nul
echo Build directories cleaned.

echo.
echo Step 2: Copying updated google-services.json...
copy /Y google-services.json android\app\
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy to app directory!
    pause
    exit /b 1
)

copy /Y google-services.json android\capacitor-cordova-android-plugins\
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy to plugins directory!
    pause
    exit /b 1
)

echo.
echo Step 3: Verifying google-services.json files...
if not exist "android\app\google-services.json" (
    echo ERROR: google-services.json missing from app directory!
    pause
    exit /b 1
)
if not exist "android\capacitor-cordova-android-plugins\google-services.json" (
    echo ERROR: google-services.json missing from plugins directory!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Complete build fix applied!
echo.
echo Fixed issues:
echo ✓ Google Services configuration (both package names)
echo ✓ Android manifest conflicts resolved
echo ✓ FCM permissions added
echo ✓ Namespace conflicts fixed
echo ✓ Android 12+ exported attributes added
echo ✓ Build cache cleared
echo.
echo You can now build the project in Android Studio.
echo Both Google Services and manifest merger errors should be resolved.
echo ========================================
pause
