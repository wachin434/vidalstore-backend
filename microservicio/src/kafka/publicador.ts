import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { aMensaje } from './a-mensaje.js';
import { EventoDto, type TipoEvento } from './evento.dto.js';
import { crearProductor, type ProductorKafka } from './productor.js';

let productor: ProductorKafka | undefined;

function obtenerProductor(): ProductorKafka {
  productor ??= crearProductor();
  return productor;
}

/**
 * Publica compra.realizada y licencia.revocada en vidalstore.compras. Se llama DESPUES de guardar en
 * Postgres y ADEMAS de RabbitMQ: no reemplaza a nada.
 *
 * Si Kafka no responde, la licencia ya existe: se registra el error y la peticion sigue respondiendo
 * igual que con RabbitMQ. El productor reintenta 10 veces (retries), asi que el fallo tarda unos
 * segundos y no cuelga la peticion.
 */
export async function publicarEnKafka(
  tipo: TipoEvento,
  juegoId: string,
  usuarioSub: string,
  datos: Record<string, unknown>,
): Promise<void> {
  const evento = plainToInstance(EventoDto, {
    eventoId: randomUUID(),
    tipo,
    version: 1,
    emitidoEn: new Date().toISOString(),
    juegoId: String(juegoId),
    usuarioSub,
    datos,
  });

  try {
    const errores = await validate(evento, { whitelist: true, forbidNonWhitelisted: true });
    if (errores.length > 0) {
      throw new Error(`el evento no cumple el DTO: ${errores.map((e) => e.toString(false, true)).join(' | ')}`);
    }
    const resultado = await obtenerProductor().send({ messages: [aMensaje(evento)] });
    const o = resultado.offsets?.[0];
    console.log(`kafka: ${tipo} evento ${evento.eventoId} en ${o?.topic}[${o?.partition}] offset ${o?.offset}`);
  } catch (error) {
    console.error(`kafka: no se pudo publicar ${tipo} evento ${evento.eventoId}: ${detalle(error)}`);
  }
}

/** Cierra el productor al apagar el servicio (SIGTERM). */
export async function cerrarProductor(): Promise<void> {
  await productor?.close().catch(() => undefined);
}

// El cliente anida los errores (`errors`): el de arriba solo dice "Producing messages failed" y el motivo
// real esta en las hojas, repetido una vez por intento. Se juntan sin repetir.
function detalle(error: unknown): string {
  type Anidado = { message?: string; errors?: Anidado[] };
  const motivos = new Set<string>();
  const recorrer = (e: Anidado): void => {
    if (e.errors?.length) e.errors.forEach(recorrer);
    else motivos.add(e.message ?? String(e));
  };
  recorrer(error as Anidado);
  return `${(error as Anidado).message ?? 'error'} (${[...motivos].join('; ')})`;
}
