# Contenu embarqué

`manuel.json` est le manuel d'utilisation affiché sur la page `/manuel`. Il est **généré** à partir du manuel rédigé dans
le document de référence (lecture complète du nœud, au format XML) par `scripts/convertir-manuel.cjs` :

    node scripts/convertir-manuel.cjs <lecture-du-manuel.json> src/content/manuel.json

Ne pas le modifier à la main : mettre à jour le manuel de référence, puis régénérer. Le test `tests/unit/manuel.test.ts`
vérifie la structure et que chaque entrée du menu y est mentionnée.
