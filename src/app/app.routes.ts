import { Routes } from '@angular/router';

const vesti = () => import('./pages/vesti-page').then((m) => m.VestiPage);
const istrazivanje = () => import('./pages/istrazivanje-page').then((m) => m.IstrazivanjePage);
const ideje = () => import('./pages/ideje-page').then((m) => m.IdejePage);

export const routes: Routes = [
  { path: '', title: 'Vesti · AI Jutro', loadComponent: vesti },
  { path: 'istrazivanje', title: 'Istraživanje · AI Jutro', loadComponent: istrazivanje },
  { path: 'ideje', title: 'Ideje · AI Jutro', loadComponent: ideje },
  { path: 'cene', title: 'Cene tokena · AI Jutro', loadComponent: () => import('./pages/cene-page').then((m) => m.CenePage) },
  { path: 'izdanje/:datum', title: 'Vesti · AI Jutro', loadComponent: vesti },
  { path: 'izdanje/:datum/istrazivanje', title: 'Istraživanje · AI Jutro', loadComponent: istrazivanje },
  { path: 'izdanje/:datum/ideje', title: 'Ideje · AI Jutro', loadComponent: ideje },
  { path: 'arhiva', title: 'Arhiva · AI Jutro', loadComponent: () => import('./pages/arhiva-page').then((m) => m.ArhivaPage) },
  { path: 'sacuvano', title: 'Sačuvano · AI Jutro', loadComponent: () => import('./pages/sacuvano-page').then((m) => m.SacuvanoPage) },
  { path: '**', redirectTo: '' },
];
