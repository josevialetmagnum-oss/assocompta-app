// Appliqué par le script "vercel-build" (package.json) : sur un déploiement de
// PRODUCTION uniquement, applique les migrations Prisma en attente AVANT la
// construction de l'application. Si la migration échoue, le build échoue et
// Vercel garde en ligne la version précédente — le code n'est donc jamais mis
// en production sans la base qu'il attend.
//
// Ignoré sur les déploiements de prévisualisation : ils partagent la même base
// que la production, ils ne doivent pas la modifier. Ignoré aussi en local
// (VERCEL_ENV absent).
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`[migrations] ignorées (VERCEL_ENV=${process.env.VERCEL_ENV ?? "absent"}).`);
  process.exit(0);
}

// Les migrations exigent une connexion directe (les verrous consultatifs de
// Prisma ne fonctionnent pas à travers un pooler type PgBouncer/Neon).
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("[migrations] ni DATABASE_URL_UNPOOLED ni DATABASE_URL n'est définie.");
  process.exit(1);
}

console.log("[migrations] application des migrations en attente sur la base de production...");
const r = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(r.status ?? 1);
