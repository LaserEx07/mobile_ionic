import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: [
      '@ionic/angular',
      '@ionic/angular/standalone',
      '@ionic/core',
      '@ionic/core/components'
    ],
    include: [
      '@ionic/angular > @ionic/core/loader'
    ]
  },
  build: {
    rollupOptions: {
      external: []
    }
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
});
