// Utilitaires des tests d'intégration : base dédiée (voir global-setup.ts).

import { prisma } from "@/lib/prisma";

export function verifierBaseDeTest() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/\/assocompta_test(\?|$)/.test(url)) throw new Error("Tests : DATABASE_URL ne cible pas la base assocompta_test.");
}

export async function viderBase() {
  verifierBaseDeTest();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const liste = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE`);
}
