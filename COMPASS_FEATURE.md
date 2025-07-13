# Directional User Marker Feature Documentation

## Overview
The directional user marker feature has been added to help users understand which direction they are facing on the map. This addresses user confusion about orientation and makes it easier to follow routes by showing a directional indicator directly on the user's location marker.

## Features

### Directional User Marker
- **Location**: User's GPS position on the map
- **Design**: myLocation.png with a blue directional arrow on top
- **Rotation**: Arrow rotates in real-time based on device orientation
- **Visual Feedback**: Clear indication of which way the user is facing

### Real-time Orientation
- **Device Tracking**: Uses device orientation sensors
- **Smooth Rotation**: Arrow rotates smoothly as device moves
- **Accurate Direction**: Shows precise facing direction for navigation
- **Route Following**: Makes it easy to follow turn-by-turn directions

## Implementation Details

### Components Updated
1. **Main Map Page** (`map.page.ts/html/scss`)
   - Added compass container and indicator
   - Implemented device orientation tracking
   - Added toggle functionality

2. **Disaster Map Modal** (`disaster-map-modal.component.ts/html`)
   - Same compass functionality as main map
   - Disaster-specific compass assets
   - Consistent user experience across all map views

### Technical Implementation

#### Device Orientation API
- Uses `DeviceOrientationEvent` for compass heading
- Handles iOS permission requests (iOS 13+)
- Fallback support for different browsers
- Automatic cleanup on component destruction

#### Compass Calculation
```typescript
// Uses webkitCompassHeading for iOS, alpha for Android
const heading = event.webkitCompassHeading || (360 - event.alpha);
```

#### Cardinal Direction Mapping
```typescript
const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const index = Math.round(deviceHeading / 45) % 8;
```

### Browser Compatibility
- **Mobile Devices**: Full support on iOS and Android
- **Desktop**: Limited support (depends on device sensors)
- **Permissions**: Automatic permission handling for iOS 13+

### Performance Considerations
- Orientation tracking only active when compass is visible
- Smooth CSS transitions for rotation animations
- Automatic cleanup prevents memory leaks
- Minimal impact on battery life

## User Experience

### Benefits
1. **Orientation Awareness**: Users always know which direction they're facing
2. **Reduced Confusion**: Clear visual indicator prevents disorientation
3. **Intuitive Design**: Familiar compass metaphor
4. **Consistent Experience**: Available across all map views

### Usage Instructions
1. **Viewing**: Compass appears automatically when GPS is enabled
2. **Toggling**: Click the compass to show/hide it
3. **Reading**: The needle points north, direction text shows current facing
4. **Movement**: Compass updates in real-time as device rotates

## Future Enhancements
- Magnetic declination correction
- Compass calibration feature
- Different compass styles/themes
- Integration with navigation instructions
- Offline compass functionality

## Testing
- Test on various mobile devices (iOS/Android)
- Verify permission handling on iOS 13+
- Check compass accuracy in different locations
- Validate smooth rotation animations
- Ensure proper cleanup on page navigation
