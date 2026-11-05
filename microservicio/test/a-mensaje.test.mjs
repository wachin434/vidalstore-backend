import test from 'node:test';
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { aMensaje } from '../dist/kafka/a-mensaje.js';
import { EventoDto } from '../dist/kafka/evento.dto.js';

const evento = {
  eventoId: '5993e1cf-0000-4000-8000-000000000001',
  tipo: 'compra.realizada',
  version: 1,
  emitidoEn: '2026-11-04T21:00:00.000Z',
  juegoId: '292030',
  usuarioSub: 'sub-usuario-123',
  datos: {},
};

test('el mensaje va al topic vidalstore.compras', () => {
  assert.equal(aMensaje(evento).topic, 'vidalstore.compras');
});

test('la key es el usuarioSub', () => {
  assert.equal(aMensaje(evento).key, 'sub-usuario-123');
});

test('el value es el evento completo en JSON', () => {
  const mensaje = aMensaje(evento);
  assert.equal(typeof mensaje.value, 'string');
  assert.deepEqual(JSON.parse(mensaje.value), evento);
});

test('lleva los 3 headers: x-evento-id, x-correlation-id y content-type', () => {
  const { headers } = aMensaje(evento, 'corr-1');
  assert.equal(headers['x-evento-id'], evento.eventoId);
  assert.equal(headers['x-correlation-id'], 'corr-1');
  assert.equal(headers['content-type'], 'application/json');
  assert.equal(Object.keys(headers).length, 3);
});

test('sin correlationId se genera un UUID distinto en cada mensaje', () => {
  const a = aMensaje(evento).headers['x-correlation-id'];
  const b = aMensaje(evento).headers['x-correlation-id'];
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test('el DTO rechaza un evento con eventoId que no es UUID', async () => {
  const malo = plainToInstance(EventoDto, { ...evento, eventoId: 'no-es-uuid' });
  const errores = await validate(malo, { whitelist: true, forbidNonWhitelisted: true });
  assert.ok(errores.length > 0);
});

test('el DTO rechaza un tipo desconocido', async () => {
  const malo = plainToInstance(EventoDto, { ...evento, tipo: 'compra.inventada' });
  const errores = await validate(malo, { whitelist: true, forbidNonWhitelisted: true });
  assert.ok(errores.length > 0);
});
