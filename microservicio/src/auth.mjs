import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER = process.env.COGNITO_ISSUER;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

if (!ISSUER || !CLIENT_ID) {
  throw new Error('Falta COGNITO_ISSUER o COGNITO_CLIENT_ID en el .env del microservicio');
}

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export async function verificar(cabeceraAuth) {
  if (!cabeceraAuth || !cabeceraAuth.startsWith('Bearer ')) {
    const e = new Error('falta el token');
    e.status = 401;
    throw e;
  }
  const token = cabeceraAuth.slice(7).trim();

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer: ISSUER }));
  } catch (err) {
    const e = new Error(`token inválido: ${err.message}`);
    e.status = 401;
    throw e;
  }

  if (payload.token_use !== 'access') {
    const e = new Error('no es un access token');
    e.status = 401;
    throw e;
  }
  if (payload.client_id !== CLIENT_ID) {
    const e = new Error('client_id ajeno');
    e.status = 401;
    throw e;
  }
  return payload;
}

export function estaEnGrupo(claims, ...grupos) {
  const propios = claims['cognito:groups'] ?? [];
  return grupos.some((g) => propios.includes(g));
}

export async function middlewareAuth(req, res, next) {
  try {
    req.claims = await verificar(req.headers.authorization);
    next();
  } catch (e) {
    res.status(e.status ?? 401).json({ error: e.message });
  }
}