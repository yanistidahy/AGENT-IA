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

**Le prototype ne fait plus foi sur la couleur** depuis le jalon 23 : la marque
l'a remplacé. Voir « Palette de marque » ci-dessous. Il reste la référence pour
le modèle de données, les règles métier et la mise en page.

---

## Palette de marque

Reprise du logo — un « A » traversé par une vague cyan → bleu → violet. Tous les
jetons vivent dans `app/globals.css` sous `@theme` ; il n'y a pas de
`tailwind.config.ts`. **On change la couleur à la source, jamais classe par
classe.**

| Rôle | Jeton | Valeur |
|---|---|---|
| Action primaire | `brand` | `#4B3FE4` |
| Survol / lien | `brand-d` | `#3A2FC7` |
| Teinte claire | `brand-l` | `#EFEDFF` |
| Marque sur fond sombre | `brand-lift` | `#A9A2F5` |
| Rail | `rail` / `rail-2` / `rail-3` | `#0B1030` / `#161C42` / `#232B5C` |
| Texte du rail | `rail-text` / `rail-dim` | `#9AA4CE` / `#828CBC` |
| Réussite | `win` / `win-d` / `win-l` | `#0FA88F` / `#0B7A68` / `#DFF3EF` |
| Encre | `ink` / `ink-2` / `ink-3` | `#0D1220` / `#161C2E` / `#232B42` |
| Neutres | `muted` / `line` / `line-2` | `#6B7192` / `#DEE0EA` / `#ECEEF4` |

**`brand` porte l'action, `win` porte la réussite, et l'un ne remplace jamais
l'autre.** Boutons, liens, entrée de navigation active, anneau de focus, états
sélectionnés, série primaire des graphiques : `brand`. Affaire gagnée, statut
sain, sauvegarde à jour, cycle `Client`, étape `Gagné` : `win`. Une menthe qui
sert aussi de couleur d'action ne veut plus rien dire — c'était le défaut du
prototype, où « Enregistrer » et « affaire gagnée » portaient le même vert.

Ambre, rouge, violet et bleu ne bougent pas : ce sont des couleurs sémantiques,
pas des couleurs de marque.

### Contrastes mesurés

| Paire | Ratio | Seuil |
|---|---|---|
| blanc sur `brand` | 6.7:1 | AA texte |
| blanc sur `brand-d` | 8.7:1 | AA texte |
| `brand` sur blanc (liens) | 6.7:1 | AA texte |
| `brand-d` sur `brand-l` | 7.6:1 | AA texte |
| blanc sur `rail` | 18.6:1 | AA texte |
| `rail-text` sur `rail` | 7.6:1 | AA texte |
| `rail-dim` sur `rail` | 5.7:1 | AA texte |
| blanc sur `rail-3` (entrée active) | 14.2:1 | AA texte |
| `brand-lift` sur `rail` | 8.1:1 | AA texte / icônes |
| `brand-lift` sur `rail-3` | 6.2:1 | AA texte / icônes |
| `win-d` sur `win-l` | 4.6:1 | AA texte |
| `muted` sur blanc | 4.9:1 | AA texte |
| bande la plus claire de l'entonnoir, texte blanc | 4.65:1 | AA texte |

Deux pièges relevés et corrigés au passage : **le blanc sur menthe pleine ne
donne que 3.0:1** — d'où l'interdiction du texte blanc sur `win` plein, la
réussite s'affiche en `win-d` sur `win-l` ; et **le bleu-violet plein ne donne
que 2.1:1 sur le rail actif** — d'où `brand-lift`, seule variante admise sur
fond sombre. L'ancien `muted` vert-gris (`#63807A`) plafonnait à 4.3:1, sous le
seuil, alors qu'il porte les libellés secondaires du tableau des contacts.

Le logo vit dans `components/brand/logo.tsx` (`Mark`, `Wordmark`) et dans
`app/icon.svg` pour la favicon. **Le tracé est une reconstruction, pas un
calque** : le fichier source n'a jamais été lisible côté agent. Remplacer le
corps de `Mark` et le contenu de `app/icon.svg` suffit à installer le vrai —
aucun autre fichier ne connaît la forme.

Le seed est en revanche étendu aux volumes du brief (12 sociétés, 18 contacts,
24 affaires), en conservant les 8 sociétés du prototype comme noyau.

---

## Architecture

```
crm/
├── app/                      App Router
│   ├── layout.tsx            polices next/font, variables CSS
│   ├── globals.css           jetons Tailwind v4 (@theme)
│   ├── (crm)/                coquille claire : accueil, pipeline, affaires,
│   │                         contacts, sociétés
│   ├── conseil/              coquille sombre du conseil d'agents
│   └── api/                  routes REST : deals, contacts, companies, tasks,
│                             activities, sequences, conversations, chat
├── lib/
│   ├── db.ts                 client Prisma unique
│   ├── format.ts             money, moneyShort, dates fr-FR
│   ├── api/                  couches de service + schémas Zod par entité
│   ├── agents/               conseil d'agents (voir § Jalon 2)
│   ├── client/               appels JSON depuis le navigateur
│   ├── navigation.ts         structure de navigation — rail + cartes d'accueil
│   └── domain/               ← règles métier pures, sans Prisma ni React
│       ├── types.ts          unions + formes du domaine
│       ├── schemas.ts        z.enum() — frontière string → union
│       ├── dates.ts          daysBetween, monthKey, lastMonthKeys
│       ├── pipeline.ts       dealProb, weighted, dealHeat, stuckDeals
│       ├── alerts.ts         les 6 générateurs + tri
│       ├── kpis.ts           winRate, cycle, funnel, forecast, retention
│       ├── tasks.ts          taskTarget, taskBucket
│       ├── sequences.ts      generateSequenceTasks
│       ├── csv.ts            lecture/écriture de tableurs — pur
│       └── __tests__/        Vitest
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
3. les agents du conseil réutilisent ces mêmes fonctions, sans duplication.

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

**Graphiques** — SVG écrit à la main, aucune librairie, en composants serveur :
`components/charts/` ne fait parvenir aucun JavaScript au navigateur.

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
vérification jetable, au prix de retouches locales à ne jamais committer : le
`provider` du schéma, et les `mode: "insensitive"` de `lib/api/deals.ts`,
`contacts.ts`, `companies.ts`, `contact-import.ts`, `tasks.ts`, `search.ts` et
`lib/agents/tools/reads.ts`.
Sauvegarder les originaux avant, les restaurer après, et relancer
`npm run build && npx tsc --noEmit && npx vitest run` sur le code restauré.

La migration `0_init` a été générée hors ligne avec
`prisma migrate diff --from-empty --to-schema-datamodel`, sans base joignable.
C'est la méthode à reprendre tant qu'aucune base de développement n'est
disponible localement.

---

## Variables d'environnement

| Variable | Depuis | Rôle |
|---|---|---|
| `DATABASE_URL` | phase 1 | connexion PostgreSQL |
| `WORKSPACE_PASSWORD` | **jalon 9, obligatoire** | mot de passe unique de l'espace + clé de signature des sessions |
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
| 2 | Conseil d'agents — 8 personnalités, registre d'outils, streaming, confirmation des écritures | **livré, à valider** (outils remis à jour au jalon 7) |
| 3 | Contacts & Sociétés — même motif, import/export CSV | **validé en production** |
| 4 | Tâches, interactions, séquences, moteur d'alertes | **validé en production** |
| 5 | Centre de pilotage & rapports — SVG écrits à la main, palette Ctrl+K, réglages, `/api/health` | **validé en production** |
| 6 | Confort d'usage — société à la volée, statut de relance, portefeuille clients | **validé en production** |
| 7 | Conseil remis à jour + cohérence entre écrans | **livré, à valider** |
| 8 | Formulaire d'affaire réparé + couche d'automatisation | **livré, à valider** |
| 9 | **Verrou d'espace de travail** — mot de passe partagé, sessions signées, sonde muette | **livré, à valider** |
| 10 | Liens, filtres de colonne, étiquettes, prospects perdus | **livré, à valider** |
| 11 | Correction des statuts depuis la feuille + import en mise à jour | **livré, à valider** |
| 12 | Rattrapage `searchText`, corrections depuis `/reglages`, parité des filtres, `/clients` | **livré, à valider** |
| 13 | Statut saisi à la consignation, accueil actionnable, noms débordés | **livré, à valider** |
| 14 | **Le conseil en vacations** — recommandations prouvées, planificateur, budget | **livré, à valider** |
| 15 | **Identité du conseil** — agents réglables, portraits en base, agent en pied | **livré, à valider** |
| 16 | **Diagnostic API** — corps d'erreur remonté, bissection du champ refusé, chemins unifiés | **livré, à valider** |
| 17 | **Clés de schéma en ASCII** — cause nommée, garde vitest, substitut qui valide | **livré, à valider** |
| 18 | **Le fil comme une conversation** — bande de portraits, écran d'ouverture, amorces | **livré, à valider** |
| 19 | **Le filet** — fusion vers `main`, sauvegardes automatiques, planificateur | **livré, à valider** |
| 20 | **Le cockpit** — file dense et groupable, anneau du jour, entonnoir, annulation | **livré, à valider** |
| 21 | **Statuts de la feuille + fiche en onglets** — report contrôlé, tiroir à en-tête fixe, six colonnes | **livré, à valider** |
| 22 | **Qualification → affaire** — pipeline refondu, fiche étoffée, rapports de prospection | **livré, à valider** |
| 23 | **Identité de marque** — palette, rail, logo, favicon, `/login` | **livré, à valider** |
| 24 | **Le site sort des Notes** — LinkedIn visible sans dépli, icônes d'en-tête, extraction contrôlée | **livré, à valider** |
| 25 | **La question des domaines, tranchée** — relecture de la feuille, report des 15 adresses réelles, propositions relues une par une | **livré, à valider** |
| 26 | **Acceptation groupée des seules déductions** — garde-fou serveur, tri par ressemblance, annulation de dix secondes | **livré, à valider** |
| 27 | **Audit du statut de relance** — la correction se réfutait elle-même ; une seule décision, test de parité | **livré, à valider** |
| 28 | **Cycle de vie terminal** — « Perdu » gagne sur le statut de relance ; tiroir durci | **livré, à valider** |
| 29 | **La règle terminale devient structurelle** — appliquée à la lecture, une seule porte, garde statique | **livré, à valider** |
| 4.5 | Envoi d'e-mails automatisé — spécifié après la validation du jalon 5 | différé |

**Séquencement révisé.** L'infrastructure CRM passe avant les agents : le jalon 2
reste tel qu'il a été livré — il n'est ni étendu ni retouché — et sa validation en
production est reportée à la fin. Les jalons 3, 4 et 5 s'enchaînent dans cet ordre,
chacun validé sur l'URL de production avant d'ouvrir le suivant.

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

---

## Jalon 3 — Contacts & Sociétés

```
lib/domain/csv.ts            découpage, reconnaissance d'en-tête, dates, écriture CSV — pur
lib/api/contacts.ts          couche de service contacts (liste, fiche, écriture, suppression)
lib/api/companies.ts         idem sociétés, avec les totaux ouvert / signé
lib/api/contact-import.ts    import : sociétés retrouvées ou créées, doublons écartés
lib/api/csv-export.ts        exports, en-têtes réimportables, BOM UTF-8
lib/client/http.ts           requête JSON générique + garde de forme
components/contacts/         vue, tableau, tiroir, formulaire, import, liaison d'affaire
components/companies/        vue en cartes, tiroir, formulaire
```

**Cartes pour les sociétés, tableau pour les contacts.** Une société se juge sur
trois nombres — contacts, pipeline ouvert, CA signé — qu'une carte donne d'un coup
d'œil ; un contact se compare ligne à ligne, sur des colonnes triables.

**Le CSV est lu en une seule passe, pas ligne par ligne.** Une cellule entre
guillemets peut contenir un saut de ligne : c'est ce que produit l'export d'une
note multiligne du CRM. Découper d'abord sur `\n` casserait le retour d'un export
dans l'import — le test `csv.test.ts` fixe cet aller-retour.

**Les en-têtes d'export sont exactement les alias de l'import.** Un test vérifie
que chaque colonne exportée est reconnue au retour (`csv-export.test.ts`). Sans
cette contrainte, l'export ne sert qu'à archiver.

**Deux formats de date acceptés à l'import** : ISO (`2026-03-01`) et français
(`11/02/2026`). Le second est traité explicitement parce que `new Date("11/02/2026")`
lit un mois américain et renvoie le 2 novembre — silencieusement, avec neuf mois
d'écart. Une date illisible arrête sa ligne et la signale ; elle n'est pas devinée.

**Doublons : l'adresse électronique fait foi, à défaut le couple nom + société.**
Sans ce repli, réimporter le même tableau recrée en double toutes les lignes sans
adresse — et c'est exactement ce que fait quelqu'un qui doute que son premier
import ait fonctionné.

**Supprimer un contact détache, supprimer une société est refusé.** Les affaires
et interactions d'un contact supprimé survivent (`SetNull`) : effacer une fiche ne
doit pas effacer du chiffre d'affaires. Une société qui porte encore des contacts
ou des affaires renvoie un 409 nommant les compteurs, plutôt que de les détacher
en silence.

**La promotion en « Client » est proposée, jamais automatique.** Gagner une
affaire fait apparaître une carte dans le tiroir de l'affaire. C'est une écriture
sur une *autre* fiche, et rien ne dit qu'un signataire soit le client — l'acheteur
peut être un intermédiaire.

**Le rattachement contact ↔ affaire s'écrit sur l'affaire.** `Deal.contactId` est
la seule clé ; un champ « affaire » sur le contact laisserait croire qu'un contact
n'en porte qu'une.

### Jalon 3 — ce qui est vérifié

Test d'acceptation rejoué contre une base réelle (SQLite jetable, retouches locales
non committées) :

- collage de 5 contacts depuis un tableur, colonnes tabulées, en-tête en français
  avec accents → 5 créés, 3 sociétés inconnues créées (dont une réutilisée pour
  deux lignes), colonne « Score interne » signalée comme ignorée
- `11/02/2026` → 11 février ; `01.03.2026` → 1er mars ; `2026-01-20` → 20 janvier
- `lead`, `PROSPECT` normalisés en `Lead`, `Prospect`
- **second import du même collage → 0 créé, 5 doublons, 0 société créée**
- modification du téléphone → persistée ; liaison à une affaire → persistée ;
  relecture complète après nouvelle requête → tout est là
- filtres `lifecycle`, `owner`, `source`, recherche, tri par fraîcheur avec les
  contacts jamais touchés en tête
- charges invalides → 400 avec l'erreur par champ (prénom vide, cycle de vie hors
  liste, adresse électronique fausse) ; collage sans en-tête → 400 explicite
- suppression d'une société avec fiches → 409 nommant les compteurs ; société vide
  → 200 ; suppression d'un contact → son affaire survit, `contact: null`
- gain d'une affaire → `won` + `closedAt`, puis promotion du contact en « Client »
- exports contacts et sociétés → BOM UTF-8, séparateur point-virgule, en-tête
  intégralement relue par l'import
- `/`, `/affaires`, `/pipeline`, `/contacts`, `/societes`, `/conseil` → 200, les
  données importées apparaissent au rendu serveur

### Jalon 3 — ce qui ne l'est pas

~~**La recherche est insensible à la casse, pas aux accents.**~~ **Corrigé au
jalon 10** : une colonne miroir `searchText` porte la version normalisée des
champs cherchables. « zenith » trouve « Zénith Labs ».

---

## Jalon 4 — Tâches, interactions, séquences, alertes

```
lib/api/tasks.ts             couche de service tâches + compteur de retards
lib/api/activities.ts        journal des interactions, transaction « prochaine action »
lib/api/sequences.ts         édition et lancement des séquences
lib/api/alerts.ts            assemblage : lit la base, appelle le moteur du domaine
lib/navigation.ts            structure de navigation — source unique rail + accueil
components/activities/       chronologie, formulaires, lancement de séquence, alertes
components/tasks/            vue /taches groupée par urgence
components/settings/         éditeur de séquences (/reglages)
```

**Consigner une interaction est une transaction, pas trois écritures.**
`logActivity()` écrit l'interaction, avance `Contact.lastContact` et
`Deal.lastActivityAt`, et crée la tâche de « prochaine action » — le tout dans un
`$transaction`. Un appel noté dont la relance s'est perdue est exactement l'oubli
que ce CRM doit empêcher ; une échéance illisible fait donc échouer l'ensemble et
n'écrit rien.

**Les dates de dernière touche ne reculent jamais.** Consigner un appel oublié la
semaine dernière ne doit pas rendre une affaire artificiellement froide : la mise
à jour n'a lieu que si la nouvelle date est postérieure.

**Le regroupement par urgence se calcule côté client.** `taskBucket()` est pur et
testé, mais il prend une horloge : « aujourd'hui » doit l'être dans le fuseau de
l'utilisateur, pas dans celui du serveur.

**Une tâche porte au plus un rattachement, et le refus est explicite.**
`taskTarget()` saurait trancher par ordre de priorité, mais une charge utile qui
nomme deux cibles traduit un bug d'appelant, pas une intention : l'API répond 400.

**Les séquences préfixent leurs tâches de leur nom.** « Relance J+3 » seul, dans
une liste de trente tâches, ne dit ni d'où il vient ni quoi arrêter si le prospect
répond. Éditer une séquence ne touche pas aux tâches déjà créées : une relance
planifiée hier reste planifiée.

**La séquence post-vente est reconnue à son nom, pas à un identifiant.** Les
séquences sont éditables dans Réglages : `q3` du seed peut être renommé,
désactivé ou supprimé. Elle est **proposée** après un gain, jamais appliquée
d'office — même règle que la promotion en « Client » du jalon 3.

**La chronologie d'une société agrège.** Elle montre aussi ce qui s'est passé sur
ses affaires et ses contacts ; sans cela, une fiche société active paraîtrait
muette.

**Le moteur d'alertes n'a pas été réécrit.** `lib/domain/alerts.ts` existait
depuis le jalon 0 avec ses six générateurs et ses tests. `lib/api/alerts.ts` ne
fait que lire les quatre jeux de données et lui passer une horloge. Les trois
surfaces — pastille du rail, liste « À traiter » de l'accueil, encart dans les
tiroirs — affichent le même calcul, sans règle parallèle qui finirait par diverger.

### Jalon 4 — ce qui est vérifié

Rejoué contre une base réelle (SQLite jetable, retouches locales non committées) :

- appel consigné sur un contact avec « prochaine action » → interaction écrite,
  tâche créée à la bonne date avec la bonne priorité et le bon rattachement,
  `lastContact` avancé du 22/07 au jour même
- la tâche apparaît dans `/taches` sous le bon groupe d'urgence, rattachement
  cliquable ; répartition observée : 4 en retard, 1 aujourd'hui, 10 cette semaine
- séquence lancée sur une affaire → 3 tâches datées J+0/J+4/J+9, préfixées du nom
  de la séquence, rattachées à l'affaire
- tâche en retard → pastille du rail à 7 ; cocher la fait tomber à 6 et horodate
  `doneAt` ; décocher efface `doneAt`
- chronologies des trois tiroirs : antéchronologiques, la société agrégeant bien
  ses affaires et ses contacts
- « prochaine action » à date illisible → 400, **et aucune écriture partielle**
  (compteur d'interactions inchangé)
- interaction antidatée de 2020 → `lastContact` inchangé
- séquence en pause → 409 nommant la cause ; deux rattachements sur une tâche →
  400 ; interaction sans rattachement → 400 ; tâche inexistante → 404
- séquence éditée dans `/reglages` (nom + étapes remplacées) → relue correctement,
  les 3 tâches déjà créées par le lancement précédent intactes
- `/`, `/affaires`, `/pipeline`, `/contacts`, `/societes`, `/taches`, `/reglages`,
  `/conseil` → 200

### Jalon 4 — ce qui ne l'est pas

Les alertes de la liste « À traiter » mènent à la vue filtrée, pas au tiroir de la
fiche : ouvrir directement la fiche demande un état d'ouverture porté par l'URL,
qui arrive avec le centre de pilotage du jalon 5.

---

## Correctif — la page d'accueil figée

**Signalé** : `/` affichait « Jalon 1 — Affaires de bout en bout » trois jalons
plus tard, sept compteurs à zéro, et aucune mention de Contacts ni Sociétés.

**Ce qui était réellement en cause.** Deux défauts distincts, dont un seul était
celui qu'on croyait :

1. *Le libellé « Jalon 1 » était bien écrit en dur*, figé au premier déploiement.
   Retiré, pas corrigé : un numéro de jalon n'apprend rien à l'utilisateur et
   redevient faux au jalon suivant. Restent le commit et la branche, qui sont des
   faits.
2. *Les compteurs, eux, interrogeaient déjà Prisma à chaque requête.*
   `readDbStatus()` fait sept `count()`, la page est en `force-dynamic`, et le
   projet ne contient ni `revalidate`, ni `unstable_cache`, ni `force-static`.
   Vérifié contre une base réelle : le même processus, **sans redémarrage**, est
   passé de sept zéros aux vrais comptes à la seconde où le seed s'est exécuté.

Sept zéros avec le voyant « connectée » ne signifient donc pas un affichage figé,
mais une base joignable et vide — tables créées par `migrate deploy`, jamais
peuplées. La page le dit désormais explicitement, avec la commande à lancer.

**Ce qui a été ajouté pour que la question ne se repose pas :**

- l'horodatage du rendu, à côté du commit : un rendu réellement frais se voit ;
- un avertissement nommant l'état « base vide » au lieu de le laisser deviner ;
- `lib/navigation.ts`, source unique du rail *et* des cartes de l'accueil : livrer
  un écran ne demande qu'une modification, là où il en fallait deux. Rien ne peut
  deviner qu'un écran est livré — c'est un jugement, pas un fait mesurable — mais
  il n'y a plus qu'un seul endroit où le déclarer ;
- `app/(crm)/__tests__/home-page.test.ts` : les comptes du client Prisma sont
  imposés, la page est rendue, et le test vérifie que *ces* nombres apparaissent,
  qu'aucun numéro de jalon n'est écrit, et que les cartes correspondent exactement
  à `shippedEntries()`. Le garde-fou a été éprouvé en figeant volontairement la
  page : trois tests tombent.

---

## Jalon 5 — Centre de pilotage, rapports, réglages

```
lib/api/dashboard.ts       assemblage du centre de pilotage
lib/api/reports.ts         fenêtre temporelle + agrégats (calculs dans lib/domain/kpis)
lib/api/settings.ts        seuils, listes, étapes du pipeline
lib/api/backup.ts          export/restauration JSON complets
lib/api/search.ts          recherche transverse (palette Ctrl+K)
components/dashboard/      en-tête, « dernière touche », relances, flux, risques
components/charts/         barres, courbe, anneau, entonnoir — SVG écrit à la main
components/search/palette  Ctrl+K, navigation au clavier
app/api/health/            sonde : injoignable (503) / vide (200) / ok (200)
```

**Le tiroir est un état d'URL.** `?fiche=<id>` sur `/contacts`, `/societes` et
`/affaires` ouvre la fiche correspondante. La page charge cette fiche
*séparément* si elle ne figure pas dans la liste filtrée : cliquer une alerte
depuis l'accueil ouvre donc toujours le bon enregistrement, même si le filtre
courant l'exclut. Le lien est partageable et le bouton « précédent » referme le
tiroir. C'est ce qui manquait au jalon 4.

**Le centre de pilotage répond à une question, pas à dix.** L'ordre des blocs est
celui de la question : ce qui brûle (« à traiter maintenant »), qui a été oublié
(« dernière touche »), ce qui est prévu (« relances à venir »), ce qui dort
(« affaires en sommeil »), ce qui vient de se passer.

**Le rouge de « dernière touche » vient des réglages, pas d'une constante.** Le
seuil affiché en légende est `coldDays` : le modifier dans Réglages change
immédiatement la légende *et* les couleurs. Un test le vérifie en comparant
l'écran à `DEFAULT_PILOTAGE`.

**Les graphiques n'envoient aucun JavaScript.** Ce sont des composants serveur
qui produisent du `<svg>` statique, `viewBox` + `width="100%"` pour la fluidité.
Le tri du tableau « dernière touche » passe lui aussi par des liens : la page
d'accueil est entièrement rendue côté serveur.

**Les seuils sont liés, et l'invariant est vérifié sur la valeur finale.**
`staleDays` doit rester strictement inférieur à `coldDays`, sinon `dealHeat()`
ne renvoie plus jamais « tiède ». Modifier un seul des deux champs reste donc
possible : le service relit l'autre en base avant de trancher.

**Supprimer une étape qui porte des affaires est refusé, en les comptant.**
`Deal.stage` n'a pas d'`onDelete` : la suppression échouerait sur une contrainte
de clé étrangère avec un message Prisma illisible. Le réordonnancement décale
d'abord toutes les positions hors de portée, sinon un simple échange de deux
étapes violerait la contrainte d'unicité.

**La restauration remplace tout, ou ne touche à rien.** Elle s'exécute dans une
transaction et les dates sont reconverties par `z.coerce.date()` — JSON n'a pas
de type date, et un export relu tel quel passerait des chaînes là où Prisma
attend des `Date`.

### Jalon 5 — ce qui est vérifié

Rejoué contre une base réelle (SQLite jetable, retouches locales non committées) :

- `/accueil` : 12 alertes, seuil « 14 jours » en légende, 4 contacts en rouge,
  10 relances sur 7 jours, blocs sommeil et activité présents, barre d'objectif
- cliquer une alerte contact → tiroir ouvert sur la bonne fiche, chronologie
  comprise ; **une fiche hors du filtre courant s'ouvre quand même** (filtre
  `lifecycle=Lead`, fiche d'un Client → tiroir correct) ; idem pour une affaire
- `coldDays` 14 → 5 : la légende passe à 5 et les contacts en rouge passent de
  4 à 10 ; `staleDays: 30` seul → 400 nommant l'invariant
- Ctrl+K : « nadia » → le contact et son lien `?fiche=` ; « nutrivia » → contact,
  société, affaires et tâche ; 1 caractère ou vide → 0 résultat
- `/rapports` sur les quatre périodes : CA 2,4k€ / 14k€ / 22k€ / 22k€, closing
  50 / 57 / 70 / 70 %, 14 `<svg>`, entonnoir, prévision, deux anneaux, tableau
  par propriétaire
- réglages : réordonnancement et renommage d'étapes appliqués ; suppression de
  5 étapes portant 21 affaires → 409 les nommant ; couleur « vert » → 400 ;
  liste avec doublon, espaces et ligne vide → nettoyée à 3 valeurs
- sauvegarde → 111 lignes exportées ; 18 contacts supprimés (13 tâches emportées
  en cascade) ; restauration → tout revient, tâches comprises
- fichier non conforme → 400 sans rien supprimer ; sauvegarde cohérente en
  apparence mais pointant une étape inexistante → 400, **base intacte** ;
  version 99 → refus nommant les versions
- `/api/health` : base peuplée → `ok` 200 ; base vide → `empty` 200 ; base
  injoignable → `unreachable` 503, sans fuite d'URL ni d'identifiant
- base injoignable : `/` répond quand même 200 et le rail affiche « Compteurs
  indisponibles » au lieu de « 0 € en pipeline »

### Jalon 5 — ce qui ne l'est pas

La palette Ctrl+K et les formulaires de réglages sont des composants client :
leur comportement au clavier a été vérifié par lecture et par les appels d'API
sous-jacents, pas par un navigateur piloté. Le rendu visuel des graphiques n'a
pas été comparé à une référence — seule leur présence et leurs données le sont.

---

## Incident — la base de production vidée

**Signalé** : `/reglages` à « 0 séquences » et le rail à « 0 € en pipeline »,
après des compteurs à 6/12/18/24/32/16/3 le matin même.

**Ce que la chaîne de déploiement fait, vérifié fichier par fichier** :
`nixpacks.toml` → `npm ci`, `npm run build`, `npm run start` ;
`scripts/start.sh` → `prisma migrate deploy` puis le serveur. `migrate deploy`
n'applique que des migrations en avant ; il ne réinitialise rien. Il n'y a dans
le dépôt ni `migrate reset`, ni `db push`, ni `--accept-data-loss`, ni appel
automatique au seed. La clé `package.json#prisma.seed` existe, mais elle n'est
invoquée que par `migrate dev` et `migrate reset`, jamais par `migrate deploy`.
**Aucun chemin de déploiement ne supprime de données.**

