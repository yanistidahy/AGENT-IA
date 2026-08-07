#!/bin/sh
# Démarrage du service CRM en production (Railway).
set -u

# --- Bannière d'identification ----------------------------------------------
# Les Deploy Logs sont le seul endroit où l'on peut constater QUEL code démarre.
# Si ces lignes n'apparaissent pas, ce n'est pas ce service qui tourne — voir
# le § « Journal des incidents » de CLAUDE.md.
echo "=============================================="
echo " AuraFLOW CRM — Next.js standalone"
echo " commit  : ${RAILWAY_GIT_COMMIT_SHA:-inconnu}"
echo " branche : ${RAILWAY_GIT_BRANCH:-inconnue}"
echo " service : ${RAILWAY_SERVICE_NAME:-inconnu}"
echo " dossier : $(pwd)"
echo "=============================================="

# --- Interface d'écoute -----------------------------------------------------
# Le serveur standalone de Next fait `const hostname = process.env.HOSTNAME || '0.0.0.0'`.
# Or tout runtime de conteneur définit HOSTNAME à l'identifiant du conteneur.
# Sans la ligne ci-dessous, Next se lie donc à cet hôte-là et non à toutes les
# interfaces : le port est ouvert, mais le proxy de Railway ne l'atteint pas et
# le healthcheck échoue en « service unavailable » jusqu'à expiration.
export HOSTNAME=0.0.0.0

# --- Migrations -------------------------------------------------------------
# Volontairement non bloquant. Si la migration échoue et que l'on arrête ici,
# le conteneur meurt sans rien servir et le seul signal disponible est
# « service unavailable » — c'est-à-dire aucun diagnostic. En démarrant quand
# même, la page « / » affiche la cause exacte (base injoignable, schéma absent).
echo "→ Application des migrations Prisma"
if ./node_modules/.bin/prisma migrate deploy; then
  echo "✓ Migrations à jour"
else
  echo "✗ Migrations en échec — le serveur démarre quand même, voir le diagnostic sur /"
fi

# --- Serveur ----------------------------------------------------------------
# `exec` remplace le shell par le process Node : les signaux d'arrêt de Railway
# (SIGTERM) parviennent directement au serveur, qui peut fermer proprement.
echo "→ Démarrage du serveur sur ${HOSTNAME}:${PORT:-3000}"
exec node .next/standalone/server.js
