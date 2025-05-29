# PowerShell script to fix icon sizes for Android

Write-Host "Fixing icon sizes for Android..." -ForegroundColor Green

# Create a temporary directory
New-Item -ItemType Directory -Path "temp_icons" -Force | Out-Null

# Source icon path - using the exact path you provided
$sourceIcon = "android/app/src/main/res/mipmap-hdpi/alerto_icon.png"

# Check if the file exists
if (Test-Path $sourceIcon) {
    Write-Host "Found source icon at: $sourceIcon" -ForegroundColor Green
} else {
    Write-Host "Source icon not found at: $sourceIcon" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

# Copy the source icon to the temp directory
Copy-Item -Path $sourceIcon -Destination "temp_icons/alerto_icon.png" -Force

# Create a new ic_launcher_background.xml with a white background
$backgroundXml = @"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
"@

Set-Content -Path "android/app/src/main/res/values/ic_launcher_background.xml" -Value $backgroundXml

# Create a new ic_launcher.xml with a larger size
$launcherXml = @"
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"@

Set-Content -Path "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml" -Value $launcherXml
Set-Content -Path "android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml" -Value $launcherXml

# Copy the icon to all the necessary locations
Write-Host "Copying icon to mdpi (48x48)..." -ForegroundColor Yellow
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-mdpi/ic_launcher.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png" -Force

Write-Host "Copying icon to hdpi (72x72)..." -ForegroundColor Yellow
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-hdpi/ic_launcher.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png" -Force

Write-Host "Copying icon to xhdpi (96x96)..." -ForegroundColor Yellow
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png" -Force

Write-Host "Copying icon to xxhdpi (144x144)..." -ForegroundColor Yellow
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png" -Force

Write-Host "Copying icon to xxxhdpi (192x192)..." -ForegroundColor Yellow
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png" -Force
Copy-Item -Path $sourceIcon -Destination "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png" -Force

# Update the favicon
Copy-Item -Path $sourceIcon -Destination "src/assets/icon/favicon.png" -Force

# Clean up the temp directory
Remove-Item -Path "temp_icons" -Recurse -Force

Write-Host "Icon size fixing complete!" -ForegroundColor Green
Write-Host "Now rebuild your app with: ionic build && npx cap sync android" -ForegroundColor Cyan
