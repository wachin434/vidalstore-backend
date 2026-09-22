import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';

import {
  estaEnGrupo,
  tieneScope,
} from '../auth/verificador';

import {
  autenticarOFallar,
  MICROSERVICIO_URL,
} from '../auth/http';

@Controller('v1/catalogo')
export class CatalogoController {
  /* ===================================================
     RESPUESTA DEL MICROSERVICIO
  =================================================== */

  private async responder(r: Response) {
    const texto = await r.text();

    let data: unknown;

    try {
      data = texto
        ? JSON.parse(texto)
        : null;
    } catch {
      console.error(
        'El microservicio devolvió una respuesta que no es JSON:',
        {
          status: r.status,
          url: r.url,
          contentType:
            r.headers.get(
              'content-type',
            ),
          respuesta:
            texto.slice(0, 500),
        },
      );

      data = {
        error:
          'el microservicio devolvió una respuesta inválida',
        status:
          r.status,
      };
    }

    if (!r.ok) {
      throw new HttpException(
        data,
        r.status,
      );
    }

    return data;
  }

  /* ===================================================
     LISTAR CATÁLOGO
  =================================================== */

  @Get()
  async listar(
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
        'catalogo.leer',
      )
    ) {
      throw new ForbiddenException(
        'te falta el permiso vidalstore/catalogo.leer',
      );
    }

    const r = await fetch(
      `${MICROSERVICIO_URL}/catalogo`,
      {
        headers: {
          Authorization:
            authorization!,
        },
      },
    );

    return this.responder(r);
  }

  /* ===================================================
     PUBLICAR JUEGO
  =================================================== */

  @Post()
  async publicar(
    @Headers('authorization')
    authorization?: string,
    @Body()
    body?: unknown,
  ) {
    const claims =
      await autenticarOFallar(
        authorization,
      );

    if (
      !estaEnGrupo(
        claims,
        'editores',
        'administradores',
      )
    ) {
      throw new ForbiddenException(
        'solo editores o administradores publican juegos',
      );
    }

    const r = await fetch(
      `${MICROSERVICIO_URL}/catalogo`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            authorization!,
        },
        body: JSON.stringify({
          ...(body as object),
          publicadoPor:
            claims.sub,
        }),
      },
    );

    return this.responder(r);
  }

  /* ===================================================
     EDITAR JUEGO
  =================================================== */

  @Put(':juegoId')
  async editar(
    @Param('juegoId')
    juegoId: string,
    @Headers('authorization')
    authorization?: string,
    @Body()
    body?: unknown,
  ) {
    const claims =
      await autenticarOFallar(
        authorization,
      );

    if (
      !estaEnGrupo(
        claims,
        'editores',
        'administradores',
      )
    ) {
      throw new ForbiddenException(
        'solo editores o administradores editan el catálogo',
      );
    }

    const r = await fetch(
      `${MICROSERVICIO_URL}/catalogo/${encodeURIComponent(juegoId)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            authorization!,
        },
        body: JSON.stringify({
          ...(body as object),
          editadoPor:
            claims.sub,
        }),
      },
    );

    return this.responder(r);
  }

  /* ===================================================
     ELIMINAR JUEGO
  =================================================== */

  @Delete(':juegoId')
  async eliminar(
    @Param('juegoId')
    juegoId: string,
    @Headers('authorization')
    authorization?: string,
  ) {
    const claims =
      await autenticarOFallar(
        authorization,
      );

    if (
      !estaEnGrupo(
        claims,
        'editores',
        'administradores',
      )
    ) {
      throw new ForbiddenException(
        'solo editores o administradores eliminan juegos',
      );
    }

    const url =
      `${MICROSERVICIO_URL}/catalogo/${encodeURIComponent(juegoId)}`;

    console.log(
      `DELETE catálogo -> ${url}`,
    );

    const r = await fetch(
      url,
      {
        method: 'DELETE',
        headers: {
          Authorization:
            authorization!,
          Accept:
            'application/json',
        },
      },
    );

    return this.responder(r);
  }
}