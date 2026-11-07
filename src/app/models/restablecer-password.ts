export interface RestablecerPasswordModel {
  password: string;
  confirmarPassword: string;
}

export interface EstadoRecuperacion {
  valido: boolean;
  expiresInSeconds: number;
}
