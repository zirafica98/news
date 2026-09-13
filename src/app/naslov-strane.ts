import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Kljuc } from './i18n';
import { PodesavanjaService } from './podesavanja.service';

/** Naslov taba iz `data.naslov` rute, preveden i osvežen kad se promeni jezik. */
@Injectable({ providedIn: 'root' })
export class NaslovStrane extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly podesavanja = inject(PodesavanjaService);
  private readonly kljuc = signal<Kljuc | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      const kljuc = this.kljuc();
      this.title.setTitle(kljuc ? `${this.podesavanja.t(kljuc)} · AI Jutro` : 'AI Jutro');
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let ruta = snapshot.root;
    while (ruta.firstChild) ruta = ruta.firstChild;
    this.kljuc.set(ruta.data['naslov']);
  }
}
