import { SetMetadata } from '@nestjs/common';

export const AUTHZ_PERMISO_KEY = 'authz:permiso';

export const RequirePermiso = (clavePermiso: string) =>
  SetMetadata(AUTHZ_PERMISO_KEY, clavePermiso);
