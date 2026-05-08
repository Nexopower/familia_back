export type PermisoClave =
  | 'DASHBOARD.VER'
  | 'PRODUCTOS.VER'
  | 'PRODUCTOS.CREAR'
  | 'PRODUCTOS.EDITAR'
  | 'PRODUCTOS.ELIMINAR'
  | 'PRODUCTOS.CATEGORIAS.GESTIONAR'
  | 'PRODUCTOS.MARCAS.GESTIONAR'
  | 'PRODUCTOS.RECETAS.GESTIONAR'
  | 'INVENTARIO.VER'
  | 'INVENTARIO.MOVIMIENTO.CREAR'
  | 'INVENTARIO.MOVIMIENTO.VER'
  | 'INVENTARIO.UNIDADES.GESTIONAR'
  | 'INVENTARIO.CONVERSIONES.GESTIONAR'
  | 'INVENTARIO.TRANSFORMACIONES.GESTIONAR'
  | 'FACTURAS.VER'
  | 'FACTURAS.CREAR'
  | 'FACTURAS.CERRAR'
  | 'RESERVAS.VER'
  | 'RESERVAS.CREAR'
  | 'RESERVAS.REPROGRAMAR'
  | 'CONTABILIDAD.VER'
  | 'CONTABILIDAD.INGRESO.CREAR'
  | 'CONTABILIDAD.EGRESO.CREAR'
  | 'USUARIOS.VER'
  | 'USUARIOS.CREAR'
  | 'USUARIOS.ROL.CAMBIAR'
  | 'USUARIOS.ESTADO.CAMBIAR'
  | 'USUARIOS.ROLES_CREABLES.CONFIGURAR'
  | 'CONFIGURACIONES.EDITAR'
  | 'CONFIGURACIONES.VER';

export type ModuloKey =
  | 'DASHBOARD'
  | 'PRODUCTOS'
  | 'INVENTARIO'
  | 'FACTURAS'
  | 'RESERVAS'
  | 'CONTABILIDAD'
  | 'USUARIOS'
  | 'CONFIGURACIONES';

export const MODULOS: Array<{ key: ModuloKey; nombre: string }> = [
  { key: 'DASHBOARD', nombre: 'Dashboard' },
  { key: 'PRODUCTOS', nombre: 'Productos' },
  { key: 'INVENTARIO', nombre: 'Inventario' },
  { key: 'FACTURAS', nombre: 'Facturas' },
  { key: 'RESERVAS', nombre: 'Reservas' },
  { key: 'CONTABILIDAD', nombre: 'Contabilidad' },
  { key: 'USUARIOS', nombre: 'Usuarios' },
  { key: 'CONFIGURACIONES', nombre: 'Configuraciones' },
];

export const MODULO_PERMISOS: Record<ModuloKey, PermisoClave[]> = {
  DASHBOARD: ['DASHBOARD.VER'],

  PRODUCTOS: [
    'PRODUCTOS.VER',
    'PRODUCTOS.CREAR',
    'PRODUCTOS.EDITAR',
    'PRODUCTOS.ELIMINAR',
    'PRODUCTOS.CATEGORIAS.GESTIONAR',
    'PRODUCTOS.MARCAS.GESTIONAR',
    'PRODUCTOS.RECETAS.GESTIONAR',
  ],

  INVENTARIO: [
    'INVENTARIO.VER',
    'INVENTARIO.MOVIMIENTO.CREAR',
    'INVENTARIO.MOVIMIENTO.VER',
    'INVENTARIO.UNIDADES.GESTIONAR',
    'INVENTARIO.CONVERSIONES.GESTIONAR',
    'INVENTARIO.TRANSFORMACIONES.GESTIONAR',
  ],
  FACTURAS: ['FACTURAS.VER', 'FACTURAS.CREAR', 'FACTURAS.CERRAR'],
  RESERVAS: ['RESERVAS.VER', 'RESERVAS.CREAR', 'RESERVAS.REPROGRAMAR'],
  CONTABILIDAD: [
    'CONTABILIDAD.VER',
    'CONTABILIDAD.INGRESO.CREAR',
    'CONTABILIDAD.EGRESO.CREAR',
  ],
  USUARIOS: [
    'USUARIOS.VER',
    'USUARIOS.CREAR',
    'USUARIOS.ROL.CAMBIAR',
    'USUARIOS.ESTADO.CAMBIAR',
    'USUARIOS.ROLES_CREABLES.CONFIGURAR',
  ],
  CONFIGURACIONES: ['CONFIGURACIONES.VER', 'CONFIGURACIONES.EDITAR'],
};

