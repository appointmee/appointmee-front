// Copia histórica del login anterior. Sin ruta, imports activos ni componente ejecutable.
// Se conserva como comentarios porque sus dependencias originales fueron reemplazadas.

// import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
// import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// import { Auth } from '../../auth/auth';
// import { ApiError } from '../../http/api-errors';
//
// /**
//  * Login mínimo para poder levantar sesión durante el demo 2 (navbar autenticado).
//  * Después se reemplaza por la US del flujo de login.
//  */
// @Component({
//   selector: 'app-login',
//   imports: [RouterLink],
//   templateUrl: './login.html',
//   styleUrl: './login.css',
//   changeDetection: ChangeDetectionStrategy.OnPush,
// })
// export class LoginPage {
//   private readonly auth = inject(Auth);
//   private readonly router = inject(Router);
//   private readonly route = inject(ActivatedRoute);
//
//   protected readonly email = signal('');
//   protected readonly contrasenia = signal('');
//   protected readonly enviando = signal(false);
//   protected readonly error = signal('');
//   protected readonly fieldErrors = signal<Readonly<Record<string, string>>>({});
//
//   constructor() {
//     if (this.route.snapshot.queryParamMap.get('expired') === '1') {
//       this.error.set('Tu sesión expiró. Iniciá sesión para continuar.');
//     }
//   }
//
//   protected actualizarEmail(event: Event): void {
//     this.email.set((event.target as HTMLInputElement).value);
//   }
//
//   protected actualizarContrasenia(event: Event): void {
//     this.contrasenia.set((event.target as HTMLInputElement).value);
//   }
//
//   protected enviar(event: Event): void {
//     event.preventDefault();
//
//     const email = this.email().trim();
//
//     if (!email || !this.contrasenia()) {
//       this.error.set('Completá email y contraseña.');
//       return;
//     }
//
//     this.enviando.set(true);
//     this.error.set('');
//     this.fieldErrors.set({});
//
//     this.auth.iniciarSesion(email, this.contrasenia()).subscribe({
//       next: () => {
//         this.enviando.set(false);
//         void this.router.navigateByUrl(this.safeReturnTo());
//       },
//       error: (cause: ApiError) => {
//         this.enviando.set(false);
//         if ([400, 422, 409].includes(cause?.status) && Object.keys(cause.fields).length) {
//           this.fieldErrors.set(cause.fields);
//           return;
//         }
//         this.error.set(cause?.status === 0
//           ? 'No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.'
//           : cause?.status === 409
//             ? cause.message
//             : 'No pudimos iniciar sesión. Revisá el email y la contraseña.');
//       },
//     });
//   }
//
//   private safeReturnTo(): string {
//     const destination = this.route.snapshot.queryParamMap.get('returnTo');
//     return destination?.startsWith('/') && !destination.startsWith('//') && !destination.startsWith('/login')
//       ? destination
//       : '/';
//   }
// }
