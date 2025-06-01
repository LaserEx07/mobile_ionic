# 📱 Alerto Mobile App Installation Guide

## 🚀 Quick Start

### Option 1: Automated Build & Install
1. **Double-click `build-apk-debug.bat`** - This will build the latest APK
2. **Double-click `install-to-device.bat`** - This will try to install via ADB

### Option 2: Manual Installation (Recommended)
1. **Build the APK**: Double-click `build-apk-debug.bat`
2. **Copy APK to phone**: Transfer `android\app\build\outputs\apk\debug\app-debug.apk` to your phone
3. **Install**: Tap the APK file on your phone and install

## 📋 Detailed Steps

### Step 1: Build the APK
```bash
# Run this in mobile_ionic folder
build-apk-debug.bat
```

### Step 2: Transfer to Phone

#### Method A: USB Cable
1. Connect phone to computer via USB
2. Copy `app-debug.apk` to phone's Downloads folder
3. Safely eject phone

#### Method B: Cloud Storage
1. Upload `app-debug.apk` to Google Drive/OneDrive
2. Download on phone from cloud app

#### Method C: Email
1. Email the APK file to yourself
2. Download attachment on phone

### Step 3: Enable Unknown Sources (Android)
1. Go to **Settings** > **Security** (or **Privacy**)
2. Enable **Unknown sources** or **Install unknown apps**
3. Or: **Settings** > **Apps** > **Special access** > **Install unknown apps**

### Step 4: Install the App
1. Open **File Manager** on phone
2. Navigate to **Downloads** folder
3. Tap **app-debug.apk**
4. Tap **Install**
5. Wait for installation to complete

### Step 5: First Launch
1. Find **Alerto** in app drawer
2. Open the app
3. **Grant permissions**:
   - Location access (required)
   - Notifications (recommended)
   - Storage access (for offline mode)
4. Register or login
5. Test the features!

## 🔧 Advanced: ADB Installation

If you have Android Debug Bridge (ADB) installed:

### Prerequisites
1. **Enable Developer Options**:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings > Developer Options
   - Enable "USB Debugging"

2. **Install via ADB**:
   ```bash
   adb install android\app\build\outputs\apk\debug\app-debug.apk
   ```

## ✅ Testing the New Features

After installation, test these improvements:

### 1. Clean Map Display
- Go to **tabs/map**
- Should show only your location (no colored circles)
- Clean interface for search results

### 2. Disaster-Specific Maps
- **Typhoon Map**: Shows only typhoon evacuation centers
- **Flood Map**: Shows only flood evacuation centers  
- **Earthquake Map**: Shows only earthquake evacuation centers

### 3. Search Functionality
- Use **tabs/search** to find evacuation centers
- Results appear on **tabs/map** with routing

### 4. Offline Detection
- Check the banner at top
- Should accurately show online/offline status

## 🔄 Future Updates

To update the app:
1. Run `build-apk-debug.bat` again
2. Install the new APK (it will update the existing app)

## ⚠️ Troubleshooting

### Installation Issues
- **"Unknown sources blocked"**: Enable unknown sources in Settings
- **"App not installed"**: Clear cache, restart phone, try again
- **"Parse error"**: Re-download/transfer the APK file

### App Issues
- **Crashes on startup**: Grant all permissions, restart app
- **No evacuation centers**: Check internet connection, verify backend is running
- **GPS not working**: Enable location services, grant location permission

### Backend Connection
- Make sure Laravel backend is running at `http://172.30.13.185:8000`
- Phone must be on same network as computer
- Test API: `http://172.30.13.185:8000/api/evacuation-centers`

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Verify all permissions are granted
3. Ensure backend is running and accessible
4. Try rebuilding the APK with latest changes
