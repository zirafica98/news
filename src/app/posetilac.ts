import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';

const CITALAC_KEY = 'ai-jutro:citalac';

/**
 * Početna strana je za nove posetioce. Ko je već čitao izdanje (ili je otvorio drugu stranu sajta)
 * i ko koristi instaliranu aplikaciju, ide pravo na današnje izdanje.
 */
export function jeNovPosetilac(): boolean {
  const w = inject(DOCUMENT).defaultView;
  if (!w) return true;
  if (w.matchMedia('(display-mode: standalone)').matches || (w.navigator as Navigator & { standalone?: boolean }).standalone) return false;
  try {
    return localStorage.getItem(CITALAC_KEY) === null;
  } catch {
    return true;
  }
}

/** Posetilac je otvorio izdanje ili drugu stranu: sledeći put ga početna ne zadržava. */
export function zapamtiCitaoca(): void {
  try {
    localStorage.setItem(CITALAC_KEY, '1');
  } catch {
    // Privatni režim: početna se prikazuje svaki put.
  }
}
