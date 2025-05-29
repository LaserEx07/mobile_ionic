@echo off
echo Starting full rebuild of Alerto app...

REM Clean Android build
echo Cleaning Android build...
cd android
call gradlew clean
cd ..

REM Clean Ionic build
echo Cleaning Ionic build...
rmdir /s /q www
rmdir /s /q android\app\build

REM Rebuild the app
echo Rebuilding Ionic app...
call ionic build

REM Copy the google-services.json file to ensure it's in both locations
echo Ensuring Firebase configuration is in place...
copy android\app\google-services.json android\capacitor-cordova-android-plugins\google-services.json

REM Sync with Capacitor
echo Syncing with Capacitor...
call npx cap sync android

echo Full rebuild complete!
echo To run the app, use: ionic capacitor run android
