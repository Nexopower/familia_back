import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { AUTHZ_PERMISO_KEY } from 'src/authz/permiso.decorator';

/**
 * Descubre en tiempo de ejecución TODAS las claves de permiso declaradas con
 * `@RequirePermiso(...)` en cualquier controller de la app. Esto convierte al
 * propio código en la fuente de verdad: al agregar/quitar endpoints, sus
 * permisos aparecen/desaparecen del descubrimiento sin tocar ningún manifiesto.
 */
@Injectable()
export class PermisoDiscoveryService {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  descubrirClaves(): string[] {
    const claves = new Set<string>();

    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance;
      if (!instance) continue;

      // Metadata a nivel de clase (por si se usara @RequirePermiso en la clase).
      const claveClase = this.reflector.get<string>(
        AUTHZ_PERMISO_KEY,
        instance.constructor,
      );
      if (claveClase) claves.add(claveClase);

      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) continue;

      for (const methodName of this.scanner.getAllMethodNames(prototype)) {
        const handler = prototype[methodName];
        if (typeof handler !== 'function') continue;
        const clave = this.reflector.get<string>(AUTHZ_PERMISO_KEY, handler);
        if (clave) claves.add(clave);
      }
    }

    return Array.from(claves);
  }
}
