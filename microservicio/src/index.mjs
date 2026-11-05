import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  middlewareAuth,
  estaEnGrupo,
} from './auth.mjs';

import { catalogo, guardarCatalogo } from './datos.mjs';
import { aplicarEsquema } from './db/pool.mjs';
import {
  LicenciaDuplicada,
  aLicenciaApi,
  crearLicencia,
  listarActivasDeUsuario,
  listarTodas,
  revocarLicencia,
} from './db/licencias-repo.mjs';
import { iniciarPublicador, publicar } from './mensajeria/publicador.mjs';
import { publicarEnKafka, cerrarProductor } from '../dist/kafka/publicador.js';
import {
  EXCHANGE_EVENTOS,
  RK_COMPRA_REALIZADA,
  RK_JUEGO_PUBLICADO,
  RK_LICENCIA_REVOCADA,
} from './mensajeria/topologia.mjs';

const app = express();

app.use(cors());
app.use(express.json());
app.use(middlewareAuth);

/* =====================================================
   UTILIDADES
===================================================== */

function crearSlug(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Express 4 no captura los errores de handlers async: este envoltorio los
 * manda al manejador de errores final (500) en vez de dejar la petición colgada.
 */
const ruta = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Publica un evento DESPUÉS de haber escrito. Si el broker falla, el dato ya
 * está guardado: se deja el error en el log con el identificador de negocio
 * para poder republicarlo a mano y se responde igual. Es la ventana conocida
 * entre escribir y publicar (se documenta en el README).
 */
async function publicarEvento(routingKey, payload, referencia) {
  try {
    await publicar(EXCHANGE_EVENTOS, routingKey, payload);
  } catch (err) {
    console.error(
      `No se pudo publicar ${routingKey} (${referencia}): ${err.message}`,
    );
  }
}

function conJuego(licenciaApi) {
  return {
    ...licenciaApi,
    juego: catalogo.find((j) => j.id === licenciaApi.juegoId),
  };
}

/* =====================================================
   CATÁLOGO
===================================================== */

app.get('/catalogo', (_req, res) => {
  const juegosActivos =
    catalogo.filter(
      (juego) =>
        juego.activo !== false,
    );

  return res.json(
    juegosActivos,
  );
});

/* =====================================================
   PUBLICAR JUEGO
   Solo editores y administradores
===================================================== */

app.post('/catalogo', ruta(async (req, res) => {
  if (
    !estaEnGrupo(
      req.claims,
      'editores',
      'administradores',
    )
  ) {
    return res.status(403).json({
      error:
        'solo editores o administradores pueden publicar juegos',
    });
  }

  const {
    titulo,
    precio,
    genero,
    portada,
    descripcion,
  } = req.body ?? {};

  if (
    !titulo ||
    precio === undefined ||
    precio === null
  ) {
    return res.status(400).json({
      error:
        'faltan titulo o precio',
    });
  }

  const precioNumero =
    Number(precio);

  if (
    !Number.isFinite(
      precioNumero,
    ) ||
    precioNumero < 0
  ) {
    return res.status(400).json({
      error:
        'el precio debe ser un número válido',
    });
  }

  const id =
    crearSlug(titulo);

  if (!id) {
    return res.status(400).json({
      error:
        'no se pudo generar un id válido',
    });
  }

  const yaExiste =
    catalogo.some(
      (juego) =>
        juego.id === id,
    );

  if (yaExiste) {
    return res.status(409).json({
      error:
        'ya existe un juego con ese título',
    });
  }

  const juego = {
    id,

    titulo:
      titulo.trim(),

    precio:
      precioNumero,

    genero:
      genero?.trim() ||
      'Sin categoría',

    portada:
      portada?.trim() ||
      'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600',

    descripcion:
      descripcion?.trim() || '',

    activo: true,

    publicadoPor:
      req.claims.sub,

    creadoEn:
      new Date().toISOString(),
  };

  catalogo.push(juego);

  guardarCatalogo();

  await publicarEvento(
    RK_JUEGO_PUBLICADO,
    {
      juegoId: juego.id,
      titulo: juego.titulo,
      editorSub: req.claims.sub,
    },
    `juegoId=${juego.id}`,
  );

  return res
    .status(201)
    .json(juego);
}));

/* =====================================================
   EDITAR JUEGO
   Solo editores y administradores
===================================================== */

app.put(
  '/catalogo/:juegoId',
  (req, res) => {
    if (
      !estaEnGrupo(
        req.claims,
        'editores',
        'administradores',
      )
    ) {
      return res.status(403).json({
        error:
          'solo editores o administradores pueden editar el catálogo',
      });
    }

    const juego =
      catalogo.find(
        (j) =>
          j.id ===
          req.params.juegoId,
      );

    if (!juego) {
      return res.status(404).json({
        error:
          'juego no existe',
      });
    }

    if (
      juego.activo === false
    ) {
      return res.status(409).json({
        error:
          'el juego fue eliminado del catálogo',
      });
    }

    const {
      titulo,
      precio,
      genero,
      portada,
      descripcion,
    } = req.body ?? {};

    if (
      titulo !== undefined
    ) {
      const tituloLimpio =
        String(titulo).trim();

      if (!tituloLimpio) {
        return res
          .status(400)
          .json({
            error:
              'el título no puede estar vacío',
          });
      }

      juego.titulo =
        tituloLimpio;
    }

    if (
      precio !== undefined
    ) {
      const precioNumero =
        Number(precio);

      if (
        !Number.isFinite(
          precioNumero,
        ) ||
        precioNumero < 0
      ) {
        return res
          .status(400)
          .json({
            error:
              'el precio debe ser un número válido',
          });
      }

      juego.precio =
        precioNumero;
    }

    if (
      genero !== undefined
    ) {
      juego.genero =
        String(genero).trim() ||
        'Sin categoría';
    }

    if (
      portada !== undefined
    ) {
      juego.portada =
        String(portada).trim();
    }

    if (
      descripcion !== undefined
    ) {
      juego.descripcion =
        String(
          descripcion,
        ).trim();
    }

    juego.editadoPor =
      req.claims.sub;

    juego.editadoEn =
      new Date().toISOString();

    guardarCatalogo();

    return res.json(juego);
  },
);

/* =====================================================
   ELIMINAR JUEGO
   Eliminación lógica.
   Solo administradores
===================================================== */

app.delete(
  '/catalogo/:juegoId',
  (req, res) => {
    if (
      !estaEnGrupo(
        req.claims,
        'administradores',
      )
    ) {
      return res.status(403).json({
        error:
          'solo administradores pueden eliminar juegos',
      });
    }

    const juego =
      catalogo.find(
        (j) =>
          j.id ===
          req.params.juegoId,
      );

    if (!juego) {
      return res.status(404).json({
        error:
          'juego no existe',
      });
    }

    if (
      juego.activo === false
    ) {
      return res.status(409).json({
        error:
          'el juego ya fue eliminado del catálogo',
      });
    }

    juego.activo = false;

    juego.eliminadoPor =
      req.claims.sub;

    juego.eliminadoEn =
      new Date().toISOString();

    guardarCatalogo();

    return res.json({
      mensaje:
        'juego eliminado del catálogo',

      juego,
    });
  },
);

/* =====================================================
   COMPRAS

   La identidad del comprador sale exclusivamente
   del access token validado por el microservicio.
===================================================== */

app.post('/compras', ruta(async (req, res) => {
  const { juegoId } = req.body ?? {};
  const usuarioSub = req.claims.sub;

  if (!juegoId || typeof juegoId !== 'string') {
    return res.status(400).json({ error: 'falta juegoId' });
  }

  const juego = catalogo.find(
    (j) => j.id === juegoId && j.activo !== false,
  );

  if (!juego) {
    return res.status(404).json({ error: 'el juego no existe' });
  }

  let fila;

  try {
    fila = await crearLicencia(juegoId, usuarioSub);
  } catch (err) {
    if (err instanceof LicenciaDuplicada) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }

  // La compra se publica antes de responder el 201.
  await publicarEvento(
    RK_COMPRA_REALIZADA,
    {
      licenciaId: fila.id,
      juegoId: fila.juego_id,
      usuarioSub: fila.usuario_sub,
      adquiridaEn: fila.adquirida_en.toISOString(),
    },
    `licenciaId=${fila.id}`,
  );

  // Y además en Kafka (EP3): no reemplaza a RabbitMQ.
  await publicarEnKafka('compra.realizada', fila.juego_id, fila.usuario_sub, {
    licenciaId: String(fila.id),
    adquiridaEn: fila.adquirida_en.toISOString(),
  });

  return res.status(201).json({
    licencia: aLicenciaApi(fila),
    juego,
  });
}));

/* =====================================================
   BIBLIOTECA

   No recibe usuario por URL ni por body.
   La identidad sale exclusivamente del token.
===================================================== */

app.get('/biblioteca', ruta(async (req, res) => {
  const filas = await listarActivasDeUsuario(req.claims.sub);
  return res.json(filas.map((f) => conJuego(aLicenciaApi(f))));
}));

/* =====================================================
   LICENCIAS
   Solo administradores
===================================================== */

app.get('/licencias', ruta(async (req, res) => {
  if (!estaEnGrupo(req.claims, 'administradores')) {
    return res.status(403).json({ error: 'solo administradores' });
  }

  const filas = await listarTodas();
  return res.json(filas.map((f) => conJuego(aLicenciaApi(f))));
}));

/* =====================================================
   REVOCAR LICENCIA
   Solo administradores.
   revocada_por sale del sub del token; cualquier "revocadoPor"
   que venga en el cuerpo se ignora. Solo se lee "motivo".
===================================================== */

app.delete('/licencias/:licenciaId', ruta(async (req, res) => {
  if (!estaEnGrupo(req.claims, 'administradores')) {
    return res.status(403).json({ error: 'solo administradores' });
  }

  const motivoCrudo = req.body?.motivo;

  if (motivoCrudo !== undefined && typeof motivoCrudo !== 'string') {
    return res.status(400).json({ error: 'el motivo debe ser texto' });
  }

  const motivo = (motivoCrudo ?? '').trim();

  if (motivo.length > 500) {
    return res
      .status(400)
      .json({ error: 'el motivo no puede superar 500 caracteres' });
  }

  const resultado = await revocarLicencia(
    req.params.licenciaId,
    req.claims.sub,
  );

  if (!resultado) {
    return res.status(404).json({ error: 'licencia no existe' });
  }

  const { fila, yaEstabaRevocada } = resultado;

  // Si ya estaba revocada no se vuelve a publicar: sería un evento duplicado.
  if (!yaEstabaRevocada) {
    await publicarEvento(
      RK_LICENCIA_REVOCADA,
      {
        licenciaId: fila.id,
        juegoId: fila.juego_id,
        // usuarioSub sale de la fila modificada, no del cuerpo ni del token del admin
        usuarioSub: fila.usuario_sub,
        revocadaPor: fila.revocada_por,
        motivo,
      },
      `licenciaId=${fila.id}`,
    );

    // La key de Kafka es el dueño de la licencia, no el admin que la revoca.
    await publicarEnKafka('licencia.revocada', fila.juego_id, fila.usuario_sub, {
      licenciaId: String(fila.id),
      revocadaPor: String(fila.revocada_por),
      motivo,
    });
  }

  return res.json(conJuego(aLicenciaApi(fila)));
}));

/* =====================================================
   ERRORES NO PREVISTOS
===================================================== */

app.use((err, _req, res, _next) => {
  console.error(`Error no controlado: ${err.stack ?? err.message}`);
  return res.status(500).json({ error: 'error interno del servidor' });
});

/* =====================================================
   SERVIDOR
===================================================== */

const port = Number(process.env.PORT ?? 3001);

await aplicarEsquema();
await iniciarPublicador();

app.listen(port, () => {
  console.log(
    `microservicio de VidalStore escuchando en http://localhost:${port}`,
  );
});

// Cierra el productor de Kafka al apagar el contenedor (docker compose stop).
process.on('SIGTERM', async () => {
  await cerrarProductor();
  process.exit(0);
});
