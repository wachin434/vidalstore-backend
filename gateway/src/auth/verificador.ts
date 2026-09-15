import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER = process.env.COGNITO_ISSUER!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const RESOURCE_SERVER = process.env.RESOURCE_SERVER_ID ?? 'vidalstore';

if (!ISSUER || !CLIENT_ID) {
  throw new Error(
    'Falta COGNITO_ISSUER o COGNITO_CLIENT_ID en el .env del gateway. Revisa .env.example',
  );
}

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export type Claims = {
  sub: string;
  scope?: string;
  client_id: string;
  token_use: string;
  'cognito:groups'?: string[];
  [k: string]: unknown;
};

export class ErrorDeAutenticacion extends Error {}

export async function verificar(cabeceraAuth?: string): Promise<Claims> {
  if (!cabeceraAuth || !cabeceraAuth.startsWith('Bearer ')) {
    throw new ErrorDeAutenticacion('falta el header Authorization: Bearer <token>');
  }

  const token = cabeceraAuth.slice('Bearer '.length).trim();
  if (!token) {
    throw new ErrorDeAutenticacion('token vacío');
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer: ISSUER }));
  } catch (e) {

    throw new ErrorDeAutenticacion(`token inválido: ${(e as Error).message}`);
  }

  if (payload.token_use !== 'access') {
    throw new ErrorDeAutenticacion(
      'no es un access token (¿mandaste el id_token por error?)',
    );
  }

  if (payload.client_id !== CLIENT_ID) {
    throw new ErrorDeAutenticacion('el token fue emitido para otra aplicación (client_id ajeno)');
  }

  return payload as unknown as Claims;
}

export function tieneScope(claims: Claims, scopeCorto: string): boolean {
  const completo = `${RESOURCE_SERVER}/${scopeCorto}`;
  return (claims.scope ?? '').split(' ').includes(completo);
}

export function estaEnGrupo(claims: Claims, ...gruposPermitidos: string[]): boolean {
  const grupos = claims['cognito:groups'] ?? [];
  return gruposPermitidos.some((g) => grupos.includes(g));
}

export const RESOURCE_SERVER_ID = RESOURCE_SERVER;
