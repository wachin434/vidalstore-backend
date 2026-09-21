import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const catalogoPath = fileURLToPath(
  new URL('./catalogo-rawg.json', import.meta.url)
);

let catalogoImportado = [];

try {
  const contenido = readFileSync(catalogoPath, 'utf8');

  catalogoImportado = JSON.parse(contenido);

  console.log(
    `Catalogo cargado: ${catalogoImportado.length} juegos`
  );
} catch (error) {
  console.warn(
    'No se encontro catalogo-rawg.json. Ejecuta primero el importador.'
  );
}

export const catalogo = catalogoImportado;

export const licencias = [];

export const auditoria = [];

export function crearLicencia(juegoId, usuarioSub) {
  const licencia = {
    id: randomUUID(),
    juegoId,
    usuarioSub,
    compradoEn: new Date().toISOString(),
    revocada: false,
  };

  licencias.push(licencia);

  return licencia;
}

export function revocarLicencia(licenciaId, adminSub) {
  const licencia = licencias.find(
    (l) => l.id === licenciaId
  );

  if (!licencia) {
    return null;
  }

  licencia.revocada = true;

  auditoria.push({
    id: randomUUID(),
    accion: 'revocar_licencia',
    licenciaId: licencia.id,
    juegoId: licencia.juegoId,
    adminSub,
    usuarioSub: licencia.usuarioSub,
    fecha: new Date().toISOString(),
  });

  return licencia;
}