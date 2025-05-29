@echo off
echo ========================================
echo ALERTO MOBILE DEBUG SCRIPT
echo ========================================

echo.
echo 1. Checking current IP address...
ipconfig | findstr "IPv4"

echo.
echo 2. Testing backend API connection...
curl -s http://172.30.11.217:8000/api/test

echo.
echo 3. Building mobile app...
call npm run build

echo.
echo 4. Copying to Android...
call npx cap copy android

echo.
echo 5. Syncing Android platform...
call npx cap sync android

echo.
echo 6. Opening in Android Studio...
call npx cap open android

echo.
echo ========================================
echo MOBILE DEBUG COMPLETE
echo ========================================
echo.
echo NEXT STEPS:
echo 1. In Android Studio, click the Run button
echo 2. On your device, test the API connection by opening:
echo    http://172.30.11.217:8000/api/test in your mobile browser
echo 3. If that works, try logging in to the app
echo 4. Check Chrome DevTools for any errors:
echo    - Open Chrome on your computer
echo    - Go to chrome://inspect
echo    - Select your device and app
echo ========================================
pause
