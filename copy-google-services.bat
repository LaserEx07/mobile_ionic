@echo off
echo Copying google-services.json to Android directories...

REM Copy to main app directory
copy /Y google-services.json android\app\
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy to android\app\
    pause
    exit /b 1
)

REM Copy to capacitor-cordova-android-plugins directory
copy /Y google-services.json android\capacitor-cordova-android-plugins\
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy to capacitor-cordova-android-plugins\
    pause
    exit /b 1
)

echo Successfully copied google-services.json to both locations!
echo Done!
