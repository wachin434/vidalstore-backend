import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { estaEnGrupo, tieneScope } from '../auth/verificador';
import { autenticarOFallar, MICROSERVICIO_URL } from '../auth/http';

@Controller('v1/catalogo')
export class CatalogoController {
  @Get()
  async listar(@Headers('authorization') authorization?: string) {
    const claims = await autenticarOFallar(authorization);

    if (!tieneScope(claims, 'catalogo.leer')) {
      throw new ForbiddenException('te falta el permiso vidalstore/catalogo.leer');
    }

    const r = await fetch(`${MICROSERVICIO_URL}/catalogo`);
    return r.json();
  }

  @Post()
  async publicar(
    @Headers('authorization') authorization?: string,
    @Body() body?: unknown,
  ) {
    const claims = await autenticarOFallar(authorization);

    if (!estaEnGrupo(claims, 'editores', 'administradores')) {
      throw new ForbiddenException('solo editores o administradores publican juegos');
    }

    const r = await fetch(`${MICROSERVICIO_URL}/catalogo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(body as object), publicadoPor: claims.sub }),
    });
    return r.json();
  }

  @Put(':juegoId')
  async editar(
    @Param('juegoId') juegoId: string,
    @Headers('authorization') authorization?: string,
    @Body() body?: unknown,
  ) {
    const claims = await autenticarOFallar(authorization);

    if (!estaEnGrupo(claims, 'editores', 'administradores')) {
      throw new ForbiddenException('solo editores o administradores editan el catálogo');
    }

    const r = await fetch(`${MICROSERVICIO_URL}/catalogo/${juegoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(body as object), editadoPor: claims.sub }),
    });
    return r.json();
  }
}