@echo off
echo Cleaning and rebuilding Alerto app...

REM Navigate to Android directory
cd android

REM Clean the Gradle project
call gradlew clean

REM Go back to project root
cd ..

REM Rebuild the app
call ionic build

REM Update the Android platform with clean flag
call npx cap sync android

echo Clean rebuild complete! Try running the app now.
echo To test on Android, run: ionic capacitor run android
