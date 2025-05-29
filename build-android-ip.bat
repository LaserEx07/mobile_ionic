@echo off
echo Building Ionic app with IP address configuration...

REM Build the app
echo Building app...
call npm run build

REM Copy to Android
echo Copying to Android...
call npx cap copy android

REM Update Android platform
echo Updating Android platform...
call npx cap update android

REM Copy FCM configuration
echo Copying FCM configuration...
copy google-services.json android\app\
copy google-services.json android\capacitor-cordova-android-plugins\

echo Build completed. Now running on device...
call npx cap run android

echo Done!
