# VidalStore · Backend (gateway + microservicio)

Implementa el caso VidalStore completo: identidad real con AWS Cognito,
gateway NestJS que valida el token contra el JWKS, y un microservicio que
vuelve a validar por su cuenta.

## Arquitectura

```
Angular (localhost:4200) --Bearer token--> Gateway NestJS (localhost:8080) --> Microservicio (localhost:3001)
                                                  │
                                                  └── valida contra AWS Cognito (JWKS)
```

- **gateway/**: NestJS. Un solo punto de validación de identidad (firma, issuer,
  vigencia, `token_use`, `client_id`) y de autorización por scope o por grupo,
  según la tabla de rutas del punto 4.3 del enunciado.
- **microservicio/**: Express + datos en memoria (catálogo, biblioteca, licencias,
  auditoría). Vuelve a validar el token, como pide el punto 4.5.
- **scripts/crear-user-pool.sh**: recrea todo el proveedor de identidad desde cero
  con la AWS CLI (punto 4.7).

## 1. Crear el proveedor de identidad

Opción A — a mano en la consola de Cognito (recomendado la primera vez, para
entender cada pantalla): sigue el mismo patrón del laboratorio L3, cambiando
`biblioteca` por `vidalstore` y creando los **tres** grupos:

| Grupo | Rol |
|---|---|
| `jugadores` | Ver catálogo, comprar, ver su biblioteca |
| `editores` | Lo anterior + publicar/editar el catálogo |
| `administradores` | Lo anterior + revocar licencias |

Scopes del resource server `vidalstore`:
- `vidalstore/catalogo.leer`
- `vidalstore/catalogo.escribir`
- `vidalstore/biblioteca.leer`

App client: **Single-page application**, sin secreto, callback
`http://localhost:4200/callback`, `Authorization code grant`, scopes `openid`,
`profile` y los tres de arriba.

Crea además un **segundo app client** (sin habilitarle nada especial) — lo vas
a necesitar para la prueba 3 de más abajo: un token válido, pero emitido para
otra aplicación.

Opción B — con el script:

```bash
bash scripts/crear-user-pool.sh
```

Al final imprime todos los valores que necesitas pegar en los `.env` y en el
`Amplify.configure` del frontend.

## 2. Levantar el gateway

```bash
cd gateway
npm install
cp .env.example .env      # y pega tus valores de Cognito
npm run start:dev
```

Debe imprimir `gateway de VidalStore escuchando en http://localhost:8080`.

## 3. Levantar el microservicio

```bash
cd microservicio
npm install
cp .env.example .env      # los mismos COGNITO_ISSUER / COGNITO_CLIENT_ID
npm run start:dev
```

Debe imprimir `microservicio de VidalStore escuchando en http://localhost:3001`.

## Rutas del gateway (punto 4.3)

| Método y ruta | Autoriza por | Alcance |
|---|---|---|
| `GET /v1/catalogo` | scope `catalogo.leer` | cualquier sesión válida |
| `POST /v1/catalogo` | grupo | `editores`, `administradores` |
| `PUT /v1/catalogo/:juegoId` | grupo | `editores`, `administradores` |
| `POST /v1/compras` | scope `catalogo.leer` + `biblioteca.leer` | cualquier sesión válida |
| `GET /v1/biblioteca` | scope `biblioteca.leer` | del usuario del token (`sub`), nunca por parámetro |
| `GET /v1/licencias` | grupo | `administradores` — ve las de todos |
| `DELETE /v1/licencias/:licenciaId` | grupo | `administradores` |
| `GET /v1/auditoria` | grupo | `administradores` (requerimiento de grupos de 3) |

401 = "no sé quién eres" (token ausente/roto/vencido/ajeno).
403 = "sé quién eres, y no te alcanza" (token válido, permiso insuficiente).

## Las cuatro pruebas del punto 4.7

Con el gateway y el microservicio corriendo, y un token bueno en `$TOKEN`:

```bash
# 1. sin token
curl -i http://localhost:8080/v1/catalogo
# esperado: 401

# 2. token alterado (cámbiale un carácter al payload, la parte del medio)
curl -i -H "Authorization: Bearer $TOKEN_ALTERADO" http://localhost:8080/v1/catalogo
# esperado: 401

# 3. token emitido para OTRA aplicación (usa el segundo app client)
curl -i -H "Authorization: Bearer $TOKEN_DE_LA_APP_AJENA" http://localhost:8080/v1/catalogo
# esperado: 401 (client_id ajeno)

# 4. token válido sin el permiso suficiente (ej: un jugador probando /v1/licencias)
curl -i -H "Authorization: Bearer $TOKEN_DE_JUGADOR" http://localhost:8080/v1/licencias
# esperado: 403
```

Documenta estas cuatro salidas en el README con captura o con el texto crudo
de `curl -i`, como pide el punto 4.7.

## CORS (punto 4.6)

El gateway solo acepta el origen `http://localhost:4200` (configurable por
`FRONTEND_ORIGIN` en el `.env`) y solo los métodos `GET, POST, PUT, DELETE`.

## Qué falta documentar en este README antes de entregar

- [ ] Capturas de la consola de Cognito: user pool, app client, los tres grupos, los usuarios
- [ ] Diagrama de la arquitectura implementada (el de arriba sirve de base)
- [ ] Las cuatro pruebas de arriba, con su código de respuesta real
- [ ] Hash del último commit de este repo y del frontend, en el documento de entrega del AVA
