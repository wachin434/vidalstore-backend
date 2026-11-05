import { Producer, ProduceAcks, compatibilityPartitioner, stringSerializers } from '@platformatic/kafka';

export type ProductorKafka = Producer<string, string, string, string>;

/** Crea el productor desde KAFKA_BROKERS. No se conecta hasta el primer envio. */
export function crearProductor(): ProductorKafka {
  const brokers = process.env.KAFKA_BROKERS;
  if (!brokers) {
    throw new Error('Falta KAFKA_BROKERS en el entorno del microservicio');
  }
  return new Producer({
    clientId: 'vidalstore-licencias',
    bootstrapBrokers: brokers.split(','),
    serializers: stringSerializers,
    idempotent: true,
    acks: ProduceAcks.ALL, // espera a todo el ISR
    retries: 10, // con un limite: asi un fallo se ve
    partitioner: compatibilityPartitioner, // como el cliente de Java
    autocreateTopics: false,
  });
}
