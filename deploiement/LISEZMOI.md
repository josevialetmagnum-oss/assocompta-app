# Déploiement d'AssoCompta sur le VPS LBSOFT

Après avoir commité :

```bash
bash deploiement/publier.sh assocompta
```

Le script envoie l'archive du dernier commit au VPS et lance `lbsoft-deployer` (dépendances, sauvegarde de la base,
migrations, build, bascule, contrôle de santé, retour automatique en cas d'échec).

L'installation du serveur (Caddy, services systemd, PostgreSQL, sauvegardes chiffrées, restauration, secrets à
renseigner) est documentée une seule fois, avec les scripts serveur, dans le dépôt VITI-BAIL :
`raisins-app/deploiement/LISEZMOI.md`.
