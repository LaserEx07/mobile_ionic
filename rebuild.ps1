# PowerShell script to rebuild the Alerto app

Write-Host "Starting rebuild of Alerto app..." -ForegroundColor Green

# Navigate back to the mobile_ionic directory
cd ..

# Fix icon capitalization
Write-Host "Fixing icon capitalization..." -ForegroundColor Yellow
# Create a temporary directory
New-Item -ItemType Directory -Path "temp_icons" -Force | Out-Null

# Copy the Alerto icon to the temp directory with proper naming
Copy-Item -Path "src\assets\AlertoIconApp.launcher.png" -Destination "temp_icons\ic_launcher.png" -Force
Copy-Item -Path "src\assets\AlertoIconApp.round.png" -Destination "temp_icons\ic_launcher_round.png" -Force
Copy-Item -Path "src\assets\AlertoIconApp.foreground.png" -Destination "temp_icons\ic_launcher_foreground.png" -Force

# Copy the processed icons to all Android resource directories
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png" -Force

Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png" -Force

Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher_foreground.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher_foreground.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher_foreground.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png" -Force

# Update favicon
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "src\assets\icon\favicon.png" -Force

# Clean up temp directory
Remove-Item -Path "temp_icons" -Recurse -Force

Write-Host "Icon capitalization fixed!" -ForegroundColor Green

# Rebuild the app
Write-Host "Rebuilding Ionic app..." -ForegroundColor Yellow
ionic build

# Copy the google-services.json file to ensure it's in both locations
Write-Host "Ensuring Firebase configuration is in place..." -ForegroundColor Yellow
Copy-Item -Path "android\app\google-services.json" -Destination "android\capacitor-cordova-android-plugins\google-services.json" -Force

# Sync with Capacitor
Write-Host "Syncing with Capacitor..." -ForegroundColor Yellow
npx cap sync android

Write-Host "Rebuild complete!" -ForegroundColor Green
Write-Host "To run the app, use: ionic capacitor run android" -ForegroundColor Cyan
