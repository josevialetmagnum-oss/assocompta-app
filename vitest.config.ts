import { defineConfig } from "vitest/config";
import path from "node:path";

// Deux familles de tests :
//  - tests/unit : fonctions pures (navigation, calculs), sans base de données ;
//  - tests/integration : logique qui lit/écrit la base, sur une base PostgreSQL DÉDIÉE aux tests
//    (jamais celle de développement) — voir tests/support/base-test.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/support/server-only-stub.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
