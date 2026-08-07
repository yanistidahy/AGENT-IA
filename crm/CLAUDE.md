# AuraFLOW CRM

CRM interne d'AuraFLOW AI, doublé d'un conseil de huit agents IA qui lisent et
agissent sur les données du CRM.

Ce fichier est la mémoire du projet : architecture, conventions, commandes et
état d'avancement. Il est mis à jour à la fin de chaque phase.

---

## Périmètre et garde-fous

Ce projet vit dans `crm/`. Il ne partage rien avec le reste du dépôt :

| Chemin | Contenu | Service Railway |
|---|---|---|
| `/` (racine) | App Vite « Aura Flow AI » | `AGENT-IA`, Root Directory vide |
| `/backend` | API Python FastAPI | service dédié, Root Directory `backend` |
| `/crm` | **ce projet** | service dédié, Root Directory `crm` |

Aucun fichier hors de `crm/` ne doit être modifié. Les `nixpacks.toml`,
`railway.json` et `package.json` de la racine appartiennent à un service en
production et n'ont pas à bouger.

---

## Le prototype fait foi

`auraflow-crm.html` (fourni hors dépôt) est la référence pour le modèle de
données, les règles métier et l'identité visuelle. Là où le brief initial et le
prototype divergeaient, le prototype a tranché :

| | Brief initial | Retenu (prototype) |
|---|---|---|
| Menthe | `#12B79C` | `#0FA88F` |
| Violet | `#6C4DF6` | `#6D5AE6` |
| Ambre | `#F2802B` | `#D99323` |
| Encre | `#16142B` | `#0C1614` — vert-noir, pas bleu-noir |
| Titres | Bricolage Grotesque | **Space Grotesk** |

Deux conséquences qui ne sont pas que des valeurs : la couleur d'action primaire
est la **menthe**, pas le violet — le violet n'est qu'une étape de pipeline et une
couleur d'avatar ; et l'encre vert-noir porte tout le contraste du rail de
navigation et de la fluxbar.

Le seed est en revanche étendu aux volumes du brief (12 sociétés, 18 contacts,
24 affaires), en conservant les 8 sociétés du prototype comme noyau.

---

## Architecture

```
crm/
├── app/                      App Router
│   ├── layout.tsx            polices next/font, variables CSS
│   ├── globals.css           jetons Tailwind v4 (@theme)
│   └── page.tsx              page de santé (phase 1)
├── lib/
│   ├── db.ts                 client Prisma unique
│   ├── format.ts             money, moneyShort, dates fr-FR
│   └── domain/               ← règles métier pures, sans Prisma ni React
│       ├── types.ts          unions + formes du domaine
│       ├── schemas.ts        z.enum() — frontière string → union
│       ├── dates.ts          daysBetween, monthKey, lastMonthKeys
│       ├── pipeline.ts       dealProb, weighted, dealHeat, stuckDeals
│       ├── alerts.ts         les 6 générateurs + tri
│       ├── kpis.ts           winRate, cycle, funnel, forecast, retention
│       ├── tasks.ts          taskTarget, taskBucket
│       ├── sequences.ts      generateSequenceTasks
│       └── __tests__/        Vitest — 62 tests
├── prisma/
│   ├── schema.prisma
│   ├── migrations/0_init/    générée hors ligne (migrate diff)
│   └── seed.ts
└── scripts/
    └── bundle-standalone.mjs post-traitement du build Next
```

### Pourquoi `lib/domain/` ne connaît pas Prisma

Les fonctions y sont pures et prennent des formes structurelles
(`DealLike`, `StageLike`…) définies dans `types.ts`. Trois bénéfices :

1. les tests tournent sans base ni `prisma generate` ;
2. l'horloge est injectée (`now: Date`), donc les tests sont déterministes ;
3. les agents IA (phase 3) réutiliseront ces mêmes fonctions, sans duplication.

---

## Conventions

**Nommage** — fichiers en `kebab-case`, composants React en `PascalCase`, le
reste en `camelCase`. Le domaine métier est nommé en français (`affaires`,
`étapes`, `tâches`) parce que c'est la langue du produit ; les identifiants
techniques restent en anglais.

**TypeScript** — `strict` plus `noUncheckedIndexedAccess`. Aucun `any`, aucun
`@ts-ignore`. Un accès indexé renvoie `T | undefined` : il se traite, il ne
s'assère pas.

**Pas d'`enum` Prisma, pas de tableau scalaire, pas de `Json`.** Ces trois
constructions ne se comportent pas de façon identique entre SQLite et
PostgreSQL. Les valeurs contraintes sont des `String` en base, converties en
unions TypeScript par les `z.enum()` de `lib/domain/schemas.ts` — le seul
endroit du code où l'on passe de `string` au type du domaine.

