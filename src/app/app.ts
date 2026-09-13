import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly linkovi = [
    { putanja: '/', naziv: 'Danas', tacno: true },
    { putanja: '/arhiva', naziv: 'Arhiva', tacno: false },
    { putanja: '/sacuvano', naziv: 'Sačuvano', tacno: false },
  ];
}
