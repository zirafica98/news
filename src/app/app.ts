import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { PodesavanjaMeni } from './components/podesavanja-meni';
import { Sekcija, putanjaSekcije } from './izdanje-ruta';
import { PodesavanjaService } from './podesavanja.service';

type Kartica = Sekcija | 'cene';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PodesavanjaMeni],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly t = inject(PodesavanjaService).t;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Kad gledaš staro izdanje, kartice ostaju na tom danu. */
  private readonly datum = computed(() => this.url().match(/^\/izdanje\/(\d{4}-\d{2}-\d{2})/)?.[1]);

  protected readonly aktivna = computed<Kartica | null>(() => {
    const putanja = this.url().split(/[?#]/)[0];
    if (putanja.startsWith('/arhiva') || putanja.startsWith('/sacuvano')) return null;
    if (putanja.endsWith('/istrazivanje')) return 'istrazivanje';
    if (putanja.endsWith('/ideje')) return 'ideje';
    if (putanja.endsWith('/mreze')) return 'mreze';
    if (putanja.startsWith('/cene')) return 'cene';
    return 'vesti';
  });

  protected readonly kartice = computed(() => {
    const d = this.datum();
    return [
      { id: 'vesti' as const, naziv: 'nav.vesti' as const, link: putanjaSekcije('vesti', d), ikona: 'M4 5h16M4 10h16M4 15h10M4 20h7' },
      { id: 'istrazivanje' as const, naziv: 'nav.istrazivanje' as const, link: putanjaSekcije('istrazivanje', d), ikona: 'M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M8.5 3h7M7 15h10' },
      { id: 'ideje' as const, naziv: 'nav.ideje' as const, link: putanjaSekcije('ideje', d), ikona: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z' },
      { id: 'mreze' as const, naziv: 'nav.mreze' as const, link: putanjaSekcije('mreze', d), ikona: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12zM8.5 10.5h7M8.5 14h4.5' },
      { id: 'cene' as const, naziv: 'nav.cene' as const, link: ['/cene'], ikona: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
    ];
  });
}
