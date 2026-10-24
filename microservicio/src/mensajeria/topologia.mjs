export const EXCHANGE_EVENTOS = 'vidalstore.eventos';

export const RK_COMPRA_REALIZADA = 'compra.realizada';
export const RK_LICENCIA_REVOCADA = 'licencia.revocada';
export const RK_JUEGO_PUBLICADO = 'juego.publicado';

export const EXCHANGES_QUE_PUBLICA = [{ nombre: EXCHANGE_EVENTOS, tipo: 'topic' }];

export async function declararExchanges(canal) {
  for (const { nombre, tipo } of EXCHANGES_QUE_PUBLICA) {
    await canal.assertExchange(nombre, tipo, { durable: true });
  }
}