import { Module } from '@nestjs/common';
import { CatalogoController } from './catalogo/catalogo.controller';
import { ComprasController } from './compras/compras.controller';
import { BibliotecaController } from './biblioteca/biblioteca.controller';
import { LicenciasController } from './licencias/licencias.controller';
import { AuditoriaController } from './auditoria/auditoria.controller';


@Module({
  controllers: [
    CatalogoController,
    ComprasController,
    BibliotecaController,
    LicenciasController,
    AuditoriaController,
  ],
})
export class AppModule {}
