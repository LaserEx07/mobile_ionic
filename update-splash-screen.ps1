# PowerShell script to update splash screen with new ALERTO logo
# Place your new ALERTO logo as "new_alerto_logo.png" in the mobile_ionic folder

Write-Host "=== ALERTO Splash Screen Update Script ===" -ForegroundColor Green
Write-Host ""

# Check if the new logo file exists
$newLogoPath = "new_alerto_logo.png"
if (-not (Test-Path $newLogoPath)) {
    Write-Host "ERROR: Please place your new ALERTO logo as 'new_alerto_logo.png' in the mobile_ionic folder" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Steps to use this script:" -ForegroundColor Cyan
    Write-Host "1. Save your new ALERTO logo as 'new_alerto_logo.png' in the mobile_ionic folder" -ForegroundColor White
    Write-Host "2. Run this script again" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Found new ALERTO logo: $newLogoPath" -ForegroundColor Green

# Define all splash screen file paths
$splashPaths = @(
    "android\app\src\main\res\drawable\splash.png",
    "android\app\src\main\res\drawable-port-mdpi\splash.png",
    "android\app\src\main\res\drawable-port-hdpi\splash.png",
    "android\app\src\main\res\drawable-port-xhdpi\splash.png",
    "android\app\src\main\res\drawable-port-xxhdpi\splash.png",
    "android\app\src\main\res\drawable-port-xxxhdpi\splash.png",
    "android\app\src\main\res\drawable-land-mdpi\splash.png",
    "android\app\src\main\res\drawable-land-hdpi\splash.png",
    "android\app\src\main\res\drawable-land-xhdpi\splash.png",
    "android\app\src\main\res\drawable-land-xxhdpi\splash.png",
    "android\app\src\main\res\drawable-land-xxxhdpi\splash.png"
)

Write-Host ""
Write-Host "Updating splash screen files..." -ForegroundColor Yellow

$successCount = 0
$totalCount = $splashPaths.Count

foreach ($splashPath in $splashPaths) {
    try {
        if (Test-Path $splashPath) {
            # Create backup of original file
            $backupPath = $splashPath + ".backup"
            if (-not (Test-Path $backupPath)) {
                Copy-Item -Path $splashPath -Destination $backupPath -Force
                Write-Host "  Backed up: $splashPath" -ForegroundColor Gray
            }

            # Copy new logo to splash screen location
            Copy-Item -Path $newLogoPath -Destination $splashPath -Force
            Write-Host "  Updated: $splashPath" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  Not found: $splashPath" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  Failed to update: $splashPath" -ForegroundColor Red
        Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Update Summary ===" -ForegroundColor Cyan
Write-Host "Successfully updated: $successCount out of $totalCount files" -ForegroundColor Green

if ($successCount -eq $totalCount) {
    Write-Host "All splash screen files updated successfully!" -ForegroundColor Green
} elseif ($successCount -gt 0) {
    Write-Host "Some files were updated, but not all. Check the output above." -ForegroundColor Yellow
} else {
    Write-Host "No files were updated. Please check the file paths." -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Rebuild your app with these commands:" -ForegroundColor White
Write-Host "   ionic build" -ForegroundColor Gray
Write-Host "   npx cap sync android" -ForegroundColor Gray
Write-Host "   npx cap run android" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test the app to see your new splash screen" -ForegroundColor White
Write-Host ""
Write-Host "Note: Original files have been backed up with .backup extension" -ForegroundColor Yellow

Read-Host "Press Enter to exit"
