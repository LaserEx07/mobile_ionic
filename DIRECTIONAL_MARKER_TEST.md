# Directional Marker Test Instructions

## What to Look For

When you open the map page, you should now see:

1. **User Location Marker**: The familiar blue myLocation.png icon
2. **Red Direction Arrow**: A red triangular arrow pointing upward from the user marker
3. **Console Logs**: Check browser console for debugging messages

## Expected Behavior

### Static Arrow (Always Visible)
- A red arrow should always be visible on top of your location marker
- The arrow points "north" by default (upward on the map)
- This should be visible even if device orientation isn't working

### Dynamic Arrow (If Device Orientation Works)
- The arrow should rotate as you rotate your device
- Console should show "Device heading updated: [number]" messages
- Arrow direction should change smoothly as you turn

## Testing Steps

1. **Open the app** and go to the Map tab
2. **Allow location permissions** when prompted
3. **Look for the red arrow** on your location marker
4. **Check browser console** (F12 → Console) for debug messages
5. **Try rotating your device** (if on mobile) or simulating orientation change

## Troubleshooting

### If you don't see the red arrow:
1. Check if GPS is enabled (green GPS button in top-right)
2. Look in browser console for error messages
3. Try refreshing the page
4. Check if location permissions are granted

### If the arrow doesn't rotate:
1. Check console for "Device heading updated" messages
2. Try on a real mobile device (orientation may not work in browser)
3. Check if device orientation permissions are granted (iOS)

## Debug Information

The following console messages indicate the feature is working:
- "Creating directional marker with heading: [number]"
- "Device heading updated: [number]"
- "Starting orientation tracking"

## Browser vs Mobile Device

- **Browser**: Arrow should be visible but may not rotate (no orientation sensors)
- **Mobile**: Arrow should be visible AND rotate with device orientation
- **iOS**: May require permission prompt for device orientation

## Visual Specifications

- **Arrow Color**: Red (#FF4444)
- **Arrow Size**: 12px height, 6px width on each side
- **Position**: Centered above the location marker
- **Shadow**: Drop shadow for better visibility
- **Rotation**: Smooth CSS transition (0.3s ease)

## Success Criteria

✅ Red arrow is visible on user location marker
✅ Arrow points upward by default
✅ Console shows creation and heading messages
✅ (Mobile only) Arrow rotates with device orientation