**Rattachement des tâches** — le couple polymorphe `relType`/`relId` du
prototype est remplacé par trois clés étrangères nullables (`contactId`,
`companyId`, `dealId`). L'intégrité est garantie par la base et les jointures
Prisma redeviennent possibles. `taskTarget()` fait la lecture ; en cas de
conflit, l'ordre affaire > contact > société tranche.

**Tailwind v4, sans `tailwind.config.ts`.** La v4 se configure en CSS via
`@theme` ; le fichier de configuration JS n'existe plus par défaut. Les jetons
sont donc dans `app/globals.css`. Le brief mentionnait `tailwind.config.ts`,
écrit avant que la v4 ne devienne la version courante.

**Composants** — 250 lignes maximum. Au-delà, découper.

**Graphiques** — SVG écrit à la main, aucune librairie. Les cinq primitives du
prototype (`fluxbar`, `bar`, `donut`, `line`, `funnel`) arrivent en phase 2.

---

## Commandes

```bash
npm run dev          # serveur de développement
npm run build        # prisma generate + next build + bundle standalone
npm start            # prisma migrate deploy + serveur standalone
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run db:migrate   # créer une migration (développement)
npm run db:deploy    # appliquer les migrations (production)
npm run db:seed      # charger le jeu de démonstration
npm run db:studio    # explorateur Prisma
```

Vérification complète avant de committer :

```bash
npm run build && npx tsc --noEmit && npx vitest run
```

---

## Base de données

PostgreSQL en production (Railway). Le **schéma** reste portable — aucun `enum`,
aucun tableau scalaire, aucun `Json` — mais **le code applicatif ne l'est plus** :
`lib/api/deals.ts` utilise `mode: "insensitive"` pour la recherche, un champ que
le type `Prisma.StringFilter` généré pour SQLite ne comporte même pas. Compiler
contre un schéma SQLite échoue donc au typecheck.

C'est assumé : la cible est PostgreSQL. SQLite reste utilisable pour une
vérification jetable, au prix de deux retouches locales (le `provider` et ce
filtre), à ne jamais committer.

La migration `0_init` a été générée hors ligne avec
`prisma migrate diff --from-empty --to-schema-datamodel`, sans base joignable.
C'est la méthode à reprendre tant qu'aucune base de développement n'est
disponible localement.

---

## Variables d'environnement

| Variable | Depuis | Rôle |
|---|---|---|
| `DATABASE_URL` | phase 1 | connexion PostgreSQL |
| `WORKSPACE_PASSWORD` | phase 2 | mot de passe unique de l'espace de travail |
| `ANTHROPIC_API_KEY` | phase 3 | conseil d'agents — **serveur uniquement** |
| `AGENT_ETIENNE_ENABLED` | phase 4 | drapeau de l'agent verrouillé |

Aucune clé n'est lue côté client. Tout appel Anthropic passe par une route
serveur. `.env` n'est jamais commité ; `.env.example` documente les valeurs.

---

## Déploiement

`output: "standalone"` dans `next.config.ts`, avec `outputFileTracingRoot`
explicitement fixé au dossier `crm/`. Sans cette ligne, Next remonte jusqu'au
`package-lock.json` de la racine du dépôt pour tracer les fichiers et produit
`.next/standalone/crm/server.js` au lieu de `.next/standalone/server.js`, ce qui
casse la commande de démarrage.

Next ne copie ni `.next/static` ni `public/` dans la sortie standalone :
`scripts/bundle-standalone.mjs` s'en charge après le build.

`prisma` et `tsx` sont en `dependencies`, pas en `devDependencies` : la commande
de démarrage exécute `prisma migrate deploy`, et un élagage des dépendances de
développement en production rendrait le binaire introuvable.

### `HOSTNAME` doit être forcé à `0.0.0.0`

Le serveur standalone contient `const hostname = process.env.HOSTNAME || '0.0.0.0'`.
Le repli n'est utilisé que si la variable est absente — or **tout runtime de
conteneur définit `HOSTNAME` à l'identifiant du conteneur**. Sans intervention,
Next se lie donc à cet hôte et non à toutes les interfaces : le proxy de Railway
n'atteint jamais le port et le healthcheck échoue en « service unavailable »
pendant toute sa fenêtre, alors que le process tourne et que les logs semblent
normaux.

`scripts/start.sh` exporte `HOSTNAME=0.0.0.0` avant de lancer le serveur. C'est
la raison d'être de ce script — ne pas le contourner en remettant la commande
directement dans `package.json`.

