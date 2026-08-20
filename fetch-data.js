/**
 * fetch-data.js
 *
 * Consulta la API de Riot Games para cada cuenta definida en accounts.config.json
 * y escribe el resultado en data/data.json.
 *
 * Requiere Node.js 18+ (usa fetch nativo).
 * Requiere la variable de entorno RIOT_API_KEY.
 *
 * Uso local:
 *   RIOT_API_KEY=RGAPI-xxxx node scripts/fetch-data.js
 */

const fs = require("fs");
const path = require("path");

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Routing regional (para Account-V1) y de plataforma (para League-V4)
// LAS = Latinoamérica Sur
const REGIONAL_ROUTE = "americas"; // americas | asia | europe
const PLATFORM_ROUTE = "la2"; // la2 = LAS, la1 = LAN, na1 = NA, euw1, eun1, kr, etc.

const ACCOUNTS_PATH = path.join(__dirname, "..", "accounts.config.json");
const OUTPUT_PATH = path.join(__dirname, "..", "public", "data.json");

const QUEUE_TYPE = "RANKED_SOLO_5x5";

// Código de región usado por op.gg en sus URLs (distinto del platform route de la API de Riot).
const OPGG_REGION = "las";

function buildOpggUrl(gameName, tagLine) {
  return `https://www.op.gg/summoners/${OPGG_REGION}/${encodeURIComponent(`${gameName}-${tagLine}`)}`;
}

if (!RIOT_API_KEY) {
  console.error("Falta la variable de entorno RIOT_API_KEY.");
  process.exit(1);
}

function loadAccounts() {
  const raw = fs.readFileSync(ACCOUNTS_PATH, "utf-8");
  return JSON.parse(raw);
}

async function riotFetch(url) {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": RIOT_API_KEY },
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") || 1);
    console.warn(`Rate limit alcanzado, esperando ${retryAfter}s...`);
    await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
    return riotFetch(url);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Error ${res.status} en ${url}: ${body}`);
  }

  return res.json();
}

async function getPuuid(gameName, tagLine) {
  const url = `https://${REGIONAL_ROUTE}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
    gameName
  )}/${encodeURIComponent(tagLine)}`;
  const data = await riotFetch(url);
  return data.puuid;
}

async function getRankedEntries(puuid) {
  const url = `https://${PLATFORM_ROUTE}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
  return riotFetch(url);
}

function pickSoloQueueEntry(entries) {
  return entries.find((e) => e.queueType === QUEUE_TYPE) || null;
}

function buildPlayerRecord(account, puuid, entry) {
  const base = {
    alias: account.alias,
    riotId: `${account.gameName}#${account.tagLine}`,
    opggUrl: buildOpggUrl(account.gameName, account.tagLine),
    puuid,
    updatedAt: new Date().toISOString(),
  };

  if (!entry) {
    return {
      ...base,
      unranked: true,
      tier: null,
      rank: null,
      leaguePoints: 0,
      wins: 0,
      losses: 0,
      winrate: null,
    };
  }

  const wins = entry.wins;
  const losses = entry.losses;
  const totalGames = wins + losses;

  return {
    ...base,
    unranked: false,
    tier: entry.tier, // IRON, BRONZE, SILVER, GOLD, PLATINUM, EMERALD, DIAMOND, MASTER, GRANDMASTER, CHALLENGER
    rank: entry.rank, // I, II, III, IV (vacío en Master+)
    leaguePoints: entry.leaguePoints,
    wins,
    losses,
    winrate: totalGames > 0 ? Math.round((wins / totalGames) * 1000) / 10 : null,
    hotStreak: entry.hotStreak,
  };
}

async function main() {
  const accounts = loadAccounts();
  const players = [];

  for (const account of accounts) {
    try {
      console.log(`Consultando ${account.gameName}#${account.tagLine}...`);
      const puuid = await getPuuid(account.gameName, account.tagLine);
      const entries = await getRankedEntries(puuid);
      const soloEntry = pickSoloQueueEntry(entries);
      players.push(buildPlayerRecord(account, puuid, soloEntry));
    } catch (err) {
      console.error(`Fallo al procesar ${account.alias}:`, err.message);
      players.push({
        alias: account.alias,
        riotId: `${account.gameName}#${account.tagLine}`,
        opggUrl: buildOpggUrl(account.gameName, account.tagLine),
        error: err.message,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    region: PLATFORM_ROUTE,
    players,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Listo. Datos guardados en ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
