import fs from 'node:fs';
import path from 'node:path';

import {
  MODULOS as FALLBACK_MODULOS,
  MODULO_PERMISOS as FALLBACK_MODULO_PERMISOS,
  PERMISOS as FALLBACK_PERMISOS,
} from './rbac.permisos';

export type RbacManifestModule = { key: string; nombre: string };
export type RbacManifestPermission = {
  clave: string;
  nombre: string;
  detalle?: string | null;
  moduloKey?: string;
};

export type RbacManifest = {
  version: number;
  generatedAt?: string;
  modules: RbacManifestModule[];
  modulePermissions: Record<string, string[]>;
  permissions: RbacManifestPermission[];
};

export type RbacCatalog = {
  source: 'manifest' | 'fallback';
  modulos: RbacManifestModule[];
  moduloPermisos: Record<string, string[]>;
  permisos: RbacManifestPermission[];
};

let cached: RbacCatalog | null = null;

function defaultManifestPath(): string {
  // Preferimos un archivo en la raíz del proyecto (no dentro de dist)
  return path.resolve(process.cwd(), 'rbac.manifest.json');
}

function isManifestEnabled(): boolean {
  return String(process.env.RBAC_MANIFEST_ENABLED ?? '').trim() === '1';
}

function normalizeModuleKey(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function tryLoadManifestFile(filePath: string): RbacManifest | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return null;

    const version = Number((parsed as any).version);
    const modules = (parsed as any).modules;
    const modulePermissions = (parsed as any).modulePermissions;
    const permissions = (parsed as any).permissions;

    if (!Number.isFinite(version) || !Array.isArray(modules) || !isObject(modulePermissions) || !Array.isArray(permissions)) {
      return null;
    }

    return {
      version,
      generatedAt: (parsed as any).generatedAt,
      modules: modules.map((m: any) => ({
        key: normalizeModuleKey(m?.key),
        nombre: String(m?.nombre ?? '').trim(),
      })),
      modulePermissions: Object.fromEntries(
        Object.entries(modulePermissions).map(([k, v]) => [
          normalizeModuleKey(k),
          Array.isArray(v) ? v.map((x) => String(x).trim()) : [],
        ]),
      ),
      permissions: permissions.map((p: any) => ({
        clave: String(p?.clave ?? '').trim(),
        nombre: String(p?.nombre ?? '').trim(),
        detalle: p?.detalle ?? null,
        moduloKey: p?.moduloKey ? normalizeModuleKey(p.moduloKey) : undefined,
      })),
    };
  } catch {
    return null;
  }
}

function buildFallbackCatalog(): RbacCatalog {
  return {
    source: 'fallback',
    modulos: FALLBACK_MODULOS.map((m) => ({ key: m.key, nombre: m.nombre })),
    moduloPermisos: FALLBACK_MODULO_PERMISOS as unknown as Record<string, string[]>,
    permisos: FALLBACK_PERMISOS.map((p) => ({
      clave: p.clave,
      nombre: p.nombre,
      detalle: p.detalle ?? null,
      moduloKey: p.modulo,
    })),
  };
}

export function getRbacCatalog(): RbacCatalog {
  if (cached) return cached;

  if (!isManifestEnabled()) {
    cached = buildFallbackCatalog();
    return cached;
  }

  const filePath = process.env.RBAC_MANIFEST_PATH
    ? path.resolve(process.env.RBAC_MANIFEST_PATH)
    : defaultManifestPath();

  const manifest = tryLoadManifestFile(filePath);
  if (!manifest) {
    cached = buildFallbackCatalog();
    return cached;
  }

  cached = {
    source: 'manifest',
    modulos: manifest.modules,
    moduloPermisos: manifest.modulePermissions,
    permisos: manifest.permissions,
  };

  return cached;
}
