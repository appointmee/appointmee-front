import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Navbar } from './navbar/navbar';
import { ApiErrors } from './http/api-errors';
import { NavigationHistory } from './navigation-history';

@Component({
  imports: [RouterOutlet, RouterLink, Navbar],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly apiErrors = inject(ApiErrors);
  private readonly navigationHistory = inject(NavigationHistory);
}
