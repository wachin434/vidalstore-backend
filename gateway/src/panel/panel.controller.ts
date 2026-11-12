import { Controller, ForbiddenException, Get, Headers, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { estaEnGrupo } from '../auth/verificador';
import { autenticarOFallar, EVENTOS_URL } from '../auth/http';

@Controller('v1/panel')
export class PanelController {
  /**
   * El panel en vivo (EP3 E2). El gateway hace de BFF: revisa el token y que el usuario sea administrador
   * (un jugador recibe 403) y le pide los datos a vidalstore-eventos, el dueño de kpi_minuto, alertas y
   * ventas_semana. El gateway nunca abre una conexion a Postgres ni toca Kafka.
   */
  @Get('en-vivo')
  async enVivo(@Headers('authorization') authorization?: string) {
    const claims = await autenticarOFallar(authorization);

    if (!estaEnGrupo(claims, 'administradores')) {
      throw new ForbiddenException('solo administradores ven el panel en vivo');
    }

    let r: Response;
    try {
      r = await fetch(`${EVENTOS_URL}/panel/en-vivo`);
    } catch {
      throw new ServiceUnavailableException('vidalstore-eventos no responde');
    }

    const cuerpo: unknown = await r.json().catch(() => null);
    if (!r.ok) {
      throw new HttpException(cuerpo ?? { message: 'vidalstore-eventos respondió con error' }, r.status);
    }
    return cuerpo;
  }
}
