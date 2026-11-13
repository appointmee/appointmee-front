export interface RegistroRequest {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
}

export interface RegistroModel extends RegistroRequest {
  confirmarEmail: string;
  confirmarPassword: string;
}
