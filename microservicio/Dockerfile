# Etapa 1: compila el TypeScript de src/kafka (el resto del servicio es JavaScript).
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Etapa 2: la imagen final, solo con dependencias de produccion.
FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "src/index.mjs"]
