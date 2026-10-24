import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL en el .env del microservicio');

export const pool = new pg.Pool({ connectionString: url });
pool.on('error', (err) => {
  console.error(`Error en una conexión inactiva de Postgres: ${err.message}`);
});

const rutaEsquema = fileURLToPath(new URL('../../sql/esquema.sql', import.meta.url));

export async function aplicarEsquema({ intentos = 10, esperaMs = 2000 } = {}) {
  const sql = readFileSync(rutaEsquema, 'utf8');
  for (let i = 1; ; i++) {
    try {
      await pool.query(sql);
      console.log('Esquema de licencias aplicado');
      return;
    } catch (err) {
      if (i >= intentos) throw new Error(`No se pudo aplicar el esquema: ${err.message}`);
      console.warn(`Postgres no está listo (${err.message}); reintento ${i}/${intentos}`);
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
}