import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const API_KEY = process.env.RAWG_API_KEY;

if (!API_KEY) {
  console.error('Falta RAWG_API_KEY en microservicio/.env');
  process.exit(1);
}

const CANTIDAD = 1000;
const PAGE_SIZE = 40;

const precios = [
  4990,
  7990,
  9990,
  12990,
  14990,
  19990,
  24990,
  29990,
  34990,
  39990,
  44990,
  49990,
  59990,
];

const juegos = [];

console.log('Importando juegos desde RAWG...\n');

try {
  for (let pagina = 1; juegos.length < CANTIDAD; pagina++) {
    console.log(
      `Pagina ${pagina} - ${juegos.length}/${CANTIDAD} juegos`
    );

    const url =
      `https://api.rawg.io/api/games` +
      `?key=${API_KEY}` +
      `&page=${pagina}` +
      `&page_size=${PAGE_SIZE}` +
      `&ordering=-rating`;

    const respuesta = await fetch(url);

    if (!respuesta.ok) {
      throw new Error(
        `RAWG respondio con HTTP ${respuesta.status}`
      );
    }

    const data = await respuesta.json();

    if (!data.results?.length) {
      console.log('RAWG no devolvio mas juegos.');
      break;
    }

    for (const juego of data.results) {
      if (!juego.name || !juego.slug) {
        continue;
      }

      // Evitar juegos repetidos
      if (juegos.some((j) => j.id === juego.slug)) {
        continue;
      }

      const precio =
        precios[Math.floor(Math.random() * precios.length)];

      const generos =
        juego.genres
          ?.map((genero) => genero.name)
          .join(', ') || 'Sin categoria';

      const plataformas =
        juego.platforms
          ?.map((item) => item.platform?.name)
          .filter(Boolean)
          .join(', ') || 'No especificadas';

      juegos.push({
        id: juego.slug,
        titulo: juego.name,
        precio,
        genero: generos,

        portada:
          juego.background_image ||
          'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600',

        descripcion:
          `${juego.name}. ` +
          `Lanzamiento: ${juego.released || 'sin fecha'}. ` +
          `Plataformas: ${plataformas}. ` +
          `Valoracion RAWG: ${juego.rating ?? 'sin valoracion'}.`,
      });

      if (juegos.length >= CANTIDAD) {
        break;
      }
    }
  }

  const rutaSalida = fileURLToPath(
    new URL('./catalogo-rawg.json', import.meta.url)
  );

  await writeFile(
    rutaSalida,
    JSON.stringify(juegos, null, 2),
    'utf8'
  );

  console.log('\n================================');
  console.log(`${juegos.length} juegos importados`);
  console.log('catalogo-rawg.json creado');
  console.log('================================');
} catch (error) {
  console.error('\nError importando juegos:');
  console.error(error);
  process.exit(1);
}