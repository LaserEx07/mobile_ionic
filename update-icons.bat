@echo off
echo Updating Alerto app icons...

REM Copy launcher icons to all resolution folders
copy src\assets\AlertoIconApp.launcher.png android\app\src\main\res\mipmap-mdpi\ic_launcher.png
copy src\assets\AlertoIconApp.launcher.png android\app\src\main\res\mipmap-hdpi\ic_launcher.png
copy src\assets\AlertoIconApp.launcher.png android\app\src\main\res\mipmap-xhdpi\ic_launcher.png
copy src\assets\AlertoIconApp.launcher.png android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png
copy src\assets\AlertoIconApp.launcher.png android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png

REM Copy round icons to all resolution folders
copy src\assets\AlertoIconApp.round.png android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png
copy src\assets\AlertoIconApp.round.png android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png
copy src\assets\AlertoIconApp.round.png android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png
copy src\assets\AlertoIconApp.round.png android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png
copy src\assets\AlertoIconApp.round.png android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png

REM Copy foreground icons to all resolution folders
copy src\assets\AlertoIconApp.foreground.png android\app\src\main\res\mipmap-mdpi\ic_launcher_foreground.png
copy src\assets\AlertoIconApp.foreground.png android\app\src\main\res\mipmap-hdpi\ic_launcher_foreground.png
copy src\assets\AlertoIconApp.foreground.png android\app\src\main\res\mipmap-xhdpi\ic_launcher_foreground.png
copy src\assets\AlertoIconApp.foreground.png android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.png
copy src\assets\AlertoIconApp.foreground.png android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png

echo Icon update complete!
