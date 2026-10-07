#!/bin/bash
# Publie la version COMMITÉE du dépôt courant sur le VPS LBSOFT.
#
#   ./deploiement/publier.sh <viti|assocompta|assomembres> [hôte-ssh]
#
# Envoie une archive du dernier commit (jamais les fichiers non commités, ni node_modules, ni .env) puis
# lance lbsoft-deployer sur le serveur : dépendances, sauvegarde de la base, migrations, construction,
# bascule et contrôle de santé (retour automatique à la version précédente en cas d'échec).
set -euo pipefail

APP="${1:-}"
HOTE="${2:-lbsoft-claude}"
case "$APP" in viti|assocompta|assomembres) ;; *) echo "usage : $0 <viti|assocompta|assomembres> [hôte-ssh]" >&2; exit 2 ;; esac

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo "Des modifications ne sont pas commitées : elles ne seraient pas publiées. Commitez d'abord." >&2
  exit 1
fi

COMMIT="$(git rev-parse --short HEAD)"
ETIQUETTE="$(date +%Y%m%d-%H%M%S)-$COMMIT"
ARCHIVE="$(mktemp -u "${TMPDIR:-/tmp}/lbsoft-$APP-XXXXXX").tar.gz"
DISTANT="/tmp/lbsoft-$ETIQUETTE.tar.gz"
trap 'rm -f "$ARCHIVE"' EXIT

echo "Publication de $APP — commit $COMMIT ($(git log -1 --format=%s))"
git archive --format=tar.gz -o "$ARCHIVE" HEAD
scp -q "$ARCHIVE" "$HOTE:$DISTANT"
ssh -o BatchMode=yes "$HOTE" "sudo /usr/local/bin/lbsoft-deployer '$APP' '$DISTANT' '$ETIQUETTE'; code=\$?; rm -f '$DISTANT'; exit \$code"
