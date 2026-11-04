import { randomUUID } from 'node:crypto';
import type { EventoDto } from './evento.dto.js';
import { TOPICS } from './topics.js';

/**
 * El serializer de Kafka en UN solo lugar: recibe el evento y devuelve el mensaje completo
 * (topic, key, value y headers). La key es el usuarioSub: todo lo de un mismo usuario cae en la misma
 * particion y se lee en orden. stringSerializers solo convierte estos textos a bytes.
 */
export function aMensaje(evento: EventoDto, correlationId: string = randomUUID()) {
  return {
    topic: TOPICS.compras,
    key: evento.usuarioSub,
    value: JSON.stringify(evento),
    headers: {
      'x-evento-id': evento.eventoId,
      'x-correlation-id': correlationId,
      'content-type': 'application/json',
    },
  };
}
