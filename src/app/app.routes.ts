import { Routes } from '@angular/router';
import { Kljuc } from './i18n';

const vesti = () => import('./pages/vesti-page').then((m) => m.VestiPage);
const istrazivanje = () => import('./pages/istrazivanje-page').then((m) => m.IstrazivanjePage);
const ideje = () => import('./pages/ideje-page').then((m) => m.IdejePage);
const mreze = () => import('./pages/mreze-page').then((m) => m.MrezePage);
const vest = () => import('./pages/vest-page').then((m) => m.VestPage);

/** Naslov taba prevodi NaslovStrane. */
const naslov = (kljuc: Kljuc) => ({ naslov: kljuc });

export const routes: Routes = [
  // Početna (šta je AI Morning Brief, današnje vesti vizuelno, prijava) je za sve; najnovije izdanje je na /today.
  { path: '', data: { vlastitiNaslov: true }, loadComponent: () => import('./pages/pocetna-page').then((m) => m.PocetnaPage) },
  { path: 'today', data: naslov('nav.vesti'), loadComponent: vesti },
  { path: 'research', data: naslov('nav.istrazivanje'), loadComponent: istrazivanje },
  { path: 'ideas', data: naslov('nav.ideje'), loadComponent: ideje },
  { path: 'social', data: naslov('nav.mreze'), loadComponent: mreze },
  { path: 'prices', data: naslov('naslov.cene'), loadComponent: () => import('./pages/cene-page').then((m) => m.CenePage) },
  { path: 'brief/:datum', data: naslov('nav.vesti'), loadComponent: vesti },
  { path: 'brief/:datum/story/:broj', data: { vrsta: 'vest', vlastitiNaslov: true }, loadComponent: vest },
  { path: 'brief/:datum/tool/:broj', data: { vrsta: 'novo', vlastitiNaslov: true }, loadComponent: vest },
  { path: 'brief/:datum/research', data: naslov('nav.istrazivanje'), loadComponent: istrazivanje },
  { path: 'brief/:datum/ideas', data: naslov('nav.ideje'), loadComponent: ideje },
  { path: 'brief/:datum/social', data: naslov('nav.mreze'), loadComponent: mreze },
  { path: 'archive', data: naslov('nav.arhiva'), loadComponent: () => import('./pages/arhiva-page').then((m) => m.ArhivaPage) },
  { path: 'saved', data: naslov('nav.sacuvano'), loadComponent: () => import('./pages/sacuvano-page').then((m) => m.SacuvanoPage) },

  // Stare srpske adrese (linkovi iz notifikacija, Telegrama i pretrage). Na sajtu ih preusmerava i vercel.json (301).
  { path: 'danas', redirectTo: 'today' },
  { path: 'istrazivanje', redirectTo: 'research' },
  { path: 'ideje', redirectTo: 'ideas' },
  { path: 'mreze', redirectTo: 'social' },
  { path: 'cene', redirectTo: 'prices' },
  { path: 'arhiva', redirectTo: 'archive' },
  { path: 'sacuvano', redirectTo: 'saved' },
  { path: 'izdanje/:datum', redirectTo: 'brief/:datum' },
  { path: 'izdanje/:datum/vest/:broj', redirectTo: 'brief/:datum/story/:broj' },
  { path: 'izdanje/:datum/novo/:broj', redirectTo: 'brief/:datum/tool/:broj' },
  { path: 'izdanje/:datum/istrazivanje', redirectTo: 'brief/:datum/research' },
  { path: 'izdanje/:datum/ideje', redirectTo: 'brief/:datum/ideas' },
  { path: 'izdanje/:datum/mreze', redirectTo: 'brief/:datum/social' },
  { path: '**', redirectTo: '' },
];
