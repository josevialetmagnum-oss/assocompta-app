# AssoCompta

Comptabilité de trésorerie pour associations (pas de comptabilité d'engagement) : mouvements
(recettes, dépenses, virements entre comptes), catégories/sous-catégories paramétrables, rapprochement
bancaire manuel, soldes en temps réel, résultat analytique par exercice. Développé par LBSOFT.

SaaS multi-associations : chaque association est indépendante (pas de structure "cabinet" qui en
gère plusieurs). Deux niveaux de compte :
- **Superviseur** (LBSOFT) : crée les comptes association depuis `/administration`, aucun accès aux
  données d'une association.
- **Trésorier** / **Lecture seule** : rattachés à une association, gèrent leur paramétrage
  (journaux, catégories, exercices) et leur trésorerie.

## Stack

- Next.js (TypeScript, App Router) + Tailwind CSS
- PostgreSQL + Prisma ORM
- Hébergement : Vercel (déploiement automatique depuis `master`) + PostgreSQL managé Neon

## Démarrage local

1. Base de données : PostgreSQL doit tourner sur `localhost:5432` avec les identifiants décrits dans
   `.env.example`. Deux options :
   - PostgreSQL installé nativement sur la machine
   - `docker compose up -d` si Docker est disponible (voir `docker-compose.yml`)
2. Copier `.env.example` en `.env` et ajuster si besoin.
3. Installer les dépendances : `npm install`
4. Appliquer le schéma : `npx prisma migrate dev`
5. Lancer le serveur de dev : `npm run dev`, puis ouvrir http://localhost:3010
6. Créer le tout premier compte (superviseur) sur `/connexion/premier-compte` avec
   `BOOTSTRAP_ADMIN_PASSWORD`, puis créer une association depuis `/administration`.

## Tests

`npm test` (Vitest) : tests unitaires (navigation, contrôle d'accès) et tests d'intégration (contre
une base `assocompta_test` locale dédiée, créée automatiquement). Voir `tests/README.md`.

## Déploiement

Le build de production sur Vercel (`vercel-build`) applique d'abord les migrations Prisma en attente
(`scripts/migrer-en-production.mjs`) avant `next build` ; un échec de migration bloque le déploiement,
la version précédente reste en ligne. Les previews ne rejouent pas les migrations (elles partagent la
base de production).
