import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { middlewareAuth, estaEnGrupo } from './auth.mjs';
import {
  catalogo,
  licencias,
  auditoria,
  crearLicencia,
  revocarLicencia,
  guardarCatalogo,
} from './datos.mjs';

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

/* =====================================================
   CATÁLOGO
===================================================== */

app.get('/catalogo', (_req, res) => {
  const juegosActivos = catalogo.filter(
    (juego) => juego.activo !== false,
  );

  return res.json(juegosActivos);
});

/* =====================================================
   PUBLICAR JUEGO
   Solo editores y administradores
===================================================== */

app.post('/catalogo', (req, res) => {
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
      error: 'faltan titulo o precio',
    });
  }

  const precioNumero = Number(precio);

  if (
    !Number.isFinite(precioNumero) ||
    precioNumero < 0
  ) {
    return res.status(400).json({
      error: 'el precio debe ser un número válido',
    });
  }

  const id = crearSlug(titulo);

  if (!id) {
    return res.status(400).json({
      error: 'no se pudo generar un id válido',
    });
  }

  const yaExiste = catalogo.some(
    (juego) => juego.id === id,
  );

  if (yaExiste) {
    return res.status(409).json({
      error:
        'ya existe un juego con ese título',
    });
  }

  const juego = {
    id,
    titulo: titulo.trim(),
    precio: precioNumero,
    genero:
      genero?.trim() || 'Sin categoría',
    portada:
      portada?.trim() ||
      'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600',
    descripcion:
      descripcion?.trim() || '',
    activo: true,
    publicadoPor: req.claims.sub,
    creadoEn: new Date().toISOString(),
  };

  catalogo.push(juego);

  guardarCatalogo();

  return res.status(201).json(juego);
});

/* =====================================================
   EDITAR JUEGO
   Solo editores y administradores
===================================================== */

app.put('/catalogo/:juegoId', (req, res) => {
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

  const juego = catalogo.find(
    (j) => j.id === req.params.juegoId,
  );

  if (!juego) {
    return res.status(404).json({
      error: 'juego no existe',
    });
  }

  if (juego.activo === false) {
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

  if (titulo !== undefined) {
    const tituloLimpio =
      String(titulo).trim();

    if (!tituloLimpio) {
      return res.status(400).json({
        error:
          'el título no puede estar vacío',
      });
    }

    juego.titulo = tituloLimpio;
  }

  if (precio !== undefined) {
    const precioNumero = Number(precio);

    if (
      !Number.isFinite(precioNumero) ||
      precioNumero < 0
    ) {
      return res.status(400).json({
        error:
          'el precio debe ser un número válido',
      });
    }

    juego.precio = precioNumero;
  }

  if (genero !== undefined) {
    juego.genero =
      String(genero).trim() ||
      'Sin categoría';
  }

  if (portada !== undefined) {
    juego.portada =
      String(portada).trim();
  }

  if (descripcion !== undefined) {
    juego.descripcion =
      String(descripcion).trim();
  }

  juego.editadoPor = req.claims.sub;
  juego.editadoEn =
    new Date().toISOString();

  guardarCatalogo();

  return res.json(juego);
});

/* =====================================================
   ELIMINAR JUEGO
   Eliminación lógica.
   Solo administradores
===================================================== */

app.delete('/catalogo/:juegoId', (req, res) => {
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

  const juego = catalogo.find(
    (j) => j.id === req.params.juegoId,
  );

  if (!juego) {
    return res.status(404).json({
      error: 'juego no existe',
    });
  }

  if (juego.activo === false) {
    return res.status(409).json({
      error:
        'el juego ya fue eliminado del catálogo',
    });
  }

  juego.activo = false;
  juego.eliminadoPor = req.claims.sub;
  juego.eliminadoEn =
    new Date().toISOString();

  guardarCatalogo();

  return res.json({
    mensaje:
      'juego eliminado del catálogo',
    juego,
  });
});

/* =====================================================
   COMPRAS
===================================================== */

app.post('/compras', (req, res) => {
  const {
    juegoId,
    usuarioSub,
  } = req.body ?? {};

  const juego = catalogo.find(
    (j) =>
      j.id === juegoId &&
      j.activo !== false,
  );

  if (!juego) {
    return res.status(404).json({
      error: 'el juego no existe',
    });
  }

  const yaLoTiene = licencias.some(
    (l) =>
      l.juegoId === juegoId &&
      l.usuarioSub === usuarioSub &&
      !l.revocada,
  );

  if (yaLoTiene) {
    return res.status(409).json({
      error:
        'ya tienes una licencia activa de este juego',
    });
  }

  const licencia = crearLicencia(
    juegoId,
    usuarioSub,
  );

  return res.status(201).json({
    licencia,
    juego,
  });
});

/* =====================================================
   BIBLIOTECA
===================================================== */

app.get(
  '/biblioteca/:usuarioSub',
  (req, res) => {
    const mias = licencias
      .filter(
        (l) =>
          l.usuarioSub ===
            req.params.usuarioSub &&
          !l.revocada,
      )
      .map((l) => ({
        ...l,
        juego: catalogo.find(
          (j) => j.id === l.juegoId,
        ),
      }));

    return res.json(mias);
  },
);

/* =====================================================
   LICENCIAS
   Solo administradores
===================================================== */

app.get('/licencias', (req, res) => {
  if (
    !estaEnGrupo(
      req.claims,
      'administradores',
    )
  ) {
    return res.status(403).json({
      error: 'solo administradores',
    });
  }

  const todas = licencias.map(
    (l) => ({
      ...l,
      juego: catalogo.find(
        (j) => j.id === l.juegoId,
      ),
    }),
  );

  return res.json(todas);
});

/* =====================================================
   REVOCAR LICENCIA
   Solo administradores
===================================================== */

app.delete(
  '/licencias/:licenciaId',
  (req, res) => {
    if (
      !estaEnGrupo(
        req.claims,
        'administradores',
      )
    ) {
      return res.status(403).json({
        error: 'solo administradores',
      });
    }

    const { revocadoPor } =
      req.body ?? {};

    const licencia = revocarLicencia(
      req.params.licenciaId,
      revocadoPor ?? req.claims.sub,
    );

    if (!licencia) {
      return res.status(404).json({
        error: 'licencia no existe',
      });
    }

    return res.json(licencia);
  },
);

/* =====================================================
   AUDITORÍA
   Solo administradores
===================================================== */

app.get('/auditoria', (req, res) => {
  if (
    !estaEnGrupo(
      req.claims,
      'administradores',
    )
  ) {
    return res.status(403).json({
      error: 'solo administradores',
    });
  }

  return res.json(auditoria);
});

/* =====================================================
   SERVIDOR
===================================================== */

const port = Number(
  process.env.PORT ?? 3001,
);

app.listen(port, () => {
  console.log(
    `microservicio de VidalStore escuchando en http://localhost:${port}`,
  );
});