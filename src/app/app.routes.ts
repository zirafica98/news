import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', title: 'AI Jutro', loadComponent: () => import('./pages/izdanje-page').then((m) => m.IzdanjePage) },
  { path: 'izdanje/:datum', title: 'AI Jutro', loadComponent: () => import('./pages/izdanje-page').then((m) => m.IzdanjePage) },
  { path: 'arhiva', title: 'Arhiva · AI Jutro', loadComponent: () => import('./pages/arhiva-page').then((m) => m.ArhivaPage) },
  { path: 'sacuvano', title: 'Sačuvano · AI Jutro', loadComponent: () => import('./pages/sacuvano-page').then((m) => m.SacuvanoPage) },
  { path: '**', redirectTo: '' },
];
