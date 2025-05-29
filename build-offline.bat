@echo off
echo Building Alerto app in offline mode...

REM Build the Ionic app
call ionic build

REM Copy the google-services.json file to both locations
copy android\app\google-services.json android\capacitor-cordova-android-plugins\google-services.json

REM Sync with Capacitor
call npx cap sync android

REM Build Android in offline mode
cd android
call .\gradlew --offline assembleDebug
cd ..

echo Build complete! Check the output for any errors.
echo The APK should be located at: android\app\build\outputs\apk\debug\app-debug.apk
