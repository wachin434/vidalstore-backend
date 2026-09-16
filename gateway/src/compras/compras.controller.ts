import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { tieneScope } from '../auth/verificador';
import { autenticarOFallar, MICROSERVICIO_URL } from '../auth/http';

@Controller('v1/compras')
export class ComprasController {
  @Post()
  async comprar(
    @Headers('authorization') authorization?: string,
    @Body() body?: { juegoId?: string },
  ) {
    const claims = await autenticarOFallar(authorization);

    if (!tieneScope(claims, 'catalogo.leer') || !tieneScope(claims, 'biblioteca.leer')) {
      throw new ForbiddenException('tu aplicación no tiene los scopes para comprar');
    }

    const r = await fetch(`${MICROSERVICIO_URL}/compras`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization!,
      },
      body: JSON.stringify({ juegoId: body?.juegoId, usuarioSub: claims.sub }),
    });
    return r.json();
  }
}