# content/ — Catálogo de meditaciones

Esta carpeta contiene la infraestructura para curar y sembrar el catálogo de
meditaciones de YouTube que consume Remia (colección Firestore `/meditations`).

## Archivos

| Archivo | Va a git | Qué es |
|---|---|---|
| `meditations-catalog.template.json` | ✅ Sí | Plantilla con ejemplos. **No la edites**, cópiala. |
| `CURATION_GUIDE.md` | ✅ Sí | Criterios y proceso de curación. |
| `README.md` | ✅ Sí | Este archivo. |
| `meditations-catalog.json` | ❌ No (gitignored) | Tu versión llena con videos reales. |
| `meditations-from-legacy.json` | ❌ No (gitignored) | Output del migrate script (placeholders legacy). |

> Los JSON llenos NO van a git: evolucionan constantemente y el seed script es
> la fuente de verdad hacia Firestore, no el repo.

## Flujo de seed (primera vez)

1. **Curar** (ver `CURATION_GUIDE.md`): copiar la plantilla y llenarla.
   ```
   cp content/meditations-catalog.template.json content/meditations-catalog.json
   # editar meditations-catalog.json con tus videos curados
   ```

2. **Validar sin escribir** (atrapa IDs mal formados, categorías inválidas,
   placeholders olvidados):
   ```
   node scripts/seedMeditationsCatalog.js --dry-run
   ```

3. **Sembrar a Firestore** (con el service account como credencial):
   ```
   # PowerShell:
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:/secrets/Remia/<service-account>.json"
   node scripts/seedMeditationsCatalog.js --project banded-torus-434917-c1
   ```
   IMPORTANTE: usá el project ID REAL `banded-torus-434917-c1`, NO el alias
   `remia`. El alias solo lo entiende el firebase CLI; el Admin SDK necesita el
   ID real. (Si omitís `--project`, el script toma el project del service
   account, que también funciona.)

## Agregar / quitar videos después

- **Agregar**: añade objetos a `meditations-catalog.json` y vuelve a correr el
  seed (es idempotente: actualiza existentes por `id`, crea nuevos).
- **Quitar de la app sin borrar**: en Firebase Console marca `unavailable: true`
  en el doc — el picker lo filtra. El job semanal `validateMeditationsCatalog`
  también lo marca automáticamente si el video de YouTube desaparece.
- **Borrar definitivamente**: elimina el doc en Firebase Console.

## Ver la colección

Firebase Console → Firestore:
https://console.firebase.google.com/project/banded-torus-434917-c1/firestore/data/~2Fmeditations

## Requisitos

- `firebase-admin` (ya es dependencia del proyecto).
- Credenciales: un service account JSON (Firebase Console → Configuración →
  Cuentas de servicio → Generar nueva clave privada), guardado FUERA del repo,
  apuntado con la env var `GOOGLE_APPLICATION_CREDENTIALS`. La auth del firebase
  CLI (la de los `firebase deploy`) NO sirve para el Admin SDK.
- Project ID real: `banded-torus-434917-c1` (el alias `remia` es solo del CLI).
