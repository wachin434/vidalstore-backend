import { randomUUID } from 'node:crypto';
import { crearProductor, type ProductorKafka } from './productor.js';

/** El topic compactado: lo crea vidalstore-plataforma/kafka/topics.sh (cleanup.policy=compact), nunca el codigo. */
export const TOPIC_CATALOGO = 'vidalstore.catalogo';

/** Un juego del catalogo, como lo guarda datos.mjs. */
export interface JuegoCatalogo {
  id: string;
  titulo: string;
  precio: number;
  activo?: boolean;
  publicadoPor?: string;
}

export type TipoCatalogo = 'juego.publicado' | 'precio.cambiado';

let productor: ProductorKafka | undefined;
const obtenerProductor = (): ProductorKafka => (productor ??= crearProductor());

/**
 * El mensaje de un juego. La KEY es el juegoId: en un topic compactado Kafka conserva solo el ultimo mensaje de
 * cada key, asi que el VALUE lleva el estado COMPLETO del juego (no solo lo que cambio). Mismo sobre que
 * vidalstore.compras: eventoId, tipo, version, emitidoEn, juegoId, usuarioSub y datos.
 */
function aMensaje(tipo: TipoCatalogo, juego: JuegoCatalogo, usuarioSub: string) {
  const eventoId = randomUUID();
  return {
    topic: TOPIC_CATALOGO,
    key: juego.id,
    value: JSON.stringify({
      eventoId,
      tipo,
      version: 1,
      emitidoEn: new Date().toISOString(),
      juegoId: juego.id,
      usuarioSub,
      datos: { titulo: juego.titulo, precioClp: Math.round(juego.precio), activo: juego.activo !== false },
    }),
    headers: { 'x-evento-id': eventoId, 'content-type': 'application/json' },
  };
}

/** Publica el estado vigente de UN juego (al publicarlo, editarlo o retirarlo). Si Kafka falla, solo se registra. */
export async function publicarJuego(tipo: TipoCatalogo, juego: JuegoCatalogo, usuarioSub: string): Promise<void> {
  try {
    const r = await obtenerProductor().send({ messages: [aMensaje(tipo, juego, usuarioSub)] });
    const o = r.offsets?.[0];
    console.log(`kafka: ${tipo} ${juego.id} en ${o?.topic}[${o?.partition}] offset ${o?.offset}`);
  } catch (error) {
    console.error(`kafka: no se pudo publicar ${tipo} de ${juego.id}: ${(error as Error).message}`);
  }
}

/**
 * Al arrancar: publica el estado actual de TODO el catalogo. Es lo que hace util un topic compactado: quien llegue
 * despues (o reconstruya su tabla desde el offset 0) encuentra un mensaje vigente por juego, sin importar cuantas
 * veces se editaron. Republicar lo mismo no ensucia: la compactacion deja solo el ultimo de cada key.
 */
export async function publicarCatalogoCompleto(juegos: JuegoCatalogo[]): Promise<void> {
  try {
    const messages = juegos.map((j) => aMensaje('juego.publicado', j, j.publicadoPor ?? 'sistema'));
    await obtenerProductor().send({ messages });
    console.log(`kafka: catalogo completo publicado en ${TOPIC_CATALOGO} (${messages.length} juegos)`);
  } catch (error) {
    console.error(`kafka: no se pudo publicar el catalogo completo: ${(error as Error).message}`);
  }
}

export async function cerrarProductorCatalogo(): Promise<void> {
  await productor?.close().catch(() => undefined);
}
