// Prépare la base de TEST avant toute exécution : crée (si besoin) une base PostgreSQL dédiée à
// côté de celle de développement, y applique les migrations, et redirige DATABASE_URL vers elle.
// Garde-fou : refuse tout hôte autre que la machine locale — les tests vident leurs tables, ils ne
// doivent jamais pouvoir atteindre une base de production.

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

export const NOM_BASE_TEST = "assocompta_test";

export function urlBaseTest(): string {
  const source = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!source) throw new Error("Tests : DATABASE_URL (PostgreSQL local) n'est pas définie.");
  const url = new URL(source);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error(
      `Tests : la base ciblée (${url.hostname}) n'est pas locale. Les tests vident leurs tables : refus de continuer.`,
    );
  }
  url.pathname = `/${NOM_BASE_TEST}`;
  return url.toString();
}

export default async function setup() {
  const urlTest = urlBaseTest();

  const admin = new URL(urlTest);
  admin.pathname = "/postgres";
  admin.searchParams.delete("schema");
  const client = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  try {
    const existe = await client.$queryRawUnsafe<{ datname: string }[]>(
      `SELECT datname FROM pg_database WHERE datname = '${NOM_BASE_TEST}'`,
    );
    if (existe.length === 0) await client.$executeRawUnsafe(`CREATE DATABASE ${NOM_BASE_TEST}`);
  } finally {
    await client.$disconnect();
  }

  const r = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: urlTest },
  });
  if (r.status !== 0) {
    throw new Error(`Tests : migrations impossibles sur ${NOM_BASE_TEST}\n${r.stdout}\n${r.stderr}`);
  }

  process.env.DATABASE_URL = urlTest;
}
