import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { tieneScope } from '../auth/verificador';
import { autenticarOFallar, MICROSERVICIO_URL } from '../auth/http';

@Controller('v1/biblioteca')
export class BibliotecaController {
  @Get()
  async miBiblioteca(@Headers('authorization') authorization?: string) {
    const claims = await autenticarOFallar(authorization);

    if (!tieneScope(claims, 'biblioteca.leer')) {
      throw new ForbiddenException('te falta el permiso vidalstore/biblioteca.leer');
    }

    const r = await fetch(`${MICROSERVICIO_URL}/biblioteca/${encodeURIComponent(claims.sub)}`, {
      headers: { Authorization: authorization! },
    });
    return r.json();
  }
}