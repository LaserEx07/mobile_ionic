# FCM Notification Troubleshooting Guide

This guide will help you troubleshoot issues with Firebase Cloud Messaging (FCM) notifications in your Ionic app.

## Common Issues and Solutions

### 1. Notifications Not Displaying on Android

If notifications are not displaying on your Android device, check the following:

#### Google Play Services

- Make sure Google Play Services is installed and up to date on your device
- Open the Google Play Store app and search for "Google Play Services"
- If it's installed, make sure it's updated to the latest version

#### Notification Channels

- For Android 8.0+ (API level 26+), notification channels are required
- Make sure the notification channels are properly created in the app
- Check the Android Manifest for proper channel configuration

#### Notification Permissions

- Make sure the app has notification permissions
- Go to Settings > Apps > Your App > Notifications and ensure they are enabled

### 2. Background Notifications Not Working

If notifications work when the app is in the foreground but not in the background:

- Make sure the FCM service is properly registered in the Android Manifest
- Check that the notification icon and color are properly configured
- Ensure the notification channel is set to the correct importance level

### 3. Notification Clicks Not Working

If clicking on notifications doesn't open the app or navigate to the correct screen:

- Make sure the intent filters are properly configured in the Android Manifest
- Check that the notification includes the correct data payload
- Verify that the notification click handler is properly implemented

### 4. Testing FCM Notifications

To test FCM notifications:

1. Make sure your device is connected to the internet
2. Send a test notification from the Laravel backend
3. Check the device logs for any errors
4. Verify that the FCM token is properly registered with the backend

## Debugging Steps

### 1. Check FCM Token Registration

Make sure the FCM token is properly registered with the backend:

```typescript
// In your app
const token = await FirebaseMessaging.getToken();
console.log('FCM Token:', token);
```

### 2. Check Android Logs

Use Android Studio's Logcat to check for FCM-related logs:

1. Connect your device to your computer
2. Open Android Studio
3. Open the Logcat window
4. Filter for "FCM" or "Firebase"

### 3. Test with Firebase Console

Test sending notifications directly from the Firebase Console:

1. Go to the Firebase Console
2. Select your project
3. Go to Messaging
4. Send a test message to your device

### 4. Check Backend Logs

Check the Laravel backend logs for any errors when sending notifications:

```bash
tail -f storage/logs/laravel.log
```

## Refreshing FCM Token

If you're still having issues, try refreshing the FCM token:

1. Go to the app settings
2. Find the "Refresh Notification Token" option
3. Tap it to refresh the token
4. Check the logs to make sure the new token is registered with the backend

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Firebase Messaging Plugin](https://github.com/capacitor-community/firebase-messaging)
- [Android Notification Channels](https://developer.android.com/develop/ui/views/notifications/channels)
