CREATE SCHEMA IF NOT EXISTS licencias;

CREATE TABLE IF NOT EXISTS licencias.licencias (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- juego_id NO es clave foránea: el catálogo lo sirve otro módulo.
  juego_id     text        NOT NULL,
  usuario_sub  text        NOT NULL,
  estado       text        NOT NULL DEFAULT 'activa',
  adquirida_en timestamptz NOT NULL DEFAULT now(),
  revocada_en  timestamptz,
  revocada_por text,
  CONSTRAINT licencias_estado_chk CHECK (estado IN ('activa', 'revocada'))
);

-- Un jugador no puede tener dos licencias vigentes del mismo juego,
-- pero sí volver a comprarlo después de una revocación.
CREATE UNIQUE INDEX IF NOT EXISTS licencias_activa_unica
  ON licencias.licencias (usuario_sub, juego_id)
  WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS licencias_usuario_sub_idx
  ON licencias.licencias (usuario_sub);