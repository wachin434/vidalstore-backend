import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
} from '@nestjs/common';
import { estaEnGrupo } from '../auth/verificador';
import { autenticarOFallar, MICROSERVICIO_URL } from '../auth/http';

// GET    /v1/licencias             -> grupo administradores. Ve las de TODOS.
// DELETE /v1/licencias/:licenciaId -> grupo administradores. Revoca una licencia.
@Controller('v1/licencias')
export class LicenciasController {
  @Get()
  async listarTodas(@Headers('authorization') authorization?: string) {
    const claims = await autenticarOFallar(authorization);

    if (!estaEnGrupo(claims, 'administradores')) {
      throw new ForbiddenException('solo administradores ven las licencias de todos los usuarios');
    }

    const r = await fetch(${MICROSERVICIO_URL}/licencias);
    return r.json();
  }

  @Delete(':licenciaId')
  async revocar(
    @Param('licenciaId') licenciaId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const claims = await autenticarOFallar(authorization);

    if (!estaEnGrupo(claims, 'administradores')) {
      throw new ForbiddenException('solo administradores pueden revocar una licencia');
    }

    const r = await fetch(${MICROSERVICIO_URL}/licencias/${licenciaId}, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revocadoPor: claims.sub }),
    });
    return r.json();
  }
}