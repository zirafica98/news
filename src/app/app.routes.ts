import { Routes } from '@angular/router';
import { Kljuc } from './i18n';

const vesti = () => import('./pages/vesti-page').then((m) => m.VestiPage);
const istrazivanje = () => import('./pages/istrazivanje-page').then((m) => m.IstrazivanjePage);
const ideje = () => import('./pages/ideje-page').then((m) => m.IdejePage);

/** Naslov taba prevodi NaslovStrane. */
const naslov = (kljuc: Kljuc) => ({ naslov: kljuc });

export const routes: Routes = [
  { path: '', data: naslov('nav.vesti'), loadComponent: vesti },
  { path: 'istrazivanje', data: naslov('nav.istrazivanje'), loadComponent: istrazivanje },
  { path: 'ideje', data: naslov('nav.ideje'), loadComponent: ideje },
  { path: 'cene', data: naslov('naslov.cene'), loadComponent: () => import('./pages/cene-page').then((m) => m.CenePage) },
  { path: 'izdanje/:datum', data: naslov('nav.vesti'), loadComponent: vesti },
  { path: 'izdanje/:datum/istrazivanje', data: naslov('nav.istrazivanje'), loadComponent: istrazivanje },
  { path: 'izdanje/:datum/ideje', data: naslov('nav.ideje'), loadComponent: ideje },
  { path: 'arhiva', data: naslov('nav.arhiva'), loadComponent: () => import('./pages/arhiva-page').then((m) => m.ArhivaPage) },
  { path: 'sacuvano', data: naslov('nav.sacuvano'), loadComponent: () => import('./pages/sacuvano-page').then((m) => m.SacuvanoPage) },
  { path: '**', redirectTo: '' },
];
