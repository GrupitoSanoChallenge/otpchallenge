# La Grieta — Tracker de SoloQ

Tracker estático de rango, victorias y derrotas para un grupo de amigos en League of Legends. Los datos se obtienen automáticamente desde la API oficial de Riot Games.

## Cómo funciona

1. `accounts.config.json` define las cuentas a trackear (Riot ID de cada jugador).
2. `scripts/fetch-data.js` consulta la API de Riot para cada cuenta y genera `data/data.json`.
3. `.github/workflows/update-data.yml` corre ese script automáticamente cada 30 minutos vía GitHub Actions y commitea el `data.json` actualizado.
4. `public/index.html` es el sitio: lee `data.json` y muestra el rango, PL, victorias/derrotas y winrate de cada jugador.
5. Al conectar el repo a Netlify, cada nuevo commit del Action dispara un redeploy automático.

## 1. Configurar las cuentas

Edita `accounts.config.json` con el Riot ID real de cada jugador (nombre y tag, sin el `#`):

```json
[
  { "alias": "Facu", "gameName": "Facundo", "tagLine": "LAS1" }
]
```

`alias` es el nombre que se muestra en el sitio (puede ser distinto al Riot ID).

## 2. Conseguir tu API Key de Riot

1. Entra a https://developer.riotgames.com/ e inicia sesión con tu cuenta de League.
2. Genera una **Development API Key** (dura 24 horas, sirve para probar).
3. Cuando quieras algo permanente para la automatización, solicita una **Personal API Key** desde el mismo portal (no expira).

## 3. Probarlo en tu computador

```bash
export RIOT_API_KEY="RGAPI-tu-key-aqui"
npm run fetch
```

Esto genera/actualiza `data/data.json`. Luego abre `public/index.html` en el navegador (o sirve la carpeta `public` con cualquier servidor estático) para ver el sitio con los datos reales.

## 4. Automatizar con GitHub Actions

1. Sube este proyecto a un repositorio de GitHub.
2. Ve a **Settings → Secrets and variables → Actions** y crea un secret llamado `RIOT_API_KEY` con tu key.
3. El workflow ya está configurado (`.github/workflows/update-data.yml`) y correrá cada 30 minutos, o puedes lanzarlo manualmente desde la pestaña **Actions → Actualizar datos de SoloQ → Run workflow**.

> Nota: si usas una Development API Key (24h), el workflow empezará a fallar cuando expire hasta que actualices el secret. Para no tener que hacerlo a diario, pide la Personal API Key permanente.

## 5. Publicar en Netlify

1. Conecta el repositorio de GitHub en Netlify.
2. Directorio de publicación: `public`.
3. No necesita build command (es un sitio estático).
4. Agrega tu dominio propio desde **Domain settings**.

Cada vez que el Action actualice `data/data.json`, Netlify va a redesplegar el sitio solo.

## Cambiar la región

Si no juegan en LAS, edita en `scripts/fetch-data.js`:
- `REGIONAL_ROUTE`: `americas` | `asia` | `europe`
- `PLATFORM_ROUTE`: plataforma según servidor (`la1` LAN, `na1` NA, `euw1` EUW, `kr` Corea, etc.)
