export interface JwtPayload {
  sub: string;
  codrol?: number | string | null;
  codneg?: number | null;
  audit?: number | null;
  iat?: number;
  exp?: number;
  type?: string;
}

export type RequestUser = { user: JwtPayload };
