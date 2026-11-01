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
