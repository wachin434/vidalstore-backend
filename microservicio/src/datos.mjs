import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const catalogoPath = fileURLToPath(
  new URL('./catalogo-rawg.json', import.meta.url),
);

const licenciasPath = fileURLToPath(
  new URL('./licencias.json', import.meta.url),
);

const auditoriaPath = fileURLToPath(
  new URL('./auditoria.json', import.meta.url),
);

function leerJson(ruta, valorInicial = []) {
  try {
    if (!existsSync(ruta)) {
      writeFileSync(
        ruta,
        JSON.stringify(valorInicial, null, 2),
        'utf8',
      );

      return valorInicial;
    }

    const contenido = readFileSync(ruta, 'utf8');

    if (!contenido.trim()) {
      return valorInicial;
    }

    return JSON.parse(contenido);
  } catch (error) {
    console.error(
      `Error leyendo ${ruta}:`,
      error.message,
    );

    return valorInicial;
  }
}

function guardarJson(ruta, datos) {
  writeFileSync(
    ruta,
    JSON.stringify(datos, null, 2),
    'utf8',
  );
}

/* =====================================================
   CATÁLOGO
===================================================== */

export const catalogo = leerJson(
  catalogoPath,
  [],
);

console.log(
  `Catálogo cargado: ${catalogo.length} juegos`,
);

export function guardarCatalogo() {
  guardarJson(
    catalogoPath,
    catalogo,
  );
}

/* =====================================================
   LICENCIAS
===================================================== */

export const licencias = leerJson(
  licenciasPath,
  [],
);

export function guardarLicencias() {
  guardarJson(
    licenciasPath,
    licencias,
  );
}

/* =====================================================
   AUDITORÍA
===================================================== */

export const auditoria = leerJson(
  auditoriaPath,
  [],
);

export function guardarAuditoria() {
  guardarJson(
    auditoriaPath,
    auditoria,
  );
}

/* =====================================================
   CREAR LICENCIA
===================================================== */

export function crearLicencia(
  juegoId,
  usuarioSub,
) {
  const licencia = {
    id: randomUUID(),
    juegoId,
    usuarioSub,
    compradoEn: new Date().toISOString(),
    revocada: false,
  };

  licencias.push(licencia);

  guardarLicencias();

  return licencia;
}

/* =====================================================
   REVOCAR LICENCIA
===================================================== */

export function revocarLicencia(
  licenciaId,
  adminSub,
) {
  const licencia = licencias.find(
    (l) => l.id === licenciaId,
  );

  if (!licencia) {
    return null;
  }

  if (licencia.revocada) {
    return licencia;
  }

  licencia.revocada = true;

  guardarLicencias();

  auditoria.push({
    id: randomUUID(),
    accion: 'revocar_licencia',
    licenciaId: licencia.id,
    juegoId: licencia.juegoId,
    adminSub,
    usuarioSub: licencia.usuarioSub,
    fecha: new Date().toISOString(),
  });

  guardarAuditoria();

  return licencia;
}