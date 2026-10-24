import { pool } from './pool.mjs';

const COLUMNAS =
  'id, juego_id, usuario_sub, estado, adquirida_en, revocada_en, revocada_por';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class LicenciaDuplicada extends Error {
  constructor() {
    super('ya tienes una licencia activa de este juego');
    this.name = 'LicenciaDuplicada';
  }
}

/** Fila de la base → forma JSON que consume el frontend. */
export function aLicenciaApi(fila) {
  return {
    id: fila.id,
    juegoId: fila.juego_id,
    usuarioSub: fila.usuario_sub,
    estado: fila.estado,
    compradoEn: fila.adquirida_en.toISOString(),
    revocada: fila.estado === 'revocada',
    revocadaEn: fila.revocada_en ? fila.revocada_en.toISOString() : null,
    revocadaPor: fila.revocada_por,
  };
}

/** Si ya hay una activa del mismo juego, el índice único parcial lanza 23505. */
export async function crearLicencia(juegoId, usuarioSub) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO licencias.licencias (juego_id, usuario_sub)
       VALUES ($1, $2)
       RETURNING ${COLUMNAS}`,
      [juegoId, usuarioSub],
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw new LicenciaDuplicada();
    throw err;
  }
}

/** Devuelve { fila, yaEstabaRevocada } o null si no existe. */
export async function revocarLicencia(licenciaId, revocadaPor) {
  if (!UUID.test(licenciaId)) return null;

  const actualizada = await pool.query(
    `UPDATE licencias.licencias
        SET estado = 'revocada', revocada_en = now(), revocada_por = $2
      WHERE id = $1 AND estado = 'activa'
      RETURNING ${COLUMNAS}`,
    [licenciaId, revocadaPor],
  );
  if (actualizada.rows.length > 0) {
    return { fila: actualizada.rows[0], yaEstabaRevocada: false };
  }

  const existente = await pool.query(
    `SELECT ${COLUMNAS} FROM licencias.licencias WHERE id = $1`,
    [licenciaId],
  );
  if (existente.rows.length === 0) return null;
  return { fila: existente.rows[0], yaEstabaRevocada: true };
}

export async function listarActivasDeUsuario(usuarioSub) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM licencias.licencias
      WHERE usuario_sub = $1 AND estado = 'activa'
      ORDER BY adquirida_en DESC`,
    [usuarioSub],
  );
  return rows;
}

export async function listarTodas() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM licencias.licencias ORDER BY adquirida_en DESC`,
  );
  return rows;
}