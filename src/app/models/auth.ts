export interface Tokens {
  accessToken?: string;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UsuarioSesion {
  id: number;
  roles: readonly string[];
  fotoPerfil: string | null;
  email: string | null;
}

export interface PerfilResponse {
  id: number;
  roles: readonly string[];
  fotoPerfil: string | null;
}

export interface LoginModel {
  email: string;
  password: string;
}

export interface VerificacionEmailModel {
  email: string;
  codigo: string;
}

export interface MensajeResponse {
  message: string;
}

export interface VerificacionPendiente {
  email: string;
  intentos: number;
  reenviarDesde: number;
  codigoVenceEn: number;
  verificationToken: string;
  expiresAt: number;
  enviado: boolean;
}

export interface VerificacionEmailResponse {
  message: string;
  token: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  usuario: PerfilResponse;
}

export interface EstadoVerificacion {
  verificada: boolean;
  enviado: boolean;
  enviadoAhora: boolean;
  retryAfterSeconds: number;
  attemptsRemaining: number;
  expiresInSeconds: number;
}
