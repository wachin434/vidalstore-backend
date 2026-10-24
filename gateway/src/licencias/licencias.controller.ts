import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
  Param,
} from '@nestjs/common';
import { estaEnGrupo } from '../auth/verificador';
import { autenticarOFallar, MICROSERVICIO_URL } from '../auth/http';

@Controller('v1/licencias')
export class LicenciasController {
  @Get()
  async listarTodas(@Headers('authorization') authorization?: string) {
    const claims = await autenticarOFallar(authorization);

    if (!estaEnGrupo(claims, 'administradores')) {
      throw new ForbiddenException('solo administradores ven las licencias de todos los usuarios');
    }

    const r = await fetch(`${MICROSERVICIO_URL}/licencias`, {
      headers: { Authorization: authorization! },
    });
    return r.json();
  }

  @Delete(':licenciaId')
  async revocar(
    @Param('licenciaId') licenciaId: string,
    @Headers('authorization') authorization?: string,
    @Body() body?: { motivo?: string },
  ) {
    const claims = await autenticarOFallar(authorization);

    if (!estaEnGrupo(claims, 'administradores')) {
      throw new ForbiddenException('solo administradores pueden revocar una licencia');
    }

    const r = await fetch(`${MICROSERVICIO_URL}/licencias/${licenciaId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization!,
      },
      // Solo viaja el motivo. Quién revoca lo decide el microservicio con el
      // sub del token que reenviamos en Authorization, no un campo del cuerpo.
      body: JSON.stringify({ motivo: body?.motivo }),
    });

    const resultado = await r.json();

    if (!r.ok) {
      throw new HttpException(resultado, r.status);
    }

    return resultado;
  }
}