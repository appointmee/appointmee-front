import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { captureResetPasswordToken } from './app/security/reset-password-token';

captureResetPasswordToken(window.location, window.history);

bootstrapApplication(App, appConfig).catch(() =>
  console.error('[AppointMee] No se pudo iniciar la aplicación.', { reference: crypto.randomUUID() }),
);
