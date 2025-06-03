import { Routes } from '@angular/router';
import { onboardingGuard } from './services/onboarding.guard';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'loading',
    pathMatch: 'full',
  },
  {
    path: 'loading',
    loadComponent: () => import('./pages/loading/loading.page').then(m => m.LoadingPage)
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
    loadComponent: () => import('./pages/welcome/welcome.page').then(m => m.WelcomePage),
    canActivate: [authGuard]
  },
  {
    path: 'data',
    loadComponent: () => import('./pages/data/data.page').then(m => m.DataPage),
    canActivate: [authGuard]
  },

  {
    path: 'test-icons',
    loadComponent: () => import('./pages/test-icons/test-icons.page').then(m => m.TestIconsPage)
  },
  {
    path: 'data-debug',
    loadComponent: () => import('./pages/data-debug/data-debug.page').then(m => m.DataDebugPage),
    canActivate: [authGuard]
  },
  // Disaster-specific maps
  {
    path: 'earthquake-map',
    loadComponent: () => import('./pages/disaster-maps/earthquake-map.page').then(m => m.EarthquakeMapPage),
    canActivate: [authGuard]
  },
  {
    path: 'typhoon-map',
    loadComponent: () => import('./pages/disaster-maps/typhoon-map.page').then(m => m.TyphoonMapPage),
    canActivate: [authGuard]
  },
  {
    path: 'flood-map',
    loadComponent: () => import('./pages/disaster-maps/flood-map.page').then(m => m.FloodMapPage),
    canActivate: [authGuard]
  },
  {
    path: 'all-maps',
    loadComponent: () => import('./pages/disaster-maps/all-maps.page').then(m => m.AllMapsPage),
    canActivate: [authGuard]
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/tabs/tabs.page').then(m => m.TabsPage),
    canActivate: [authGuard, onboardingGuard],
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
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];
