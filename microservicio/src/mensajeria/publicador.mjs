import { randomUUID } from 'node:crypto';
import amqp from 'amqplib';
import { declararExchanges } from './topologia.mjs';

// Tiempo maximo que se espera la confirmacion del broker. Sin quorum (un nodo
// caido en un cluster de dos) el broker nunca confirma y la peticion quedaria colgada.
const TIEMPO_CONFIRMACION_MS = Number(process.env.CONFIRMACION_TIMEOUT_MS ?? 5000);

let conexionPendiente = null;

async function abrir() {
  const conexion = await amqp.connect(process.env.RABBITMQ_URL ?? 'amqp://localhost:5672');
  // Canal con confirmaciones: publish() solo se da por bueno cuando el broker lo confirma.
  const canal = await conexion.createConfirmChannel();
  await declararExchanges(canal);

  const olvidar = () => { conexionPendiente = null; };
  conexion.on('close', olvidar);
  conexion.on('error', (err) => {
    console.error(`Conexión con RabbitMQ perdida: ${err.message}`);
    olvidar();
  });
  console.log('Conectado a RabbitMQ y exchanges declarados');
  return canal;
}

function obtenerCanal() {
  if (!conexionPendiente) {
    conexionPendiente = abrir().catch((err) => { conexionPendiente = null; throw err; });
  }
  return conexionPendiente;
}

export async function iniciarPublicador() {
  try { await obtenerCanal(); }
  catch (err) {
    console.warn(`RabbitMQ no está disponible todavía (${err.message}); se reintentará al publicar`);
  }
}

export async function publicar(exchange, routingKey, payload) {
  const canal = await obtenerCanal();
  const eventoId = randomUUID();
  await new Promise((resolve, reject) => {
    const espera = setTimeout(
      () => reject(new Error(`el broker no confirmo en ${TIEMPO_CONFIRMACION_MS} ms`)),
      TIEMPO_CONFIRMACION_MS,
    );
    canal.publish(
      exchange, routingKey, Buffer.from(JSON.stringify(payload)),
      {
        contentType: 'application/json',
        persistent: true,
        headers: { 'x-evento-id': eventoId, 'x-emitido-en': new Date().toISOString() },
      },
      (err) => {
        clearTimeout(espera);
        if (err) reject(err);
        else resolve();
      },
    );
  });
  return eventoId;
}