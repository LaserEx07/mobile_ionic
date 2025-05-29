@echo off
echo Fixing icon capitalization and naming issues...

REM Create a temporary directory for processed icons
mkdir temp_icons

REM Copy the Alerto icon to the temp directory with proper naming
copy src\assets\AlertoIconApp.launcher.png temp_icons\ic_launcher.png
copy src\assets\AlertoIconApp.round.png temp_icons\ic_launcher_round.png
copy src\assets\AlertoIconApp.foreground.png temp_icons\ic_launcher_foreground.png

REM Copy the processed icons to all Android resource directories with proper naming
copy temp_icons\ic_launcher.png android\app\src\main\res\mipmap-mdpi\ic_launcher.png
copy temp_icons\ic_launcher.png android\app\src\main\res\mipmap-hdpi\ic_launcher.png
copy temp_icons\ic_launcher.png android\app\src\main\res\mipmap-xhdpi\ic_launcher.png
copy temp_icons\ic_launcher.png android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png
copy temp_icons\ic_launcher.png android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png

copy temp_icons\ic_launcher_round.png android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png
copy temp_icons\ic_launcher_round.png android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png
copy temp_icons\ic_launcher_round.png android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png
copy temp_icons\ic_launcher_round.png android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png
copy temp_icons\ic_launcher_round.png android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png

copy temp_icons\ic_launcher_foreground.png android\app\src\main\res\mipmap-mdpi\ic_launcher_foreground.png
copy temp_icons\ic_launcher_foreground.png android\app\src\main\res\mipmap-hdpi\ic_launcher_foreground.png
copy temp_icons\ic_launcher_foreground.png android\app\src\main\res\mipmap-xhdpi\ic_launcher_foreground.png
copy temp_icons\ic_launcher_foreground.png android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.png
copy temp_icons\ic_launcher_foreground.png android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png

REM Also update the favicon
copy temp_icons\ic_launcher.png src\assets\icon\favicon.png

REM Clean up the temp directory
rmdir /s /q temp_icons

echo Icon capitalization fixed!
