import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
} from '@nestjs/common';

import {
  tieneScope,
} from '../auth/verificador';

import {
  autenticarOFallar,
  MICROSERVICIO_URL,
} from '../auth/http';

@Controller('v1/biblioteca')
export class BibliotecaController {
  @Get()
  async miBiblioteca(
    @Headers('authorization')
    authorization?: string,
  ) {
    const claims =
      await autenticarOFallar(
        authorization,
      );

    if (
      !tieneScope(
        claims,
        'biblioteca.leer',
      )
    ) {
      throw new ForbiddenException(
        'te falta el permiso vidalstore/biblioteca.leer',
      );
    }

    const r = await fetch(
      `${MICROSERVICIO_URL}/biblioteca`,
      {
        headers: {
          Authorization:
            authorization!,
        },
      },
    );

    const resultado = await r.json();

    if (!r.ok) {
      throw new HttpException(resultado, r.status);
    }

    return resultado;
  }
}