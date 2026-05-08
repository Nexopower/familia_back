import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    manifest: null,
    catalog: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') {
      args.manifest = argv[i + 1] ?? null;
      i++;
    } else if (a === '--catalog') {
      args.catalog = argv[i + 1] ?? null;
      i++;
    }
  }
  return args;
}

function detectNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function normalizeKey(value) {
  return String(value ?? '').trim().toUpperCase();
}

function extractUnionKeys(source, typeName) {
  const re = new RegExp(`export\\s+type\\s+${typeName}\\s*=([\\s\\S]*?);`);
  const match = source.match(re);
  if (!match) throw new Error(`No se encontró el type ${typeName} en el catálogo`);
  const block = match[1];
  const keys = [];
  const strRe = /'([^']+)'/g;
  for (;;) {
    const m = strRe.exec(block);
    if (!m) break;
    keys.push(m[1]);
  }
  return { match, keys };
}

function replaceUnion(source, typeName, keys, NL) {
  const re = new RegExp(`export\\s+type\\s+${typeName}\\s*=([\\s\\S]*?);`);
  const union = `export type ${typeName} =${NL}${keys
    .map((k) => `  | '${k}'`)
    .join(NL)};`;
  return source.replace(re, union);
}

function findBlockRange(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return null;
  return { start };
}

function extractModulesFromModulosArray(source) {
  const startMarker = 'export const MODULOS';
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error('No se encontró export const MODULOS');
  const end = source.indexOf('];', start);
  if (end < 0) throw new Error('No se pudo cerrar MODULOS');
  const block = source.slice(start, end + 2);

  const keys = [];
  const re = /key:\s*'([^']+)'/g;
  for (;;) {
    const m = re.exec(block);
    if (!m) break;
    keys.push(m[1]);
  }
  return { start, end: end + 2, block, keys };
}

function insertIntoModulos(source, modulosInfo, newModules, NL) {
  if (!newModules.length) return source;

  const insertion = newModules
    .map((m) => `  { key: '${m.key}', nombre: '${m.nombre}' },`)
    .join(NL);

  const insertAt = modulosInfo.end - 2; // before "];"
  return source.slice(0, insertAt) + NL + insertion + NL + source.slice(insertAt);
}

function extractRecordBlock(source, constName) {
  const startMarker = `export const ${constName}`;
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`No se encontró export const ${constName}`);
  const open = source.indexOf('{', start);
  if (open < 0) throw new Error(`No se encontró '{' para ${constName}`);

  // Busca el cierre '};' del record (primer match desde open)
  const close = source.indexOf('};', open);
  if (close < 0) throw new Error(`No se encontró cierre '};' para ${constName}`);

  const block = source.slice(open, close + 2);
  return { start, open, close: close + 2, block };
}

function updateModuloPermisos(source, newModulePermissions, NL) {
  const record = extractRecordBlock(source, 'MODULO_PERMISOS');
  let block = record.block;

  for (const [moduleKeyRaw, permsRaw] of Object.entries(newModulePermissions)) {
    const moduleKey = normalizeKey(moduleKeyRaw);
    const perms = Array.isArray(permsRaw) ? permsRaw.map((p) => String(p).trim()) : [];
    if (!perms.length) continue;

    const propRe = new RegExp(`\\n\\s*${moduleKey}:\\s*\\[([\\s\\S]*?)\\]\\s*,`);
    const propMatch = block.match(propRe);

    if (!propMatch) {
      // agregar propiedad nueva (inline)
      const line = `  ${moduleKey}: [${perms.map((p) => `'${p}'`).join(', ')}],`;
      const insertAt = block.lastIndexOf(NL + '}');
      block = block.slice(0, insertAt) + NL + line + block.slice(insertAt);
      continue;
    }

    const inside = propMatch[1];
    const existing = [];
    const strRe = /'([^']+)'/g;
    for (;;) {
      const m = strRe.exec(inside);
      if (!m) break;
      existing.push(m[1]);
    }

    const missing = perms.filter((p) => !existing.includes(p));
    if (!missing.length) continue;

    let replacement;
    const isMultiLine = inside.includes(NL);
    if (!isMultiLine) {
      const all = [...existing, ...missing];
      replacement = `${NL}  ${moduleKey}: [${all.map((p) => `'${p}'`).join(', ')}],`;
    } else {
      // conserva multiline, agrega al final con indent 4
      const trimmed = inside.replace(/\s+$/g, '');
      const append = missing.map((p) => `    '${p}',`).join(NL);
      replacement = propMatch[0].replace(inside, `${trimmed}${NL}${append}${NL}  `);
      // propMatch[0] ya contiene salto inicial y coma final; dejamos así
      block = block.replace(propMatch[0], replacement);
      continue;
    }

    // Reemplazo completo de la línea (incluye salto inicial)
    block = block.replace(propMatch[0], replacement);
  }

  return source.slice(0, record.open) + block + source.slice(record.close);
}

