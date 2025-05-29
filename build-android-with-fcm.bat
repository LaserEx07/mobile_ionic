@echo off
echo Building Ionic app for Android with FCM configuration...

REM Build the app for Android
echo Building app for Android...
call ionic capacitor build android --no-open

REM Copy google-services.json to the correct locations
echo Copying google-services.json to Android project...
copy /Y google-services.json android\app\
copy /Y google-services.json android\capacitor-cordova-android-plugins\

REM Ensure the notification icon is in place
echo Checking notification icon...
if not exist android\app\src\main\res\drawable\ic_notification.xml (
  echo Warning: Notification icon not found. Make sure to create it.
)

REM Ensure the colors.xml file is in place
echo Checking colors.xml...
if not exist android\app\src\main\res\values\colors.xml (
  echo Warning: colors.xml not found. Make sure to create it.
)

REM Ensure the FCMService.java file is in place
echo Checking FCMService.java...
if not exist android\app\src\main\java\io\ionic\starter\FCMService.java (
  echo Warning: FCMService.java not found. Make sure to create it.
)

echo Build completed. You can now open the project in Android Studio:
echo npx cap open android

echo Or run the app directly on a connected device:
echo npx cap run android