Piège de méthode : une vérification locale qui passe `HOSTNAME=0.0.0.0`
explicitement ne teste pas ce chemin. Pour rejouer les conditions de Railway :

```bash
env HOSTNAME="$(hostname)" PORT=3312 npm run start
curl http://0.0.0.0:3312/     # doit répondre 200, pas se connecter à vide
```

### Les migrations ne bloquent pas le démarrage

`prisma migrate deploy` s'exécute avant le serveur, mais un échec n'interrompt
pas le lancement. Un `&&` ferait mourir le conteneur sans rien servir, et le
seul signal disponible serait « service unavailable » — aucun diagnostic. En
démarrant quand même, la page `/` nomme la cause exacte (base injoignable,
authentification refusée, tables absentes) via `lib/db-diagnosis.ts`.

Ce compromis est adapté à une phase de mise en place. À revoir quand
l'application portera de vraies données : servir une application au schéma
incomplet n'est pas un comportement de production.

---

## État d'avancement

Le découpage en sept phases a laissé place à des **jalons verticaux** : chacun est
déployé, cliquable sur l'URL de production, et validé avant d'ouvrir le suivant.

| Jalon | Contenu | État |
|---|---|---|
| 0 | Fondations — Next 15, Tailwind, Prisma, seed, `lib/domain/` + tests, chaîne de déploiement | **validé en production** |
| 1 | Affaires de bout en bout — API, liste, fiche, Kanban, gain/perte | **validé en production** |
| 2 | Conseil d'agents — 8 personnalités, registre d'outils, streaming, confirmation des écritures | **livré, à valider** |
| 3 | Contacts & Sociétés — même motif, import/export CSV, « Demander à Sacha » | à faire |
| 4 | Tâches, interactions, séquences, moteur d'alertes | à faire |
| 5 | Tableau de bord & rapports — SVG écrits à la main | à faire |
| 6 | Finitions — palette Ctrl+K, réglages, `/api/health`, responsive, README | à faire |

### Jalon 1 — décisions prises

**Une seule couche de service.** `lib/api/deals.ts` est appelée par les routes
d'API *et* directement par les composants serveur. Une page ne fait pas de
requête HTTP vers sa propre API : une source de vérité, un aller-retour en moins.

**Les filtres passent par l'URL.** `/affaires?status=won&owner=Yanis` est
partageable et rechargeable, et le bouton « précédent » fonctionne.

**Kanban optimiste avec restauration.** La carte change de colonne avant la
réponse réseau ; en cas d'échec, l'état revient en arrière et le message
s'affiche. Un déplacement qui semble réussir sans être persisté serait pire que
pas de glisser-déposer.

**Rouvrir une affaire efface `closedAt`.** Écart assumé avec le prototype, qui
laissait une affaire « en cours » porter une date de clôture — incohérence qui
fausse le calcul du cycle de vente.

**Entrées de navigation à venir affichées, mais inertes.** La structure du
produit est lisible dès maintenant, sans lien mort vers une 404.

### Jalon 1 — ce qui est vérifié

Le test d'acceptation a été rejoué de bout en bout contre une base réelle
(SQLite jetable, deux retouches locales décrites plus haut) :

- création d'une affaire par l'API → 201
- deux déplacements d'étape successifs → persistés, deux notes système écrites
- modification du montant → persistée
- relecture après nouvelle requête → tout est là
- passage sur l'étape à 100 % → `status: won` + `closedAt` daté
- réouverture → `status: open`, `closedAt` effacé
- recherche `?q=` → l'affaire remonte
- `/`, `/affaires`, `/pipeline` → 200, l'affaire créée apparaît au rendu serveur
- charge invalide → 400 avec les erreurs par champ, aucune trace d'exécution

### Phase 1 — ce qui est vérifié

- `npm run build` : succès, `/` en rendu dynamique (`ƒ`)
- `npx tsc --noEmit` : aucune erreur
- `npx vitest run` : 72 tests, 5 fichiers
- serveur démarré avec `HOSTNAME` valant l'identifiant du conteneur, comme sur
  Railway : écoute bien `0.0.0.0`, joignable depuis `0.0.0.0`, répond 200
- base injoignable : la page nomme la cause et ne fuite ni mot de passe ni hôte
- seed validé contre une base réelle (SQLite jetable) : 6 étapes, 12 sociétés,
  18 contacts, 24 affaires, 32 interactions, 16 tâches, 3 séquences, 0 orpheline,
  174 jours d'historique

### Phase 1 — ce qui ne l'est pas

