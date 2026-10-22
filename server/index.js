import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Prototipo: el frontend es la fuente de verdad (src/data/*).
// Este servidor expone el mismo contrato para migrar a Postgres sin cambiar el motor.
app.get('/api/health', (_req, res) => res.json({ ok: true, dataset: 'dataset-ejemplo-local v0.1 (NO oficial)' }));
app.get('/api/brawlers', (_req, res) => res.json({ info: 'Usa src/data/brawlers.ts como fuente en el MVP. Ver README para migrar a Prisma/Postgres.' }));
app.get('/api/maps', (_req, res) => res.json({ info: 'Usa src/data/maps.ts como fuente en el MVP.' }));
app.get('/api/matchups', (_req, res) => res.json({ info: 'Usa src/data/meta.ts MATCHUPS como fuente en el MVP.' }));
app.post('/api/recommend', (req, res) => res.json({ info: 'Motor completo en src/engine/scoring.ts scoreAll(). Conecta Prisma aquí sin cambiar su firma.', echo: req.body ?? {} }));

const PORT = 3001;
app.listen(PORT, () => console.log(`[api] Brawl Draft Pro en http://localhost:${PORT} (datos de ejemplo)`));
