import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SqlService } from './sql/sql.service';
import configuration from './sql/config/configuration';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { TokenService } from './token/token.service';
import { TokenCleanupService } from './token/token-cleanup.service';
import { EncryptionService } from './encryption/encryption.service';
import { ProductosController } from './productos/productos.controller';
import { ProductosService } from './productos/productos.service';
import { InventarioController } from './inventario/inventario.controller';
import { InventarioService } from './inventario/inventario.service';
import { FacturasController } from './facturas/facturas.controller';
import { FacturasService } from './facturas/facturas.service';
import { ReservasController } from './reservas/reservas.controller';
import { ReservasService } from './reservas/reservas.service';
import { ContabilidadController } from './contabilidad/contabilidad.controller';
import { ContabilidadService } from './contabilidad/contabilidad.service';
import { CajaController } from './caja/caja.controller';
import { CajaService } from './caja/caja.service';
import { ImpresionController } from './impresion/impresion.controller';
import { ImpresionService } from './impresion/impresion.service';
import { Tokenpass } from './const/const';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { ConfiguracionesController } from './configuraciones/configuraciones.controller';
import { ConfiguracionesService } from './configuraciones/configuraciones.service';
import { RbacController } from './rbac/rbac.controller';
import { RbacService } from './rbac/rbac.service';
import { PermisoDiscoveryService } from './rbac/permiso-discovery.service';
import { AuthzService } from './authz/authz.service';
import { AuthzController } from './authz/authz.controller';
import { PermisoGuard } from './authz/permiso.guard';
import { NegocioUsuariosController } from './usuarios/negocio-usuarios.controller';
import { NegocioUsuariosService } from './usuarios/negocio-usuarios.service';
import { PerfilController } from './perfil/perfil.controller';
import { DireccionesController } from './direcciones/direcciones.controller';
import { DireccionesService } from './direcciones/direcciones.service';
import { FiaosController } from './fiaos/fiaos.controller';
import { FiaosService } from './fiaos/fiaos.service';
import { AuditoriaController } from './auditoria/auditoria.controller';
import { FondosController } from './fondos/fondos.controller';
import { FondosService } from './fondos/fondos.service';
import { PersonasController } from './personas/personas.controller';
import { PersonasService } from './personas/personas.service';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
import { ProveedoresController } from './proveedores/proveedores.controller';
import { ProveedoresService } from './proveedores/proveedores.service';
import { InventarioAvanzadoController } from './inventario-avanzado/inventario-avanzado.controller';
import { InventarioAvanzadoService } from './inventario-avanzado/inventario-avanzado.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      load: [configuration],
    }),
    JwtModule.register({
      global: true,
      secret: Tokenpass.secret,
      signOptions: { expiresIn: '1h' },
    }),
    ScheduleModule.forRoot(),
    DiscoveryModule,
    // Caché en memoria para catálogos casi estáticos (categorías, marcas,
    // unidades, permisos, negocios). Nunca se cachea facturación ni stock.
    CacheModule.register({ isGlobal: true }),
  ],
  controllers: [
    AppController,
    AuthController,
    DashboardController,
    ConfiguracionesController,
    AuthzController,
    RbacController,
    NegocioUsuariosController,
    ProductosController,
    InventarioController,
    InventarioAvanzadoController,
    FacturasController,
    ReservasController,
    ContabilidadController,
    CajaController,
    ImpresionController,
    PerfilController,
    DireccionesController,
    FiaosController,
    AuditoriaController,
    FondosController,
    PersonasController,
    ClientesController,
    ProveedoresController,
  ],
  providers: [
    AppService,
    SqlService,
    AuthService,
    TokenService,
    TokenCleanupService,
    EncryptionService,
    RbacService,
    PermisoDiscoveryService,
    AuthzService,
    PermisoGuard,
    NegocioUsuariosService,
    DashboardService,
    ConfiguracionesService,
    ProductosService,
    InventarioService,
    InventarioAvanzadoService,
    FacturasService,
    ReservasService,
    ContabilidadService,
    CajaService,
    ImpresionService,
    DireccionesService,
    FiaosService,
    FondosService,
    PersonasService,
    ClientesService,
    ProveedoresService,
  ],
})
export class AppModule {}