**Deux défauts du code, en revanche, produisent exactement ce symptôme** — les
deux sont corrigés :

1. **Le seed vidait puis rechargeait, sans transaction.** Dix `deleteMany` suivis
   d'une longue série d'insertions. Un échec au milieu — clé étrangère, coupure
   réseau, conteneur interrompu — laissait les suppressions validées et les
   insertions perdues : une base intégralement vide, sans erreur visible dans
   l'application. C'est le seul mécanisme du dépôt capable de vider la base, et
   il ne se déclenche qu'à la main. Il est désormais encadré par `$transaction`
   (délai 60 s) et signale en sortie toute table restée vide.
2. **Le rail affichait « 0 € » quand la requête échouait.** Le `catch` de
   `readRailTotals()` renvoyait des zéros : une base injoignable et une base vide
   donnaient le même affichage. Il renvoie maintenant `null`, et le rail écrit
   « Compteurs indisponibles ».

**Ce qui reste à vérifier côté Railway, et que le code ne peut pas dire** : si le
service PostgreSQL dispose d'un volume persistant, et si `DATABASE_URL` désigne
toujours la même instance après redéploiement. `/api/health` donne la réponse en
un appel — `unreachable`, `empty` ou `ok`, avec les sept compteurs. Une base
`empty` juste après un déploiement, alors qu'elle était `ok` avant, désigne
l'infrastructure, pas l'application.

**Filet de sécurité ajouté** : sauvegarde JSON complète téléchargeable et
restauration transactionnelle dans Réglages. À exporter avant toute manipulation
risquée.

---

## Jalon 6 — société à la volée, statut de relance, portefeuille

```
lib/domain/follow-up.ts     statut de relance dérivé — pur, testé
lib/api/company-resolve.ts  société créée dans la transaction du parent
lib/api/clients.ts          portefeuille : CA signé, ancienneté, statut
components/ui/combobox.tsx  saisie avec suggestions et création à la volée
components/clients/         tableau du portefeuille
```

**La société se crée sans quitter le formulaire.** Le champ n'est plus une liste
déroulante mais un combobox : on tape, il filtre, et s'il ne trouve rien il
propose « Créer “X” ». Le composant ne rend pas un identifiant — il rend soit un
identifiant existant, soit **un nom à créer**. La création réelle a lieu côté
serveur, `resolveCompanyLink()` dans la transaction du contact ou de l'affaire :
un contact refusé ne laisse donc aucune société fantôme derrière lui. La société
est créée avec son seul nom ; le reste se remplit depuis sa propre fiche.

**La correspondance des noms se fait en mémoire, pas en SQL.** `mode:
"insensitive"` ne couvre pas les accents et n'existe pas sous SQLite : la règle
serait invérifiable hors production — exactement la façon dont un doublon
« ACME » / « acme » finit par arriver en base sans que personne l'ait vu venir.
La table des sociétés se compte en dizaines ; la lire entièrement coûte moins
qu'une règle qu'on ne peut pas tester. « zénith labs » retrouve donc « Zenith Labs ».

