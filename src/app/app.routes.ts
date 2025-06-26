import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/intro',
    pathMatch: 'full',
  },
  {
    path: 'intro',
    loadComponent: () => import('./pages/intro/intro.page').then(m => m.IntroPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage)
  },
  {
    path: 'welcome',
    loadComponent: () => import('./pages/welcome/welcome.page').then(m => m.WelcomePage)
  },
  {
    path: 'onboarding-2',
    loadComponent: () => import('./pages/onboarding-2/onboarding-2.page').then(m => m.Onboarding2Page)
  },
  {
    path: 'onboarding-3',
    loadComponent: () => import('./pages/onboarding-3/onboarding-3.page').then(m => m.Onboarding3Page)
  },
  {
    path: 'onboarding-4',
    loadComponent: () => import('./pages/onboarding-4/onboarding-4.page').then(m => m.Onboarding4Page)
  },
  // Disaster-specific maps
  {
    path: 'earthquake-map',
    loadComponent: () => import('./pages/disaster-maps/earthquake-map.page').then(m => m.EarthquakeMapPage)
  },
  {
    path: 'typhoon-map',
    loadComponent: () => import('./pages/disaster-maps/typhoon-map.page').then(m => m.TyphoonMapPage)
  },
  {
    path: 'flood-map',
    loadComponent: () => import('./pages/disaster-maps/flood-map.page').then(m => m.FloodMapPage)
  },
  {
    path: 'fire-map',
    loadComponent: () => import('./pages/disaster-maps/fire-map.page').then(m => m.FireMapPage)
  },
  {
    path: 'landslide-map',
    loadComponent: () => import('./pages/disaster-maps/landslide-map.page').then(m => m.LandslideMapPage)
  },
  {
    path: 'all-maps',
    loadComponent: () => import('./pages/disaster-maps/all-maps.page').then(m => m.AllMapsPage)
  },
  {
    path: 'ors-test',
    loadChildren: () => import('./pages/ors-test/ors-test.module').then(m => m.OrsTestPageModule)
  },
  {
    path: 'real-time-demo',
    loadComponent: () => import('./pages/real-time-demo/real-time-demo.page').then(m => m.RealTimeDemoPage)
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage)
      },
      {
        path: 'search',
        loadComponent: () => import('./pages/search/search.page').then(m => m.SearchPage)
      },
      {
        path: 'map',
        loadComponent: () => import('./pages/map/map.page').then(m => m.MapPage)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage)
      },
      // Disaster maps accessible through tabs (for navigation consistency)
      {
        path: 'earthquake-map',
        loadComponent: () => import('./pages/disaster-maps/earthquake-map.page').then(m => m.EarthquakeMapPage)
      },
      {
        path: 'typhoon-map',
        loadComponent: () => import('./pages/disaster-maps/typhoon-map.page').then(m => m.TyphoonMapPage)
      },
      {
        path: 'flood-map',
        loadComponent: () => import('./pages/disaster-maps/flood-map.page').then(m => m.FloodMapPage)
      },
      {
        path: 'fire-map',
        loadComponent: () => import('./pages/disaster-maps/fire-map.page').then(m => m.FireMapPage)
      },
      {
        path: 'landslide-map',
        loadComponent: () => import('./pages/disaster-maps/landslide-map.page').then(m => m.LandslideMapPage)
      },
      {
        path: 'all-maps',
        loadComponent: () => import('./pages/disaster-maps/all-maps.page').then(m => m.AllMapsPage)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];
