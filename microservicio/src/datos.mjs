import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// El catálogo NO está en Postgres: sigue saliendo del JSON versionado que dejó
// el script importar-rawg.mjs. Las licencias viven en Postgres (src/db).

const catalogoPath = fileURLToPath(
  new URL('./catalogo-rawg.json', import.meta.url),
);

function leerJson(ruta, valorInicial = []) {
  try {
    if (!existsSync(ruta)) {
      writeFileSync(ruta, JSON.stringify(valorInicial, null, 2), 'utf8');
      return valorInicial;
    }

    const contenido = readFileSync(ruta, 'utf8');

    if (!contenido.trim()) {
      return valorInicial;
    }

    return JSON.parse(contenido);
  } catch (error) {
    console.error(`Error leyendo ${ruta}:`, error.message);
    return valorInicial;
  }
}

export const catalogo = leerJson(catalogoPath, []);

console.log(`Catálogo cargado: ${catalogo.length} juegos`);

export function guardarCatalogo() {
  writeFileSync(catalogoPath, JSON.stringify(catalogo, null, 2), 'utf8');
}
