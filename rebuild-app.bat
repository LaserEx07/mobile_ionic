@echo off
echo Rebuilding Alerto app with new name and icons...

REM Build the app
call ionic build

REM Update the Android platform
call npx cap sync android

echo Rebuild complete! You can now run the app with the new name and icons.
echo To test on Android, run: ionic capacitor run android
