export const environment = {
  production: true,

  // API Configuration for production
  // Change this to your production server's URL
  apiUrl: 'http://192.168.110.198:8000/api',

  // Health check endpoint (automatically derived if not specified)
  healthCheckUrl: 'http://192.168.110.198:8000/up',

  // External APIs - Synchronized with WebAlerto backend
  orsApiKey: '5b3ce3597851110001cf62485d16190c4e8d4358bf96e7207454806f', // Updated OpenRouteService API key
  mapboxAccessToken: 'pk.eyJ1IjoiamluY2VudC0xMjM0IiwiYSI6ImNtYzI1bWowNzA0dnYyaXByMHNkZjl5ZTgifQ.bD_y9vt5k4nDV_06PdbUMg', // Synchronized with WebAlerto

  // Firebase configuration - synchronized with WebAlerto backend
  firebase: {
    projectId: 'alerto-ef503',
    messagingSenderId: '660101685392',
    appId: '1:660101685392:android:c7c81cb0ccca4f30cb7815',
    apiKey: 'AIzaSyA5H6_NGbhDlVZ4l67qEC_JNRmcXPQ-GAo',
    databaseURL: 'https://alerto-ef503-default-rtdb.firebaseio.com', // Synchronized with WebAlerto
    storageBucket: 'alerto-ef503.appspot.com' // Synchronized with WebAlerto
  },

  // Communication settings
  communication: {
    retryAttempts: 3,
    timeoutMs: 10000,
    enableOfflineMode: true,
    enableRealTimeUpdates: true
  }
};