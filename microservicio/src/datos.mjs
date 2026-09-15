import { randomUUID } from 'node:crypto';

export const catalogo = [
  {
    id: 'half-life-3',
    titulo: 'Half-Life 3',
    precio: 29990,
    genero: 'Shooter narrativo',
    portada: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600',
    descripcion: 'La secuela que todos esperaban. Licencia revocable en cualquier momento.',
  },
  {
    id: 'chile-simulator',
    titulo: 'Chile Simulator 2026',
    precio: 14990,
    genero: 'Simulación',
    portada: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=600',
    descripcion: 'Sobrevive al taco de las 6 y a la variable dólar.',
  },
  {
    id: 'cognito-quest',
    titulo: 'Cognito Quest',
    precio: 9990,
    genero: 'Puzzle',
    portada: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600',
    descripcion: 'Encuentra el JWKS antes de que expire tu access token.',
  },
];

export const licencias = []; // { id, juegoId, usuarioSub, comprarEn, revocada }
export const auditoria = []; // { id, accion, licenciaId, juegoId, adminSub, usuarioSub, fecha }

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
  const licencia = licencias.find((l) => l.id === licenciaId);
  if (!licencia) return null;
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