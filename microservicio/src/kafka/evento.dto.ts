import 'reflect-metadata';
import { Type } from 'class-transformer';
import { Equals, IsIn, IsISO8601, IsNotEmpty, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';

export const TIPOS = ['compra.realizada', 'licencia.revocada'] as const;
export type TipoEvento = (typeof TIPOS)[number];

export class DatosCompraRealizadaDto {
  @IsString()
  @IsNotEmpty()
  licenciaId!: string;

  @IsISO8601({ strict: true })
  adquiridaEn!: string;
}

export class DatosLicenciaRevocadaDto {
  @IsString()
  @IsNotEmpty()
  licenciaId!: string;

  @IsString()
  @IsNotEmpty()
  revocadaPor!: string;

  // El motivo puede venir vacio, pero no pasar de 500 caracteres (igual que en la API).
  @IsString()
  @MaxLength(500)
  motivo!: string;
}

/**
 * El sobre de todo evento de VidalStore. Se valida ANTES de enviar a Kafka: un evento que no cumple
 * no sale del servicio, y los consumidores pueden confiar en lo que leen.
 * `juegoId` y `usuarioSub` viajan como texto; `usuarioSub` sale del token y es la key del mensaje.
 */
export class EventoDto {
  @IsUUID()
  eventoId!: string;

  @IsIn(TIPOS)
  tipo!: TipoEvento;

  @Equals(1, { message: 'version tiene que ser 1' })
  version!: number;

  @IsISO8601({ strict: true })
  emitidoEn!: string;

  @IsString()
  @IsNotEmpty()
  juegoId!: string;

  @IsString()
  @IsNotEmpty()
  usuarioSub!: string;

  // Los datos dependen del tipo. Si el tipo no existe, ya falla `tipo` y aqui no se valida nada mas.
  @ValidateIf((e: EventoDto) => TIPOS.includes(e.tipo))
  @ValidateNested()
  @Type((opciones) =>
    opciones?.object?.tipo === 'licencia.revocada' ? DatosLicenciaRevocadaDto : DatosCompraRealizadaDto,
  )
  datos!: DatosCompraRealizadaDto | DatosLicenciaRevocadaDto;
}
