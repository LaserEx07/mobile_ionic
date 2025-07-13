/**
 * Test script to help debug notification routing issues
 * This can be called from browser console or added to a test page
 */

export class NotificationRoutingTester {
  
  /**
   * Test notification routing with sample data
   */
  static testNotificationRouting() {
    console.log('🧪 Testing notification routing...');
    
    // Sample notification data that should trigger routing
    const testNotifications = [
      {
        category: 'earthquake',
        severity: 'high',
        title: 'Earthquake Alert',
        message: 'Strong earthquake detected in your area',
        notification_id: 'test-1'
      },
      {
        category: 'typhoon',
        severity: 'critical',
        title: 'Typhoon Warning',
        message: 'Typhoon approaching your location',
        notification_id: 'test-2'
      },
      {
        category: 'flood',
        severity: 'medium',
        title: 'Flood Alert',
        message: 'Flooding reported in nearby areas',
        notification_id: 'test-3'
      },
      {
        category: 'fire',
        severity: 'high',
        title: 'Fire Emergency',
        message: 'Fire reported in your vicinity',
        notification_id: 'test-4'
      },
      {
        category: 'others',
        severity: 'high',
        title: 'Emergency Alert',
        message: 'OTHERS:TSUNAMI - Tsunami warning issued',
        notification_id: 'test-5'
      }
    ];

    testNotifications.forEach((notification, index) => {
      console.log(`\n📱 Test ${index + 1}: ${notification.category.toUpperCase()}`);
      console.log('Notification data:', notification);
      
      // Test the routing logic
      const shouldRoute = this.shouldRouteToDisasterMap(notification.category, notification.severity);
      const route = this.getExpectedRoute(notification.category);
      
      console.log(`Should route: ${shouldRoute}`);
      console.log(`Expected route: ${route}`);
      console.log('---');
    });
  }

  /**
   * Test if notification should route to disaster map
   */
  private static shouldRouteToDisasterMap(category: string, severity: string): boolean {
    const disasterCategories = ['earthquake', 'flood', 'typhoon', 'fire', 'landslide', 'others'];
    const emergencySeverities = ['high', 'critical', 'emergency'];

    return disasterCategories.includes(category) || emergencySeverities.includes(severity);
  }

  /**
   * Get expected route for disaster category
   */
  private static getExpectedRoute(category: string): string {
    const disasterRoutes: { [key: string]: string } = {
      'earthquake': '/tabs/earthquake-map',
      'flood': '/tabs/flood-map',
      'typhoon': '/tabs/typhoon-map',
      'landslide': '/tabs/landslide-map',
      'fire': '/tabs/fire-map'
    };

    return disasterRoutes[category] || '/tabs/map';
  }

  /**
   * Simulate a notification action for testing
   */
  static simulateNotificationAction(category: string, severity: string = 'high') {
    const mockAction = {
      notification: {
        extra: {
          category: category,
          severity: severity,
          title: `${category.toUpperCase()} Alert`,
          message: `Test ${category} notification`,
          notification_id: `test-${Date.now()}`
        }
      }
    };

    console.log('🔔 Simulating notification action:', mockAction);
    
    // This would normally be handled by the FCM service
    // You can copy this data and test it manually
    return mockAction;
  }
}

// Make it available globally for testing
(window as any).NotificationRoutingTester = NotificationRoutingTester;

console.log('🧪 Notification Routing Tester loaded. Use NotificationRoutingTester.testNotificationRouting() to test.');