function extractPermisosArray(source) {
  const startMarker = 'export const PERMISOS';
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error('No se encontró export const PERMISOS');
  const end = source.indexOf('];', start);
  if (end < 0) throw new Error('No se pudo cerrar PERMISOS');
  const block = source.slice(start, end + 2);

  const claves = [];
  const re = /clave:\s*'([^']+)'/g;
  for (;;) {
    const m = re.exec(block);
    if (!m) break;
    claves.push(m[1]);
  }

  return { start, end: end + 2, block, claves };
}

function insertIntoPermisos(source, permisosInfo, newPermisos, NL) {
  if (!newPermisos.length) return source;

  const insertion = newPermisos
    .map((p) => {
      const detalle = p.detalle != null ? JSON.stringify(p.detalle) : 'null';
      // si detalle es null, no lo incluimos para mantener catálogo limpio
      if (p.detalle == null) {
        return `  { clave: '${p.clave}', modulo: '${p.modulo}', nombre: '${p.nombre}' },`;
      }
      return `  { clave: '${p.clave}', modulo: '${p.modulo}', nombre: '${p.nombre}', detalle: ${detalle} },`;
    })
    .join(NL);

  const insertAt = permisosInfo.end - 2;
  return source.slice(0, insertAt) + NL + insertion + NL + source.slice(insertAt);
}

async function main() {
  const args = parseArgs(process.argv);

  const manifestPath = path.resolve(process.cwd(), args.manifest ?? 'rbac.manifest.json');
  const catalogPath = path.resolve(process.cwd(), args.catalog ?? 'src/rbac/rbac.permisos.ts');

  const manifestRaw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  const modules = Array.isArray(manifest?.modules) ? manifest.modules : [];
  const modulePermissions = manifest?.modulePermissions ?? {};
  const permissions = Array.isArray(manifest?.permissions) ? manifest.permissions : [];

  if (!modules.length) throw new Error('Manifest inválido: modules[] vacío');
  if (!permissions.length) throw new Error('Manifest inválido: permissions[] vacío');

  let catalog = await fs.readFile(catalogPath, 'utf8');
  const NL = detectNewline(catalog);

  const modUnion = extractUnionKeys(catalog, 'ModuloKey');
  const permisoUnion = extractUnionKeys(catalog, 'PermisoClave');

  const existingModuleKeys = new Set(modUnion.keys.map(normalizeKey));
  const existingPermisoKeys = new Set(permisoUnion.keys.map((x) => String(x).trim()));

  const modulosInfo = extractModulesFromModulosArray(catalog);
  const permisosInfo = extractPermisosArray(catalog);

  const existingPermisosNamed = new Set(permisosInfo.claves.map((x) => String(x).trim()));

  // 1) módulos nuevos
  const newModules = [];
  for (const m of modules) {
    const key = normalizeKey(m?.key);
    const nombre = String(m?.nombre ?? '').trim();
    if (!key || !nombre) continue;
    if (!existingModuleKeys.has(key)) {
      newModules.push({ key, nombre });
      existingModuleKeys.add(key);
      modUnion.keys.push(key);
    }
  }

  // 2) permisos nuevos
  const newPermissionKeys = [];
  for (const p of permissions) {
    const clave = String(p?.clave ?? '').trim();
    if (!clave) continue;
    if (!existingPermisoKeys.has(clave)) {
      existingPermisoKeys.add(clave);
      permisoUnion.keys.push(clave);
      newPermissionKeys.push(clave);
    }
  }

  // 3) PERMISOS[] (con nombre)
  const newPermisos = [];
  for (const p of permissions) {
    const clave = String(p?.clave ?? '').trim();
    const nombre = String(p?.nombre ?? '').trim();
    const detalle = p?.detalle ?? null;
    const modulo = normalizeKey(p?.moduloKey);

    if (!clave || !nombre || !modulo) continue;
    if (existingPermisosNamed.has(clave)) continue;

    newPermisos.push({ clave, nombre, detalle, modulo });
    existingPermisosNamed.add(clave);
  }

  // Aplicar updates sobre el archivo
  if (newModules.length || newPermissionKeys.length) {
    // reconstruye unions con nuevas keys agregadas al final
    catalog = replaceUnion(catalog, 'ModuloKey', modUnion.keys, NL);
    catalog = replaceUnion(catalog, 'PermisoClave', permisoUnion.keys, NL);
  }

  // MODULOS[]
  catalog = insertIntoModulos(catalog, modulosInfo, newModules, NL);

  // MODULO_PERMISOS
  catalog = updateModuloPermisos(catalog, modulePermissions, NL);

  // PERMISOS[]
  const permisosInfo2 = extractPermisosArray(catalog);
  catalog = insertIntoPermisos(catalog, permisosInfo2, newPermisos, NL);

  await fs.writeFile(catalogPath, catalog, 'utf8');

  process.stdout.write(
    `OK: catálogo actualizado. Módulos nuevos: ${newModules.length}. Permisos nuevos: ${newPermissionKeys.length}. PERMISOS agregados: ${newPermisos.length}.\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err?.message ?? String(err)}\n`);
  process.exitCode = 1;
});
