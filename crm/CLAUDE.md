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
