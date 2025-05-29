import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tabs',
    children: [
      {
        path: 'home',
        loadComponent: () => import('../pages/home/home.page').then(m => m.HomePage)
      },
      {
        path: 'map',
        loadComponent: () => import('../pages/map/map.page').then(m => m.MapPage)
      },
      {
        path: 'search',
        loadComponent: () => import('../pages/search/search.page').then(m => m.SearchPage)
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  }
];
