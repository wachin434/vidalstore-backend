import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { middlewareAuth, estaEnGrupo } from './auth.mjs';
import { catalogo, licencias, auditoria, crearLicencia, revocarLicencia } from './datos.mjs';

const app = express();
app.use(cors());
app.use(express.json());
app.use(middlewareAuth);

app.get('/catalogo', (_req, res) => {
  res.json(catalogo);
});

app.post('/catalogo', (req, res) => {
  const { titulo, precio, genero, portada, descripcion } = req.body ?? {};
  if (!titulo || !precio) {
    return res.status(400).json({ error: 'faltan titulo o precio' });
  }
  const juego = {
    id: titulo.toLowerCase().replace(/\s+/g, '-'),
    titulo,
    precio,
    genero: genero ?? 'Sin categoría',
    portada: portada ?? 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600',
    descripcion: descripcion ?? '',
  };
  catalogo.push(juego);
  res.status(201).json(juego);
});

app.put('/catalogo/:juegoId', (req, res) => {
  const juego = catalogo.find((j) => j.id === req.params.juegoId);
  if (!juego) return res.status(404).json({ error: 'juego no existe' });
  Object.assign(juego, req.body ?? {});
  res.json(juego);
});

app.post('/compras', (req, res) => {
  const { juegoId, usuarioSub } = req.body ?? {};
  const juego = catalogo.find((j) => j.id === juegoId);
  if (!juego) return res.status(404).json({ error: 'el juego no existe' });

  const yaLoTiene = licencias.some(
    (l) => l.juegoId === juegoId && l.usuarioSub === usuarioSub && !l.revocada,
  );
  if (yaLoTiene) {
    return res.status(409).json({ error: 'ya tienes una licencia activa de este juego' });
  }

  const licencia = crearLicencia(juegoId, usuarioSub);
  res.status(201).json({ licencia, juego });
});

app.get('/biblioteca/:usuarioSub', (req, res) => {
  const mias = licencias
    .filter((l) => l.usuarioSub === req.params.usuarioSub && !l.revocada)
    .map((l) => ({ ...l, juego: catalogo.find((j) => j.id === l.juegoId) }));
  res.json(mias);
});

app.get('/licencias', (req, res) => {
  if (!estaEnGrupo(req.claims, 'administradores')) {
    return res.status(403).json({ error: 'solo administradores' });
  }
  const todas = licencias.map((l) => ({ ...l, juego: catalogo.find((j) => j.id === l.juegoId) }));
  res.json(todas);
});

app.delete('/licencias/:licenciaId', (req, res) => {
  if (!estaEnGrupo(req.claims, 'administradores')) {
    return res.status(403).json({ error: 'solo administradores' });
  }
  const { revocadoPor } = req.body ?? {};
  const licencia = revocarLicencia(req.params.licenciaId, revocadoPor ?? req.claims.sub);
  if (!licencia) return res.status(404).json({ error: 'licencia no existe' });
  res.json(licencia);
});

app.get('/auditoria', (req, res) => {
  if (!estaEnGrupo(req.claims, 'administradores')) {
    return res.status(403).json({ error: 'solo administradores' });
  }
  res.json(auditoria);
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`microservicio de VidalStore escuchando en http://localhost:${port}`);
});