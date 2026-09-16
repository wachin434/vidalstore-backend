import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { estaEnGrupo } from '../auth/verificador';
import { autenticarOFallar, MICROSERVICIO_URL } from '../auth/http';

@Controller('v1/auditoria')
export class AuditoriaController {
  @Get()
  async listar(@Headers('authorization') authorization?: string) {
    const claims = await autenticarOFallar(authorization);

    if (!estaEnGrupo(claims, 'administradores')) {
      throw new ForbiddenException('solo administradores ven el registro de auditoría');
    }

    const r = await fetch(`${MICROSERVICIO_URL}/auditoria`);
    return r.json();
  }
}