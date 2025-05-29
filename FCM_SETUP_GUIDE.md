# Firebase Cloud Messaging (FCM) Setup Guide

This guide will help you set up Firebase Cloud Messaging (FCM) in your Ionic app to receive push notifications from your Laravel backend.

## Prerequisites

1. A Firebase project (we're using "last-5acaf")
2. The google-services.json file for your Firebase project
3. A Laravel backend with FCM configured

## Setup Steps

### 1. Install Required Packages

```bash
npm install @capacitor-firebase/messaging
npm install @awesome-cordova-plugins/fcm
```

### 2. Configure Firebase in your Ionic App

1. Place the google-services.json file in the root of your Ionic project
2. Copy it to the Android app directory:
   ```bash
   copy google-services.json android/app/
   ```

### 3. Update Android Manifest

Make sure your AndroidManifest.xml has the following:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- ... other elements ... -->

    <application>
        <!-- ... other elements ... -->

        <!-- FCM Services -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false"
            tools:replace="android:exported">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        
        <!-- Custom FCM Service -->
        <service
            android:name=".FCMService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <!-- Set custom default notification icon -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_notification" />
            
        <!-- Set custom default notification color -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/colorAccent" />
            
        <!-- Set custom default notification channel ID -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="general-notifications" />
    </application>

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
</manifest>
```

### 4. Create Notification Resources

1. Create a colors.xml file in android/app/src/main/res/values/:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <resources>
       <color name="colorPrimary">#03B2DD</color>
       <color name="colorPrimaryDark">#0288D1</color>
       <color name="colorAccent">#03B2DD</color>
       <color name="notification_color">#03B2DD</color>
   </resources>
   ```

2. Create a notification icon in android/app/src/main/res/drawable/ic_notification.xml:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <vector xmlns:android="http://schemas.android.com/apk/res/android"
       android:width="24dp"
       android:height="24dp"
       android:viewportWidth="24"
       android:viewportHeight="24">
       <path
           android:fillColor="#FFFFFF"
           android:pathData="M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM12,18.5c-0.83,0 -1.5,-0.67 -1.5,-1.5h3c0,0.83 -0.67,1.5 -1.5,1.5zM17,16L7,16v-1l1,-1v-2.61C8,9.27 9.03,7.47 11,7v-0.5c0,-0.57 0.43,-1 1,-1s1,0.43 1,1L13,7c1.97,0.47 3,2.28 3,4.39L16,14l1,1v1z"/>
   </vector>
   ```

### 5. Create a Custom FCM Service

Create a file at android/app/src/main/java/io/ionic/starter/FCMService.java:

```java
package io.ionic.starter;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class FCMService extends FirebaseMessagingService {
    private static final String TAG = "FCMService";

    // Channel IDs
    private static final String EMERGENCY_CHANNEL_ID = "emergency-alerts";
    private static final String GENERAL_CHANNEL_ID = "general-notifications";
    private static final String INFO_CHANNEL_ID = "info-notifications";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Check if message contains a data payload
        if (remoteMessage.getData().size() > 0) {
            Log.d(TAG, "Message data payload: " + remoteMessage.getData());
            handleDataMessage(remoteMessage.getData());
        }

        // Check if message contains a notification payload
        if (remoteMessage.getNotification() != null) {
            Log.d(TAG, "Message Notification Body: " + remoteMessage.getNotification().getBody());
            handleNotification(remoteMessage.getNotification(), remoteMessage.getData());
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        Log.d(TAG, "Refreshed token: " + token);
        // Send token to your backend
        sendRegistrationToServer(token);
    }

    private void handleDataMessage(Map<String, String> data) {
        try {
            String title = data.get("title");
            String body = data.get("body");
            String category = data.get("category");
            String severity = data.get("severity");

            // Determine channel ID based on severity
            String channelId = getChannelId(severity);

            // Create notification
            sendNotification(title, body, channelId, data);
        } catch (Exception e) {
            Log.e(TAG, "Exception: " + e.getMessage());
        }
    }

    private void handleNotification(RemoteMessage.Notification notification, Map<String, String> data) {
        String title = notification.getTitle();
        String body = notification.getBody();
        String severity = data.get("severity");

        // Determine channel ID based on severity
        String channelId = getChannelId(severity);

        // Create notification
        sendNotification(title, body, channelId, data);
    }

    private String getChannelId(String severity) {
        if (severity != null) {
            switch (severity.toLowerCase()) {
                case "high":
                    return EMERGENCY_CHANNEL_ID;
                case "low":
                    return INFO_CHANNEL_ID;
                default:
                    return GENERAL_CHANNEL_ID;
            }
        }
        return GENERAL_CHANNEL_ID;
    }

    private void sendNotification(String title, String body, String channelId, Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        
        // Add data to intent
        Bundle bundle = new Bundle();
        for (Map.Entry<String, String> entry : data.entrySet()) {
            bundle.putString(entry.getKey(), entry.getValue());
        }
        intent.putExtras(bundle);
        
        // Create pending intent
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            intent, 
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        // Set notification sound
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        
        // Build notification
        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent);

        // Get notification manager
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        // Create notification channels for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            createNotificationChannels(notificationManager);
        }

        // Show notification
        int notificationId = (int) System.currentTimeMillis();
        notificationManager.notify(notificationId, notificationBuilder.build());
    }

    private void createNotificationChannels(NotificationManager notificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Create emergency channel
            NotificationChannel emergencyChannel = new NotificationChannel(
                EMERGENCY_CHANNEL_ID,
                "Emergency Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            emergencyChannel.setDescription("High priority notifications for emergencies");
            emergencyChannel.enableLights(true);
            emergencyChannel.enableVibration(true);
            notificationManager.createNotificationChannel(emergencyChannel);

            // Create general channel
            NotificationChannel generalChannel = new NotificationChannel(
                GENERAL_CHANNEL_ID,
                "General Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            generalChannel.setDescription("Standard notifications");
            notificationManager.createNotificationChannel(generalChannel);

            // Create info channel
            NotificationChannel infoChannel = new NotificationChannel(
                INFO_CHANNEL_ID,
                "Information",
                NotificationManager.IMPORTANCE_LOW
            );
            infoChannel.setDescription("Low priority informational notifications");
            notificationManager.createNotificationChannel(infoChannel);
        }
    }

    private void sendRegistrationToServer(String token) {
        // TODO: Send token to your backend
        Log.d(TAG, "Sending token to server: " + token);
    }
}
```

### 6. Build and Run the App

```bash
npx cap run android
```

## Testing FCM Notifications

To test FCM notifications, send a POST request to your Laravel backend:

```
POST /api/notifications/send
{
  "title": "Test Notification",
  "body": "This is a test notification",
  "category": "General",
  "severity": "high"
}
```

## Troubleshooting

If notifications are not displaying:

1. Check if Google Play Services is installed and up to date
2. Verify that notification permissions are granted
3. Check the Android logs for any errors
4. Try refreshing the FCM token
5. Make sure the FCM token is properly registered with the backend

For more detailed troubleshooting, see the FCM_TROUBLESHOOTING.md file.
