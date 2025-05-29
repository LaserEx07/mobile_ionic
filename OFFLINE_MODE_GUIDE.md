# 🔄 Alerto Offline Mode Guide

## Overview
Alerto's offline mode ensures that critical evacuation information remains accessible during disasters when internet connectivity is often compromised. This guide explains how to prepare, use, and manage offline data.

## 🏗️ Offline Mode Architecture

### Core Components
1. **Offline Storage Service** - Manages local data storage
2. **Offline Map Service** - Handles map tile caching
3. **Offline Routing Service** - Manages route caching and fallbacks
4. **Offline Banner Component** - UI for data preparation and status

### Data Storage Structure
- **Evacuation Centers**: Cached in localStorage (50MB limit)
- **Map Tiles**: Base64-encoded images (1000 tiles max, 30-day expiry)
- **Routes**: Cached with coordinates and travel modes (100 recent routes)
- **User Location**: Last known GPS position for offline use

## 📱 How to Use Offline Mode

### 1. Preparing Offline Data (When Online)

#### Automatic Preparation
1. Open the app while connected to internet
2. Look for the **offline banner** at the top of the home page
3. If you see "Prepare offline data for emergencies", tap **"Prepare"**
4. The app will download:
   - All evacuation centers from the backend
   - Map tiles in a 25km radius around your location
   - Routes to the 10 nearest evacuation centers
   - Your current GPS location

#### Manual Preparation
1. Go to any map page
2. Tap the **offline data button** (cloud icon) at the bottom center
3. Select the download option (orange button)
4. Wait for the export to complete

### 2. Using Offline Mode (When Offline)

#### Automatic Offline Detection
- The app automatically detects when you're offline
- An orange **"Offline Mode - Using cached data"** banner appears
- Maps switch to cached tiles automatically
- Evacuation centers load from local storage

#### Manual Offline Mode
1. When offline, tap **"Continue Offline"** in the offline banner
2. The app switches to offline mode and uses cached data
3. All features work with cached information

### 3. Offline Features Available

#### ✅ Available Offline
- **Evacuation Center Markers**: All cached centers display on maps
- **Map Tiles**: Cached map areas show properly
- **Search**: Search cached evacuation centers by name/address/disaster type
- **Disaster Navigation**: Filter centers by earthquake/typhoon/flood
- **Center Details**: View cached information (name, address, capacity, contact)
- **Distance Calculation**: Calculate distances to evacuation centers
- **GPS Location**: Use device GPS for current position

#### ❌ Not Available Offline
- **Live Routing**: No turn-by-turn directions (shows centers only)
- **Real-time Updates**: No new evacuation centers until next sync
- **Online Map Tiles**: Areas not cached show placeholders
- **Fresh Data**: Uses last synced information

## 🔧 Managing Offline Data

### Checking Data Status
- **Home Page Banner**: Shows sync status and data availability
- **Last Sync Time**: Displays when data was last updated
- **Storage Usage**: Shows how much space offline data uses

### Syncing Data
1. Connect to internet
2. Tap **"Sync"** in the offline banner
3. App downloads latest evacuation centers
4. Map tiles and routes are updated

### Exporting/Sharing Data
1. Go to any map page
2. Tap the **offline data button** (cloud icon)
3. Choose:
   - **Download** (orange): Exports JSON file to downloads
   - **Share** (green): Shares via native sharing or copies to clipboard

### Export Data Format
```json
{
  "evacuation_centers": [...],
  "export_timestamp": "2024-01-15T10:30:00Z",
  "last_sync_time": "2024-01-15T09:00:00Z",
  "total_centers": 25,
  "storage_info": {
    "used_mb": "2.5",
    "percentage": "5.0"
  },
  "disaster_types": ["Earthquake", "Typhoon", "Flood"],
  "app_version": "Alerto v1.0"
}
```

## 🚨 Emergency Usage

### When Internet is Lost During Disaster
1. **Don't Panic**: Offline mode activates automatically
2. **Check Banner**: Look for offline status at top of screen
3. **Use Cached Data**: All evacuation centers remain accessible
4. **Navigate by Distance**: Use GPS to find nearest centers
5. **Share Information**: Export data to share with others

### Best Practices for Emergencies
- **Prepare in Advance**: Download offline data before disasters
- **Regular Updates**: Sync data weekly when online
- **Battery Conservation**: GPS works offline but uses battery
- **Share with Others**: Export data to help community members

## 🔍 Troubleshooting

### No Markers Showing When Offline
1. **Check if data was prepared**: Look for "No offline data available" message
2. **Prepare data when online**: Use the "Prepare" button in offline banner
3. **Verify storage**: Check if device has sufficient storage space

### Map Tiles Not Loading
1. **Check cached area**: Only 25km radius around preparation location is cached
2. **Prepare from current location**: Re-prepare data from your current area
3. **Placeholder tiles**: Gray tiles indicate areas not cached

### Search Not Working Offline
1. **Verify cached data**: Ensure evacuation centers were downloaded
2. **Check disaster type**: Make sure centers exist for selected disaster type
3. **Try different search terms**: Search by name, address, or disaster type

## 📊 Storage Limits
- **Total Storage**: 50MB maximum
- **Map Tiles**: 1000 tiles maximum
- **Routes**: 100 recent routes kept
- **Auto-cleanup**: Old data removed automatically

## 🔄 Data Sync Process
1. **Check for updates**: App checks if server has newer data
2. **Download changes**: Only updated centers are downloaded
3. **Update cache**: Local storage is updated with fresh data
4. **Timestamp update**: Last sync time is recorded

This offline functionality ensures that Alerto remains a reliable emergency tool even when disasters disrupt internet connectivity.