Le chemin Prisma → PostgreSQL n'a pas pu être exercé ici : aucun serveur
PostgreSQL n'est disponible dans l'environnement de développement. La validation
du seed a été faite sur SQLite avec le même schéma. La preuve définitive est la
page d'accueil du service Railway affichant les compteurs.

---

## Jalon 2 — le conseil d'agents

```
lib/agents/
├── registry.ts             les 8 agents, leur liste blanche d'outils, isUnlocked()
├── prompts/                une persona par fichier + shared.ts (règles communes)
├── tools/
│   ├── types.ts            defineTool() — validation Zod avant tout accès base
│   ├── reads.ts            7 outils de lecture, exécutés directement
│   ├── writes.ts           5 outils d'écriture, jamais appelés par la boucle
│   └── registry.ts         assemblage + schémas JSON pour Anthropic
├── runtime/
│   ├── client.ts           `import "server-only"` — modèle, effort, erreurs FR
│   └── loop.ts             boucle de tours, interruption sur première écriture
└── messages.ts             (dé)sérialisation des blocs Anthropic
```

**Modèle et raisonnement.** `claude-opus-5`, `thinking: {type:"adaptive"}`.
`budget_tokens` est refusé par ce modèle. « Mode approfondi » relève
`output_config.effort` (`medium` → `xhigh`) et affiche le résumé de raisonnement ;
il ne touche pas à `max_tokens`, plafonné à 4096 — le garde-fou de coût porte sur
la sortie, pas sur la réflexion.

**Aucune écriture sans clic.** La boucle exécute les lectures immédiatement. À la
première écriture proposée, elle s'arrête, émet `action_proposed` et rend la main.
`app/api/actions/confirm/route.ts` est **le seul endroit du code où un outil
d'écriture s'exécute**. Un refus écrit un `tool_result` explicite : l'agent
poursuit sa réponse au lieu de rester suspendu.

**La clé ne quitte pas le serveur.** `server-only` en tête de `runtime/client.ts`
fait échouer le build si un composant client importe cette chaîne. Le test
`lib/agents/__tests__/no-key-in-bundle.test.ts` parcourt ensuite `.next/static`
et y cherche `sk-ant-`, `ANTHROPIC_API_KEY` et la valeur réelle si elle est
définie — la vérification porte sur le résultat, pas sur l'intention.

**Base vide.** `SHARED_RULES` impose à chaque persona de dire platement qu'il n'y
a rien plutôt que d'illustrer. Les outils de lecture renvoient
`{vide: true, message}` quand la requête ne ramène rien : l'agent n'a pas à
déduire le vide d'un tableau vide.

**Une complétion à la fois par conversation.** Un `Set` au niveau du module dans
`app/api/chat/route.ts` rejette un second envoi pendant le streaming.

**Étienne est verrouillé** derrière `AGENT_ETIENNE_ENABLED`, comparé à la chaîne
`"true"` exactement. Le sélectionner ouvre une modale, pas une erreur.

### Jalon 2 — ce qui est vérifié

Rejoué contre une base réelle (SQLite jetable, mêmes deux retouches locales
non committées) :

- `POST /api/conversations` → 201, conversation lisible ensuite
- `POST` avec un agent verrouillé ou inconnu → 400, message français
- `GET /api/conversations/{id}` inexistant → 404
- `POST /api/actions/confirm` avec un `toolUseId` inconnu → 404, aucune écriture
- `POST /api/chat` sans clé → carte d'erreur SSE en français, pas de trace
  d'exécution, pas de suspension
- `POST /api/chat` message vide → 400 avec l'erreur par champ
- le message utilisateur et le titre déduit sont persistés malgré l'échec :
  l'historique survit au rechargement
- `/`, `/affaires`, `/pipeline`, `/conseil`, `/conseil?agent=etienne` → 200

### Jalon 2 — ce qui ne l'est pas

**Aucun appel Anthropic réel n'a été passé ici** : `ANTHROPIC_API_KEY` n'existe
pas dans cet environnement de développement. Le streaming, l'enchaînement des
outils et la carte de confirmation ont été vérifiés par les tests unitaires et
par la boucle exercée hors réseau, pas contre l'API. La preuve définitive est une
conversation réelle sur l'URL de production.

### Journal des incidents

**Healthcheck en échec au premier déploiement** — build vert, conteneur démarré,
`service unavailable` sur les six tentatives. Cause : `HOSTNAME` défini par le
runtime de conteneur, Next se liant à l'identifiant du conteneur au lieu de
`0.0.0.0` (voir § Déploiement). Le défaut avait échappé à la vérification locale
parce que celle-ci forçait `HOSTNAME=0.0.0.0` — elle testait le correctif avant
qu'il existe. Corrigé par `scripts/start.sh`.