**Le statut de relance est dérivé, jamais saisi.** *(Révisé au jalon 13 : un
statut saisi peut désormais l'emporter. Le calcul reste le repli.)* Cinq états calculés depuis
`lastContact`, `nextReminder` et le nombre d'interactions : jamais contacté, à
relancer, relance prévue, en attente, sans nouvelles. Aucun champ manuel à tenir
à jour, donc rien qui puisse mentir parce qu'on a oublié de le changer. Le seuil
« sans nouvelles » est `coldDays`, la même valeur que la chaleur des affaires et
les alertes : la régler déplace les trois d'un coup.

**Un statut dérivé ne se filtre pas en SQL.** Le filtre et le tri par statut se
font en mémoire, après lecture, et c'est écrit dans le code. Au volume d'un CRM
d'indépendant c'est sans conséquence ; à dizaines de milliers de lignes il
faudrait matérialiser le statut, au prix de la portabilité du schéma.

**La puce « À relancer » n'est pas le statut « à relancer ».** La puce retient
*tout contact ayant une relance programmée* — en retard, aujourd'hui ou à venir —
et trie par échéance croissante : c'est le pipeline de relances vu d'un coup. Le
statut, lui, distingue « à relancer » de « relance prévue » sur une ligne donnée.
Les deux notions portent des noms distincts dans le code (`ContactFilter` contre
`FollowUpStatus`, valeur `reminder` contre `due`) pour qu'aucune ne mente sur ce
qu'elle fait. Dans la liste, l'échéance est en rouge si elle est dépassée ou du
jour, en poids normal si elle est à venir, avec dans les trois cas le délai
exprimé (« 3 j de retard », « aujourd'hui », « dans 21 j »).

Les compteurs de la puce — « À relancer (12 · 4 en retard) » — portent sur
**tous** les contacts, pas sur la liste filtrée : une puce qui compterait son
propre résultat afficherait toujours le total de ce qu'elle vient de
sélectionner, ce qui n'apprend rien.

**Ordre des règles.** « Jamais contacté » est évalué en premier : un contact
jamais touché le reste même si une relance est programmée pour aujourd'hui.
C'est l'écriture littérale de la règle demandée. Si l'usage montre qu'une relance
due doit primer, il suffit d'intervertir les deux premières branches de
`followUpStatus()` — un test couvre déjà ce cas précis.

**Le portefeuille compte ce que la personne a signé.** `/clients` additionne les
affaires gagnées **rattachées au contact**. Une affaire rattachée à la seule
société, sans contact, n'y figure pas : la fiche société porte cette autre
lecture. La moyenne se calcule sur tous les clients, y compris ceux à zéro euro —
c'est précisément ce qu'une moyenne de portefeuille doit dire.

### Jalon 6 — ce qui est vérifié

Rejoué contre une base réelle (SQLite jetable, retouches locales non committées) :

- contact créé avec « Studio Kaolin » inconnue → société créée, liée, visible
  dans `/societes` avec le nom seul ; la page la rend
- « studio KAOLIN » puis « zénith labs » → rattachés aux sociétés existantes,
  **aucun doublon** (1 seule société « Kaolin », 1 seule « Zenith »)
- contact invalide avec `companyName` → 400 et **aucune société fantôme** créée
  (compteur inchangé)
- affaire créée avec une société à la volée → même comportement
- répartition des statuts sur le jeu de démonstration : 4 jamais contactés,
  4 à relancer, 7 relances prévues, 3 en attente, 4 sans nouvelles
- puce « À relancer » → les 12 contacts ayant une relance, triés par échéance
  croissante : 4 en retard, 1 du jour, 7 à venir jusqu'à J+21 ; la colonne Statut
  y montre bien 4 « À relancer » et 8 « Relance prévue »
- un tri explicite (`sort=lastName`) n'est pas écrasé par le tri par défaut
- l'ancienne valeur de filtre `due` est désormais refusée en 400 : filtre et
  statut ne partagent plus de vocabulaire
- compteurs de la puce : (12 · 4 en retard), puis (13 · 5 en retard) après ajout
  d'une relance en retard
- filtre « Jamais contacté » → tous sans `lastContact` **et** sans interaction
- `coldDays` 14 → 20 → 40 : « sans nouvelles » passe de 4 à 3 à 1, dans l'API
  **et** dans la page rendue
- `/clients` : 6 clients, 14k€ cumulés, 2,3k€ de moyenne — recoupés contre la
  base ; tri par défaut décroissant sur le CA ; les cinq tris répondent ;
  cliquer une ligne ouvre la fiche du contact
- badge de statut présent dans le tiroir contact, colonnes Statut et Prochaine
  relance dans `/contacts`, entrée « Clients » dans le rail et carte d'accueil

### Jalon 6 — ce qui ne l'est pas

Le combobox est un composant client monté à l'ouverture du tiroir : son
comportement au clavier (flèches, Entrée, Échap, clic extérieur) a été écrit et
relu, mais vérifié seulement par les appels d'API sous-jacents, pas par un
navigateur piloté.

### Incident corrigé au passage

`GET /api/contacts` calculait le statut avec les seuils **par défaut** au lieu de
ceux enregistrés : changer `coldDays` déplaçait les couleurs de la page mais pas
la réponse de l'API, qui la contredisait donc en silence. Détecté par le test
d'acceptation nº 4, qui comparait les deux. Les trois routes contacts (liste,
fiche, export) lisent désormais les réglages.

---

## Jalon 7 — le conseil remis à jour, et la cohérence entre écrans

### Les agents avaient quatre jalons de retard

Le registre d'outils datait du jalon 2 : affaires, sociétés, tâches, indicateurs.
Les jalons 3 à 6 ont livré les interactions, les séquences, le moteur d'alertes,
le statut de relance et le portefeuille clients **sans rien en ouvrir au
conseil**. Sacha, dont la raison d'être est « qu'est-ce que je fais
aujourd'hui ? », ne pouvait pas lire la liste que l'application affiche pour
répondre exactement à cette question.

Six lectures ajoutées (`lib/agents/tools/reads-crm.ts`) :

| Outil | Répond à |
|---|---|
| `list_reminders` | « qui dois-je relancer ? » — la puce À relancer, triée par échéance |
| `list_neglected_contacts` | « qui ai-je oublié ? » — sans nouvelles, jamais contacté |
| `list_alerts` | « qu'est-ce qui presse ? » — la liste « À traiter maintenant » |
| `get_timeline` | « qu'est-ce qu'on s'est dit ? » — chronologie d'une fiche |
| `list_sequences` | connaître les séquences avant d'en proposer une |
| `list_clients` | le portefeuille : qui paie, combien, depuis quand |

Deux écritures ajoutées, derrière la même carte de confirmation que les autres :
`set_reminder` (programmer la prochaine relance) et `run_sequence` (lancer une
séquence, chaque étape devenant une tâche datée). Sacha les porte toutes les
deux, Noah seulement `set_reminder`. **Brutus reste en lecture seule.**

`search_contacts` renvoie désormais le statut de relance et la prochaine
échéance, calculés par la même fonction que les écrans.

**Ces outils n'implémentent aucune règle.** Ils appellent `listContacts`,
`readAlerts`, `readClients`, `listActivities`, `listSequences` — les couches de
service des écrans. Un agent et une page qui regardent le même contact ne
peuvent pas diverger, puisqu'ils exécutent le même code.

### La cohérence est structurelle, pas testée écran par écran

L'audit demandé a trouvé une divergence réelle : trois tableaux recalculaient
`joursÉcoulés >= coldDays` de leur côté (`contacts-table`, `clients-table`,
`stale-contacts`). Conséquence, un contact silencieux depuis trente jours **mais
dont la relance était déjà programmée** s'affichait « Relance prévue » en bleu
dans une colonne et en rouge dans la suivante, sur la même ligne.

Une relance planifiée n'est pas un problème. La couleur d'alerte vient donc
maintenant d'une seule fonction, `needsAttention(statut)` : rouge si et seulement
si le statut est « à relancer » ou « sans nouvelles ». Les trois tableaux
l'appellent, aucun ne compare plus lui-même.

Deux autres écarts corrigés au passage :

- **`readStaleContacts` ne calculait pas de statut** : le tableau « dernière
  touche » de l'accueil affiche désormais le même badge que `/contacts` ;
- **« Relances à venir » ne lisait que les tâches**. Un contact relançable dans
  trois jours apparaissait sous « À relancer » et nulle part dans le bloc qui
  porte le même mot. Le bloc agrège maintenant les deux sources, les relances de
  fiche étant marquées « relance fiche ».

`lib/domain/__tests__/no-duplicate-thresholds.test.ts` empêche la rechute : il
parcourt `lib/`, `components/` et `app/`, et échoue si un fichier autre que
`follow-up.ts`, `pipeline.ts` ou `alerts.ts` compare quoi que ce soit à
`settings.coldDays` / `settings.staleDays`. Éprouvé en réintroduisant
volontairement l'ancien calcul : le test le désigne par fichier et par ligne.

### Jalon 7 — ce qui est vérifié

Rejoué contre une base réelle (SQLite jetable, retouches locales non committées) :

- **contrôle croisé automatisé** sur les mêmes 18 contacts : `/api/contacts`,
  les trois puces, `/clients` (6 lignes) et l'accueil (12 lignes) — statut et
  couleur comparés ligne à ligne, **aucune divergence**
- sur l'accueil, rouge ⟺ statut « À relancer » ou « Sans nouvelles », sur les
  12 lignes
- le cas jadis divergent : 48 jours de silence + relance dans 5 jours → statut
  « Relance prévue », **non rouge**, sur tous les écrans où il figure
- outils du conseil contre couche de service : `list_reminders` 11 = 11 (dont 4
  en retard = 4), ordre croissant vérifié ; `list_neglected` 4 = 4 ; seuil
  annoncé 14 = réglage 14 ; `list_clients` 6 clients / 13 680 € ; `list_alerts`
  12 ; `list_sequences` 3 ; `get_timeline` répond sur une fiche réelle
- `search_contacts` expose bien statut et prochaine relance
- états vides : chacun des trois filtres nomme sa règle, et celui de « sans
  nouvelles » cite le seuil configuré (21 puis 14 après changement)
- « Relances à venir » mêle tâches et relances de fiche, ces dernières marquées
- les dix pages répondent 200

### Jalon 7 — ce qui ne l'est pas

Aucun appel Anthropic réel : `ANTHROPIC_API_KEY` n'existe pas dans cet
environnement. Les outils ont été exercés directement contre la base, pas au
travers d'une conversation. Que Sacha *choisisse* le bon outil relève du modèle
et de son prompt — c'est ce que la validation en production doit établir.

Différence de périmètre assumée, non corrigée : le tableau « dernière touche »
de l'accueil exclut les « Ancien Client », que `/contacts` affiche. Ce sont deux
populations différentes par intention, pas deux avis contradictoires sur un même
contact.

## Jalon 8 — le formulaire d'affaire, et la couche d'automatisation

### Le formulaire d'affaire était vide parce que la base l'était

Trois listes déroulantes vides — Étape, Propriétaire, Offre. Le formulaire
n'était pas en cause : `deal-form.tsx` retombait déjà sur `stages[0]`,
`owners[0]`, `offers[0]`. Des listes vides à l'écran voulaient donc dire des
tables vides en base, très probablement vidées par l'éditeur de listes de
`/reglages` avant le jalon 6.

Deux réponses, parce qu'une seule ne suffit pas :

1. **La donnée.** La migration `2_automation` sème les six étapes, les
   propriétaires, les offres, les sources et les cycles de vie — mais seulement
   `WHERE NOT EXISTS`, donc sans jamais écraser une configuration existante.
2. **L'écran.** Quand une liste indispensable manque malgré tout, le formulaire
   le dit et renvoie vers `/reglages` au lieu d'afficher un menu vide. Le montant
   naît vide plutôt qu'à `0` : un zéro pré-rempli est un chiffre qu'on oublie de
   corriger.

`/affaires` est passé au standard de `/contacts` : compteurs sur les puces
(calculés sur **toutes** les affaires, jamais sur la liste filtrée), états vides
qui nomment la règle appliquée, et distinction explicite entre « pipeline vide »
et « rien ne correspond au filtre ».

### Six règles d'automatisation, et celles qu'on a refusées

Tout le décidé vit dans `lib/domain/automation.ts` (pur, testé) ; tout l'écrit
dans `lib/api/automation.ts`. Aucune route, aucun composant ne recompose une
règle — le test `no-duplicate-thresholds` couvre désormais aussi les clés
d'automatisation.

| Évènement | Comportement |
|---|---|
| Relance posée sur un contact | Tâche miroir « Relancer X » créée dans `/taches` |
| Relance déplacée | La **même** tâche se déplace |
| Relance effacée | La tâche ouverte disparaît |
| Tâche de relance terminée | La relance du contact s'efface |
| Interaction consignée | Date de relance **proposée** selon le type (délais configurables) |
| Entrée dans une étape | Action de suivi **proposée** par l'étape, si elle en déclare une |
| Affaire en sommeil | Tâche de réveil, sur action groupée explicite |

**Refusé — créer la tâche de réveil au moment où l'alerte s'affiche.** `/api/alerts`
est lu par les agents, dont Brutus, en lecture seule par conception. Une
consultation qui écrit en base n'est plus une consultation. L'action est donc
groupée et explicite, et elle annonce combien de tâches elle va créer.

**Refusé — avancer une relance existante plus lointaine.** `proposedReminder()`
renvoie `null` dans ce cas : la date était un choix, la remplacer en silence
serait décider à la place de l'utilisateur.

**Refusé — promouvoir automatiquement un contact en Client sur affaire gagnée.**
La carte de confirmation existait déjà et reste la bonne réponse ; les deux
promotions (contact et séquence post-vente) coexistent sans se masquer.

### L'anti-doublon est une contrainte de base, pas une vérification

Chaque tâche automatique porte une `autoKey` unique en base :
`reminder:<contact>`, `stage:<affaire>:<étape>`, `stale:<affaire>`. Rejouer un
déclencheur met la tâche à jour au lieu d'en créer une seconde — une course ne
peut pas contourner une contrainte d'unicité, elle contourne toujours une
vérification applicative.

Un cas a été trouvé à la vérification, pas à l'écriture : une tâche **terminée**
bloquait la clé, si bien que reposer volontairement une relance après l'avoir
traitée laissait la fiche marquée « à relancer » sans rien dans `/taches`. La
tâche terminée libère désormais sa clé (son historique reste intact) et une
nouvelle naît à côté — mais uniquement si l'échéance a changé, sinon un
déclencheur qui repasse ne produit toujours rien.

### Jalon 8 — ce qui est vérifié

Vérifié contre un **vrai PostgreSQL 16**, pas un substitut : cluster local,
`prisma migrate deploy` des trois migrations, puis `migrate diff` renvoyant une
migration vide — le SQL écrit à la main est fidèle au schéma.

- base neuve : étapes, propriétaires et offres présents, `/affaires` annonce
  « aucune affaire n'existe encore » et non « toutes sont gagnées ou perdues » ;
- relance posée → tâche créée ; déplacée → même tâche, nouvelle date ; effacée →
  tâche supprimée ; tâche terminée → relance effacée ;
- interaction avec relance acceptée → date posée **et** tâche miroir, dans la
  même transaction ;
- déplacement d'étape → tâche de l'étape d'arrivée ; aller-retour → `effect:
  "moved"`, jamais un second exemplaire ; étape terminale → rien ;
- réveil groupé → une tâche en priorité haute, rejoué → `created: 0` ;
- sauvegarde/restauration : `auto`, `autoKey`, `stageSince`, `nextActionLabel`,
  `nextActionDays` et les cinq `relanceApres*` survivent au tour complet ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (312 tests) verts.

### Jalon 8 — ce qui ne l'est pas

Le formulaire d'affaire vit dans un tiroir rendu au clic : ses menus n'ont pas
été inspectés dans le HTML initial. Ce qui est vérifié, ce sont les données qui
l'alimentent — les mêmes listes servent les filtres de la page, eux bien
présents dans le HTML.

Aucune règle ne se déclenche seule dans le temps : il n'y a pas de tâche
planifiée. Une affaire ne devient « en sommeil » que quand quelqu'un ouvre
l'accueil et lance l'action groupée. C'est délibéré pour l'instant — un
planificateur qui écrit sans témoin est exactement ce que « rien de muet »
interdit.

## Jalon 9 — verrou d'espace de travail (P0 sécurité)

### L'incident

Le CRM de production était accessible **sans aucune authentification**. Un agent
externe a lu la liste des contacts et téléchargé l'export CSV complet sans
présenter de justificatif. Avec 150 prospects réels — noms, adresses
électroniques, téléphones — sur le point d'être importés, c'est une exposition de
données personnelles, avec les obligations RGPD qui vont avec.

Corrigé avant toute autre chose.

### Un seul point de passage, fermé par défaut

```
middleware.ts              le verrou : tout est privé sauf PUBLIC_PATHS
lib/auth/config.ts         cookie, durée, chemins publics, lecture de la variable
lib/auth/session.ts        signature HMAC, vérification, comparaison à temps constant
lib/auth/rate-limit.ts     fenêtre glissante par adresse IP
lib/auth/redirect.ts       ?next= — chemins relatifs seulement
app/api/auth/login|logout  ouverture et fermeture de session
app/login/                 saisie du mot de passe partagé
```

**Tout est privé par défaut.** `PUBLIC_PATHS` énumère quatre exceptions ; le
reste — pages, `/api/*`, exports CSV, sauvegarde JSON — est fermé sans que
personne ait à y penser. L'inverse (une liste de chemins *à protéger*) laisse
passer toute route ajoutée ensuite et oubliée, ce qui est précisément le mode de
défaillance qu'on répare.

**Sans `WORKSPACE_PASSWORD`, on ferme.** L'application répond 503 partout au lieu
de laisser passer. Remplacer un accès sans condition par un accès conditionné à
une variable qui, manquante, ouvre tout, serait le même défaut avec une étape de
plus. `/api/health` reste public : le healthcheck Railway passe, le déploiement
ne se replie pas, mais l'espace reste clos.

**La sonde publique est devenue muette.** Elle renvoyait sept compteurs et les
informations de déploiement. Le nombre de contacts n'est pas anodin — c'est déjà
renseigner un tiers sur la taille du portefeuille, et son évolution trahit
l'activité. Elle ne renvoie plus qu'un état (`ok` / `empty` / `unreachable`). La
distinction vide/injoignable, qui avait servi à diagnostiquer une perte de
données, est conservée : c'est un bit, pas un inventaire.

**Web Crypto, pas `node:crypto`.** La vérification du jeton doit avoir lieu dans
le middleware — c'est lui qui voit *toutes* les requêtes — et le middleware
tourne en runtime Edge. `crypto.subtle` fonctionne dans les deux.

**Aucune session en base.** Le jeton porte son expiration et une signature
HMAC-SHA256 dont la clé est le mot de passe lui-même. Conséquence utile : changer
`WORKSPACE_PASSWORD` invalide toutes les sessions en cours — le seul moyen de
révoquer un accès quand il n'y a pas de comptes.

**Comparaison à temps constant, sur des empreintes.** On compare les HMAC des
deux mots de passe plutôt que les chaînes : deux empreintes font toujours la même
longueur, la comparaison ne divulgue donc pas non plus la longueur du secret.

**`?next=` n'accepte que des chemins relatifs.** Sans ce filtre, la page de
connexion devient un tremplin : `?next=https://…` enverrait ailleurs quelqu'un
qui vient de saisir son mot de passe sur le bon domaine. `//ailleurs` et `/\ailleurs`
sont refusés aussi — le navigateur les lit comme des URL absolues.

### La couche est isolée, pour pouvoir être remplacée

Rien hors de `lib/auth/`, `middleware.ts`, `app/login/` et `app/api/auth/` ne
connaît l'authentification. Aucune route, aucun service, aucun composant ne lit
de session. Passer à de vrais comptes, des rôles ou OAuth se fera en remplaçant
ce module — le reste de l'application n'a pas à bouger.

### Ce que la limitation de tentatives fait, et ce qu'elle ne fait pas

Fenêtre de 15 minutes, 8 échecs par adresse, **en mémoire**. Un redémarrage remet
les compteurs à zéro et deux instances comptent séparément : ce n'est pas une
défense contre un attaquant distribué. C'est ce qui met un mot de passe hors de
portée d'un script naïf. Le vrai rempart reste la longueur du secret.

### Jalon 9 — ce qui est vérifié

Contre un vrai PostgreSQL et le serveur standalone de production
(`NODE_ENV=production`) :

- **sans session** : les dix pages renvoient 307 vers `/login?next=…` ; les neuf
  routes d'API testées renvoient 401, dont `/api/contacts/export`,
  `/api/companies/export` et `/api/backup` — le corps de l'export ne contient
  plus que `{"error":{"message":"Session requise."}}` ;
- **cookie** : `HttpOnly`, `Secure`, `SameSite=lax`, `Path=/`, `Max-Age=2592000`
  (30 jours) ;
- **avec session** : pages et export CSV répondent 200, l'export est complet ;
- **limitation** : 8 refus puis 429 ; une autre adresse n'est pas pénalisée ; le
  *bon* mot de passe est refusé aussi tant que la fenêtre court ;
- **déconnexion** : l'export retombe à 401 immédiatement ;
- **sans `WORKSPACE_PASSWORD`** : 503 sur les pages et les API, `/api/health`
  toujours 200 ;
- **`?next=` hostile** : le formulaire reçoit `/`. L'URL hostile n'apparaît que
  dans le descripteur de route interne de Next, qui répète l'URL demandée — ce
  n'est pas une destination ;
- `tests/auth-routes.test.ts` énumère les routes **sur le disque** et exerce le
  vrai middleware : une route ajoutée demain entre automatiquement dans le test
  et le fait échouer si elle échappe au verrou ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (340 tests) verts.

### Jalon 9 — ce qui ne l'est pas

Un seul mot de passe partagé, sans comptes : impossible de savoir *qui* a agi, et
le retrait d'un accès passe par un changement de mot de passe pour tout le monde.
C'est le compromis demandé pour deux personnes ; il ne tient plus à cinq.

Les données restées exposées avant ce correctif le sont : le verrou ferme la
porte, il ne rappelle pas ce qui est sorti. Si des données personnelles réelles
ont été lues, l'analyse RGPD (registre, notification éventuelle) est une décision
qui n'appartient pas au code.

Aucun chiffrement au repos, aucune journalisation des accès, aucune limitation de
débit sur les routes de lecture une fois la session ouverte.

## Jalon 10 — liens, filtres de colonne, étiquettes, prospects perdus

Premier jalon écrit après un usage réel : 150 prospects importés, 133 sociétés.

### Les liens menaient dans le vide

Une valeur importée d'un tableur s'écrit `linkedin.com/in/pascal-charpentier`,
sans schéma. Dans un `href`, un navigateur la lit comme un chemin **relatif** :
le lien menait à `https://mon-crm/linkedin.com/in/…`, une 404.

Corrigé **au rendu**, jamais en base (`lib/domain/links.ts`, `ExternalLink`).
Réécrire la donnée stockée rendrait l'export infidèle à la source : un
aller-retour tableur → CRM → tableur modifierait le fichier de l'utilisateur sans
qu'il l'ait demandé. Les liens s'ouvrent dans un nouvel onglet avec
`rel="noopener noreferrer"`. Un `javascript:` n'est jamais rendu cliquable.

### La recherche ignore enfin les accents

Deux chemins étaient possibles. L'extension `unaccent` fait le travail en SQL
mais dépend d'un privilège qu'un service de base géré peut refuser — et une
recherche qui marche en développement et pas en production est pire qu'une
recherche limitée. Retenu : une **colonne miroir** `searchText` (contacts,
sociétés, affaires), écrite par l'application à chaque écriture, avec la règle
dans `lib/domain/text.ts`, testable sans PostgreSQL.

La migration remplit la colonne pour les lignes existantes avec `translate()` —
pur SQL, aucun privilège particulier. Sans ce bloc, les 150 fiches déjà
importées seraient restées introuvables jusqu'à leur prochaine modification.

### Filtres de colonne, façon tableur

Une seule mécanique pour tous les tableaux : `lib/domain/column-filters.ts`
(modèle et URL), `lib/domain/column-match.ts` (application en mémoire),
`lib/api/column-filters.ts` (traduction Prisma), `components/table/`
(le menu). Chaque tableau déclare ses colonnes dans un `*-columns.ts` ; une
colonne ajoutée là apparaît partout.

- **tout l'état vit dans l'URL** — une vue filtrée se met en favori, se partage,
  survit à un rechargement. C'est aussi ce qui permet de filtrer **en base** :
  la page est un composant serveur qui lit l'URL et interroge PostgreSQL ;
- **valeurs multiples** par colonne, **ET** entre colonnes ;
- **les valeurs distinctes sont comptées côté serveur**, sur une projection
  légère (huit petits champs), jamais en chargeant la table dans le navigateur ;
- **une colonne ne compte pas son propre filtre** — sinon le menu n'afficherait
  que les valeurs déjà cochées et il deviendrait impossible d'en ajouter une ;
- icône pleine quand un filtre est posé, bandeau « 54 sur 138 » avec
  réinitialisation.

Les paramètres se **répètent** (`f.lifecycle=Lead&f.lifecycle=Prospect`) plutôt
que d'être séparés par des virgules : un nom de société contient parfois une
virgule.

**Deux chemins pour une même règle** — SQL pour les lignes, mémoire pour les
comptes. C'est exactement le genre de duplication qui finit par diverger ; le
test de parité du jalon 12 la ferme. Les colonnes dérivées (agrégats de
`/societes` et tout `/clients`) sont marquées `derived` et appliquées après
lecture, sur les valeurs affichées.

### Étiquettes

Champ libre `tag` sur le contact, combobox qui propose les étiquettes déjà en
usage puis une liste de départ, création à la volée. Pas de table dédiée : une
table imposerait une jointure et un cycle de vie propre pour une valeur créée au
fil de l'eau. La contrepartie — renommer est un `updateMany`, supprimer une
remise à vide — est payée dans `/reglages`, où les deux actions annoncent le
nombre de fiches concernées **avant** d'agir.

L'étiquette n'entre pas dans `searchText` : chercher « devis » ne doit pas
remonter tous les « Devis envoyé ».

### `Perdu` : un statut, pas une suppression

Supprimer un prospect qui a dit non détruirait l'historique, fausserait le taux
de conversion et le ferait re-prospecter dans un an. C'est donc un cycle de vie,
**exclu par défaut** de `/contacts`, des puces de relance, du tableau
« dernière touche », des « Relances à venir » et du moteur d'alertes — et
accessible par sa propre puce, avec son historique intact.

Passer une fiche en `Perdu` efface sa relance et referme la tâche miroir :
laisser une échéance sur quelqu'un qui a refusé, c'est se rappeler de rappeler
quelqu'un qui a demandé qu'on ne le rappelle pas.

**`Ne souhaite plus être contacté` est une opposition ferme**, appliquée dans le
domaine (`lib/domain/lost.ts`) et non dans l'interface : un bouton grisé n'est
pas une garantie, l'API est appelée par les agents du conseil et par l'import,
qui ne voient aucun bouton. `runSequence()` refuse en 409, `proposedReminder()`
renvoie `null`, `logActivity()` consigne l'interaction sans poser la relance, et
l'outil `set_reminder` du conseil refuse. `/rapports` gagne la répartition des
motifs de perte.

### Jalon 10 — ce qui est vérifié

Contre un vrai PostgreSQL 16 et le serveur standalone :

- **le remplissage de migration** rejoué sur une base au schéma précédent
  contenant déjà des données : « Zénith Labs » devient `zenith labs …` ;
- « cosmetique », « cosmétique » et « COSMETIQUE » ramènent la même société ;
  un contact se trouve par le nom de sa société ;
- étiquette posée → visible dans `/api/tags`, filtrable, proposée ensuite ;
- « Contacts incomplets » → les fiches sans email **ni** téléphone et celles
  marquées « (à compléter) » ;
- `Perdu` → sort de « À relancer », relance effacée, historique intact, visible
  par sa puce ; `lifecycle=all` en montre 18, la vue par défaut 17 ;
- opposition ferme → séquence refusée en 409 avec le message du domaine, témoin
  sur un autre contact → 3 tâches créées ; interaction consignée sans relance ;
- filtres de colonne : `f.owner=Yanis` → « 10 sur 17 » ; en ajoutant
  `f.lifecycle=Lead` → « 2 sur 17 » (ET entre colonnes) ;
- lien LinkedIn rendu en `https://…`, `target="_blank"`, `rel="noopener noreferrer"` ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (368 tests) verts.

### Jalon 10 — ce qui ne l'est pas

~~**`/clients` n'a pas de filtres de colonne.**~~ **Fait au jalon 12.**

**`/societes` est passé d'une grille de cartes à un tableau.** Des colonnes
triables et filtrables l'imposaient. La lecture « trois nombres d'un coup d'œil »
du jalon 3 est perdue au profit de la comparaison ligne à ligne — c'est le bon
compromis à 133 sociétés, ce ne l'était pas à 12.

Les menus de colonne sont des composants client : leur comportement au clavier
n'a pas été vérifié par un navigateur piloté, seulement leur effet sur les
requêtes et sur le rendu serveur.

## Jalon 11 — correction des statuts, et import en mise à jour

### Ce que la feuille disait vraiment

Relecture en **lecture seule** de « CRM AURA FLOW AI », onglet « Liste de
prospection », 152 lignes. Deux constats ont décidé de tout le reste :

1. **La table des clients signés est vide.** Le classeur porte bien une table
   `Date Signature` / `CA Total (€)` / `Mois Actif` / `NPS /10` — sans une seule
   ligne. Aucun achat n'est prouvé nulle part. Les 27 fiches en « Ancien Client »
   venaient donc d'un mapping trop large au premier import, pas d'une réalité
   commerciale.
2. **Aucune opposition au démarchage n'apparaît.** Recherche sur les 152 lignes :
   pas de désinscription, pas de « ne me recontactez plus », pas de STOP. Les 21
   refus sont des « pas intéressé » commerciaux. **`Ne souhaite plus être
   contacté` n'a été attribué à personne** — c'est une opposition RGPD ferme, elle
   ne s'attribue pas par défaut.

### `Pas intéressé` rejoint les motifs

Vingt-et-un refus, aucun motif indiqué. Aucune des six valeurs existantes ne
convenait : `Ne répond plus` aurait été faux — ils ont répondu — et laisser vide
aurait privé le portefeuille de son motif majoritaire. La valeur nomme donc
exactement ce que la feuille dit : la personne a répondu, elle a dit non, on ne
sait pas pourquoi.

### Un script, pas une migration

`scripts/fix-lifecycles.ts` corrige des **valeurs**, sur la foi d'un tableur qui
n'est pas le schéma. Dans `prisma/migrations/`, il rejouerait sur toute base
neuve, y compris de test, où ces contacts n'existent pas.

La correspondance vit à côté, dans `scripts/corrections-2026-08.ts` : une
transcription, pas une règle. Chaque ligne porte son numéro dans la feuille et la
preuve qui a motivé la décision, pour qu'on puisse la contester sans rouvrir le
tableur.

Six garanties, dans l'ordre où elles comptent :

- **simulation par défaut** — sans `--apply`, rien n'est écrit ;
- **deux champs, jamais plus** — `lifecycle` et `lostReason`. Le `data` de
  l'`update` est court exprès : on doit pouvoir le lire d'un coup d'œil ;
- **idempotent** — une fiche déjà dans l'état visé est comptée « déjà à jour » et
  n'est ni réécrite, ni re-consignée ;
- **sauvegarde horodatée** des fiches concernées **avant** toute écriture ;
- **une interaction par fiche** — « Statut corrigé depuis la feuille de
  prospection : X → Perdu (motif). <preuve> » — pour que l'historique explique le
  changement dans six mois ;
- **une transaction** — une base à moitié corrigée serait pire que pas corrigée.

Le rapprochement se fait par adresse électronique, à défaut par nom + société
comparés sans accents ni casse. Une ligne introuvable ou correspondant à
plusieurs fiches est **signalée, pas appliquée**. Cinq lignes sans adresse sont
marquées « rapprochement incertain » dans la sortie.

### Les « Ancien Client » sans preuve d'achat

Ceux que la feuille ne mentionne pas retournent d'où ils viennent : `Prospect`
s'ils ont au moins une touche enregistrée (`lastContact` ou une interaction),
`Lead` sinon. C'est la seule distinction que la base permette de faire
honnêtement — elle ne sait pas ce qu'une feuille vide ne dit pas.

### L'import sait enfin mettre à jour

Case « Mettre à jour les contacts existants », **décochée par défaut** : un
import qui modifie l'existant sans qu'on l'ait demandé est une perte de données
qui ne dit pas son nom.

Cochée, une ligne qui correspond à une fiche existante la met à jour selon deux
règles strictes :

1. **une colonne absente du collage n'est pas touchée** — elle n'exprime aucune
   intention ;
2. **une cellule vide ne vide pas le champ** — sinon un tableur partiellement
   rempli effacerait des données qu'il ne prétendait pas modifier.

Rien n'est jamais supprimé. Le rapport distingue créés / mis à jour / ignorés et
**liste champ par champ ce qui a changé** : « 12 mis à jour » sans le détail
n'apprend rien.

**Défaut corrigé au passage** : l'import n'écrivait pas `searchText`. Les fiches
importées depuis le jalon 10 étaient introuvables à la recherche jusqu'à leur
prochaine modification.

### Jalon 11 — ce qui est vérifié

Contre un vrai PostgreSQL 16, sur une base chargée à l'image de la production
(146 contacts issus de la feuille, dont 27 en « Ancien Client ») :

- simulation : 53 fiches à modifier, 0 écriture, la ligne 37 (sans nom dans la
  feuille) signalée « introuvable » au lieu d'être devinée ;
- répartition obtenue : 20 `Pas intéressé`, 5 `Ne répond plus`, 2 `Pas le bon
  interlocuteur`, 1 `Concurrent`, 19 `Lead`, 6 `Prospect` ;
- application : sauvegarde écrite, 53 fiches corrigées, 53 interactions
  consignées, **0 fiche portant un téléphone, une note ou une étiquette modifiés** ;
- second passage : « 28 déjà à jour, 0 fiche à modifier » — idempotent ;
- import sans la case → 1 ignoré ; avec la case → 1 mis à jour, quatre
  changements listés ; colonne absente et cellule vide → champs conservés ;
  rejoué → 0 mis à jour ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (370 tests) verts.

### Jalon 11 — ce qui ne l'est pas

**Les chiffres ci-dessus viennent d'une base reconstituée, pas de la vôtre.** Le
nombre de fiches réellement corrigées en production dépendra des rapprochements :
la simulation sur la vraie base est le seul chiffre qui fasse foi. C'est
précisément à cela que sert le mode simulation.

La feuille n'a pas été modifiée et ne le sera pas par ce script : la
correspondance est figée dans le dépôt à la date de relecture. Si la feuille
évolue, il faut la relire et régénérer `corrections-2026-08.ts`.

## Jalon 12 — rattrapage, corrections depuis l'écran, parité des filtres

### `searchText` n'était écrit que par la moitié des chemins

Deux sources l'oubliaient : l'import de contacts et la création de société à la
volée (`company-resolve.ts`, utilisée aussi par les formulaires contact et
affaire). Toute fiche entrée par là depuis le jalon 10 était **introuvable à la
recherche** jusqu'à sa prochaine modification — sans rien d'anormal à l'écran.

Les deux sources sont corrigées, et `scripts/backfill-search.ts` rattrape
l'existant sur les trois tables.

Le rattrapage recalcule le miroir de **toutes** les lignes puis compare, au lieu
de chercher les seules colonnes vides : une fiche renommée avant l'existence du
miroir porte une valeur non vide *et* fausse. Chercher son nouveau nom échouerait
sans que rien ne paraisse anormal.

`searchText` étant dérivé — il ne porte aucune information qui ne soit ailleurs —
le recalculer ne peut rien perdre. D'où l'absence de sauvegarde préalable,
contrairement à une correction de statut.

### Une seule logique, deux façades

`lib/api/maintenance.ts` porte les deux corrections. `scripts/` et
`/api/maintenance` n'en sont que des façades. Écrire la règle deux fois — une
pour le terminal, une pour le bouton — c'est se garantir qu'elles divergeront le
jour où l'une sera corrigée seule.

### Le bouton n'est pas un pis-aller

Railway n'expose pas de terminal attaché au service. Sans `/reglages`, ces
corrections ne seraient exécutables que par quelqu'un ayant le dépôt, la CLI et
l'URL de la base sous la main — c'est-à-dire, en pratique, personne. Le panneau
est donc le chemin **normal** :

- « Simuler » lit et n'écrit rien ; le détail s'affiche fiche par fiche ;
- « Appliquer » renvoie le nombre attendu, **relu au moment d'écrire**. Si la
  base a bougé entre l'affichage et le clic, le serveur refuse plutôt que
  d'appliquer autre chose que ce qui a été validé à l'écran ;
- la sauvegarde des statuts **descend dans le navigateur** : le conteneur n'a pas
  de disque durable, un fichier écrit à côté disparaîtrait au déploiement suivant.

### La parité des filtres est enfin prouvée

Un filtre de colonne est appliqué deux fois : en SQL pour les lignes affichées,
en mémoire pour compter les valeurs distinctes. `column-filters-parity.test.ts`
exécute les deux sur le **même** jeu et compare les identifiants retenus, sur 20
cas couvrant chaque forme que `columnsWhere` sait produire.

La clause Prisma n'est pas envoyée à une base : elle est interprétée par un
évaluateur minuscule, **volontairement strict** — toute forme inconnue lève. Un
évaluateur permissif renverrait « vrai » par défaut et le test cesserait de
démontrer quoi que ce soit le jour où la traduction changerait de forme. Un test
vérifie d'ailleurs que l'évaluateur refuse bien ce qu'il ne connaît pas.

Éprouvé en introduisant deux divergences réelles : borne haute exclusive côté
SQL (2 cas tombent, nommés), et « (vide) » cessant de couvrir le nul (1 cas
tombe). Un troisième test vérifie que les cas filtrent réellement — sans lui,
une égalité entre deux ensembles complets serait vraie sans rien prouver.

### `/clients` a ses filtres, sans devenir un composant client

La table reste rendue côté serveur : le tri passe toujours par des liens. Le menu
de colonne **écrit lui-même dans l'URL** au lieu de recevoir un `onChange` — une
fonction ne franchit pas la frontière serveur → client, une lecture de l'URL si.

Toutes ses colonnes sont dérivées : le portefeuille est un agrégat d'affaires
gagnées, pas une table. Les filtres s'appliquent donc après lecture, sur les
valeurs exactement telles qu'elles sont affichées. Les totaux suivent le filtre —
« 3 sur 12 » s'accompagne du chiffre d'affaires de ces trois-là.

### Jalon 12 — ce qui est vérifié

Contre un vrai PostgreSQL 16, sur une base à l'image de la production :

- miroirs vidés → simulation « 279 lignes à corriger », 0 écriture ; après
  `--apply`, une recherche qui ne trouvait rien trouve ; rejoué → « 0 ligne » ;
- **0 fiche dont le téléphone, les notes, l'étiquette ou le motif ont bougé** ;
- panneau `/reglages` : simulation identique au script (53 fiches, 5 incertaines,
  1 avertissement) ; `expected: 999` → refus nommant l'écart ; application → 53
  corrigées, 53 interactions, sauvegarde de 53 fiches renvoyée ; rejoué → 0 ;
- `/clients` : sept icônes de filtre, « 8 sur 8 » puis « 0 sur 8 » en cumulant
  deux colonnes, bandeau de réinitialisation présent ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (393 tests) verts.

### Jalon 12 — ce qui ne l'est pas

Le panneau applique la correction **dans la requête HTTP**. À 53 fiches c'est
instantané ; à plusieurs milliers, la requête dépasserait le délai du proxy. Il
faudrait alors découper en lots — ce n'est pas le cas aujourd'hui et le code ne
prétend pas le contraire.

L'évaluateur du test de parité n'est pas PostgreSQL. Il reproduit ce que Prisma
fait des formes que `columnsWhere` produit, y compris `IN` avec `null` traduit en
`IS NULL` ; il ne remplace pas une exécution réelle, il rend la divergence
détectable sans base.

## Jalon 13 — le statut change au moment où l'on apprend quelque chose

### La décision de conception qui change

Le statut de relance était **entièrement dérivé** depuis le jalon 6 : calculé
depuis les dates, donc incapable de mentir — mais incapable aussi de dire ce
qu'on vient d'apprendre. Or le moment où l'on apprend quelque chose est celui où
l'on raccroche, pas un second passage sur la fiche qu'on oublierait.

Le champ est donc **stocké et facultatif** : `Contact.status` l'emporte quand il
est renseigné, `followUpStatus()` reprend la main quand il ne l'est pas. Les
fiches jamais touchées gardent exactement le comportement d'avant — ce
changement n'invente aucune information sur les contacts déjà en base. Vérifié :
147 contacts importés, 0 statut saisi, tous calculés.

`resolveStatus()` est la **source unique** de ce qui s'affiche, et
`ContactStatusTag` le seul composant qui le rend — tableau, tiroir, accueil,
portefeuille. Un libellé libre reste neutre : lui inventer une urgence à partir
d'un mot qu'on ne comprend pas serait pire que de n'en signaler aucune.

### Le formulaire d'interaction est devenu l'endroit où le statut change

`Résultat de l'échange` est obligatoire à l'écran (facultatif au schéma : un
import ou un agent n'en porte pas, et refuser ces écritures casserait l'import
pour un champ d'ergonomie). Il **propose** le reste — `proposalFor()`, pure et
testée :

| Issue | Statut proposé | Effet |
|---|---|---|
| Pas de réponse | Ne répond plus | — |
| Répondu — intéressé | Intéressé | cycle → Prospect |
| Répondu — à relancer plus tard | Relance prévue | curseur sur l'échéance |
| Répondu — pas intéressé | Perdu | cycle → Perdu, motif demandé, relance effacée |
| RDV obtenu | RDV pris | cycle → Prospect |
| Mauvais interlocuteur | Contacté — en attente | — |

Tout reste modifiable avant l'enregistrement, et **tout part dans la même
transaction** que l'interaction : interaction, statut, cycle de vie, motif,
relance et tâche miroir. Un écran, un moment, aucune seconde étape à oublier.

Deux garanties pour que le champ ne pourrisse pas : il est rafraîchi par l'acte
de travailler, et la puce **« Statut figé »** rassemble les fiches dont le statut
saisi est antérieur à leur dernière interaction.

### `/accueil` suit l'état de la base

Trois cartes de revenu à 0 € n'apprennent rien à quelqu'un qui n'a pas encore
créé d'affaire : elles occupent la place de ce qu'il fait réellement. Sans
affaire, elles cèdent la place aux indicateurs de prospection — contacts par
cycle, contactés cette semaine, taux de réponse, jamais contactés — et le bloc
« Affaires en sommeil » disparaît. Le revenu revient seul dès la première
affaire : l'écran suit l'état, il ne demande pas de réglage.

Le taux de réponse ne porte que sur les échanges dont l'**issue est connue** :
compter les interactions sans issue comme des non-réponses gonflerait l'échec
avec de la donnée manquante.

« À traiter maintenant » n'est plus une liste d'alertes répétant dix fois la même
phrase. Chaque ligne porte ce qui lui est propre — nom, société, **téléphone
cliquable**, jours de silence, dernier mot échangé tronqué — sous trois en-têtes
(Relances dues · Tâches en retard · Affaires bloquées), un groupe vide
disparaissant. Et trois actions en ligne : consigner un appel (le formulaire
ci-dessus, sans quitter la page), reporter à +3 j, marquer fait.

« Ma semaine » ajoute le seul chiffre qui dise si l'on a prospecté : relances
honorées contre relances en retard. Un compteur d'interactions seul ne distingue
pas l'activité de la discipline.

### Noms débordés à l'import

« Alexandra herrau, mais possible numéro de son équipe » est un nom *et* un
commentaire dans la même cellule. Deux signes suffisent à les repérer : une
longueur qu'aucun patronyme n'atteint, ou une virgule. Ils rejoignent la puce
« Contacts incomplets », et une simulation de `/reglages` propose de déplacer le
débordement dans les Notes — **ajouté** à ce qui s'y trouve déjà, jamais
substitué.

### Jalon 13 — ce qui est vérifié

Contre un vrai PostgreSQL 16, 147 contacts à l'image de la production :

- **statut calculé préservé** : 0 statut saisi sur les 147 fiches importées ;
- issue `à relancer plus tard` → statut « Relance prévue », `statusSetAt` posé,
  relance au 20/08, tâche miroir « Relancer Gregoire Rolland » — **une écriture** ;
- issue `pas intéressé` → cycle `Perdu`, motif `Budget`, relance effacée,
  **0 tâche de relance ouverte** ;
- l'issue est stockée sur l'interaction (`later`, `not-interested` en base) ;
- puce « Statut figé » → la fiche dont le statut précède la dernière interaction ;
- `/accueil` sans affaire → cartes de prospection, « Ma semaine », « Relances
  dues », « Consigner un appel », `href="tel:0611223344"`, « j sans contact »,
  **aucune carte de revenu** ;
- noms débordés → 27 fiches dans « incomplets », simulation de 2 coupes,
  application → nom « Alexandra herrau » + notes « mais possible numéro de son
  équipe », rejoué → 0 ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (413 tests) verts.

### Jalon 13 — ce qui ne l'est pas

**Les blocs de l'accueil ne sont pas repliables et ne mémorisent pas leur état.**
C'était demandé ; ce n'est pas fait. Le reste du bloc 2 l'est.

Les outils du conseil lisent `ContactRecord`, qui porte désormais `status` : ils
voient donc le statut saisi. Mais aucun **prompt** ne leur explique la différence
entre statut saisi et calculé — un agent pourrait le mentionner sans savoir ce
qu'il désigne.

La file d'action applique ses écritures dans la requête HTTP, sans file d'attente
ni reprise : une action qui échoue à mi-parcours laisse la page à rafraîchir à la
main.

### Journal des incidents

**Healthcheck en échec au premier déploiement** — build vert, conteneur démarré,
`service unavailable` sur les six tentatives. Cause : `HOSTNAME` défini par le
runtime de conteneur, Next se liant à l'identifiant du conteneur au lieu de
`0.0.0.0` (voir § Déploiement). Le défaut avait échappé à la vérification locale
parce que celle-ci forçait `HOSTNAME=0.0.0.0` — elle testait le correctif avant
qu'il existe. Corrigé par `scripts/start.sh`.

## Jalon 14 — le conseil en vacations

### Le renversement

Jusqu'ici le conseil était un chatbot : il ne savait rien tant qu'on ne lui
demandait rien. Un agent qui ne parle que lorsqu'on l'interroge ne remplace pas
un collègue, il remplace un moteur de recherche. Une **vacation** inverse la
charge : l'agent lit le CRM à heure fixe et laisse un constat écrit.

```
lib/domain/recommendations.ts   cycle de vie, déduplication, sommeil — pur, testé
lib/agents/shifts/briefing.ts   collecte déterministe des faits
lib/agents/shifts/prompt.ts     règles communes aux vacations
lib/agents/shifts/run.ts        une vacation, du briefing au journal
lib/api/recommendations.ts      lecture, décision, exécution après confirmation
app/api/cron/shifts/            point d'entrée du planificateur (secret propre)
app/conseil/suggestions/        la liste complète, filtrable, avec historique
components/recommendations/     la carte : preuves, décisions, actions
```

### Le modèle ne compte pas, il juge

`briefing.ts` fait les requêtes et rend une liste de faits déjà établis :
échéances dépassées, silences au-delà de `coldDays`, contacts touchés une fois
et jamais suivis, relances repoussées plus de trois fois. Le modèle reçoit des
identifiants et des libellés, et n'a plus qu'à décider **ce qui mérite d'être
dit**.

Trois conséquences, et c'est pour elles que le briefing existe :

1. **un compte faux devient impossible** — « 12 relances en retard » vient de
   PostgreSQL, pas d'une addition faite dans une complétion ;
2. **le silence est gratuit** — un briefing vide sort en `outcome: "empty"`
   **sans aucun appel à l'API**. Le cas le plus fréquent est le moins cher ;
3. **l'entrée est bornée** — 25 lignes par section, donc un coût prévisible
   quelle que soit la taille de la base.

### Une recommandation sans preuve n'existe pas

`isPublishable()` refuse d'écrire un constat sans preuve, et les preuves sont
résolues **deux fois avant l'écriture** : d'abord contre le briefing — un
identifiant que l'agent n'a pas reçu ne peut pas être cité — puis contre la
base. Ce qui ne résout pas est retiré ; si rien ne reste, la recommandation est
abandonnée.

Vérifié en faisant délibérément citer un identifiant inventé : le constat n'est
jamais arrivé en base. Sans cette double résolution, une preuve fausse produirait
un lien mort, c'est-à-dire une affirmation invérifiable — exactement ce que le
jalon interdit.

### Rien ne s'écrit, jamais, pendant une vacation

Une vacation n'appelle aucun outil d'écriture. Elle **propose** des actions, dont
les arguments sont validés contre le schéma réel de l'outil, et qui ne
s'exécutent qu'une par une, chacune derrière son bouton, après acceptation.

**Accepter n'exécute rien** : le statut passe à « accepté » et les actions
apparaissent. Accepter un constat et vouloir toutes ses conséquences ne sont pas
la même chose.

**Défaut trouvé à la vérification, pas à l'écriture.** La validation s'appuyait
d'abord sur `summarize()`, en supposant qu'il lèverait sur des arguments
invalides. Il ne lève pas : il retombe sur « <outil> — arguments invalides ». Une
action mal formée traversait donc toute la chaîne et n'échouait qu'au clic. Les
outils exposent désormais `accepts()`, et `executeProposedAction()` teste le
`ok` du résultat au lieu de le supposer — `run()` refuse en renvoyant
`{ok: false}`, sans lever non plus. Trois tests fixent ces trois comportements.

### La déduplication est une contrainte, pas une vérification

`dedupeKey` = agent + type de constat + identifiants cités **triés**. Le tri est
ce qui fait qu'un même constat sur les mêmes fiches produit la même clé quel que
soit l'ordre où le modèle les a listées. La clé est unique en base : un doublon
est impossible, pas seulement improbable.

Écarter pose une fenêtre de silence dont la durée vient du motif — « Pas
pertinent » 60 jours, « Déjà traité » 30, « Plus tard » 7. Un motif en un clic,
jamais un champ libre : c'est ce qui les rend comparables. Passé la fenêtre, le
constat peut revenir — s'il tient encore après deux mois, il méritait bien d'être
signalé.

### Le coût est plafonné avant l'appel, pas pendant

Le budget de jetons est configurable dans `/reglages` et vérifié **avant**
l'appel : on n'interrompt pas une complétion en cours, on refuse de la lancer.
Une vacation qui dépasserait sort en `skipped` **en le disant** — elle ne se tait
pas. Le journal porte la consommation cumulée du mois.

### Un échec est bruyant, et n'arrête pas la suite

La ligne de journal est créée **avant** la vacation et mise à jour dans tous les
cas, y compris l'échec. Un run silencieux qui a échoué est indiscernable d'un run
qui n'a rien trouvé — c'est précisément la confusion à éviter. Sacha qui échoue
n'empêche pas Alfred de passer.

### Ce que j'ai jugé mauvais d'automatiser

**Refusé — les huit agents en vacation.** Deux suffisent à établir si le format
vaut quelque chose. Huit agents produiraient huit fois plus de constats à trier
avant qu'on sache si le premier valait la peine d'être lu — et le risque d'un
outil pareil n'est pas de trop peu dire, c'est de devenir un bruit qu'on ferme.

**Refusé — expirer les recommandations toutes seules.** Le statut `expired`
existe au schéma mais rien ne le pose. Une recommandation qui disparaît sans que
personne l'ait lue est une alerte manquée, silencieuse.

**Refusé — laisser une vacation écrire, même « trivialement ».** Il n'y a pas
d'écriture triviale : poser une relance, c'est engager un démarchage.

**Refusé — réutiliser le mot de passe de l'espace pour le planificateur.** Un
secret placé dans la configuration d'un cron n'a pas le même cycle de vie qu'un
mot de passe humain. `CRON_SECRET` se change sans déconnecter personne, et fuiter
l'un ne donne pas l'autre.

**Refusé — laisser le modèle compter.** Voir le briefing plus haut.

**Refusé — le mode « approfondi » sur les vacations.** Une vacation quotidienne
doit être bon marché et prévisible. Le raisonnement long reste dans la
conversation, où quelqu'un l'a demandé.

### Statut saisi contre statut calculé, corrigé dans le prompt

Signalé au jalon 13 : les agents voyaient `status` sans qu'aucun prompt
n'explique son origine. `SHARED_RULES` porte désormais la distinction, et
l'interdiction qui va avec — **ne jamais conclure d'un libellé de statut qu'une
action a été faite ou non**. Un statut saisi dit ce que quelqu'un a observé ; un
statut calculé dit ce que les dates impliquent. Les confondre, c'est inventer.

### Le planificateur, côté Railway

Cron sur le service `crm`, `0 7 * * *` (fuseau du service : Europe/Paris),
appelant `POST /api/cron/shifts` avec `Authorization: Bearer $CRON_SECRET`.
Générer le secret avec `openssl rand -hex 32`. La route est publique au sens du
middleware — elle n'a pas de session — et fermée par son propre secret, comparé
à temps constant, répondant 401 et non une redirection.

### Jalon 14 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** et le serveur standalone de production, la
migration `5_shifts` appliquée puis `migrate diff` renvoyant une migration vide :

- **base vide** → 2 vacations `empty` « Rien à signaler. », **0 jeton consommé**,
  aucun appel émis ; Alfred passe bien après Sacha ;
- **secret** : sans en-tête et avec un mauvais secret → 401 ; `/api/shifts` sans
  session → 401 ;
- **preuves** → les constats citent des contacts réels (`p12`, `p15`), le lien
  `?fiche=p15` répond 200 ; un identifiant inventé est écarté, sa recommandation
  n'atteint jamais la base ;
- **action mal formée** → retirée, le constat survit avec sa seule action valide ;
- **accepter n'écrit rien** : `nextReminder` inchangé après acceptation ; après
  confirmation explicite → posé au 15/09 **et** tâche miroir
  « Relancer Élise Chartier » créée dans la même foulée ;
- **rejet** → la vacation suivante produit 0 et le constat ne revient pas ;
  un constat accepté n'est pas recréé ;
- **budget à 500** → `skipped` nommant l'écart (~2054 jetons), **avant l'appel** ;
- **journal** : durée (176 ms), jetons (1234 / 210), `produced`, `manual`, et la
  consommation mensuelle cumulée ;
- `/`, `/conseil/suggestions` et ses filtres, `/reglages` → 200 ; « Le point
  d'Alfred » rend le titre, la preuve et son lien `?fiche=` ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (431 tests) verts.

### Jalon 14 — ce qui ne l'est pas

**Aucun appel Anthropic réel.** `ANTHROPIC_API_KEY` n'existe pas dans cet
environnement. Tout ce qui entoure l'appel — briefing, plafond, résolution des
preuves, déduplication, journal, décisions, exécution — a été exercé contre la
vraie base, en substituant à l'API un serveur local via `ANTHROPIC_BASE_URL`.
Ce qui n'est donc **pas** établi ici : que Sacha *juge bien*, qu'il choisisse la
bonne sévérité et qu'il sache se taire quand le briefing ne porte rien de grave.
Le sens du silence relève du modèle et du prompt — c'est ce que la première
vraie vacation en production doit établir.

**Le budget est estimé, pas mesuré**, à quatre caractères par jeton. Il sert à
refuser un appel manifestement trop gros, pas à facturer. Le plafond porte sur
l'entrée estimée et sur `max_tokens` en sortie ; il ne borne pas une facture.

**Les blocs de l'accueil ne sont toujours pas repliables** — demandé au jalon 13,
toujours pas fait.

**La file d'action écrit toujours dans la requête HTTP**, sans reprise.

**Un seul planificateur, sans reprise sur échec.** Si le cron ne se déclenche pas
du tout — service arrêté, Railway en panne — rien ne le signale : le journal ne
peut montrer que les runs qui ont eu lieu. Une vacation manquée est invisible.

## Jalon 15 — l'identité du conseil devient de la donnée

### Le partage : ce qui décide du comportement, ce qui décide de l'apparence

| | Où | Modifiable depuis l'écran |
|---|---|---|
| `slug`, personnalité, outils, verrou, périmètre | `lib/agents/registry.ts` + `lib/agents/prompts/<slug>.ts` | non |
| nom, rôle affiché, photo, ordre, cadence, activation | table `agents` / `agent_photos` | oui |

Les deux se rejoignent dans `lib/api/agents.ts`, et nulle part ailleurs. Comme
le prompt est retrouvé **par le slug**, renommer un agent ne peut pas changer ce
qu'il fait — c'était la condition posée, et c'est la seule chose que cette
séparation achète vraiment.

`slug` n'est pas éditable, et ce n'est pas un oubli : il indexe le prompt, les
conversations, les recommandations et les vacations. Le rendre modifiable
transformerait un renommage en migration de données.

### Sacha devient Sarah, Alfred devient Sabrina

Un renommage de slug, donc une reprise de données — c'est précisément ce qu'on
s'interdit désormais, et la migration `6_agents` est là pour qu'il n'y ait à le
faire qu'une fois. Elle réécrit `agentId` dans `conversations`,
`recommendations` et `shift_runs`, **et** le préfixe des `dedupeKey` : sans ce
dernier point, chaque constat de Sarah serait revenu une fois sous sa nouvelle
clé, ce qui aurait ressemblé à une panne de déduplication.

Les briefings sont renommés d'après ce qu'ils collectent — `followUpBriefing`,
`qualityBriefing` — et non d'après l'agent. Un périmètre ne change pas de nom
parce qu'une personne en change.

### Les personnalités ne contiennent plus aucun nom

Chaque prompt s'ouvrait sur « Tu es Sacha, responsable Sales & Closing ». Un
nom réglable et un nom figé dans un fichier finissent toujours par se
contredire : l'écran aurait affiché Sarah pendant que l'agent se serait présenté
comme Sacha. L'identité est donc **injectée** par `buildSystemPrompt`, et la
liste des collègues avec elle — un renvoi vers un nom écrit en dur désignerait
tôt ou tard quelqu'un qui n'existe plus.

Un test parcourt les huit personnalités et échoue si l'une d'elles contient
encore « Tu es <un nom d'agent> ».

Les initiales du repli sont **calculées** depuis le nom, jamais stockées : des
initiales enregistrées à côté finiraient par le contredire — « Sabrina »
affichée « AL ».

### Les portraits vivent dans PostgreSQL

Le disque du conteneur Railway est effacé à chaque déploiement : un fichier
écrit à côté ne survivrait pas au prochain `git push`. PostgreSQL est le seul
stockage durable du projet, et huit portraits n'y pèsent rien — 227 Ko pour le
plus gros.

**Table séparée, volontairement.** `agent_photos` n'est jamais lue par
`listAgentProfiles()`, qui tourne à chaque rendu de `/conseil` et de
`/reglages` : seules l'existence et la version remontent. Garder les octets dans
`Agent` ferait voyager les portraits à chaque `findMany`, y compris là où
personne ne les affiche.

**L'image n'est jamais conservée telle quelle** — décodée, redimensionnée,
réencodée par `sharp`. Trois effets, dans l'ordre où ils comptent : ce qu'on
sert ne transporte plus de charge utile exotique ; les métadonnées EXIF
disparaissent, dont la géolocalisation qu'un téléphone glisse dans chaque
photo ; et le poids servi devient prévisible.

Deux tailles × deux encodages : portrait 600×900 `fit: inside` (jamais agrandi,
jamais déformé), vignette 128×128 `cover` cadrée sur l'attention, en WebP avec
repli JPEG choisi sur l'en-tête `Accept`.

**SVG est refusé**, et c'est le seul refus qui mérite une phrase : c'est une
image pour un navigateur, mais un document capable de porter du script. Servi
depuis notre propre domaine, il s'exécuterait dans la session. La liste des
types acceptés est donc fermée, jamais un test sur le préfixe `image/`.

**Le cache tient au jeton de version dans l'URL.** `?v=<empreinte>` désigne un
contenu immuable : remplacer la photo change l'empreinte, donc l'URL. Un an de
cache ne peut donc pas servir une photo périmée. Sans jeton, on retombe sur une
revalidation systématique — seule façon honnête de rester frais. L'ETag inclut
la taille *et* l'encodage : deux navigateurs qui reçoivent des octets différents
ne doivent pas partager une empreinte.

### L'agent en pied plutôt qu'en pastille

`/conseil` gagne une colonne de gauche : portrait vertical, nom en grand, rôle,
périmètre en une phrase, et les trois faits qui disent si l'agent travaille —
dernière vacation, constats en attente, cadence. En dessous, ses recommandations
avec accepter / écarter / plus tard, pour pouvoir travailler avec lui sans
quitter la vue.

Le roster passe du cercle de 32 px à une vignette 3/4 : un cercle rogne le front
et le menton, c'est-à-dire ce qui rend un visage reconnaissable.

Sous `lg`, la colonne devient un bandeau et le roster une bande défilante
horizontalement — changer d'agent reste possible sur un téléphone, et la
conversation garde la largeur.

**Le repli est généré, pas téléchargé** : initiales sur le fond de couleur de
l'agent, sans requête ni instant où la case reste vide. Un agent sans photo
occupe exactement la même place qu'un agent qui en a une, ce qui est la seule
façon d'empêcher la mise en page de sauter quand on ajoute un portrait.

Chaque portrait porte un texte alternatif qui nomme la personne **et** son rôle,
produit par une seule fonction — `portraitAlt()` — pour qu'aucune des trois
surfaces ne puisse livrer une image muette.

### Jalon 15 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** et le serveur standalone de production, la
migration appliquée sur une base portant déjà des données au format précédent,
puis `migrate diff` renvoyant une migration vide :

- **reprise des identifiants** : 2 recommandations et 2 vacations en `sacha` /
  `alfred` deviennent `sarah` / `sabrina`, **clés de déduplication comprises** ;
- **huit agents semés**, dans l'ordre, avec leur cadence ;
- **JPEG de 4,3 Mo** → accepté, servi en WebP 600×900 de 227 Ko et vignette
  128×128 de 3,6 Ko ; **PDF** → refusé en le nommant ; **PDF renommé en
  `image/jpeg`** → refusé au décodage, pas au type déclaré ; **7,9 Mo** →
  refusé en donnant le poids et la limite ;
- **cache** : `?v=…` → `max-age=31536000, immutable` ; sans jeton →
  `no-cache, must-revalidate` ; `If-None-Match` → **304 sans corps** ; le même
  ETag présenté pour un autre encodage → 200, pas 304 ;
- **privé** : sans session, le portrait répond 401 ; sans photo, 404 ;
- **renommage** : « Sarah Lemoine / Relance & Closing » apparaît dans le roster,
  en pied, dans les réglages, **et en tête du prompt système** — vérifié : la
  première ligne devient « Tu es Sarah Lemoine, Relance & Closing d'AuraFLOW
  AI. », et ni « Sacha » ni « Alfred » n'y subsistent ;
- **le bloc d'accueil suit** : renommer l'agent d'arbitrage fait passer le titre
  de « Le point de Sabrina » à « Le point de Sabrina Roche » ;
- **redémarrage conteneur** (disque neuf, même base) → portrait servi à
  l'identique, 227 442 octets, nom conservé ;
- **repli** : 8 blocs d'initiales rendus pour les agents sans photo, aucun
  espace vide ; Étienne verrouillé rend son portrait désaturé avec le cadenas ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (448 tests) verts.

### Jalon 15 — ce qui ne l'est pas

**L'historique des conversations n'est pas atteignable sous `lg`.** La colonne
est masquée sur mobile au profit de la conversation. Choisir un agent et lui
parler fonctionne ; retrouver un échange d'avant-hier demande un écran large.

**Le rendu visuel n'a pas été comparé à une référence.** Le recadrage `attention`
de `sharp` choisit la zone la plus saillante, ce qui marche bien sur un portrait
et moins bien sur une photo de groupe. Ce qui est vérifié, ce sont les
dimensions, les formats et les poids — pas que le visage soit bien centré.

**Aucune limite au nombre d'envois.** Rien n'empêche de remplacer un portrait
mille fois de suite ; chaque envoi remplace le précédent, donc la base ne
grossit pas, mais le temps processeur du redimensionnement n'est pas compté.

**Les six autres agents n'ont toujours pas de vacation** — seules Sarah et
Sabrina en portent une. Leur cadence est réglable dans l'écran, mais seule la
valeur de ces deux-là est lue par `SHIFTS` ; changer la cadence de Victor
n'aura aucun effet tant qu'il n'est pas câblé. C'est un réglage qui promet plus
que ce que le code tient, et c'est la principale dette de ce jalon.

## Incident — le premier appel Anthropic réel, et un 400 muet

**Signalé** : la clé posée dans Railway, l'erreur passe de « clé non configurée »
à « L'API Anthropic a renvoyé une erreur (400) ». La clé est donc lue et la
requête atteint Anthropic ; c'est le corps qui est refusé.

### Le vrai défaut : le corps d'erreur était jeté

L'API renvoie un JSON qui **nomme le champ fautif**. `describeAnthropicError`
n'en gardait que le code HTTP. Un aller-retour de débogage entier a été perdu
pour une information que le serveur avait déjà reçue et jetée.

Corrigé : `anthropicFailure()` extrait statut, `type`, `message` et
`request_id` ; `logAnthropicError()` les journalise côté serveur — sans la clé,
qui n'est jamais lue à cet endroit ; `describeAnthropicError()` remonte le
message de l'API dans la carte française. Les deux chemins d'appel passent par
là, et le journal des vacations porte désormais le même message, pas seulement
« error ».

**Un message reste volontairement générique** : une clé refusée (401). Elle se
corrige dans les variables du service, le corps de l'API n'ajoute rien et
citer « invalid x-api-key » ressemble à une fuite. Un test fixe cet écart.

### Ce que j'ai pu établir sur la cause, et ce que je n'ai pas pu

J'ai vérifié la requête champ par champ contre la référence de l'API **et**
contre les types du SDK installé, en capturant ce qui part réellement sur le
fil (serveur local en lieu et place d'`api.anthropic.com`) :

```json
{ "model": "claude-opus-5", "max_tokens": 4096,
  "thinking": { "type": "adaptive", "display": "omitted" },
  "output_config": { "effort": "medium" }, "stream": true }
```

`claude-opus-5` est un identifiant valide ; `thinking.display` est typé
`'summarized' | 'omitted' | null` dans le SDK ; `output_config.effort` accepte
`medium` ; aucun paramètre retiré sur Opus 5 (`budget_tokens`, `temperature`,
`top_p`, `top_k`) n'est envoyé nulle part dans le dépôt ; les 20 schémas
d'outils sont du JSON Schema valide, aux noms conformes ; les messages font
l'aller-retour en base sans être modifiés.

**Je n'ai donc pas pu nommer le champ depuis cet environnement** : par le
contrat publié, ce corps est valide, et aucune clé n'est disponible ici pour
interroger le validateur réel. Ce que je peux affirmer, c'est ce qui *n'est pas*
en cause — la liste ci-dessus — et que la réponse tient dans un corps HTTP que
le code jetait. D'où le diagnostic ci-dessous plutôt qu'une liste d'hypothèses.

### Le diagnostic nomme le champ, par bissection

`/reglages` → « Connexion à l'API » → **Tester la connexion à l'API**. La route
envoie cinq requêtes de 16 jetons, chacune ajoutant **un** paramètre à la
précédente : minimale → `thinking` → `output_config` → `system` → `tools`. La
première qui échoue désigne le champ ajouté à cette étape et affiche le message
de l'API et le `request_id`. Les suivantes sont marquées « non exécutée » :
après une rupture, une forme plus riche échouerait aussi et n'apprendrait rien.

`POST` et non `GET` : la route dépense des jetons, et une route qui coûte de
l'argent ne doit pas répondre à un préchargement de navigateur.

### Deux défauts trouvés en chemin

**Les deux chemins d'appel avaient divergé.** La conversation posait `thinking`
et `output_config` ; la vacation ne posait ni l'un ni l'autre et héritait donc
en silence des défauts du modèle — réflexion active et **effort `high`**. Une
seule des deux formes était réellement exercée, et l'autre payait tous les
matins un raisonnement approfondi que personne n'avait demandé.
`lib/agents/runtime/request.ts` est désormais le seul endroit où le modèle, le
plafond, la réflexion et l'effort se décident ; une vacation tourne à effort
`low` **explicitement** — elle juge un briefing déjà calculé.

**Le plafond de sortie était celui d'un modèle sans réflexion.** Sur Opus 5 la
réflexion partage `max_tokens` avec le texte : 4096 ne produisait pas une
réponse courte mais une réponse *tronquée*. Porté à 32000 pour la conversation,
et planchérisé à 2000 pour les vacations — dont le budget réglable descendait à
500, soit un plafond que le modèle aurait épuisé en réfléchissant. Le minimum du
réglage est maintenant ce plancher : proposer à l'écran une valeur que le
runtime relèverait en silence serait mentir.

### Ce qui est vérifié

Contre un vrai PostgreSQL 16, le serveur standalone de production, et un
serveur local substitué à l'API pour rejouer un refus sur un champ choisi :

- refus sur `tools` → la bissection s'arrête à l'étape 5 et cite
  « tools.3.input_schema: maximum is not permitted » ;
- refus sur `thinking` → s'arrête à l'étape 2, les trois suivantes « non
  exécutée », `request_id` affiché ;
- API injoignable → « Même la requête minimale est refusée », rien de deviné ;
- tout accepté → cinq étapes vertes, verdict explicite ;
- carte de `/conseil` : « L'API Anthropic a refusé la requête (400) :
  thinking: unexpected value at thinking.display (requête req_mock01) » ;
- journal serveur : `status=400 type=invalid_request_error request_id=…
  message=…`, **sans la clé** ;
- journal des vacations : le même message, à la place de « error » ;
- budget 500 → 400 nommant le champ ; 4000 → accepté ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (459 tests) verts.

### Ce qui ne l'est pas

**Aucun appel Anthropic réel, encore une fois** : il n'y a pas de clé dans cet
environnement, et le proxy sortant n'en fournit pas. Les refus ont été rejoués
par un serveur substitué. Ce que cela vérifie : l'extraction du corps, la
bissection, l'affichage, le journal. Ce que cela ne vérifie pas : **quel** champ
la vraie API refuse — c'est précisément ce que le bouton dira au premier clic.

**`vitest` neutralise `server-only`** (`tests/stubs/server-only.ts`) pour
pouvoir tester les modules serveur. La garde réelle est celle du build Next, et
`no-key-in-bundle.test.ts` continue de vérifier la sortie de build — le
résultat, pas l'intention.

## Incident (suite) — la cause nommée : une clé de propriété accentuée

Le diagnostic du jalon 16 a désigné le champ au premier clic, en production :

```
tools.8.custom.input_schema.properties:
  Property keys should match pattern '^[a-zA-Z0-9_.-]{1,64}$'
request_id req_011CdsMXremN2hD6UBeHU9p2
```

Les étapes 1 à 4 passaient — modèle, `thinking`, `output_config`, `system` sont
donc hors de cause, et la question du modèle et du crédit est réglée. Seul
`tools` échouait.

### Un seul outil, une seule clé

Audit des vingt outils, **à tous les niveaux de `properties`** et sur les noms
d'outils : une seule violation. `list_neglected_contacts` — l'indice 8, celui
que l'API nommait — déclarait une propriété **`catégorie`**. L'accent la met
hors du motif, et une seule clé fautive fait rejeter la requête entière : ce
n'était pas cet outil qui était cassé, c'était le conseil au complet.

Les dix-neuf autres étaient conformes. Le français y était déjà là où il ne
gêne pas : dans les `description`, et dans les **valeurs de retour** des outils
(`société`, `propriétaire`, `cycleDeVie`), qui sont du contenu et non des
identifiants — la contrainte ne porte que sur les clés de `properties` du
schéma d'entrée. Elles restent en français.

`catégorie` devient `category`, et le sens part dans `describe()` : « Catégorie
de contacts oubliés : silent = sans nouvelles, never = jamais contacté. » Le
modèle lit la description, pas l'identifiant — on ne perd rien.

### La garde, et pourquoi elle appartient à vitest

`lib/domain/tool-schema.ts` porte la règle, pure : `inspectTool(nom, schéma)`
rend toutes les violations, en descendant dans `anyOf`, `items` et les objets
imbriqués. `tool-schema-guard.test.ts` la passe sur les vingt outils.

**Éprouvée en réintroduisant le défaut exact** : le test tombe en nommant
`list_neglected_contacts → .properties.catégorie`. Six autres cas fixent ce
qu'elle doit attraper — accent imbriqué, clé dans un `anyOf`, espace,
apostrophe, clé de 65 caractères, nom d'outil fautif.

C'est la leçon du test de parité SQL/mémoire : **une contrainte qu'on ne peut
vérifier qu'en production n'est pas vérifiée.** Celle-ci est purement
syntaxique, elle n'avait aucune raison d'attendre un appel réel.

### Le substitut mentait deux fois

Il vivait dans un dossier temporaire, non versionné, et acceptait tout : il a
validé quatre jalons durant une requête que l'API refusait. Il est maintenant
`scripts/mock-anthropic.ts`, versionné, et il **tire sa validation de
`lib/domain/tool-schema.ts`** — le module du test de garde. Deux copies de la
règle divergeraient, et c'est ainsi que le défaut a survécu. Il reproduit le
format réel, index de l'outil compris.

**Second mensonge, découvert en vérifiant** : il ne répondait qu'en JSON. Le
chemin de conversation appelle `messages.stream()` et échouait sur « request
ended without sending any chunks ». Autrement dit, **le chemin de conversation
n'avait jamais été exercé localement** — seules les vacations, qui sont
non-streamées, l'étaient. Le substitut émet désormais du SSE.

### Ce qui est vérifié

Contre un vrai PostgreSQL 16, le serveur standalone de production, et le
substitut qui valide comme l'API :

- audit des 20 outils → **une seule** violation, `list_neglected_contacts.catégorie`,
  exactement l'indice 8 signalé par l'API ; zéro après correction ;
- garde éprouvée en réintroduisant `catégorie` → échec nommant outil, clé et motif ;
- substitut : l'ancien corps → `tools.1.custom.input_schema.properties: Property
  keys should match…` ; `temperature` → refusé ; `messages: []` → refusé ;
- **diagnostic : les cinq étapes en 200**, `tools` comprise ;
- **conversation avec Sarah** : flux SSE, texte reçu, `done`, réponse persistée ;
- **vacation manuelle** : Sarah `ok`, 1 recommandation, 2 preuves réelles
  cliquables, la preuve inventée écartée, l'action mal formée retirée (1 sur 2) ;
- outil renommé exercé contre la base : `silent` → 4 contacts, `never` → état
  vide nommant sa règle, ancienne clé `catégorie` → refusée ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (468 tests) verts.

### Ce qui ne l'est pas

**Toujours aucun appel Anthropic réel depuis cet environnement.** Le substitut
applique désormais les contraintes connues — celles que la production nous a
apprises — mais il ne peut pas connaître celles qu'elle ne nous a pas encore
opposées. Il rattrape ce qui a été payé une fois ; il ne prédit pas le reste.
Le bouton de `/reglages` reste le seul juge.

## Jalon 18 — le fil s'ouvre comme une conversation, pas comme un outil

### Ce qui manquait

Une conversation vide affichait une phrase et un champ de saisie. Il fallait
inventer sa première question, et changer d'agent demandait de traverser
l'écran jusqu'au roster de droite. Rien n'était cassé — c'était simplement un
outil, là où le produit promet une équipe.

```
components/agents/agent-switcher.tsx  bande de portraits en tête du fil
components/agents/welcome.tsx         écran d'ouverture d'un fil vide
lib/agents/starters.ts                quatre amorces par agent, par slug
```

### Les amorces viennent du périmètre, pas d'un gabarit

Quatre par agent, dans sa voix. « Que peux-tu faire ? » se répond par une liste
et n'engage à rien ; « Qui ai-je oublié ? » désigne un travail réel et produit
une réponse exécutable dans la minute. Le sous-titre dit **ce qu'on obtient**,
pas ce que la question veut dire.

Elles vivent avec la personnalité — code indexé par slug — et non en base :
ce sont des amorces vers ce que l'agent *sait lire*. Les changer demande de
savoir quels outils lui sont ouverts, donc c'est une décision de développement,
pas un réglage.

Un test ferme le piège du gabarit : **aucune question n'appartient à deux
agents**, et quatre formules creuses (« Que peux-tu faire », « Bonjour »,
« Présente-toi », « Aide-moi ») sont refusées. Recopier les mêmes quatre
questions partout ferait tomber la suite.

### Deux tailles, pas trois

La bande et les bulles utilisent `thumb` ; l'écran d'ouverture utilise
`portrait`. Ce sont les deux tailles déjà en base — le cadrage rond est une
affaire de CSS, pas de stockage. Vérifié à l'octet : la page de `/conseil` ne
demande que `size=thumb`, et l'accueil `size=portrait`.

Le repli initiales devient rond ici et reste rectangulaire dans le roster : le
même composant, deux cadrages. Un agent sans photo occupe exactement la même
place — c'est ce qui empêche la bande de sauter quand on en charge une.

### Le portrait ne se répète pas

Deux réponses consécutives du même agent n'affichent le portrait qu'une fois :
le répéter hacherait une réponse longue en tranches sans rien apprendre. La
gouttière reste réservée, sinon la colonne de texte danserait d'un message à
l'autre.

**Éprouvé en cassant le groupement** (`showPortrait={true}`) : le test tombe en
annonçant trois portraits là où il en faut un.

### Changer d'agent ouvre un fil neuf

Ce n'est pas une commodité, c'est une contrainte : la conversation porte
`agentId` en base, et rejouer un historique sous un autre prompt produirait une
réponse qui contredit le nom affiché au-dessus. La bande et le roster partagent
donc le même gestionnaire — deux chemins vers un seul comportement.

### Jalon 18 — ce qui est vérifié

Contre un vrai PostgreSQL 16 et le serveur standalone, sur une base où **seule
Sarah a une photo** — les sept autres exercent le repli :

- **accueil de Sarah** : « Sarah Lemoine, à votre service. », portrait
  `size=portrait` rond de 200 px, `alt="Portrait de Sarah Lemoine, Relance &
  Closing"`, et ses quatre amorces avec leurs sous-titres exacts ;
- **amorce cliquée** → envoyée comme message, l'écran cède la place au fil, et
  le titre de la conversation en est déduit (« Qui ai-je oublié ? ») ;
- **groupement** : trois réponses consécutives → un portrait ; l'utilisateur
  reprend la parole → il réapparaît ; aucun portrait sur ses propres messages ;
- **bande** : les huit agents dans l'ordre, l'actif `aria-selected="true"`, les
  autres à 45 % d'opacité ; désactiver un agent le retire de la bande ;
- **Étienne verrouillé** : `grayscale opacity-55` et le cadenas ;
- **sans photo** : sept replis initiales, `alt` nommant agent et rôle, rien de
  cassé ;
- **deux tailles seulement** : `/conseil` ne demande que `size=thumb`, l'accueil
  `size=portrait` — aucune troisième taille ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (481 tests) verts.

### Jalon 18 — ce qui ne l'est pas

**Le comportement au clavier n'est pas vérifié par un navigateur piloté.** La
bande porte `role="tablist"` et `aria-selected`, mais la navigation aux flèches
entre onglets — ce qu'un vrai `tablist` implique — n'est pas implémentée : on
tabule d'un portrait à l'autre. C'est utilisable, ce n'est pas conforme au
motif ARIA complet.

**Le rendu visuel n'a pas été comparé à une référence** : ce qui est vérifié,
ce sont les classes, les tailles demandées et les textes, pas l'aspect.

**Les amorces ne s'adaptent pas à l'état de la base.** « Qui ai-je oublié ? »
s'affiche même si personne n'est oublié ; c'est l'agent qui le dira. Les rendre
conditionnelles demanderait de calculer quatre briefings avant d'afficher un
écran vide — le coût dépasse le gain.

## Jalon 19 — le filet : fusion, sauvegardes, planificateur

Aucune fonctionnalité. Les deux choses qui pouvaient coûter le projet — un
travail jamais fusionné, une base sans sauvegarde — et le planificateur qui
manquait aux vacations.

### Ce que coûte la fusion vers `main`

La branche touche **17 fichiers hors de `crm/`**, tous datant du début de la
session — l'intégration Pipedream et les correctifs du crash Railway du
backend, demandés avant que la règle « aucun fichier hors de `crm/` » n'existe.
Ce ne sont pas des débordements de jalon, c'est du travail commandé.

Deux conséquences réelles, à connaître avant de cliquer :

**1. La configuration de déploiement de l'app Vite disparaît de la racine.**
La branche supprime `railway.json`, `nixpacks.toml`, `server.js` et `Procfile`
(commit `6121b41`, « retirer la configuration de déploiement de l'app Vite
retirée »). Si le service Railway `AGENT-IA` à Root Directory vide est **encore
déployé**, il perdra sa commande de démarrage au prochain déploiement depuis
`main`. Le code de l'app Vite (`src/`, `index.html`, `vite.config.js`) reste,
seule la configuration de déploiement part. À vérifier avant de fusionner : ce
service tourne-t-il encore ? S'il est déjà supprimé côté Railway, il n'y a rien
à craindre.

**2. Le service `backend/` change de commande de démarrage.**
`uvicorn main:app` devient `python main.py`, `backend/Procfile` est supprimé et
les dépendances sont réduites. Ce sont les correctifs du 502 — donc si le
service backend déploie depuis `main`, la fusion le **répare** ; s'il déploie
déjà depuis cette branche, elle ne change rien pour lui. Dans aucun cas elle ne
le casse : `backend/railway.json` et `backend/nixpacks.toml` restent cohérents
entre eux.

**Rien dans le code ne dépend du nom de branche.** La bannière de démarrage et
le pied de page lisent `RAILWAY_GIT_BRANCH`, que Railway renseigne seul :
repointer le service sur `main` change ce qui s'affiche, pas ce qui s'exécute.

### Où vivent les sauvegardes, et pourquoi

Le job compte moins que la destination. Le conteneur Railway n'a pas de disque
durable, et écrire les instantanés dans le PostgreSQL qu'ils sauvegardent ne
protège de rien : la panne assurée emporterait les deux.

| Destination | Pour | Contre |
|---|---|---|
| **Dépôt GitHub privé** *(retenu)* | Gratuit, hors de Railway, consultable et téléchargeable dans un navigateur, aucun fournisseur nouveau | Git conserve l'historique : une sauvegarde « élaguée » reste dans les commits passés |
| Objet S3 (R2, B2) | Suppression réelle, donc rétention réellement effective | Un compte de plus ; **non implémenté** — je n'ai pas de quoi l'exercer ici |
| Second volume Railway | Simple | Même compte, même projet : la panne qu'on assure peut l'emporter |
| Le PostgreSQL du CRM | — | Ne protège de rien. Écarté d'emblée |

**Retenu : dépôt GitHub privé**, via l'API Contents. La réserve sur
l'historique est réelle et mérite d'être dite : pour 147 personnes réelles, une
demande d'effacement se réglerait en supprimant le dépôt entier, pas en
élaguant un fichier. Si cela devient gênant, S3 est la migration — le pilote
s'ajoute derrière l'interface `SnapshotStore` sans toucher au reste.

**Aucun pilote S3 écrit à l'aveugle.** Un pilote de sauvegarde non testé est
pire qu'une absence de pilote : il rassure. Le pilote `local` existe pour la
vérification et **annonce à l'écran** qu'il ne protège de rien.

**Aucun repli silencieux non plus** : mal configuré, on le dit et on journalise
l'échec. Une sauvegarde qu'on croit partie chez GitHub et qui atterrit sur un
disque effacé au déploiement suivant est exactement le faux filet à éviter.

### Le format est celui de l'export manuel

`exportBackup()` produit, `backupSchema` valide, `restoreBackup()` remet en
place — le chemin transactionnel du jalon 5, refus sur fichier corrompu
compris. Un second format aurait fini par diverger, et on s'en apercevrait en
essayant de restaurer, c'est-à-dire le jour où l'on ne peut plus se le
permettre.

### Rétention : union, pas intersection

14 quotidiennes **et** 8 hebdomadaires (les lundis), l'**union** étant
conservée. Avec l'intersection, une semaine sans sauvegarde quotidienne
effacerait aussi l'hebdomadaire, et le filet se refermerait au pire moment.
Un test fixe ce cas précis.

### Le planificateur : GitHub Actions

Le cron de Railway relance la **commande de démarrage** d'un service ; il
n'émet pas de requête HTTP et ne peut donc pas appeler `POST /api/cron/daily`.
Il aurait fallu un second service dont la seule raison d'être est un `curl`,
avec sa facture et ses journaux à aller chercher.

`.github/workflows/auraflow-daily.yml` : gratuit, tracé, un échec visible dans
l'onglet Actions. `permissions: {}` — le workflow ne fait qu'un appel sortant
et n'a aucun droit sur le dépôt. Deux secrets de dépôt : `CRM_URL` et
`CRON_SECRET`.

**La sauvegarde passe avant les vacations**, et l'ordre est le sujet : elle
capture l'état d'avant tout ce que la journée écrira, et elle a lieu même si
les vacations échouent. L'inverse ferait dépendre le filet de sécurité d'un
appel à un modèle.

`0 5 * * *` en UTC — 07:00 à Paris en été, 06:00 en hiver. GitHub ne connaît
que l'UTC ; l'heure locale dérive d'une heure au changement d'heure, sans
conséquence pour un passage quotidien.

### Un défaut trouvé par le test, pas par l'écran

Le bandeau d'alerte était rendu dans le corps de la page d'accueil — **après**
les retours anticipés « base vide » et « base injoignable ». Autrement dit il
disparaissait exactement dans les deux situations où une sauvegarde périmée est
le plus grave. Il vit maintenant dans la coquille `Shell`, que toutes les
branches traversent, et `snapshotHealth()` est calculé avant elles.

### Jalon 19 — ce qui est vérifié

Contre un vrai PostgreSQL 16, la migration `7_snapshots` appliquée puis
`migrate diff` renvoyant une migration vide :

- **sauvegarde** → `crm-2026-08-09.json`, 45 002 octets, listé avec sa date et
  son poids ;
- **restauration réelle** : 18 contacts, 24 affaires et 32 interactions
  supprimés, puis intégralement rétablis depuis l'instantané ;
- **fichier corrompu** → « ce n'est pas du JSON valide » ; **version 99** →
  « non conforme au format » ; **base intacte** dans les deux cas ;
- **rétention** : 40 instantanés → 23 élagués, 17 conservés — les 14 derniers
  jours plus les 3 lundis antérieurs, exactement l'union attendue ;
- **bandeau** : absent à J+0 ; présent avec « il y a 3 jours » après avoir
  vieilli le journal ; présent aussi sur base fraîchement migrée ; le cas
  « base vide » est couvert par le test unitaire, qui rend précisément cette
  branche ;
- **passage quotidien** : sans en-tête et avec un mauvais secret → 401 ; avec
  le bon → instantané écrit **et** deux vacations, `manual=false` dans les deux
  journaux ;
- **magasin non configuré** → refus nommant les variables manquantes, échec
  journalisé, aucun repli silencieux ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (498 tests) verts.

### Jalon 19 — ce qui ne l'est pas

**Le pilote GitHub n'a pas été exercé contre l'API réelle** : il n'y a pas de
jeton de sauvegarde dans cet environnement. Ce qui est vérifié de bout en bout
— prise, listage, rétention, restauration, refus de fichier corrompu — l'a été
avec le pilote `local`, qui partage toute l'orchestration. Ce qui reste à
prouver au premier passage réel : les appels HTTP à l'API Contents.

**Le workflow n'a pas tourné sur GitHub** : il ne peut s'exécuter qu'une fois la
branche fusionnée et les deux secrets posés. L'appel qu'il émet, lui, a été
rejoué à l'identique en local (`curl --fail-with-body`, même en-tête, même
route) et répond correctement.

**La rétention n'efface pas l'historique git.** Voir plus haut : c'est le prix
du dépôt GitHub, et il est assumé tant que S3 n'est pas branché.

## Jalon 19 (suite) — le pilote GitHub, exercé enfin

Avant de livrer les instructions de configuration, le pilote GitHub a été
exercé contre une imitation fidèle de l'API Contents — le seul chemin que le
jalon 19 laissait non prouvé. Deux défauts en sont sortis, aucun visible à la
lecture du code.

**Au-delà d'un mégaoctet, la lecture revenait vide.** La réponse JSON de l'API
Contents rend `content: ""` avec `encoding: "none"` passé ce seuil : elle
réussit, et elle ne contient rien. Une sauvegarde de CRM franchit le mégaoctet
très vite, et le défaut ne se serait manifesté qu'à la restauration — le seul
moment où il coûte tout. La lecture passe désormais par le type média
`application/vnd.github.raw`, qui rend le fichier tel quel jusqu'à cent
mégaoctets. Le round-trip est vérifié sur une charge de 1,4 Mo contenant des
caractères accentués.

**Les erreurs ne portaient que le code HTTP.** Un 404 en écriture veut dire
« branche absente », « dépôt inconnu » ou « jeton sans accès à ce dépôt » :
trois causes, trois gestes différents. GitHub le dit dans `message` ; ce texte
remonte maintenant jusqu'à l'écran de réglages, là où la configuration se fait.

Vérifié contre l'imitation : première écriture, écrasement avec `sha`, listage,
lecture, suppression, suppression d'un absent (silencieuse, la rétention a
atteint son but), et dossier inexistant traité comme « rien encore ».

### Configuration retenue

Les variables du service Railway portent la destination
(`SNAPSHOT_STORE=github`, `SNAPSHOT_GITHUB_REPO`, `SNAPSHOT_GITHUB_TOKEN`) ;
les secrets de dépôt GitHub portent le déclencheur (`CRM_URL`, `CRON_SECRET`).
`CRON_SECRET` est le seul présent des deux côtés, avec la même valeur.

Le jeton est un PAT **à portée fine**, restreint au seul dépôt de sauvegarde,
avec `Contents: Read and write` (et `Metadata: Read`, ajouté d'office). Aucun
jeton classique à portée `repo` n'est nécessaire — le pilote n'appelle que
`/repos/{owner}/{repo}/contents/…`.

Le dépôt doit être créé **avec un README** : chaque écriture envoie
`branch: "main"`, et un dépôt sans commit n'a pas de `main`. Le dossier
`snapshots/` n'a pas à préexister : un 404 sur le dossier vaut « rien encore »,
et l'API crée les répertoires intermédiaires à l'écriture.

## Jalon 20 — le tableau de bord devient un cockpit

### Ce qui n'allait pas

Dix cartes quasi identiques, trois boutons chacune, empilées. Sarah l'avait dit
elle-même dans un fil : « ce n'est pas dix décisions, c'en est une » — et
l'écran forçait à décider dix fois. Aucun chiffre ne récompensait le travail
fait ; aucune forme ne montrait où le portefeuille fuit.

### Une action groupée n'est offerte que si elle s'applique à tout

`batchActions()` ne retient une action que si **chaque** ligne sélectionnée la
supporte. Proposer « Marquer perdu » sur six lignes dont deux sont des affaires,
puis n'en traiter que quatre, produit un écran qui ment sur ce qu'il vient de
faire. Ce qui manque est expliqué (« ne s'applique pas à toute la sélection »)
plutôt que retiré sans un mot : un bouton absent sans raison se lit comme une
panne.

### L'annulation est une donnée, pas du code

Chaque écriture du lot calcule son inverse **avant** d'écrire, à partir de
l'état lu, et le renvoie au client. Le déduire après coup reviendrait à
restaurer une valeur plausible plutôt que la vraie. Le client garde ce document
le temps du bandeau et le repose tel quel sur la même route ; il ne l'inspecte
jamais, sinon il existerait deux définitions de l'annulation.

Rien n'est gardé côté serveur : une pile d'annulation devrait être attribuée à
une session, expirée, nettoyée — de l'état à gérer pour cinq secondes de
bandeau. Le lancement de séquence s'annule en supprimant les tâches qu'il vient
de créer, et elles seules.

### Le dénominateur de l'anneau ne recule jamais

La file rétrécit quand on travaille. Mesurer « traité sur ce qui reste » ferait
un anneau immobile toute la journée. La taille du jour est donc figée au premier
affichage (`queue_days`), et seulement **relevée** si de nouvelles échéances
tombent — jamais abaissée. Les lignes traitées sont comptées comme des lignes
distinctes (`queue_marks`, unique sur `(jour, ligne)`) : reporter deux fois la
même relance est une seule ligne traitée, et un compteur incrémenté l'aurait
comptée deux fois.

Zéro sur zéro ne vaut pas cent pour cent : une journée sans rien à faire n'est
pas une journée accomplie, et l'écran le dit autrement.

### Un taux sur zéro n'existe pas

`conversionRate(0, n)` rend `null`, pas `0 %`. Zéro pour cent affirme un échec de
conversion ; sur une bande vide il n'y a rien à convertir. Même règle pour le
taux de réponse, déjà en place, et pour les comparaisons de période : sans
période précédente connue, aucune tendance n'est affichée. La carte « Jamais
contactés » n'a donc **pas** de comparaison — rien en base ne dit combien de
fiches n'avaient jamais été approchées la semaine dernière, et inventer une
tendance serait pire qu'un chiffre nu.

### La couleur suit le sens, pas le signe

`describeDelta` reçoit la direction souhaitable et refuse de la deviner : un
« + » sur « Jamais contactés » est une mauvaise nouvelle.

### Le mouvement est réglé en un seul endroit

`app/globals.css` neutralise animations et transitions sous
`prefers-reduced-motion`. Aucun composant n'a besoin de s'en souvenir, et aucun
ne peut l'oublier. Les durées sont ramenées à un instant plutôt qu'à zéro, pour
que les gestionnaires de fin de transition se déclenchent tout de même.

### Le bandeau de sauvegarde s'acquitte, sans se taire

Une alerte qu'on ne peut pas acquitter est une alerte qu'on apprend à ne plus
voir. L'acquittement porte sur **l'épisode** — la clé mémorisée est la date de la
dernière réussite — et non sur le bandeau : une nouvelle sauvegarde qui réussit
puis reprend du retard produit une clé différente, et le bandeau revient plein.

Le bandeau est **plein tant que le stockage local n'est pas lu**. L'inverse — ne
rien rendre en attendant — a été écrit, et le test de page l'a rejeté : l'alerte
devenait invisible côté serveur, donc absente pour qui n'exécute pas le script.
Une alerte qui dépend du navigateur pour apparaître n'est pas une alerte.

### Trois défauts trouvés par la vérification, pas par la lecture

1. **Le bandeau de sauvegarde rendu `null` côté serveur** — voir ci-dessus,
   attrapé par `home-page.test.ts`.
2. **La dernière bande de l'entonnoir sortait du cadre.** Une fiche peut porter
   plusieurs affaires : avec 24 affaires pour 18 contacts, la largeur relative
   dépassait 1 et le rectangle se dessinait hors de l'image (`x = -113`, largeur
   906 pour un cadre de 680). `share` est maintenant bornée des deux côtés.
3. **Les taux de passage étaient rognés.** Placés au bord droit de leur bande,
   ils sortaient du `viewBox` dès qu'une bande occupait toute la largeur. Ils
   forment désormais une colonne alignée à droite du cadre.

Un quatrième défaut, préexistant, a été corrigé au passage : le test « base
vide » mettait tous les compteurs du mock à zéro sans les rendre, si bien que
tout test écrit après lui sortait par le retour anticipé de la page.

### Jalon 20 — ce qui est vérifié

Contre un vrai PostgreSQL 16, migration `8_queue` appliquée :

- **file lue** : 12 lignes — 3 relances dues, 5 tâches en retard, 4 affaires
  bloquées ;
- **lot réel** : 6 relances sélectionnées, actions offertes calculées
  (`postpone-3`, `postpone-7`, `sequence`, `assign`, `lost`), report de 3 jours
  appliqué → 3 échéances déplacées **en base**, 3 marques du jour posées,
  avancement passé de 0/12 à 3/12 ;
- **annulation** : 3 étapes rejouées, `nextReminder` de chaque contact
  **identique à l'octet près** à sa valeur d'origine, marques du jour retombées
  à 0 ;
- **liens de l'entonnoir** : chaque bande ouvre exactement ce qu'elle annonce —
  `followUp=contacted` → 18, `recent` → 9, `answered` → 0, égaux aux nombres
  dessinés ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (529 tests) verts.

### Jalon 20 — ce qui ne l'est pas

**Le clavier et la sélection n'ont pas été exercés dans un navigateur.** `j`,
`k`, `espace`, `↵` et `c` sont testés au niveau du domaine — l'ordre visible
enjambe bien les groupes repliés, le curseur ne boucle pas, il retombe sur une
extrémité quand la ligne pointée disparaît — mais aucun test ne presse une
touche. Le rendu des composants est vérifié, leur interactivité non : il n'y a
pas d'environnement DOM dans cette suite.

**Le regroupement par société n'a pas été vu sur données réelles.** Le jeu de
démonstration n'a aucune société portant deux lignes de file simultanément. La
règle est couverte par cinq tests unitaires, y compris l'ordre d'apparition et
le cas « seule de sa société » ; ce qui reste à voir est son allure à l'écran.

**L'optimisme et le bandeau d'annulation n'ont été exercés que par le service.**
Le retrait immédiat de la ligne, le rétablissement en cas de refus partiel et le
compte à rebours de cinq secondes sont du code client sans test automatique. Le
chemin serveur qu'ils appellent, lui, est vérifié de bout en bout ci-dessus.

**Le lancement de séquence en lot n'a pas été exercé en base.** Son inverse
(supprimer les tâches créées) est écrit et typé, jamais joué : le jeu de
démonstration n'a pas de séquence active rattachable aux contacts de la file.

## Jalon 21 — les statuts de la feuille, et la fiche qui se lit

### La feuille ne dit pas ce que la demande supposait

Relecture en **lecture seule** de « CRM AURA FLOW AI », onglet « Liste de
prospection », 152 lignes de données. Trois écarts avec l'énoncé, tous
matériels :

| | Demandé | Ce que la feuille porte |
|---|---|---|
| « À contacter » | 62 | **81**, plus 3 « À contacter - Tél » |
| « Contacté » | — | **67** |
| « Pas intéressé » | valeur de `Statut Contact` | valeur de **`Réponse ?`** — elle ne figure pas dans `Statut Contact` |

Le 62 de la demande ne correspond à aucune des deux colonnes. Et lire le seul
`Statut Contact`, comme le tableau de la demande l'indiquait, aurait laissé
**vingt-sept refus explicites** dans le vivier à prospecter — la moitié d'entre
eux marqués « À contacter » par ailleurs.

Le report lit donc **deux colonnes**, et un refus l'emporte sur un statut de
contact : on ne redémarche pas quelqu'un qui a dit non. Neuf lignes portent les
deux à la fois ; la contradiction est signalée à la simulation, pas tranchée en
silence.

Après rapprochement contre une base à l'image de la production : **73** « Jamais
contacté », **47** « Contacté — en attente », **27** passages en `Perdu`.

### Une transcription, encore, pas une règle

`scripts/statuts-2026-08.ts` est engendré depuis la lecture de la feuille et
porte, ligne par ligne, son numéro de source et la preuve. Il porte aussi
`SHEET_MODIFIED_AT` — la date de dernière modification rapportée par Drive.

C'est la coupure qui départage : ce que la feuille sait est antérieur à cet
instant, donc **tout travail consigné après l'emporte sur elle**. Une fiche
portant un statut posé ou une interaction plus récente est laissée intacte et
listée à part. Une transcription vieille de trois jours n'écrase pas un appel
d'hier.

**Les interactions de correction ne comptent pas comme du travail.** Les
passages précédents en ont consigné une par fiche ; les compter ferait passer
chaque fiche déjà corrigée pour une fiche travaillée à la main, et le report ne
reprendrait plus jamais rien. Le filtre exclut `owner: "Correction"`.

### Ce que le report ne fait pas, et le dit

« Jamais contacté » est un **statut**. Il ne retire pas une relance programmée —
ce serait un cinquième champ, hors du périmètre demandé. La simulation compte
donc les fiches concernées et l'annonce en toutes lettres : elles continueront
d'apparaître dans les listes de relance. Sur la base vérifiée, ce nombre est
zéro ; en production il peut ne pas l'être, et c'est la simulation qui le dira.

Une fiche déjà `Perdu` n'est pas retouchée : le passage précédent avait tranché
avec les mêmes preuves, et repasser dessus réécrirait un motif choisi.

`statusSetAt` prend la date de la **feuille**, pas celle du jour. L'horodater
d'aujourd'hui ferait passer une transcription pour une observation fraîche, et
la puce « Statut figé » cesserait de repérer ces fiches — alors qu'elles sont
précisément celles à rafraîchir.

### « Statut saisi » devient une colonne filtrable

Le statut **calculé** ne se filtre pas en SQL : il n'existe qu'après lecture.
Le statut **saisi**, lui, est stocké — il devient donc une colonne de filtre
comme les autres, et c'est ce qui permet d'isoler « Contacté — en attente » pour
organiser des relances. Les fiches au statut vide se retrouvent sous « (vide) ».

### La fiche contact : en-tête fixe, trois onglets

Le défaut n'était pas le contenu mais la hiérarchie. Tout était présent, dans
une colonne unique, et la seule chose dont on a besoin avant un appel — le
numéro et ce qui s'est dit — se trouvait tout en bas.

L'en-tête vit **hors du conteneur défilant** du tiroir : sinon « sans défiler »
ne serait vrai qu'au chargement. Il porte l'état, l'échéance, le numéro
cliquable et l'action primaire, et rien d'autre.

**L'onglet d'arrivée suit la fiche** : historique s'il y a quelque chose à lire,
champs sinon. Deux défauts trouvés en écrivant le test plutôt qu'à l'écran :

1. le choix se faisait dans un effet, donc pas au rendu serveur — l'onglet
   correct n'apparaissait qu'après hydratation. Il est maintenant décidé à
   l'initialisation de l'état ;
2. l'effet dépendait de « la fiche a-t-elle un historique ». Consigner le
   premier échange depuis l'onglet Fiche faisait basculer l'écran ailleurs au
   moment précis où l'on venait d'agir. Il ne se recalcule plus qu'au
   **changement de fiche**, gardé par une référence.

**Un seul `RecordPanel`**, monté en permanence, dont la moitié rendue suit
l'onglet. Deux instances — une par onglet — rechargeraient la chronologie et les
tâches à chaque va-et-vient pour afficher les mêmes lignes.

`Tabs` implémente le motif ARIA **complet**, flèches comprises. La bande de
portraits du jalon 18 portait `role="tablist"` sans la navigation qu'il promet ;
c'est le genre d'à-peu-près qui rend une aide technique inutilisable.

### Le tableau : six colonnes, et un choix conservé

Les colonnes étaient écrites deux fois — les `<th>` dans une liste, les `<td>`
en dur dans le corps — sans rien pour garantir l'alignement des deux. Une
colonne est maintenant **une** entrée de `CONTACT_COLUMNS` : libellé, tri,
filtre, cellule.

Six par défaut (contact, société, statut, prochaine relance, dernier contact,
**téléphone** — qui n'existait pas), le reste derrière « Colonnes », le choix
conservé dans le stockage local. « Contact » ne se masque pas : un tableau dont
on peut retirer le nom des gens n'est plus un tableau de contacts.

La seconde rangée de puces se replie derrière un bouton « Filtres » qui **dit
s'il en cache une active** — un filtre invisible et actif est un écran qui ment.

### Un test de composant était ignoré en silence

Les globs de vitest ne couvraient que `*.test.ts`. Rendre un composant demande
du JSX, que TypeScript refuse dans un `.ts` : un test de fiche écrit en `.tsx`
n'aurait jamais été exécuté, tout en ayant l'air d'exister. Les quatre globs
acceptent désormais `.test.ts?(x)`.

### Jalon 21 — ce qui est vérifié

Contre un vrai PostgreSQL 16, sur une base rechargée depuis la feuille elle-même
(151 contacts, 135 sociétés — l'ordre de grandeur de la production) :

- **simulation** : 147 fiches à modifier, **0 écriture** — 73 « Jamais
  contacté », 47 « Contacté — en attente », 27 `Perdu` ; 25 rapprochements
  incertains et 9 contradictions de la feuille signalés ;
- **cinq lignes non rapprochées, nommées** : ligne 45 (statut vide), lignes 6 et
  25 (sans nom dans la feuille), lignes 89 et 147 (« Elena andrikian » y figure
  deux fois, sous deux orthographes de société) — avec société et adresse, pour
  pouvoir les traiter à la main ;
- **application** : 147 fiches, 147 interactions consignées, sauvegarde rendue,
  et **0 fiche dont le téléphone, les notes, l'étiquette ou la relance ont
  bougé** ;
- `statusSetAt` porte la date de la feuille sur les 120 fiches concernées ;
- **idempotence** : second passage → 0 à modifier, 147 déjà à jour ;
- **le travail plus récent gagne** : une interaction consignée le 8 août sur une
  fiche la fait passer en « laissée de côté » avec son motif ; sa voisine est
  bien reprise. Une note écrite par une correction ne compte pas comme du
  travail — vérifié en en ajoutant une ;
- **le vivier ne relance pas** : 0 des 73 « Jamais contacté » n'apparaît dans la
  puce « À relancer » ni dans la file d'accueil ;
- **filtre de colonne « Statut saisi »** : 47 lignes, exactement le compte des
  « Contacté — en attente » ; les facettes du menu affichent 47 / 73 / 31 ;
- **fiche contact** : le `tel:` est rendu **avant** le conteneur défilant, donc
  visible sans défiler ; onglet Historique sélectionné avec 3 interactions,
  onglet Fiche avec 0 ; « Pas de téléphone » et « Aucune relance programmée »
  dits en toutes lettres ; les champs rares repliés ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (541 tests) verts.

### Jalon 21 — ce qui ne l'est pas

**Les chiffres ci-dessus viennent d'une base rechargée depuis la feuille, pas de
la vôtre.** Les 139 contacts de production ont une histoire que ce jeu n'a pas :
des fiches créées à la main, des relances posées, des statuts déjà saisis. Le
nombre réellement modifié, celui des fiches laissées de côté, et surtout celui
des « Jamais contacté » **portant encore une relance** ne se connaîtront qu'à la
simulation sur la vraie base. C'est à cela qu'elle sert.

**« Elena andrikian » est un doublon de la feuille**, pas du CRM : deux lignes,
deux orthographes de société, la même adresse. Le report la refuse des deux
côtés plutôt que de choisir. À trancher à la main.

**Le choix de colonnes n'a pas été vérifié dans un navigateur.** Sa persistance
passe par `localStorage` ; ce qui est testé, c'est la liste par défaut, l'unicité
des clés, la validité des filtres référencés et le verrou sur la colonne
« Contact ». Le fait qu'un ajout survive à un rechargement n'est pas couvert par
cette suite, qui n'a pas de DOM.

**Le clavier des onglets n'est pas exercé.** Le motif ARIA est écrit — `tablist`,
`aria-selected`, `aria-controls`, `tabIndex` roulant, flèches, `Home`/`Fin` — et
le rendu est vérifié, mais aucun test ne presse une touche.

## Jalon 22 — la qualification crée l'affaire, et les rapports mesurent la prospection

### `Qualifié` est l'engagement de l'acheteur, pas notre activité

Nouveau cycle de vie entre `Prospect` et `Client`, et sa définition tient en une
phrase, écrite **contre le champ** dans le formulaire : *le prospect a exprimé
le désir de l'offre.* Avoir fait une démo ne qualifie personne ; avoir demandé
un prix, si.

C'est ce qui justifie qu'y passer ouvre une affaire : à partir de là, il y a
quelque chose à suivre, à chiffrer et à perdre.

**Un seul geste, une seule transaction.** Le cycle de vie, l'affaire, la visite
d'étape et l'interaction de qualification partent ensemble. Les séparer
laisserait, à la moindre coupure, un contact qualifié sans rien à suivre —
exactement le demi-état que ce jalon supprime. La modale ne demande que le
montant et l'offre ; le reste se déduit de la fiche. **Annuler la modale
n'écrit rien du tout.**

**Le montant est obligatoire et strictement positif.** Une affaire à zéro pèse
zéro dans le pipeline pondéré et dans la prévision : elle serait invisible
partout où elle compte tout en existant. Mieux vaut refuser la qualification que
fabriquer une affaire fantôme.

**Rejouer ne crée rien.** Un contact portant déjà une affaire ouverte est
qualifié sans seconde affaire, et le bandeau dit laquelle existe avec son lien.
Qualifier deux fois n'est pas une erreur de l'utilisateur — c'est ce qui arrive
quand un prospect confirme son intérêt une seconde fois.

**L'annulation réutilise le mécanisme de la file d'accueil**, sans le
réimplémenter : le serveur rend les étapes inverses, le client les repose sur
`POST /api/queue` en mode `undo`. Une étape `deal-delete` a été ajoutée au
vocabulaire — jamais fabriquée par le client, seulement rendue par le serveur
qui vient de créer cette affaire-là. Dix secondes plutôt que cinq : supprimer
une affaire qu'on vient de créer se décide moins vite que défaire un report.

Trois chemins déclenchent la modale, et un seul endroit décide : la fiche.
Le bouton « Qualifier » de l'en-tête, le formulaire qui rend le cycle de vie
enregistré, et l'issue d'une interaction (`RDV obtenu`, `Répondu — intéressé`)
que `RecordPanel` remonte. Le formulaire et le formulaire d'interaction ne
connaissent pas les affaires, et n'ont pas à les connaître.

### Le pipeline suit l'acheteur, lui aussi

| Avant | Après |
|---|---|
| Nouveau lead (10) | **Qualifié** (15) — renommée |
| Contacté (25) | fusionnée dans Qualifié |
| Démo planifiée (45) | **Démo planifiée** (30) |
| — | **Démo réalisée** (50) — nouvelle |
| Proposition envoyée (65) | inchangée |
| Négociation (85) | inchangée |
| Gagné (100) | inchangée |

`Nouveau lead` et `Contacté` décrivent l'avant-qualification : dans le nouveau
modèle, une affaire n'existe qu'à partir du moment où le prospect a exprimé un
désir. Leurs affaires atterrissent donc en première étape.

La migration n'agit que sur les **six étapes semées** (`s1`–`s6`), reconnues à
leur identifiant : une étape ajoutée à la main n'est pas touchée. Le renommage
se fait en place pour préserver les clés étrangères, positions décalées de 100
d'abord — sinon le moindre échange violerait la contrainte d'unicité.

Chaque étape porte un **critère de sortie**, affiché au survol de la colonne et
écrit du point de vue de l'engagement : « a demandé une proposition chiffrée »
plutôt que « proposition envoyée ». Une étape définie par ce qu'on a fait se
franchit toute seule ; définie par ce que l'autre a accordé, elle mesure quelque
chose.

**Le seed a été mis au même jeu.** Un seed posant l'ancien pipeline ferait
diverger une base fraîche d'une base migrée, et personne ne saurait laquelle
fait foi.

### Les durées par étape demandaient une table

`Deal.stageSince` ne dit que depuis quand l'affaire est dans son étape
**actuelle** : il ne peut pas répondre à « où mes affaires stagnent-elles ? »,
qui demande la durée des étapes **quittées**. `deal_stage_visits` enregistre une
ligne à chaque entrée, création comprise.

Réserve honnête : les affaires antérieures n'ont qu'une visite, reconstituée
depuis `stageSince`. Leurs passages précédents n'ont jamais été enregistrés, et
les moyennes ne deviennent vraies qu'à mesure que de nouveaux passages
s'accumulent. L'écran affiche donc une colonne « passages mesurés » à côté de
chaque durée : une médiane calculée sur deux passages n'est pas une mesure, et
l'afficher comme les autres la ferait lire comme telle.

**Seuls les passages terminés comptent.** Le passage en cours mesurerait
« depuis quand » et non « combien de temps », et tirerait toutes les durées vers
le bas au fil des jours.

**Un aller-retour compte une entrée**, et « avancé » se juge sur l'étape la plus
avancée **atteinte**, pas sur l'étape actuelle : une affaire revenue en arrière
est bien passée par la suivante, et l'oublier sous-estimerait la conversion à
chaque recul.

### La fiche dit enfin combien on a essayé

Cinq faits calculés, aucun à saisir : tentatives et réponses (« 3 tentatives ·
0 réponse » tranche entre insister et abandonner), canal et issue du dernier
échange, taille et secteur de la société lus sur la fiche liée, et ancienneté
dans le vivier en jours. Plus `website`, qui retombe **à l'affichage** sur le
domaine de la société — le recopier en base ferait diverger les deux le jour où
la société change de domaine.

« Sans réponse » se compte par un `groupBy` pour toute la liste : Prisma ne sait
pas rendre deux compteurs de la même relation dans un seul `_count`, et cent
quarante requêtes pour cent quarante lignes seraient un prix absurde pour un
second nombre.

Les six nouvelles colonnes rejoignent le sélecteur « Colonnes », **non affichées
par défaut**. Aucune n'est triable ni filtrable : ce sont des agrégats calculés
à la lecture, et promettre un tri qui ne trierait rien serait pire que ne rien
promettre.

### `/rapports` mesure ce qu'on fait, pas seulement ce qu'on signe

Deux blocs. **Prospection** passe devant et reste seul tant qu'aucune affaire
n'existe : rythme hebdomadaire sur douze semaines, taux de réponse par canal,
délai médian avant premier contact, discipline de relance, vieillissement du
vivier, taux de qualification par source.

**Médiane et non moyenne** pour le délai avant premier contact : trois fiches
touchées le jour même et une oubliée depuis huit mois donneraient une moyenne de
deux mois, qui ne décrit aucune des quatre.

**« Tenue » veut dire terminée au plus tard le jour de l'échéance.** Compter
comme tenue une relance faite trois semaines après reviendrait à mesurer qu'on
finit par tout faire, ce qui est vrai de tout le monde.

**Aucun taux n'est inventé.** Partout où le dénominateur est nul, `null` plutôt
que zéro — et l'écran écrit « issue non renseignée » là où il aurait affiché
« 0 % ». C'est la règle de l'entonnoir du jalon 20, reprise sans exception.

**Chaque graphique vide dit pourquoi et quoi faire**, avec sa raison propre :
« Aucune interaction consignée sur les douze dernières semaines. Consignez un
appel depuis une fiche contact. » Un message générique serait la même absence
d'information sous une autre forme.

### Un défaut trouvé contre la vraie base

Sur la base chargée depuis la feuille, le rythme annonçait **149 interactions**
— dont **148 notes écrites par les corrections de données** des jalons 11, 12 et
21. Ce sont nos écritures à nous, pas de la prospection : les compter aurait
présenté au premier coup d'œil une semaine de travail que personne n'a faite.
Toutes les mesures d'activité excluent désormais `owner: "Correction"`, la même
exclusion que « la fiche a-t-elle été travaillée » du jalon 21. Après
correction : **1 interaction réelle**.

### Le conseil lit la prospection

`get_prospecting_metrics` rend les mêmes nombres que `/rapports` en appelant le
même service — un agent et un écran qui regardent la même semaine ne peuvent pas
la décrire différemment.

Les mesures entrent aussi dans les **briefings**, dans un champ `context`
distinct des sections. La distinction n'est pas cosmétique : une section porte
des enregistrements dont chaque identifiant devient une preuve cliquable, alors
qu'un taux de réponse ne désigne aucune fiche. Les glisser parmi les sections
aurait produit des preuves qui ne résolvent pas, donc des constats rejetés par
la double résolution du jalon 14. Elles ne comptent pas dans `empty` : un CRM
sans rien à signaler doit rester silencieux et gratuit.

### Jalon 22 — ce qui est vérifié

Contre un vrai PostgreSQL 16, migration `9_qualification` appliquée sur une base
portant déjà des données :

- **restructuration du pipeline** : les six étapes lues en base après migration
  sont exactement Qualifié 15 / Démo planifiée 30 / Démo réalisée 50 /
  Proposition envoyée 65 / Négociation 85 / Gagné 100, positions 0 à 5, chacune
  avec son critère de sortie ;
- **qualification** : contact `Prospect` → affaire « Assistant IA Pro — Kotto
  Sport » créée, `contactId` et `companyId` repris de la fiche, montant 6480,
  étape d'entrée en position 0, clôture prévue à +30 j, **1 visite d'étape**
  écrite, cycle de vie passé à `Qualifié` ;
- **idempotence** : second appel → `created: false`, même `dealId`, message
  nommant l'affaire existante, **24 affaires avant et après** ;
- **annulation** : 2 étapes rejouées → l'affaire disparaît (24 → 25 → 24) et le
  cycle de vie redevient `Prospect` ;
- **offre par défaut** : « Pilote 3 mois », la dernière **vendue** ;
- **prospection** : 18 contacts, 25 interactions sur 12 semaines, ventilées
  `call:9 | email:6 | meeting:5 | demo:3 | note:2` ; délai médian avant premier
  contact 19 j ; qualification par source `LinkedIn 3/5 | Scraping 2/2` ;
- **exclusion des notes de correction** : sur la base issue de la feuille, 149
  interactions deviennent **1** ;
- **parcours de vente** : taux de lapin 50 % (1 démo tenue sur 2 planifiées),
  vélocité médiane 28 j sur 7 affaires gagnées ;
- **outil du conseil** : `get_prospecting_metrics` répond `ok` et rend le taux
  par canal, les douze semaines de rythme comprises ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (568 tests) verts.

### Jalon 22 — ce qui ne l'est pas

**La modale n'a pas été ouverte dans un navigateur.** Le service qu'elle appelle
est vérifié de bout en bout ci-dessus — création, idempotence, annulation — mais
la saisie du montant, le clic sur « Annuler » et le compte à rebours de dix
secondes sont du code client sans test automatique, cette suite n'ayant pas de
DOM.

**Créer un contact directement en `Qualifié` depuis « Nouveau contact » n'ouvre
pas la modale.** Le formulaire de création ne rend pas l'identifiant de la fiche
qu'il vient d'écrire, et la modale en a besoin. La fiche s'ouvre ensuite et son
bouton « Qualifier » fait le travail — mais c'est un geste de plus, et il n'est
pas dit à l'écran.

**Les durées par étape reposent sur peu de passages.** Le jeu de démonstration
n'a qu'une visite par affaire, reconstituée : la colonne « passages mesurés »
affiche donc 0 partout sauf là où de vrais mouvements ont eu lieu. La mesure est
juste, elle est simplement encore pauvre — et l'écran le dit.

**La vélocité mélange deux définitions pour les affaires anciennes.** Depuis ce
jalon, `createdAt` est la date de qualification ; pour les affaires antérieures,
c'est la date de saisie. Les 28 jours mesurés portent donc sur des affaires du
jeu de démonstration, pas sur des qualifications réelles.

**`components/contacts/contact-form.tsx` reste à 276 lignes**, au-dessus de la
limite de 250. Il en faisait 300 avant ce jalon : trois extractions l'ont réduit
sans le ramener sous la barre. C'est de la dette reconnue, pas un oubli.

**Le logo est un dessin, pas un calque du fichier fourni.** L'image existe dans
la conversation, elle n'existe pas sur le disque : rien ne permettait de la lire
octet par octet, et aucun vectoriseur (potrace, ImageMagick) n'est installé.
Le tracé de `components/brand/logo.tsx` suit la description — « A » traversé par
une vague cyan → bleu → violet, fond transparent — sans prétendre en reproduire
les courbes. Il est isolé pour que la substitution coûte un fichier.

---

## Jalon 24 — le site sort des Notes, LinkedIn sort du dépli

### Deux choses distinctes sur la fiche contact, l'une visuelle, l'autre de donnée

**LinkedIn rejoint le site dans le bloc visible.** Les deux sont des liens
qu'on ouvre avant un appel, pas des champs qu'on consulte une fois par mois —
ils n'avaient rien à faire sous « Plus de détails ». Deux icônes rejoignent le
téléphone dans l'en-tête (`globe`, `linkedin`, ajoutées à `components/ui/icon.tsx`) :
un clic ouvre le site ou le profil sans passer par l'onglet Fiche, grisées
plutôt qu'absentes quand la valeur manque — un bouton qui disparaît selon les
fiches se cherche, un bouton désactivé se lit d'un coup d'œil. Le domaine de la
société l'était déjà, sans dépli, dans le tiroir société : rien à y changer.

**Le site était déjà dans la donnée, au mauvais endroit.** L'import versait
toute colonne non reconnue dans `Notes` — `SITE :` en fait partie. Sur la
vraie feuille (154 contacts, relue en lecture seule), **67 fiches** portent une
ligne `SITE :` dans leurs notes et 0 dans le champ `website`.

### On ne devine pas un domaine dans un titre

`lib/domain/notes-extract.ts` cherche une ligne `SITE :` (et ses variantes
`SITE:`, `Site :`), et n'en extrait un domaine ou une URL que s'il y en a un à
extraire — un motif de domaine étroit, testé pour ne jamais confondre
« 100% gourmand » avec un TLD. Vérifié contre les 67 lignes réelles : **8**
portent un domaine exploitable (`cuure.com`, `numorning.com`…), **59**
ne portent qu'un titre de page (« SITE : Shopify », « SITE : Argalys
Essentiels ») et sont listées comme non résolues plutôt que devinées.

Même contrat que les corrections précédentes : simulation d'abord, deux champs
touchés (`website`, et `domain` de la société liée s'il est vide), jamais les
Notes — **copie, pas déplacement**, la ligne source y reste intacte pour
qu'on ne perde jamais le contexte autour du domaine. Idempotent : une fiche
dont `website` est déjà rempli est ignorée, saisi ou extrait indifféremment.

### Ce qui est signalé, pas traité

Les mêmes Notes portent d'autres colonnes échouées à l'import — `N° :`,
`Réponse ? :`, parfois `Canal :`. Le bloc de réglages les compte
(`countOtherPatterns()`) et les affiche en avertissement, sans les extraire :
ce n'est pas ce qui a été demandé, et décider où chacune devrait aller (un
`N°` de ligne de feuille n'a pas d'équivalent dans le schéma) est une décision
produit, pas une extraction évidente. Sur la base vérifiée : 136 lignes
`N° :`, 50 lignes `Réponse ? :`, 0 `Canal :`.

### Jalon 24 — ce qui est vérifié

Contre un vrai PostgreSQL 16, base rechargée depuis la vraie feuille (154
contacts, import réel via `importContacts()`) :

- **simulation** : 8 fiches à corriger, 59 lignes non résolues nommées, 0
  écriture ; le rapport « autres motifs » cite 136 `N°`, 50 `Réponse ?`, 0
  `Canal` ;
- **application** : 8 `website` remplis, notes des 8 fiches **inchangées à
  l'octet près** (comparées avant/après), 20 sociétés au total avec un domaine
  non vide ;
- **idempotence** : second passage → 0 fiche à corriger ;
- **fiche Hugo Fachin** (capture) : Site et LinkedIn visibles sans dépli,
  icônes globe et LinkedIn dans l'en-tête à côté du téléphone, toutes deux
  cliquables, `SITE : https://cuure.com/` toujours présent dans le bloc Notes ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (578 tests) verts.

### Jalon 24 — ce qui ne l'est pas

Le choix de traiter `N° :`, `Réponse ? :` et `Canal :` reste ouvert — ce jalon
les compte et les nomme, il ne décide pas où ils devraient aller.

L'icône LinkedIn du jeu d'icônes est une approximation dessinée dans le même
style que les autres (traits, pas de remplissage) : ce n'est pas le logo
officiel, et ça n'a pas besoin de l'être — c'est un repère, pas une marque.

---

## Jalon 25 — la question des domaines, tranchée

### Ce que la feuille contient réellement

Relecture en **lecture seule** de « CRM AURA FLOW AI », les **six onglets**, le
12 août 2026. La réponse est décevante et il valait mieux la connaître :

| Onglet | Colonne susceptible de porter une adresse | Ce qu'elle contient |
|---|---|---|
| Liste de prospection | `SITE` | 71 valeurs sur 152 lignes — **14 sont des adresses**, 57 sont des titres de page |
| Prospects chauds | `Boutique / URL` | 2 lignes, **1 adresse** ; sa colonne `SITE` dit « Shopify » — la plateforme |
| Suivi mensuel par canal | — | aucune adresse |
| Tableau de bord | — | aucune adresse |
| Clients signés & suivi | — | table vide |
| Grille tarifaire | — | aucune adresse |

**Rien n'a été perdu à l'import.** La colonne `SITE` a bien été versée dans les
Notes ; elle était simplement, à 80 %, autre chose qu'une adresse — le titre de
l'onglet du navigateur (« Vitamines et Compléments alimentaires | Argalys
Essentiels ») plutôt que son adresse. Le total exploitable dans tout le
classeur est de **15 adresses**.

### Deux corrections, deux sources

`planWebsiteFix()` (jalon 24) lit les **Notes** du CRM. `planSiteFix()` lit la
**feuille**, transcrite dans `scripts/sites-2026-08.ts`. Elles ne trouvent pas
la même chose, et c'est la raison d'être de la seconde : une ligne que l'import
a refusée — nom manquant — n'a laissé aucune note, donc aucune adresse à
extraire. **Six des quinze adresses sont dans ce cas** ; elles sont signalées
« introuvable » avec leur nom, leur société et leur adresse électronique, pour
être traitées à la main.

Mêmes garanties que les autres reports de feuille : simulation d'abord,
`website` du contact et `domain` de la société **seulement s'ils sont vides**
(la condition est portée par le `updateMany`, pas par une lecture antérieure),
Notes intactes, sauvegarde JSON avant écriture, idempotent.

### Les domaines proposés ne s'appliquent jamais en masse

Pour les sociétés sans domaine, `lib/domain/domain-guess.ts` propose — **et ne
vérifie rien, par construction**. Aucun appel réseau n'est émis vers une
adresse proposée, et c'est le point dur de ce jalon : un domaine deviné qui
*répond* peut appartenir à n'importe qui. Le vérifier depuis le serveur
donnerait à une supposition l'apparence d'un fait, et l'erreur se découvrirait
devant un client, sur un lien menant chez un tiers.

Deux règles, dans l'ordre de fiabilité :

| Règle | D'où vient la valeur | Couverture (base vérifiée) |
|---|---|---|
| `email` | domaine d'une adresse **professionnelle déjà saisie** sur une fiche de la société — une déduction, pas une invention | 96 sociétés sur 125 |
| `name` | nom de la société transformé en domaine — **pure supposition** | 29 sociétés |

Les messageries grand public (Gmail, Orange, Yahoo…) sont exclues : elles ne
disent rien de la société. Deux domaines différents parmi les contacts font
tomber la confiance et le disent (« 2 domaines différents… »).

**Même la règle `email` se trompe.** « Absolution » et « Spring » portent des
contacts en `@teledyne.com` — une adresse manifestement erronée dans la
feuille. « Agence ads » donne `ads.com`. C'est exactement pourquoi il n'existe
aucune fonction qui écrive plusieurs domaines d'un coup : le bloc « Domaines
proposés » se relit **ligne à ligne**, chaque proposition portant sa règle, sa
confiance et la phrase qui l'explique.

Accepter écrit **une** société (et recalcule son miroir de recherche, sans quoi
elle resterait introuvable par son adresse). Écarter n'écrit rien sur la
société : le refus est mémorisé dans `domain_rejections` pour que la ligne ne
revienne pas — mais **le refus porte sur la valeur**, pas sur la société : si
la règle propose autre chose plus tard, la ligne revient.

### Jalon 25 — ce qui est vérifié

Contre un vrai PostgreSQL 16, base chargée depuis la feuille par l'import réel
(154 contacts, 135 sociétés), migration `10_domain_review` appliquée puis
`migrate diff` renvoyant une migration vide :

- **report des sites** : 8 fiches renseignées sur les 15 adresses de la
  feuille, 7 lignes « introuvable » nommées (six refusées à l'import, plus
  « Aurélie » de l'onglet Prospects chauds) ; **notes identiques à l'octet
  près** avant/après ; second passage → 0 à écrire, 8 déjà pourvues ;
- **propositions** : 125 sociétés sans domaine → 96 déduites d'une adresse,
  29 supposées du nom, 0 sans proposition ;
- **accepter** écrit une seule société et recalcule son `searchText` ;
  **écarter** laisse `domain` vide en base ; la ligne acceptée et la ligne
  écartée sortent toutes deux de la liste ;
- **un refus ne vaut que pour sa valeur** : changer la valeur mémorisée fait
  revenir la ligne ;
- **écriture concurrente** : domaine renseigné à la main entre l'affichage et
  le clic → l'acceptation refuse en le nommant, la valeur saisie est conservée ;
- **collision de clés React corrigée** au passage : deux fiches homonymes
  (« Elena andrikian », doublon de la feuille) partageaient une clé dans quatre
  listes du panneau — React pouvait en omettre une, dans l'écran qui sert
  précisément à relire ce qui va être écrit. Vérifié : plus aucun message en
  console ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (590 tests) verts.

### Jalon 25 — ce que je recommande pour les sociétés restantes

**Ne pas généraliser la règle `name`.** Elle produit du plausible, pas du vrai :
`ads.com` pour « Agence ads », `bacha.com` pour « Bacha » (le site réel est
*bachca.com*, visible dans les Notes). Un champ rempli de domaines plausibles
est pire qu'un champ vide, parce qu'on cesse de se méfier.

Dans l'ordre de ce que je ferais :

1. **Accepter les propositions `email` après relecture** — 96 sociétés, une
   déduction à partir d'une donnée réellement saisie. Compter quelques minutes
   de relecture, en écartant les cas manifestes (`teledyne.com`).
2. **Récolter le reste au fil des appels.** Le site se demande en trente
   secondes pendant la conversation, et il arrive alors vérifié par la personne
   même. C'est le seul canal qui produit une donnée sûre sans rien payer.
3. **Pour un rattrapage en masse, un service d'enrichissement**, pas une
   supposition. Un connecteur d'enrichissement B2B est disponible dans
   l'environnement de travail (`Vibe_Prospecting`) et sait rendre le domaine
   d'une entreprise à partir de son nom ; il est payant à l'appel et n'a pas
   été utilisé ici, faute d'accord préalable. C'est la réponse honnête à
   « comment obtenir cette donnée » : l'acheter à quelqu'un dont c'est le
   métier, ou la demander au prospect.
4. **Ce qu'il ne faut pas faire** : vérifier les domaines devinés en les
   appelant depuis le serveur. Une page qui s'affiche ne prouve pas qu'elle
   appartient au prospect — seulement que le nom est déposé.

### Jalon 25 — ce qui n'est pas vérifié

**Les chiffres viennent d'une base reconstituée depuis la feuille, pas de la
vôtre.** 135 sociétés ici, 133 annoncées en production : la répartition entre
`email` et `name` y sera proche mais pas identique. La simulation sur la vraie
base est le seul chiffre qui fasse foi.

**Aucun domaine proposé n'a été vérifié, et c'est voulu.** Ni par le serveur,
ni par moi. `nailmatic.com` et `typology.com` sont probablement justes ;
`ads.com` est probablement faux ; la liste ne fait pas la différence et ne
prétend pas la faire.

**Le bloc de relecture n'a pas été exercé au clavier dans un navigateur.** Les
deux boutons de chaque ligne appellent une route vérifiée de bout en bout, et
le rendu du bloc est vérifié par capture ; la navigation au clavier entre cent
lignes ne l'est pas.

---

## Jalon 26 — accepter en bloc, mais seulement ce qui est déduit

### La distinction que le bouton ne doit pas pouvoir effacer

Les propositions de domaine se partagent en deux populations qui n'ont pas la
même valeur : celles **déduites** d'une adresse professionnelle déjà saisie, et
celles **supposées** à partir du nom de la société. Relire les premières une par
une est une corvée ; relire les secondes est le seul moyen de ne pas remplir la
base de plausible.

« Tout accepter » n'existe donc que pour les déductions, et la règle est portée
à deux endroits, dont un seul compte vraiment :

- **À l'écran**, le bouton n'apparaît que sous le filtre « Déduites d'une
  adresse ». **Absent, pas désactivé** : un bouton grisé invite à chercher
  comment l'activer, un bouton absent ne pose pas la question. Il nomme son
  compte — « Accepter les 105 domaines déduits ».
- **Au serveur**, `acceptManyDomains()` **recalcule la proposition de chaque
  société** et écarte tout ce qui n'est pas de règle `email`. C'est ce qui rend
  la règle vraie : un appel fabriqué à la main qui listerait des sociétés
  « supposées du nom » écrit zéro ligne. Vérifié en passant trois suppositions
  en force → `0 domaines écrits · 3 ignorés (ne sont plus des déductions)`.

L'acceptation et le rejet à l'unité ne bougent pas : le bouton groupé est un
raccourci sur un sous-ensemble filtré, pas un remplacement.

### Ce que le groupé garantit, et ce qu'il refuse

- **Confirmation qui montre**, pas qui résume : la liste complète de ce qui sera
  écrit, les lignes douteuses en tête, et le rappel — mot pour mot celui du
  panneau — qu'aucune de ces adresses n'a été appelée. Deux formulations pour
  la même garantie finiraient par diverger.
- **Ne touche que ce qui est encore en attente** dans la vue filtrée : une ligne
  déjà acceptée ou écartée n'y est plus.
- **Ignore sans échouer** une société dont le domaine a été renseigné entre
  l'affichage et le clic — même garde que l'acceptation à l'unité, portée par la
  condition du `updateMany` et non par une lecture antérieure. Idem si la
  proposition a changé de valeur : ce qui serait écrit ne serait plus ce qui a
  été relu.
- **Dit exactement ce qui s'est passé** : `describeBulkOutcome()` (pur, testé)
  rend « 84 domaines écrits · 4 ignorés (déjà renseignés) », chaque raison
  accordée sur son propre compte.
- **Annulation de dix secondes**, par le mécanisme de la file d'accueil : les
  étapes inverses sont calculées **avant** d'écrire, à partir de l'état lu, et
  reposées telles quelles sur `POST /api/queue` en mode `undo`. Une étape
  `company-domain` rejoint le vocabulaire — elle transporte l'ancien domaine
  **et** l'ancien miroir de recherche plutôt que de le recalculer : recalculer
  supposerait de relire le nom tel qu'il est *maintenant*, et une modification
  faite entre-temps se retrouverait défaite par une annulation qui n'a rien à
  voir avec elle.

### La ressemblance nom ↔ domaine, ou l'art de se méfier au bon endroit

`nameSimilarity()` compare le nom de la société à l'étiquette du domaine —
inclusion valant 1, sinon coefficient de Dice sur les bigrammes. Les
correspondances les plus faibles remontent en tête de la vue « Déduites » avec
un repère discret.

**Ce n'est pas une mesure de justesse, c'est une mesure d'étonnement.** Un score
bas ne dit pas que le domaine est faux : « AGENCE INCARE Marketing » chez
`oomylab.com` peut très bien être exact. Ce que le score attrape réellement,
c'est **l'adresse erronée dans la feuille source**. Sur la base vérifiée, 11 des
105 déductions passent sous le seuil de 0,34 — et l'on y trouve les deux
sociétés de cosmétique rattachées à `teledyne.com`, un électronicien américain,
ainsi que « Sisi la paillette » rattachée à `u-paris.fr`, une université. Les 75
correspondances exactes (`numorning.com` pour Numorning) ne sont pas signalées.

Le seuil est calé sur cette base : juste au-dessus se trouvent
`Laboratoire mademoiselle → mademoisellecosmetique.com` (0,51) et
`Omnie → omie.fr` (0,57) — une faute de frappe dans le nom, pas une erreur de
domaine. Les signaler aurait dilué les onze qui comptent.

### Jalon 26 — ce qui est vérifié

Contre un vrai PostgreSQL 16, base chargée depuis la feuille (154 contacts, 135
sociétés) :

- **tri** : les 105 déductions passent toutes avant les 30 suppositions, et à
  l'intérieur la ressemblance la plus faible d'abord — les six premières lignes
  sont à 0,00, `teledyne.com` en tête ;
- **garde-fou serveur** : 3 suppositions passées en force → `0 domaines écrits ·
  3 ignorés (ne sont plus des déductions)` ;
- **groupé** : 104 écrits, 1 ignoré, `104 domaines écrits · 1 ignoré (déjà
  renseigné)` ; la société renseignée à la main entre-temps **a gardé sa
  valeur** ;
- **annulation** : 104 étapes rejouées, domaine **et** miroir de recherche
  revenus à vide, 0 société avec domaine en base après le tour complet ;
- **à l'écran** : le bouton est **absent** sous « Toutes » et sous « Supposées
  du nom » (compté à 0 dans le DOM, pas seulement désactivé), présent sous
  « Déduites » ; le parcours complet clic → confirmation → écriture → bandeau →
  « Annuler » rejoué dans un navigateur, sans une erreur en console ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (601 tests) verts.

### Jalon 26 — ce qui ne l'est pas

**La ressemblance ne dit toujours rien de la justesse.** Elle trie, elle
n'arbitre pas. Une déduction à 1,00 peut être fausse — une société qui a changé
de nom — et une à 0,00 peut être juste. Aucun domaine n'est vérifié, et
toujours pas depuis le serveur.

**Le bandeau d'annulation n'a qu'une vie de page.** Recharger `/reglages` dans
les dix secondes le fait disparaître avec les étapes inverses qu'il portait ;
il faut alors revider les domaines à la main. C'est le même compromis que la
file d'accueil, à un volume plus grand.

**Le groupé écrit dans la requête HTTP**, une société après l'autre, sans
transaction d'ensemble : une coupure au milieu laisse les lignes déjà écrites
écrites — et sans bandeau pour les défaire. À 105 lignes c'est instantané ; à
plusieurs milliers, il faudrait découper en lots.

---

## Jalon 27 — le statut de relance, audité puis unifié

### Le symptôme, et ce qu'il cachait

La puce « Jamais contacté » de `/contacts` renvoyait **2** contacts alors que la
correction de feuille venait d'en écrire **67**. Audit mené sur une base
reconstituée depuis la feuille (154 fiches), correction appliquée pour
reproduire l'état signalé.

**La cause n'est pas dans les filtres : c'est la correction qui se réfutait
elle-même.** `applyStatusFix()` consigne une interaction par fiche pour
expliquer ce qu'elle écrit — c'est ce qui rend l'historique lisible six mois
plus tard. Mais `followUpStatus()` teste `activityCount === 0` pour dire
« jamais contacté ». En écrivant le statut, la correction créait l'interaction
qui le contredit : 135 notes de correction, 134 fiches n'ayant **que** cela,
18 fiches portant une interaction réelle.

Le jalon 22 avait déjà rencontré ce piège sur les rapports de prospection —
149 interactions dont 148 étaient nos propres notes — et posé `CORRECTION_OWNER`
dans `lib/api/prospecting.ts`. L'exclusion n'avait jamais atteint le statut de
relance.

### Les cinq divergences trouvées, et leur fichier

| # | Divergence | Où |
|---|---|---|
| 1 | Les notes de correction comptaient comme prise de contact | `lib/api/contacts.ts` `_count: { activities: true }` |
| 2 | Les puces filtraient sur le statut **calculé**, la pastille affichait le **saisi** | `lib/domain/follow-up.ts` `matchesContactFilter()` |
| 3 | `/accueil` et `/clients` ne lisaient jamais le champ saisi | `lib/api/dashboard.ts` `readStaleContacts()`, `lib/api/clients.ts` |
| 4 | Les outils du conseil non plus | `lib/agents/tools/reads.ts` `searchContacts` |
| 5 | « Statut figé » comptait la note de la correction comme interaction postérieure | `lib/api/contacts.ts`, dernière `activities` |

Mesures avant / après, mêmes 154 fiches :

| Surface | Avant | Après |
|---|---|---|
| stocké « Jamais contacté » | 66 | 66 |
| puce « Jamais contacté » | **2** | **68** |
| puce « Sans nouvelles » | 39 | 4 |
| puce « Déjà contactés » | 128 | 18 |
| puce « Contactés cette semaine » | 119 | 9 |
| puce « Statut figé » | 110 | 0 |
| `/accueil` en désaccord avec `/contacts` | **110 fiches** | **0** |
| `/clients` en désaccord | 0 | 0 |
| outils du conseil en désaccord | (calcul seul) | 0 |

Les 68 de la puce sont les 66 saisis plus 2 fiches sans statut saisi dont le
calcul dit « jamais » — la puce montre le **statut résolu**, pas le champ.

### Une seule décision, deux fonctions

`lib/domain/contact-status.ts` est créé au-dessus de `follow-up.ts` (le calcul)
et de `status.ts` (la saisie) — au-dessus et non entre les deux, pour que
l'ordre des dépendances reste acyclique.

- **`resolveContactStatus()`** décide du statut d'un contact. Toutes les
  surfaces l'appellent, directement ou via `ContactStatusTag`.
- **`matchesContactFilter()`** décide de ce que chaque puce sélectionne. Il a
  déménagé de `follow-up.ts`, où il ne voyait que le calcul. Aucune vue ne
  réimplémente ce prédicat.

`resolveStatus()` rend désormais une **clé canonique** (`key`) en plus du
libellé : c'est elle que les puces comparent. Un libellé saisi hors vocabulaire
du domaine — « Contacté — en attente », « Intéressé » — rend `key: null` et
n'est revendiqué par aucune puce. C'est un fait sur le vocabulaire, pas un
oubli, et le test de parité l'impose.

`lib/api/real-activity.ts` porte `CORRECTION_OWNER` et le fragment Prisma
`REAL_ACTIVITY`, posé partout où l'on **mesure** l'activité — jamais où on
l'**affiche** : la chronologie d'une fiche doit montrer les corrections.
`prospecting.ts` réexporte la constante au lieu d'en garder une copie.

### Le test de parité

`lib/domain/__tests__/status-parity.test.ts`, dans la lignée de
`column-filters-parity.test.ts` et `no-duplicate-thresholds.test.ts` : dix-huit
fiches couvrant les cinq statuts calculés croisés avec les statuts saisis, et
trois invariants — la pastille et les puces désignent le même statut ; un
contact appartient à **au plus une** puce de statut ; un libellé libre n'est
revendiqué par aucune.

Éprouvé en écrivant d'abord une assertion trop forte : le test a signalé que
`due`, `planned` et `waiting` n'ont **pas** de puce, ce qui est correct — `due`
et `planned` sont couverts par la puce de date « À relancer », `waiting` est
l'état par défaut. L'invariant a été resserré sur ce fait plutôt que l'inverse.

### Jalon 27 — ce qui est vérifié

Contre un vrai PostgreSQL 16, 154 fiches issues de la feuille, correction des
statuts appliquée :

- **0 désaccord** entre `/contacts`, `/accueil`, `/clients` et les outils du
  conseil, contact par contact, sur le libellé réellement affiché ;
- **0 fiche** portant « Jamais contacté » en base et absente de la puce, contre
  66 avant ; **0 fiche** dans la puce portant un autre statut saisi ;
- `never ∩ contacted = 0`, `recent ⊆ contacted`, `answered ⊆ contacted` ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (608 tests) verts.

### Jalon 27 — ce qui n'est pas fait, et vous attend

**La seconde rangée de puces n'a pas été réduite** — c'est votre décision. Ce
qu'elles sélectionnent, mesuré :

| Puce | Sélectionne | Verdict |
|---|---|---|
| À relancer | toute relance programmée (date) | garder — c'est le pipeline de relances |
| Sans nouvelles | statut résolu `silent` | garder |
| Jamais contacté | statut résolu `never` | garder |
| Statut figé | statut saisi antérieur à la dernière vraie interaction | garder — outil d'hygiène |
| Déjà contactés | ≥ 1 interaction réelle | **redondant** : c'est le complément exact de « Jamais contacté » |
| Contactés cette semaine | ≥ 1 interaction < 7 j | sous-ensemble de « Déjà contactés » |
| Ont répondu | ≥ 1 interaction à issue ≠ « pas de réponse » | sous-ensemble de « Déjà contactés » |

Les trois dernières viennent des bandes de l'entonnoir de l'accueil (jalon 20),
où chaque bande devait mener quelque part. Recommandation : **retirer « Déjà
contactés »** (strictement complémentaire de « Jamais contacté », donc du bruit)
et **garder « Contactés cette semaine » et « Ont répondu »**, qui ne se
déduisent d'aucune autre — au prix de conserver leur cible pour les liens de
l'entonnoir. Cinq puces plutôt que sept.

**Les chiffres viennent d'une base reconstituée**, pas de la vôtre. La
répartition de production différera ; le mécanisme, lui, est celui-ci.

**La puce « Ont répondu » renvoie 0** sur cette base — aucune interaction n'y
porte d'issue renseignée. Le filtre est correct, la donnée manque.

---

## Jalon 28 — un cycle de vie terminal n'attend rien

### La contradiction

Une fiche affichait sur la même ligne : cycle `Perdu`, statut saisi
« Contacté — en attente », « jamais contacté » à droite, et « 0 tentative ».
Trois de ces quatre affirmations parlent d'attente ; la première dit que la
relation est finie.

**La règle manquait au domaine.** `resolveStatus()` ne connaissait que le couple
saisi/calculé et ignorait le cycle de vie, si bien que chaque surface affichait
consciencieusement un statut de relance sur une fiche qui n'attend plus rien.

### La règle, et où elle vit

`lib/domain/lost.ts` porte `TERMINAL_LIFECYCLES` — `Perdu` et `Ancien Client` :
l'un a dit non, l'autre a cessé d'acheter. `resolveContactStatus()` rend
désormais **`null`** pour ces deux cycles, avant toute autre considération.

Conséquences, obtenues sans qu'aucune vue n'ait à y penser :

- `ContactStatusTag` **ne rend rien** quand le cycle est terminal : l'en-tête ne
  peut plus afficher deux pastilles d'état à la fois ;
- aucune puce de statut ne revendique une fiche terminale ;
- l'accueil, le portefeuille et les outils du conseil se taisent pareillement —
  l'outil du conseil rend `statutDeRelance: null` plutôt qu'un libellé inventé ;
- l'en-tête de fiche supprime aussi l'échéance, le « Aucune relance
  programmée » et le « jamais contacté », et affiche le motif de perte à la
  place.

### L'écriture est uniforme

`TERMINAL_RESET` — `status: ""`, `statusSetAt: null`, `nextReminder: null` —
est appliqué par **tous** les chemins :

| Chemin | Avant | Après |
|---|---|---|
| formulaire / tiroir (`updateContact`) | effaçait la relance, **au passage seulement** | efface les trois champs dès que le cycle **résultant** est terminal |
| interaction « Répondu — pas intéressé » (`logActivity`) | effaçait la relance, écrivait `status: "Perdu"` | efface les trois champs |
| tâche miroir de relance | refermée au passage | refermée dans les deux cas |

La condition porte sur le cycle **résultant**, pas sur la transition : une fiche
déjà `Perdu` à laquelle on écrit un statut par ailleurs est nettoyée elle aussi.
C'est ce que l'ancienne version, qui ne réagissait qu'au passage, laissait
passer.

### La correction de l'existant

`planTerminalFix()` / `applyTerminalFix()`, avec les garanties habituelles :
simulation d'abord, sauvegarde JSON, idempotent, **trois champs et rien
d'autre** — cycle de vie, motif de perte, notes et historique intacts — et la
tâche miroir de relance refermée, parce qu'une échéance effacée laissant sa
tâche ouverte serait le même mensonge déplacé.

### Le tiroir

**Je n'ai pas reproduit l'échec du ✕.** Testé dans un navigateur piloté sur les
huit tiroirs de l'application — contact, société, affaire, tâche, import,
créations — le bouton ferme à chaque fois, entre 65 et 570 ms, sans une erreur
en console ; `elementFromPoint` sur le centre du bouton renvoie bien le bouton.
Le dire plutôt que d'inventer une cause.

Trois défauts réels ont été trouvés et corrigés en cherchant, chacun capable de
produire ce symptôme :

1. **L'effet dépendait de `onClose`**, dont l'identité est neuve à chaque rendu
   du parent. Il rejouait donc à chaque rendu et **reprenait le focus sur le ✕**
   pendant qu'on travaillait dans le tiroir. `onClose` est désormais lu dans une
   référence, et l'effet ne dépend plus que de `open`.
2. **Le voile et le panneau étaient tous deux à `z-50`**, départagés par le seul
   ordre du DOM. Un portail, une transition ou un fragment inséré entre eux
   aurait suffi à faire passer le voile devant le ✕ — le bouton devient inerte
   sans que rien ne paraisse anormal. Voile à `z-40`, panneau à `z-50`, bouton
   `relative z-10` dans son en-tête.
3. **Le voile fermait sur n'importe quel clic**, même quand le geste avait
   commencé dans le panneau : une sélection de texte tirée trop loin refermait
   le tiroir. Il ne ferme plus que si `mousedown` **et** `click` ont eu lieu sur
   lui.

**Échap fermait déjà** — c'était en place depuis l'origine. Ce qui manquait, et
qui est ajouté : **le focus revient à la ligne d'où l'on vient**. Sans cela il
retombait sur `body` et la tabulation suivante repartait du haut de la page.

### Jalon 28 — ce qui est vérifié

Contre un vrai PostgreSQL 16, sur la base issue de la feuille :

- **détection** : 12 fiches `Perdu` portant « Contacté — en attente » et une
  relance sont listées ; application → 12 corrigées, `status`, `statusSetAt` et
  `nextReminder` vidés, **motif de perte, notes et cycle de vie intacts**,
  0 tâche de relance ouverte restante ; second passage → **0** ;
- **passage en Perdu par le formulaire** : statut, date et relance effacés,
  tâche miroir refermée, statut résolu `null` ;
- **passage en Perdu par une interaction « pas intéressé »** : même résultat ;
- **à l'écran**, fiche `Perdu` : **une seule pastille** (« Perdu »), aucun
  « jamais contacté », aucun « Aucune relance programmée » ;
- **✕ ferme en 421 ms et rend le focus à la ligne d'origine** ; **Échap ferme**
  aussi ; aucune erreur en console ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (612 tests) verts.

### Jalon 28 — ce qui n'est pas résolu

**La cause de votre ✕ inerte reste inconnue.** Les trois défauts corrigés
peuvent l'expliquer — le vol de focus surtout, qui déplace le curseur pendant
qu'on vise — mais ce n'est pas établi. Si le symptôme persiste après ce
déploiement, ce qu'il faudrait savoir : sur quelle page, après quel geste, et
si la page derrière reste bloquée en défilement.

**« 0 tentative(s) · 0 réponse(s) » subsiste sur une fiche perdue.** Ce n'est
pas une contradiction mais un fait : depuis le jalon 27, ce compteur ne compte
que les interactions réelles, et une fiche importée puis passée en `Perdu`
depuis la feuille n'en a effectivement aucune.

---

## Jalon 29 — la règle terminale s'applique à la lecture, ou elle ne s'applique pas

### Le diagnostic, d'abord : les deux causes étaient vraies

La question posée était « déploiement pas encore en ligne, ou bien la table lit
la valeur brute ? ». La réponse est **les deux**, et il fallait les séparer :

1. **Le correctif du jalon 28 n'a jamais atteint la production.** Railway déploie
   depuis `main` ; `main` était **35 commits en retard** sur
   `claude/wonderful-cannon-1s8sd2`, et la PR n'était pas fusionnée. Reginald
   André et Carine Bozon s'affichaient donc avec le code d'avant le jalon 28.
   C'est la cause de ce qui était à l'écran.
2. **Mais la règle était bel et bien contournable**, et deux surfaces la
   contournaient :
   - `components/clients/clients-table.tsx:131` rendait
     `<ContactStatusTag status={…} followUp={…} />` **sans `lifecycle`** ;
   - `clients-table.tsx:90`, `stale-contacts.tsx:103` et
     `contact-table-columns.tsx:121` appelaient `resolveStatus()` en direct pour
     la couleur d'alerte — donc lisaient la valeur stockée brute.

Le second point est celui qui méritait le travail : sans lui, fusionner aurait
corrigé `/contacts` et laissé `/clients` mentir.

**Le cas de Carine Bozon dit pourquoi la règle ne peut pas être « ne pas écrire
de statut ».** Son champ `status` est **vide** : « Sans nouvelles · 31 j » venait
du **calcul**, pas d'une valeur stockée. Aucune correction de données n'aurait pu
l'atteindre — il n'y avait rien à nettoyer. Seule une règle appliquée à la
lecture pouvait la faire taire.

### Le champ facultatif était la faille

`ContactStatusLike.lifecycle` et la prop `lifecycle` de `ContactStatusTag`
étaient **facultatifs**, « pour les appelants qui n'en disposent pas ». Un champ
facultatif qui porte une règle d'affichage est une règle qu'on peut oublier
d'appliquer, et l'oubli ne se voit pas : la pastille s'affiche, simplement elle
ment.

Les deux sont désormais **obligatoires**. Le compilateur refuse un appelant qui
ne fournit pas le cycle de vie — c'est la moitié de la garantie, et elle est
gratuite : tous les appelants sauf `/clients` le fournissaient déjà.

### Une seule porte

```
lib/domain/status.ts            couche basse : saisi contre calculé
        ↑ (n'est plus importé que par contact-status.ts)
lib/domain/contact-status.ts    resolveDisplayStatus()  ← LA règle terminale
        ↑                       resolveContactStatus()  ← délègue à la précédente
        ↑                       contactAttention()      ← la couleur, même règle
components/ui/primitives.tsx    ContactStatusTag → resolveDisplayStatus()
```

`resolveDisplayStatus({status, followUp, lifecycle})` porte l'unique
`if (isTerminal(…)) return null`. Elle prend un `followUp` **déjà calculé**
plutôt que les réglages et l'horloge, parce que c'est ce dont disposent les
composants ; `resolveContactStatus()` calcule d'abord puis l'appelle. **Il
n'existe aucun chemin qui rende un statut sans passer par ce `return null`.**

`contactAttention()` étend la règle au rouge de « dernière touche » : une fiche
perdue ne peut pas être « en retard », il n'y a plus de rendez-vous à honorer.

### Ce que la correction de données devient

**Elle ne rend plus l'écran correct — l'écran l'est déjà.** Le bloc s'appelle
désormais « Rangement : statuts périmés des fiches terminales » et sa phrase de
résumé le dit : *« Aucun de ces statuts n'est affiché nulle part : l'écran
applique déjà la règle à la lecture. »* Son `hint` s'ouvre sur « Facultatif ».

La valeur stockée reste en base, et c'est délibéré : c'est de l'histoire.
L'effacer ne sert qu'à rendre les exports et les requêtes directes aussi propres
que l'écran. **On n'a jamais besoin de cliquer pour qu'un écran cesse de
mentir** — une consultation qui doit écrire pour être juste est exactement ce
qu'on a refusé aux agents au jalon 8.

### Deux tests, et ce qu'ils attrapent

**`status-single-source.test.ts` (nouveau).** Parcourt `lib/`, `app/` et
`components/` et échoue si un fichier hors liste blanche **importe**
`resolveStatus`. Liste blanche : `contact-status.ts` (le décideur), `status.ts`
(le module), `maintenance.ts` (qui raisonne sur la valeur stockée — c'est son
objet). Un second cas fixe que la prop `lifecycle` reste obligatoire.

**`status-parity.test.ts` (étendu).** Trois surfaces simulées — la pastille, les
outils du conseil, la couleur d'alerte — croisées avec les cinq cas terminaux de
la population. Plus deux garde-fous contre le test qui se satisfait de rien : un
test vérifie que les surfaces **affichent** bien quelque chose sur les fiches non
terminales (sans quoi tout supprimer rendrait le premier vert), et un autre que
**chaque** cycle de `TERMINAL_LIFECYCLES` est représenté dans la population
(sans quoi un cycle ajouté demain resterait hors du test).

**Éprouvés en réintroduisant la lecture brute**, comme demandé :

| Régression réintroduite | Ce qui tombe |
|---|---|
| `clients-table.tsx` remis à `resolveStatus()` sans `lifecycle` | `status-single-source` : « components/clients/clients-table.tsx:3 importe resolveStatus » — **et** `tsc` : « Property 'lifecycle' is missing » |
| `return null` retiré de `resolveDisplayStatus()` | 3 tests, dont la liste nominative des fuites par surface : « Perdu + statut saisi contradictoire → outils du conseil affiche « Contacté — en attente » » |

### Jalon 29 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (154 fiches issues de la feuille) et le serveur
standalone de production, sur une base **délibérément contradictoire** et
**sans avoir lancé aucune correction** :

- **11 fiches terminales portant un statut stocké** injectées en base
  (« Contacté — en attente », « Sans nouvelles », « Jamais contacté » sur
  `Perdu` et `Ancien Client`) ;
- **les deux cas signalés reproduits à l'identique** : Reginald André en `Perdu`
  avec « Contacté — en attente » **stocké**, Carine Bozon en `Perdu` au statut
  **vide** et 31 jours de silence — donc un libellé venu du calcul. Les deux
  lignes rendent une **colonne Statut vide** dans le navigateur ;
- **couche de service** : `/contacts?lifecycle=Perdu` 46 lignes → **0 pastille** ;
  `/contacts?lifecycle=all` 51 lignes terminales → 0 ; `/clients` → `lifecycle`
  présent sur chaque ligne ; `/accueil` → 0 ligne terminale (exclusion de
  périmètre, désormais doublée de la règle) ; **0 fuite** ;
- **aucune écriture** : les 11 fiches portent toujours leur statut stocké après
  lecture de toutes les surfaces — la consultation ne corrige rien en base ;
- **navigateur** : `/contacts?lifecycle=Perdu` 46 lignes et
  `/contacts?lifecycle=Ancien Client` 5 lignes, **toutes terminales par
  construction du filtre**, → **0 statut de relance affiché** ; tiroir d'une
  fiche perdue → `pastilles : ["Perdu"]`, aucun statut de relance, ni « jamais
  contacté » ni « Aucune relance programmée » ; **0 réponse HTTP ≥ 400, 0 erreur
  console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**617 tests**) verts.

### Jalon 29 — ce qui ne l'est pas

**`/clients` ne peut pas exhiber le défaut aujourd'hui** : `readClients()`
interroge `where: { lifecycle: "Client" }`, donc aucune fiche terminale n'y
entre. La correction y est structurelle, pas observable — le `lifecycle` voyage
maintenant jusqu'à la ligne pour que la pastille cesse d'être juste **par
accident du périmètre de la requête**. Le jour où le portefeuille inclurait les
anciens clients, rien n'aurait à bouger dans le composant.

**La seconde rangée de puces n'est toujours pas réduite** — c'est votre décision,
en attente depuis le jalon 27 (retirer « Déjà contactés », garder « Contactés
cette semaine » et « Ont répondu » : cinq puces au lieu de sept).

**La garde statique porte sur les imports, pas sur toute lecture concevable.**
Un composant qui afficherait `{contact.status}` en texte brut ne serait pas
attrapé — aucun n'en fait autant aujourd'hui, et ce serait un autre défaut que
celui-ci. Ce que le test ferme, c'est le chemin par lequel la règle a réellement
été contournée deux fois.
