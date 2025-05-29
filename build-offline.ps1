# PowerShell script to build Alerto app in offline mode

Write-Host "Building Alerto app in offline mode..." -ForegroundColor Green

# Build the Ionic app
Write-Host "Building Ionic app..." -ForegroundColor Yellow
ionic build

# Copy the google-services.json file to both locations
Write-Host "Copying Firebase configuration..." -ForegroundColor Yellow
Copy-Item -Path "android\app\google-services.json" -Destination "android\capacitor-cordova-android-plugins\google-services.json" -Force

# Sync with Capacitor
Write-Host "Syncing with Capacitor..." -ForegroundColor Yellow
npx cap sync android

# Build Android in offline mode
Write-Host "Building Android app in offline mode..." -ForegroundColor Yellow
Push-Location -Path "android"
.\gradlew --offline assembleDebug
Pop-Location

Write-Host "Build complete! Check the output for any errors." -ForegroundColor Green
Write-Host "The APK should be located at: android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Cyan
