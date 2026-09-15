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
