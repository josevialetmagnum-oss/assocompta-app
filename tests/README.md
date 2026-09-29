# Tests automatisés

```
npm test            # toute la suite
npm run test:watch  # relance à chaque modification
```

## Deux familles

| Dossier | Contenu | Base de données |
|---------|---------|-----------------|
| `tests/unit` | fonctions pures : navigation/menu par rôle, `exigerEcriture`/`exigerSuperviseur` | aucune |
| `tests/integration` | logique qui lit la base : calculs de trésorerie, actions des mouvements, cloisonnement entre associations | PostgreSQL **locale**, base `assocompta_test` |

## Base de test

`tests/support/global-setup.ts` crée la base `assocompta_test` à côté de la base de développement
(même serveur PostgreSQL local, déduit de `DATABASE_URL`), y applique les migrations, puis redirige
`DATABASE_URL` vers elle. **Les tests vident leurs tables** : le garde-fou refuse tout serveur qui
n'est pas local (jamais une base de production).

## Ce que les tests protègent

- Soldes des comptes en temps réel : recette/dépense/virement interne, toutes exercices confondus.
- Résultat analytique et situation de trésorerie : agrégés par exercice, jamais mélangés entre eux.
- Ventilation d'un mouvement : montant total = somme des lignes, sous-catégorie du bon type et de
  la bonne association.
- Exercice clôturé : plus aucune saisie ni suppression possible.
- Lecture seule : `exigerEcriture()` bloque toute saisie/modification pour ce rôle — jamais la
  consultation, ni le superviseur/administration.
- Cloisonnement : une association ne voit ni ne modifie les données d'une autre (journal, exercice,
  sous-catégorie, soldes).

## Ajouter un test d'intégration

1. Déclarer l'association courante simulée en tête du fichier :
   `vi.mock("@/lib/association", async () => (await import("../support/contexte")).moduleAssociationDeTest());`
2. `verifierBaseDeTest()` puis `viderBase()` dans `beforeEach`.
3. Construire les données avec `tests/support/jeu-de-donnees.ts` (`creerJeuComplet()` : une
   association paramétrée avec un journal, une catégorie de chaque type et un exercice ouvert).

Chaque règle ci-dessus a été vérifiée par « mutation » : casser volontairement la règle dans le
code fait bien échouer au moins un test.