export const PERMISOS: Array<{
  clave: PermisoClave;
  modulo: ModuloKey;
  nombre: string;
  detalle?: string | null;
}> = [
  { clave: 'DASHBOARD.VER', modulo: 'DASHBOARD', nombre: 'Ver dashboard' },

  { clave: 'PRODUCTOS.VER', modulo: 'PRODUCTOS', nombre: 'Ver productos' },
  { clave: 'PRODUCTOS.CREAR', modulo: 'PRODUCTOS', nombre: 'Crear productos' },

  { clave: 'INVENTARIO.VER', modulo: 'INVENTARIO', nombre: 'Ver inventario' },
  {
    clave: 'INVENTARIO.MOVIMIENTO.CREAR',
    modulo: 'INVENTARIO',
    nombre: 'Registrar movimientos de inventario',
  },

  { clave: 'FACTURAS.VER', modulo: 'FACTURAS', nombre: 'Ver facturas' },
  { clave: 'FACTURAS.CREAR', modulo: 'FACTURAS', nombre: 'Crear facturas' },
  { clave: 'FACTURAS.CERRAR', modulo: 'FACTURAS', nombre: 'Cerrar facturas' },

  { clave: 'RESERVAS.VER', modulo: 'RESERVAS', nombre: 'Ver reservas' },
  { clave: 'RESERVAS.CREAR', modulo: 'RESERVAS', nombre: 'Crear reservas' },
  {
    clave: 'RESERVAS.REPROGRAMAR',
    modulo: 'RESERVAS',
    nombre: 'Reprogramar reservas',
  },

  {
    clave: 'CONTABILIDAD.VER',
    modulo: 'CONTABILIDAD',
    nombre: 'Ver contabilidad',
  },
  {
    clave: 'CONTABILIDAD.INGRESO.CREAR',
    modulo: 'CONTABILIDAD',
    nombre: 'Registrar ingresos',
  },
  {
    clave: 'CONTABILIDAD.EGRESO.CREAR',
    modulo: 'CONTABILIDAD',
    nombre: 'Registrar egresos',
  },

  { clave: 'USUARIOS.VER', modulo: 'USUARIOS', nombre: 'Ver usuarios' },
  { clave: 'USUARIOS.CREAR', modulo: 'USUARIOS', nombre: 'Crear usuarios' },
  {
    clave: 'USUARIOS.ROL.CAMBIAR',
    modulo: 'USUARIOS',
    nombre: 'Cambiar rol de usuarios',
  },
  {
    clave: 'USUARIOS.ESTADO.CAMBIAR',
    modulo: 'USUARIOS',
    nombre: 'Cambiar estado de usuarios',
  },
  {
    clave: 'USUARIOS.ROLES_CREABLES.CONFIGURAR',
    modulo: 'USUARIOS',
    nombre: 'Configurar roles creables',
  },

  { clave: 'PRODUCTOS.EDITAR', modulo: 'PRODUCTOS', nombre: 'Editar productos' },
  { clave: 'PRODUCTOS.ELIMINAR', modulo: 'PRODUCTOS', nombre: 'Eliminar/Inactivar productos' },
  { clave: 'PRODUCTOS.CATEGORIAS.GESTIONAR', modulo: 'PRODUCTOS', nombre: 'Gestionar categorías' },
  { clave: 'PRODUCTOS.MARCAS.GESTIONAR', modulo: 'PRODUCTOS', nombre: 'Gestionar marcas' },
  { clave: 'PRODUCTOS.RECETAS.GESTIONAR', modulo: 'PRODUCTOS', nombre: 'Gestionar recetas/composiciones' },

  { clave: 'INVENTARIO.MOVIMIENTO.VER', modulo: 'INVENTARIO', nombre: 'Ver movimientos de inventario' },
  { clave: 'INVENTARIO.UNIDADES.GESTIONAR', modulo: 'INVENTARIO', nombre: 'Gestionar unidades de medida' },
  { clave: 'INVENTARIO.CONVERSIONES.GESTIONAR', modulo: 'INVENTARIO', nombre: 'Gestionar conversiones de unidades' },
  { clave: 'INVENTARIO.TRANSFORMACIONES.GESTIONAR', modulo: 'INVENTARIO', nombre: 'Gestionar transformaciones de inventario' },

  { clave: 'CONFIGURACIONES.EDITAR', modulo: 'CONFIGURACIONES', nombre: 'Editar configuraciones' },
  { clave: 'CONFIGURACIONES.VER', modulo: 'CONFIGURACIONES', nombre: 'Ver configuraciones' },
];
