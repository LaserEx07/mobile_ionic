# PowerShell script to resize icons for different Android densities
# Note: This requires ImageMagick to be installed

Write-Host "Resizing alerto_icon.png for different Android densities..." -ForegroundColor Green

# Create directories for resized icons
New-Item -ItemType Directory -Path "resized_icons" -Force | Out-Null
New-Item -ItemType Directory -Path "resized_icons\mdpi" -Force | Out-Null
New-Item -ItemType Directory -Path "resized_icons\hdpi" -Force | Out-Null
New-Item -ItemType Directory -Path "resized_icons\xhdpi" -Force | Out-Null
New-Item -ItemType Directory -Path "resized_icons\xxhdpi" -Force | Out-Null
New-Item -ItemType Directory -Path "resized_icons\xxxhdpi" -Force | Out-Null

# Source icon path
$sourceIcon = "android\app\src\main\res\mipmap-hdpi\alerto_icon.png"

# Check if ImageMagick is installed
$hasImageMagick = $null -ne (Get-Command "magick" -ErrorAction SilentlyContinue)

if ($hasImageMagick) {
    # Resize icons using ImageMagick
    Write-Host "Using ImageMagick to resize icons..." -ForegroundColor Yellow
    
    # Resize for different densities
    magick convert $sourceIcon -resize 48x48 "resized_icons\mdpi\ic_launcher.png"
    magick convert $sourceIcon -resize 72x72 "resized_icons\hdpi\ic_launcher.png"
    magick convert $sourceIcon -resize 96x96 "resized_icons\xhdpi\ic_launcher.png"
    magick convert $sourceIcon -resize 144x144 "resized_icons\xxhdpi\ic_launcher.png"
    magick convert $sourceIcon -resize 192x192 "resized_icons\xxxhdpi\ic_launcher.png"
    
    # Create round versions
    magick convert $sourceIcon -resize 48x48 "resized_icons\mdpi\ic_launcher_round.png"
    magick convert $sourceIcon -resize 72x72 "resized_icons\hdpi\ic_launcher_round.png"
    magick convert $sourceIcon -resize 96x96 "resized_icons\xhdpi\ic_launcher_round.png"
    magick convert $sourceIcon -resize 144x144 "resized_icons\xxhdpi\ic_launcher_round.png"
    magick convert $sourceIcon -resize 192x192 "resized_icons\xxxhdpi\ic_launcher_round.png"
    
    # Create foreground versions
    magick convert $sourceIcon -resize 108x108 "resized_icons\mdpi\ic_launcher_foreground.png"
    magick convert $sourceIcon -resize 162x162 "resized_icons\hdpi\ic_launcher_foreground.png"
    magick convert $sourceIcon -resize 216x216 "resized_icons\xhdpi\ic_launcher_foreground.png"
    magick convert $sourceIcon -resize 324x324 "resized_icons\xxhdpi\ic_launcher_foreground.png"
    magick convert $sourceIcon -resize 432x432 "resized_icons\xxxhdpi\ic_launcher_foreground.png"
} else {
    Write-Host "ImageMagick not found. Copying original icon to all densities..." -ForegroundColor Yellow
    
    # Just copy the original icon to all densities
    Copy-Item -Path $sourceIcon -Destination "resized_icons\mdpi\ic_launcher.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\hdpi\ic_launcher.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xhdpi\ic_launcher.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xxhdpi\ic_launcher.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xxxhdpi\ic_launcher.png" -Force
    
    Copy-Item -Path $sourceIcon -Destination "resized_icons\mdpi\ic_launcher_round.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\hdpi\ic_launcher_round.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xhdpi\ic_launcher_round.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xxhdpi\ic_launcher_round.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xxxhdpi\ic_launcher_round.png" -Force
    
    Copy-Item -Path $sourceIcon -Destination "resized_icons\mdpi\ic_launcher_foreground.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\hdpi\ic_launcher_foreground.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xhdpi\ic_launcher_foreground.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xxhdpi\ic_launcher_foreground.png" -Force
    Copy-Item -Path $sourceIcon -Destination "resized_icons\xxxhdpi\ic_launcher_foreground.png" -Force
}

# Copy resized icons to Android resource directories
Write-Host "Copying resized icons to Android resource directories..." -ForegroundColor Yellow

# Copy to mdpi
Copy-Item -Path "resized_icons\mdpi\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher.png" -Force
Copy-Item -Path "resized_icons\mdpi\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png" -Force
Copy-Item -Path "resized_icons\mdpi\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-mdpi\ic_launcher_foreground.png" -Force

# Copy to hdpi
Copy-Item -Path "resized_icons\hdpi\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher.png" -Force
Copy-Item -Path "resized_icons\hdpi\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png" -Force
Copy-Item -Path "resized_icons\hdpi\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-hdpi\ic_launcher_foreground.png" -Force

# Copy to xhdpi
Copy-Item -Path "resized_icons\xhdpi\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher.png" -Force
Copy-Item -Path "resized_icons\xhdpi\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png" -Force
Copy-Item -Path "resized_icons\xhdpi\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xhdpi\ic_launcher_foreground.png" -Force

# Copy to xxhdpi
Copy-Item -Path "resized_icons\xxhdpi\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png" -Force
Copy-Item -Path "resized_icons\xxhdpi\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png" -Force
Copy-Item -Path "resized_icons\xxhdpi\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.png" -Force

# Copy to xxxhdpi
Copy-Item -Path "resized_icons\xxxhdpi\ic_launcher.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png" -Force
Copy-Item -Path "resized_icons\xxxhdpi\ic_launcher_round.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png" -Force
Copy-Item -Path "resized_icons\xxxhdpi\ic_launcher_foreground.png" -Destination "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png" -Force

# Also update the favicon
Copy-Item -Path "resized_icons\xhdpi\ic_launcher.png" -Destination "src\assets\icon\favicon.png" -Force

# Clean up the temp directory
Remove-Item -Path "resized_icons" -Recurse -Force

Write-Host "Icon resizing complete!" -ForegroundColor Green
Write-Host "Now rebuild your app with: ionic build && npx cap sync android" -ForegroundColor Cyan
