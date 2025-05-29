# PowerShell script to update app icons with alerto_icon.png

Write-Host "Updating app icons with alerto_icon.png..." -ForegroundColor Green

# Create a temporary directory for processed icons
New-Item -ItemType Directory -Path "temp_icons" -Force | Out-Null

# Copy the alerto_icon to the temp directory with proper naming
Copy-Item -Path "android\app\src\main\res\mipmap-hdpi\alerto_icon.png" -Destination "temp_icons\ic_launcher.png" -Force
Copy-Item -Path "android\app\src\main\res\mipmap-hdpi\alerto_icon.png" -Destination "temp_icons\ic_launcher_round.png" -Force
Copy-Item -Path "android\app\src\main\res\mipmap-hdpi\alerto_icon.png" -Destination "temp_icons\ic_launcher_foreground.png" -Force

# Copy the processed icons to all Android resource directories
Write-Host "Copying icons to all resolution folders..." -ForegroundColor Yellow

# Copy to mdpi
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher_foreground.png" -Force

# Copy to hdpi
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher_foreground.png" -Force

# Copy to xhdpi
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher_foreground.png" -Force

# Copy to xxhdpi
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.png" -Force

# Copy to xxxhdpi
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png" -Force
Copy-Item -Path "temp_icons\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png" -Force

# Also update the favicon
Copy-Item -Path "temp_icons\ic_launcher.png" -Destination "src\assets\icon\favicon.png" -Force

# Clean up the temp directory
Remove-Item -Path "temp_icons" -Recurse -Force

Write-Host "Icon update complete!" -ForegroundColor Green
Write-Host "Now rebuild your app with: ionic build && npx cap sync android" -ForegroundColor Cyan
