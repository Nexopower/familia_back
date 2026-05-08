import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { Tokenpass } from './const/const';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { ConfiguracionesController } from './configuraciones/configuraciones.controller';
import { ConfiguracionesService } from './configuraciones/configuraciones.service';
import { RbacController } from './rbac/rbac.controller';
import { RbacService } from './rbac/rbac.service';
import { AuthzService } from './authz/authz.service';
import { AuthzController } from './authz/authz.controller';
import { PermisoGuard } from './authz/permiso.guard';
import { NegocioUsuariosController } from './usuarios/negocio-usuarios.controller';
import { NegocioUsuariosService } from './usuarios/negocio-usuarios.service';
import { PersonasController } from './personas/personas.controller';
import { PersonasService } from './personas/personas.service';
import { ClientesController } from './clientes/clientes.controller';
import { ClientesService } from './clientes/clientes.service';
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
    PersonasController,
    ClientesController,
  ],
  providers: [
    AppService,
    SqlService,
    AuthService,
    TokenService,
    TokenCleanupService,
    EncryptionService,
    RbacService,
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
    PersonasService,
    ClientesService,
  ],
})
export class AppModule {}
