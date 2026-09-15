#!/usr/bin/env bash
# Recrea desde cero todo el proveedor de identidad de VidalStore:
# user pool, resource server + scopes, 2 app clients, 3 grupos y 3 usuarios de prueba.
#
# Uso: en Git Bash (Windows) o cualquier terminal (macOS/Linux), con la
# AWS CLI configurada contra el laboratorio de AWS:
#
#   bash crear-user-pool.sh
#
# Al final imprime los valores para pegar en el .env del gateway y del
# microservicio, y en el Amplify.configure del frontend.

set -e
REGION="us-east-1"
PREFIJO_DOMINIO="vidalstore-$(whoami | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')-$RANDOM"

echo "== 1. Creando el user pool =="
POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name vidalstore \
  --region "$REGION" \
  --username-attributes email \
  --auto-verified-attributes email \
  --schema Name=email,Required=true \
  --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
  --query 'UserPool.Id' --output text)
echo "User pool: $POOL_ID"

echo "== 2. Resource server y scopes =="
aws cognito-idp create-resource-server \
  --user-pool-id "$POOL_ID" --region "$REGION" \
  --identifier vidalstore --name "API de VidalStore" \
  --scopes \
    ScopeName=catalogo.leer,ScopeDescription="Leer el catálogo" \
    ScopeName=catalogo.escribir,ScopeDescription="Publicar o editar juegos" \
    ScopeName=biblioteca.leer,ScopeDescription="Ver y comprar en la biblioteca propia"

echo "== 3. App client público (la SPA de verdad) =="
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$POOL_ID" --region "$REGION" \
  --client-name vidalstore-spa \
  --no-generate-secret \
  --allowed-o-auth-flows-user-pool-client \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid profile vidalstore/catalogo.leer vidalstore/catalogo.escribir vidalstore/biblioteca.leer \
  --callback-urls '["http://localhost:4200/callback"]' \
  --logout-urls '["http://localhost:4200"]' \
  --supported-identity-providers COGNITO \
  --query 'UserPoolClient.ClientId' --output text)
echo "Client ID (real): $CLIENT_ID"

echo "== 4. Segundo app client (para la prueba 3: token emitido para OTRA app) =="
CLIENT_ID_AJENO=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$POOL_ID" --region "$REGION" \
  --client-name vidalstore-app-ajena \
  --no-generate-secret \
  --allowed-o-auth-flows-user-pool-client \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes openid profile vidalstore/catalogo.leer \
  --callback-urls '["http://localhost:4200/callback"]' \
  --supported-identity-providers COGNITO \
  --query 'UserPoolClient.ClientId' --output text)
echo "Client ID (ajeno, solo para la prueba 3): $CLIENT_ID_AJENO"

echo "== 5. Dominio de login =="
aws cognito-idp create-user-pool-domain \
  --domain "$PREFIJO_DOMINIO" \
  --user-pool-id "$POOL_ID" --region "$REGION" \
  --managed-login-version 2
aws cognito-idp create-managed-login-branding \
  --user-pool-id "$POOL_ID" --client-id "$CLIENT_ID" \
  --use-cognito-provided-values --region "$REGION" > /dev/null
echo "Dominio: https://$PREFIJO_DOMINIO.auth.$REGION.amazoncognito.com"

echo "== 6. Los tres grupos del punto 4.1 =="
aws cognito-idp create-group --group-name jugadores --user-pool-id "$POOL_ID" --region "$REGION"
aws cognito-idp create-group --group-name editores --user-pool-id "$POOL_ID" --region "$REGION"
aws cognito-idp create-group --group-name administradores --user-pool-id "$POOL_ID" --region "$REGION"

echo "== 7. Tres usuarios de prueba, clave permanente =="
for PAR in "jugador@vidalstore.test:jugadores" "editor@vidalstore.test:editores" "admin@vidalstore.test:administradores"; do
  CORREO="${PAR%%:*}"
  GRUPO="${PAR##*:}"
  aws cognito-idp admin-create-user \
    --user-pool-id "$POOL_ID" --region "$REGION" \
    --username "$CORREO" \
    --message-action SUPPRESS \
    --user-attributes Name=email,Value="$CORREO" Name=email_verified,Value=true
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" --region "$REGION" \
    --username "$CORREO" --password 'VidalStore2026!' --permanent
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id "$POOL_ID" --region "$REGION" \
    --username "$CORREO" --group-name "$GRUPO"
  echo "  usuario $CORREO -> grupo $GRUPO (clave: VidalStore2026!)"
done

echo ""
echo "======================================================================"
echo " Pega esto en gateway/.env y microservicio/.env:"
echo ""
echo "COGNITO_REGION=$REGION"
echo "COGNITO_ISSUER=https://cognito-idp.$REGION.amazonaws.com/$POOL_ID"
echo "COGNITO_CLIENT_ID=$CLIENT_ID"
echo "RESOURCE_SERVER_ID=vidalstore"
echo ""
echo " Y esto en el Amplify.configure del frontend (src/main.ts):"
echo ""
echo "userPoolId: '$POOL_ID'"
echo "userPoolClientId: '$CLIENT_ID'"
echo "domain: '$PREFIJO_DOMINIO.auth.$REGION.amazoncognito.com'"
echo ""
echo " Client ID del app client AJENO, solo para la prueba 3 del README: $CLIENT_ID_AJENO"
echo "======================================================================"
