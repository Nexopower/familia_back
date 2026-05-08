export type ModuloKey =
  | 'DASHBOARD'
  | 'PRODUCTOS'
  | 'INVENTARIO'
  | 'FACTURAS'
  | 'RESERVAS'
  | 'CONTABILIDAD';

export type PermisoKey =
  | 'DASHBOARD_VER'
  | 'PRODUCTOS_VER'
  | 'PRODUCTOS_CREAR'
  | 'PRODUCTOS_EDITAR'
  | 'PRODUCTOS_ELIMINAR'
  | 'PRODUCTOS_CATEGORIAS_GESTIONAR'
  | 'PRODUCTOS_MARCAS_GESTIONAR'
  | 'PRODUCTOS_RECETAS_GESTIONAR'
  | 'INVENTARIO_VER'
  | 'INVENTARIO_MOVIMIENTO_CREAR'
  | 'INVENTARIO_UNIDADES_GESTIONAR'
  | 'INVENTARIO_CONVERSIONES_GESTIONAR'
  | 'INVENTARIO_TRANSFORMACIONES_GESTIONAR'
  | 'FACTURAS_VER'
  | 'FACTURAS_CREAR'
  | 'FACTURAS_CERRAR'
  | 'RESERVAS_VER'
  | 'RESERVAS_CREAR'
  | 'RESERVAS_REPROGRAMAR'
  | 'CONTABILIDAD_VER'
  | 'CONTABILIDAD_INGRESO'
  | 'CONTABILIDAD_EGRESO';

export const MODULOS: Array<{ key: ModuloKey; nombre: string }> = [
  { key: 'DASHBOARD', nombre: 'Dashboard' },
  { key: 'PRODUCTOS', nombre: 'Productos' },
  { key: 'INVENTARIO', nombre: 'Inventario' },
  { key: 'FACTURAS', nombre: 'Facturas' },
  { key: 'RESERVAS', nombre: 'Reservas' },
  { key: 'CONTABILIDAD', nombre: 'Contabilidad' },
];

export const MODULO_PERMISOS: Record<ModuloKey, PermisoKey[]> = {
  DASHBOARD: ['DASHBOARD_VER'],
  PRODUCTOS: [
    'PRODUCTOS_VER',
    'PRODUCTOS_CREAR',
    'PRODUCTOS_EDITAR',
    'PRODUCTOS_ELIMINAR',
    'PRODUCTOS_CATEGORIAS_GESTIONAR',
    'PRODUCTOS_MARCAS_GESTIONAR',
    'PRODUCTOS_RECETAS_GESTIONAR',
  ],
  INVENTARIO: [
    'INVENTARIO_VER',
    'INVENTARIO_MOVIMIENTO_CREAR',
    'INVENTARIO_UNIDADES_GESTIONAR',
    'INVENTARIO_CONVERSIONES_GESTIONAR',
    'INVENTARIO_TRANSFORMACIONES_GESTIONAR',
  ],
  FACTURAS: ['FACTURAS_VER', 'FACTURAS_CREAR', 'FACTURAS_CERRAR'],
  RESERVAS: ['RESERVAS_VER', 'RESERVAS_CREAR', 'RESERVAS_REPROGRAMAR'],
  CONTABILIDAD: ['CONTABILIDAD_VER', 'CONTABILIDAD_INGRESO', 'CONTABILIDAD_EGRESO'],
};

export const PERMISOS: Array<{
  key: PermisoKey;
  modulo: ModuloKey;
  nombre: string;
}> = [
  { key: 'DASHBOARD_VER', modulo: 'DASHBOARD', nombre: 'Ver dashboard' },

  { key: 'PRODUCTOS_VER', modulo: 'PRODUCTOS', nombre: 'Ver productos' },
  { key: 'PRODUCTOS_CREAR', modulo: 'PRODUCTOS', nombre: 'Crear productos' },
  { key: 'PRODUCTOS_EDITAR', modulo: 'PRODUCTOS', nombre: 'Editar productos' },
  { key: 'PRODUCTOS_ELIMINAR', modulo: 'PRODUCTOS', nombre: 'Eliminar/inactivar productos' },
  { key: 'PRODUCTOS_CATEGORIAS_GESTIONAR', modulo: 'PRODUCTOS', nombre: 'Gestionar categorías' },
  { key: 'PRODUCTOS_MARCAS_GESTIONAR', modulo: 'PRODUCTOS', nombre: 'Gestionar marcas' },
  { key: 'PRODUCTOS_RECETAS_GESTIONAR', modulo: 'PRODUCTOS', nombre: 'Gestionar recetas (BOM)' },

  { key: 'INVENTARIO_VER', modulo: 'INVENTARIO', nombre: 'Ver inventario' },
  { key: 'INVENTARIO_MOVIMIENTO_CREAR', modulo: 'INVENTARIO', nombre: 'Registrar movimientos de inventario' },
  { key: 'INVENTARIO_UNIDADES_GESTIONAR', modulo: 'INVENTARIO', nombre: 'Gestionar unidades de medida' },
  { key: 'INVENTARIO_CONVERSIONES_GESTIONAR', modulo: 'INVENTARIO', nombre: 'Gestionar conversiones de unidades' },
  { key: 'INVENTARIO_TRANSFORMACIONES_GESTIONAR', modulo: 'INVENTARIO', nombre: 'Gestionar transformaciones' },

  { key: 'FACTURAS_VER', modulo: 'FACTURAS', nombre: 'Ver facturas' },
  { key: 'FACTURAS_CREAR', modulo: 'FACTURAS', nombre: 'Crear facturas' },
  { key: 'FACTURAS_CERRAR', modulo: 'FACTURAS', nombre: 'Cerrar facturas' },

  { key: 'RESERVAS_VER', modulo: 'RESERVAS', nombre: 'Ver reservas' },
  { key: 'RESERVAS_CREAR', modulo: 'RESERVAS', nombre: 'Crear reservas' },
  {
    key: 'RESERVAS_REPROGRAMAR',
    modulo: 'RESERVAS',
    nombre: 'Reprogramar reservas',
  },

  {
    key: 'CONTABILIDAD_VER',
    modulo: 'CONTABILIDAD',
    nombre: 'Ver contabilidad',
  },
  {
    key: 'CONTABILIDAD_INGRESO',
    modulo: 'CONTABILIDAD',
    nombre: 'Registrar ingresos',
  },
  {
    key: 'CONTABILIDAD_EGRESO',
    modulo: 'CONTABILIDAD',
    nombre: 'Registrar egresos',
  },
];
