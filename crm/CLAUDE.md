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

PostgreSQL en production (Railway), SQLite possible en local. Le schéma est écrit
pour que la bascule ne demande que deux changements : `provider` dans
`datasource db`, et `DATABASE_URL`.

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

---

## État d'avancement

| Phase | Contenu | État |
|---|---|---|
| 1 | Fondations — Next 15, Tailwind, Prisma, seed, `lib/domain/` + tests, page de santé | **terminée, déploiement à valider** |
| 2 | CRM — 8 vues, Le Flux, Kanban, drawers, palette Ctrl+K, CSV | à faire |
| 3 | Socle agents — client Anthropic, registre d'outils, boucle, streaming | à faire |
| 4 | Les 8 personnalités — prompts, attribution des outils, verrou Étienne | à faire |
| 5 | Interface de conversation — panneau sombre, mode approfondi, confirmations | à faire |
| 6 | Jonction CRM ↔ agents — 4 points de contact | à faire |
| 7 | Finitions — responsive, focus, reduced-motion, états vides, erreurs API | à faire |

### Phase 1 — ce qui est vérifié

- `npm run build` : succès, `/` en rendu dynamique (`ƒ`)
- `npx tsc --noEmit` : aucune erreur
- `npx vitest run` : 62 tests, 4 fichiers
- serveur standalone démarré sur un `PORT` injecté, écoute `0.0.0.0`, répond 200
- page dégradée sans base : affiche l'état d'erreur sans fuiter la chaîne de connexion
- seed validé contre une base réelle (SQLite jetable) : 6 étapes, 12 sociétés,
  18 contacts, 24 affaires, 32 interactions, 16 tâches, 3 séquences, 0 orpheline,
  174 jours d'historique

### Phase 1 — ce qui ne l'est pas

Le chemin Prisma → PostgreSQL n'a pas pu être exercé ici : aucun serveur
PostgreSQL n'est disponible dans l'environnement de développement. La validation
du seed a été faite sur SQLite avec le même schéma. La preuve définitive est la
page d'accueil du service Railway affichant les compteurs.
