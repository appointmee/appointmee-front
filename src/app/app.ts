import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Navbar } from './navbar/navbar';
import { apiErrorsService } from './http/api-errors-service';

@Component({
  imports: [RouterOutlet, RouterLink, Navbar],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly apiErrors = inject(apiErrorsService);
}
