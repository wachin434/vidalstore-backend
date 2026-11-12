import { UnauthorizedException } from '@nestjs/common';
import { Claims, ErrorDeAutenticacion, verificar } from './verificador';


export async function autenticarOFallar(authorization?: string): Promise<Claims> {
  try {
    return await verificar(authorization);
  } catch (e) {
    const msg = e instanceof ErrorDeAutenticacion ? e.message : 'no se pudo validar el token';
    throw new UnauthorizedException(msg);
  }
}

export const MICROSERVICIO_URL = process.env.MICROSERVICIO_URL ?? 'http://localhost:3001';

// vidalstore-eventos: dueño de kpi_minuto, alertas y ventas_semana. Solo lo consulta el panel en vivo.
export const EVENTOS_URL = process.env.EVENTOS_URL ?? 'http://localhost:3010';
