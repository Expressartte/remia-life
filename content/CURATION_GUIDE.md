# Guía de curación de meditaciones (YouTube en español)

Esta guía es para curar manualmente el catálogo de meditaciones que aparece en
Remia. El objetivo: 30-40 videos de YouTube en español, de calidad, sin ads
molestos, distribuidos en 6 categorías.

## Criterios de selección (todos obligatorios)

1. **Español nativo.** Voz humana hablando español, no doblaje automático ni
   subtítulos auto-traducidos. La voz importa para una meditación.
2. **Sin ads pre-roll.** Míralo logueado en YouTube **sin Premium**. Si aparece
   un anuncio antes de empezar, descártalo — un ad justo antes de dormir mata el
   ritual. (Los ads a mitad de video también descalifican).
3. **Duración apropiada por categoría:**
   - `sleep`: 10-30 min (largo está bien, ayuda a dormirse)
   - `recall`, `lucid`: 5-12 min (corto, es pre-sueño activo)
   - `anxiety`: 4-10 min
   - `gratitude`: 3-8 min
   - `focus`: 5-15 min
4. **Voz humana profesional.** No TTS, no robótica. Buena calidad de audio.
5. **Embeddable.** Prueba abriendo `https://www.youtube.com/embed/{youtube_id}`
   en el navegador. Si carga y reproduce → OK. Si dice "Video no disponible" o
   "El propietario no permite reproducirlo en otros sitios" → descártalo.
6. **Canal con trayectoria.** Creador con más de 1 año de actividad y idealmente
   +100 suscriptores (señal de que el contenido perdura, no desaparecerá pronto).

## Las 6 categorías (mínimo 5 videos cada una)

| Categoría | Para qué | Buscar en YouTube |
|---|---|---|
| `sleep` | Dormirse | "meditación para dormir", "body scan dormir", "relajación profunda noche" |
| `recall` | Recordar sueños | "meditación recordar sueños", "intención antes de dormir MILD" |
| `lucid` | Sueño lúcido | "meditación sueño lúcido", "inducir sueño lúcido", "WILD MILD español" |
| `anxiety` | Calmar ansiedad | "respiración 4-7-8", "meditación ansiedad", "calmar mente acelerada" |
| `gratitude` | Cierre del día | "meditación gratitud", "gratitud antes de dormir" |
| `focus` | Reconexión / presencia | "meditación atención plena", "reconexión cuerpo", "presencia 5 minutos" |

## Cómo extraer el `youtube_id`

El ID son los 11 caracteres después de `v=` o tras `youtu.be/`:

- `https://www.youtube.com/watch?v=`**`dQw4w9WgXcQ`** → `dQw4w9WgXcQ`
- `https://youtu.be/`**`dQw4w9WgXcQ`** → `dQw4w9WgXcQ`
- `https://www.youtube.com/embed/`**`dQw4w9WgXcQ`** → `dQw4w9WgXcQ`

Debe matchear `^[A-Za-z0-9_-]{11}$` (el seed script lo valida).

## Canales de meditación en español como punto de partida

Estos son canales conocidos de meditación guiada en español. **Verifica cada
video individualmente** contra los criterios de arriba (no todos sus videos
cumplen, especialmente lo de ads):

- EOC Institute (versiones en español)
- Cristina Codina (meditación y mindfulness)
- Hermandad Blanca / canales de relajación
- Meditación Mindfulness en Español
- Easy Zen / Relajación guiada

> No copies URLs a ciegas: ábrelos, verifica español + sin ads + embeddable.

## Flujo de trabajo

1. Copia `content/meditations-catalog.template.json` → `content/meditations-catalog.json`.
2. Para cada video curado, llena un objeto con todos los campos.
   - `id`: slug único en kebab-case, ej. `sleep-bodyscan-ana-15`.
   - `verified_no_ads`: marca `true` SOLO si confirmaste que no hay ads.
   - `embed_allowed`: marca `true` solo si pasó el test de `/embed/`.
3. Valida sin escribir: `node scripts/seedMeditationsCatalog.js --dry-run`.
4. Si todo OK: `node scripts/seedMeditationsCatalog.js --project remia`.

Ver `content/README.md` para el detalle del flujo de seed.
