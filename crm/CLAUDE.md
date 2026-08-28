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
| `closed` sur `paper` (fiche close) | 4.86:1 | AA texte |
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
| `SMTP_PASSWORD` | **jalon 32** | mot de passe de la boîte d'envoi — **serveur uniquement**, jamais en base. **Sert aussi à IMAP** depuis le jalon 37 : c'est la même boîte |
| `CRM_PUBLIC_URL` | jalon 37 | adresse publique du CRM, pour composer l'URL du pixel de suivi. À défaut, `RAILWAY_PUBLIC_DOMAIN`. Absente, **aucun pixel n'est posé** |
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
| 30 | **La fiche close se lit « Perdu »** — le cycle de vie devient le statut affiché, en gris, trié en fin | **livré, à valider** |
| 31 | **« Déjà contactés » retirée** — six puces, la valeur reste valide pour l'entonnoir | **livré, à valider** |
| 32 | **Emails** — conseil réduit à Alex et Sabrina, SMTP IONOS, mise en forme fidèle, rédaction depuis un échange | **livré, à valider** |
| 33 | **Les agents dans le rail** — panneau latéral, contexte entreprise, signature imposée, reprise du brouillon | **livré, à valider** |
| 34 | **Le vrai pitch** — Personal Shoppers, signature et lien réglables, conversation avec Alex | **livré, à valider** |
| 35 | **Deux signataires** — sélecteur Yanis/Mohamed, nouveau mail de référence, reprise fidèle | **livré, à valider** |
| 36 | **Le coût de l'API, mesuré puis coupé** — compteur par appel, un modèle par usage, plafond mensuel | **livré, à valider** |
| 37 | **Les emails laissent une trace** — copie IMAP dans « Envoyés », journal des envois, section Emails, suivi d'ouverture assumé comme estimation | **livré, à valider** |
| 38 | **Séquences d'emails** — trois étapes, file du matin, mode automatique à double verrou, plafonds qui apprennent du refus | **livré, à valider** |
| 39 | **`/emails` refondu** — graphiques conditionnés à l'histoire, entonnoir, journal des envois, « Sans réponse », par signataire | **livré, à valider** |
| 40 | **« Ma performance »** — activité par canal et par jour, comparée ; réponses par canal ; Yanis/Mohamed côte à côte ; régularité et objectifs | **livré, à valider** |
| 41 | **Détection automatique des réponses** — relevé IMAP d'INBOX toutes les 15 min, en-têtes seuls, rapprochement exact, séquences arrêtées | **livré, à valider** |
| 42 | **La restauration ne perd plus rien** — 44 colonnes de réglages au lieu de 11, garde anti-perte, bandeau du relevé non configuré | **livré, à valider** |
| 43 | **Le relevé s'explique, les ouvertures se trient** — détail message par message, pixel retiré de la copie « Envoyés », chargements enregistrés et classés | **livré, à valider** |
| 44 | **L'identifiant stocké n'était pas celui qui partait** — nodemailer en fabriquait un en envoi `raw` ; rattrapage depuis « Envoyés », envois orphelins re-rattachés | **livré, à valider** |
| 45 | **Une réponse rapprochée qui ne produit rien se voit et se répare** — compteur et bandeau dédiés, relevé auto-réparant, doublons nommés | **livré, à valider** |
| 48 | **Instagram entre dans la prospection** — DM consigné comme un canal, segment isolable, Alex qui ne mentionne le DM que s'il existe et nomme le vrai site, comparaison DM+email contre email seul | **livré, à valider** |
| 47 | **Sortir une affaire du pipeline** — « perdue » avec motif et réouverture exacte, suppression refusée dès qu'il y a une histoire, menu ⋯ sur les cartes, société héritée du contact | **livré, à valider** |
| 46 | **Le CRM tient dans la main** — rail repliable partout (cookie, Ctrl+B, surcouche mobile), tableaux en cartes sous `lg`, cibles tactiles à 44 px, /reglages assumé bureau | **livré, à valider** |
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
l'entonnoir. Six puces plutôt que sept.

*(Décidé au jalon 31 : retrait appliqué. Le compte annoncé ici disait d'abord
« cinq », ce qui était une erreur d'arithmétique — sept moins une en fait six.)*

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

---

## Jalon 30 — une fiche close se lit « Perdu », pas une case vide

### Le défaut du jalon 29

La règle était juste et l'écran illisible. `resolveDisplayStatus()` rendait
`null` pour un cycle terminal, donc la colonne Statut restait **vide** — or
c'est la première colonne qu'on lit. Une case vide ne dit pas « cette fiche est
close » : elle ne dit rien, et on va chercher ailleurs ce qu'elle aurait dû
répondre.

### Le cycle de vie devient le statut affiché

`resolveDisplayStatus()` ne rend plus `null` : elle rend le **cycle de vie
lui-même**, marqué `terminal: true`. `ResolvedStatus` porte donc un quatrième
champ, et c'est lui qui permet à la couleur, aux puces et au tri de traiter ces
lignes comme closes sans que chaque surface ait à le savoir.

| Champ | Valeur pour une fiche close | Effet |
|---|---|---|
| `label` | `Perdu` / `Ancien Client` | la colonne Statut redevient lisible |
| `terminal` | `true` | ton gris, suffixe supprimé, tri en fin |
| `attention` | `false` | **jamais de rouge, jamais de liste de travail** |
| `key` | `null` | aucune puce de statut ne la revendique |

**La règle reste à un seul endroit.** Aucune surface ne teste le cycle de vie
pour décider quoi afficher : elles affichent ce que le domaine rend. La garde
statique du jalon 29 (`status-single-source.test.ts`) est inchangée et continue
de fermer le contournement.

### Les trois conséquences, traitées

**1. Jamais d'alerte.** `contactAttention()` rend `false` — c'est
mécanique, il lit `resolveDisplayStatus().attention`. Deux trous ont été trouvés
et bouchés en vérifiant, tous deux hors de la fonction :

- **`matchesContactFilter()` laissait passer la puce « À relancer ».** Elle porte
  sur une **date**, pas sur un statut : une fiche perdue dont l'échéance dort
  encore en base y remontait. Le test du jalon 28 fixait même ce comportement
  comme voulu (« c'est ce que la correction nettoie »). Il ne l'est plus :
  afficher « Perdu » dans la colonne Statut ne doit rien rouvrir, et la valeur
  stockée n'étant volontairement pas effacée, l'exclusion doit être explicite.
- **`readActionQueue()` et `readTomorrow()` n'excluaient que `Perdu`**, pas
  `Ancien Client` (`lib/api/dashboard.ts`). Un ancien client portant une relance
  entrait donc dans la file du jour, et dans le dénominateur de l'anneau.
  Les deux lisent maintenant `TERMINAL_LIFECYCLES`.

**2. Pas de doublon.** La colonne Statut garde le libellé — c'est là qu'on
regarde. Là où les deux pastilles sont **côte à côte**, `LifecycleTag` disparaît
sur une fiche close :

| Endroit | Décision |
|---|---|
| en-tête du tiroir (`contact-header.tsx`) | la pastille de statut garde « Perdu » ; le motif de perte reste affiché juste après |
| cellule « Cycle de vie » de `/accueil` (`stale-contacts.tsx`) | idem, même cellule |
| colonne « Cycle de vie » de `/contacts` | **conservée** — colonne dédiée, hors des six par défaut, et elle porte aussi le motif de perte. La vider serait l'effacer précisément pour les lignes dont elle parle. Sur la vue par défaut, « Perdu » n'apparaît donc qu'une fois. |

Le **suffixe** est supprimé lui aussi : sans cela une fiche close silencieuse
depuis un mois affichait « Perdu · 31 j », c'est-à-dire un décompte là où il n'y
a plus rien à décompter.

**3. Tri en fin, dans les deux sens.** `compareByStatus()` (domaine) partitionne
avant de comparer : le sens ne s'applique qu'aux fiches actives. Inverser le tri
ne peut donc pas ramener des « Perdu » en tête d'une liste de travail. C'est le
même principe que les relances sans date du tri par échéance.

### Un contraste sous le seuil, trouvé en calculant

Le ton `mute` était `text-muted` sur `bg-paper` : **4.15:1**, sous le seuil AA de
4.5. Tant qu'il ne portait qu'un mot secondaire, cela passait ; il porte
désormais le libellé de la colonne Statut. Jeton `--color-closed: #616780`
ajouté — **4.86:1 sur `paper`**, 5.58:1 sur blanc — et `mute` l'utilise. `muted`
ne bouge pas : il porte tout le texte secondaire du produit et ses 4.9:1 sur
blanc sont conformes.

### Le test de parité, étendu et non remplacé

Son intention est la même — toutes les surfaces s'accordent, contact par contact
— mais l'accord attendu sur une fiche close passe de « aucune ne montre rien » à
« toutes montrent le cycle de vie, en style terminal, et aucune n'y voit du
travail ». Quatre cas ajoutés : le libellé propre à chaque cycle terminal,
l'absence d'attention sur toute la population close, l'exclusion de « À
relancer », et le tri dans les deux sens.

**Éprouvé en réintroduisant trois régressions distinctes :**

| Régression | Ce qui tombe |
|---|---|
| la pastille retombe sur la lecture brute | 4 tests, dont « Perdu, sans statut saisi → pastille affiche « Sans nouvelles » au lieu de « Perdu » » |
| `attention: true` sur une fiche close | 3 tests, dont « n'appelle jamais l'attention, donc ne rougit aucune ligne » |
| la partition du tri retirée | « sens 1 : une terminale précède une active: expected 0 to be greater than 3 » |

### Jalon 30 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (154 fiches) et le serveur standalone de
production, sur une base portant **12 fiches closes au statut stocké
contradictoire**, sans lancer aucune correction :

- **couche de service** : `/contacts?lifecycle=Perdu` 47 lignes → libellés
  `["Perdu"]`, toutes marquées `terminal`, **0 en alerte** ;
  `?lifecycle=Ancien Client` 5 lignes → `["Ancien Client"]`, idem ;
- **0 fiche close** dans la puce « À relancer » (9 lignes), **0** dans la file
  d'accueil (25 lignes), **0** dans « dernière touche » (102 lignes) ;
- **tri par Statut** : 154 lignes, première close en position 102, dernière
  active en 101 — **dans les deux sens** ;
- **aucune écriture** : les 12 fiches portent toujours leur statut stocké ;
- **navigateur** : colonne Statut `{"Perdu": 47}` et `{"Ancien Client": 5}`,
  couleur du texte `rgb(97, 103, 128)` = `#616780`, **0 ligne en rouge** ;
  tiroir → « Perdu » **une seule fois**, pastilles d'état `["Perdu"]` ; tri
  vérifié dans les deux sens ; **0 réponse HTTP ≥ 400, 0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**620 tests**) verts.

### Jalon 30 — ce qui ne l'est pas

**Les outils du conseil rendent désormais `statutDeRelance: "Perdu"`** au lieu de
`null`. C'est ce que la parité exige — toutes les surfaces disent la même chose —
mais un agent lit donc « Perdu » dans un champ nommé « statut de relance », alors
que `cycleDeVie` porte déjà l'information. Ce n'est pas faux, c'est redondant.
Renommer le champ serait le geste juste ; il touche les prompts et les schémas
d'outils, et n'appartient pas à ce jalon.

**La colonne « Cycle de vie » de `/contacts` duplique « Perdu »** avec la colonne
Statut si on l'active. Choix assumé et expliqué plus haut : elle est hors des six
colonnes par défaut, et la vider reviendrait à l'effacer pour les lignes qu'elle
décrit le mieux.

**La seconde rangée de puces n'est toujours pas réduite** — décision en attente
depuis le jalon 27.

---

## Jalon 31 — une puce en moins, et pas une vue en moins

Décision prise par le propriétaire du produit, en attente depuis le jalon 27 :
**retirer « Déjà contactés », garder les autres.** Six puces au lieu de sept.

Correction d'arithmétique au passage : le jalon 27 annonçait « cinq puces
plutôt que sept » pour une seule suppression. C'était faux, et le chiffre est
rectifié là où il a été écrit.

### Pourquoi celle-là

« Déjà contactés » retient les fiches ayant au moins une interaction réelle —
c'est le **complément exact** de « Jamais contacté ». Deux puces qui partagent
la même frontière font choisir entre deux formulations d'une seule question, et
celle-ci sortait toujours tout le reste du portefeuille, ce que « Tous » fait
déjà.

Les deux autres de la rangée restent : « Contactés cette semaine » et « Ont
répondu » ne se déduisent d'aucune autre.

### La valeur reste valide — et c'est le point

**Retirer la puce n'est pas retirer la vue.** La bande « contactés » de
l'entonnoir de l'accueil pointe sur `/contacts?lifecycle=all&followUp=contacted`,
et des vues mises en favori aussi. Supprimer la valeur casserait un lien qui
fonctionne, pour ne rien gagner : ce qu'on retire, c'est la question posée deux
fois dans la barre de filtres, pas la lecture qu'ouvre l'entonnoir.

D'où la séparation, dans `lib/domain/follow-up.ts`, entre deux notions qui
n'étaient qu'une :

| | Contenu | Rôle |
|---|---|---|
| `CONTACT_FILTERS` | les 7 valeurs | ce que l'URL et le schéma Zod acceptent |
| `CONTACT_CHIPS` | les 6 proposées | ce que la barre de filtres affiche |

`isChipFilter()` tranche entre les deux. `HIDDEN_CHIPS` liste les exceptions —
aujourd'hui `contacted` seule.

### Le filtre orphelin s'affiche quand même

Un filtre actif sans puce serait invisible : la liste serait filtrée, rien à
l'écran ne dirait lequel, et on ne pourrait l'annuler qu'en éditant l'URL.
C'est exactement l'écran qui ment que « Filtres · 1 actif » cherche à empêcher
depuis le jalon 21.

`ContactChips` rend donc une puce de rattrapage **tant que le filtre est
actif** : elle porte son libellé, elle est marquée active, et un clic la
retire. Elle disparaît dès qu'on choisit autre chose. Arriver par l'entonnoir
donne donc exactement la même barre qu'avant, plus une puce ; partir de
`/contacts` n'en montre que six.

### Jalon 31 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (154 fiches) et le serveur standalone :

- **barre par défaut** : `["Tous", "À relancer (15 · 6 en retard)", "Sans
  nouvelles", "Jamais contacté", "Statut figé", "Contactés cette semaine", "Ont
  répondu", "Contacts incomplets (1)"]` — **« Déjà contactés » absente** ;
- **arrivée par l'entonnoir** (`?followUp=contacted`) : la puce apparaît, elle
  est **active**, la liste rend 15 lignes, et le bouton annonce
  « Filtres · 1 actif » ;
- **la bande de l'entonnoir existe toujours** sur `/` et pointe bien sur
  `/contacts?lifecycle=all&followUp=contacted` ; elle ouvre les 15 mêmes lignes ;
- **0 réponse HTTP ≥ 400, 0 erreur console** ;
- trois tests fixent la décision : le jeu des six puces dans l'ordre, le fait
  que `contacted` reste une valeur valide sans puce, et que toute valeur sans
  puce garde un libellé — sans quoi la puce de rattrapage sortirait vide ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**623 tests**) verts.

### Jalon 31 — ce qui ne l'est pas

**La puce de rattrapage n'a pas de test de rendu**, comme tout le reste des
composants clients de ce projet : elle est vérifiée dans un navigateur piloté,
pas par la suite, qui n'a pas de DOM.

**`emptyFilterMessage("contacted")` est conservé** : la valeur reste
atteignable, donc son état vide doit continuer de nommer sa règle. Ce n'est pas
du code mort.

---

## Jalon 32 — les emails, et un conseil réduit à deux

### Le conseil : deux visibles, neuf définis

Alex (Emails) et Sabrina (Directrice des Opérations) sont seuls affichés. Les
sept autres — Victor, Oxana, Noah, Sarah, Héloïse, Étienne, Brutus — sont
**désactivés, pas supprimés** : `enabled = false` en base, définitions
conservées dans le code.

**Leurs données sont intactes et interrogeables.** Vérifié sur la base de
production reconstituée : Sarah, désactivée, garde ses 3 conversations, sa
recommandation et sa vacation. Réactiver un agent est un interrupteur dans
`/reglages` ; le supprimer aurait été irréversible.

Quatre surfaces devaient respecter `enabled`, et **deux ne le faisaient pas** :

| Surface | État |
|---|---|
| roster et bande de `/conseil` | filtrait déjà |
| `/reglages` → Conseil | montre tout le monde, c'est son rôle — c'est là qu'on réactive |
| **lanceur de vacations** | **ne filtrait pas.** Sarah porte une vacation quotidienne : sans correctif, elle aurait continué d'appeler l'API tous les matins pour un agent que personne ne voit. Le filtre est dans `runAllShifts()`, pas dans la liste `SHIFTS` — l'activation est de la donnée, une liste écrite en dur ne peut pas la connaître |
| **`POST /api/conversations`** | **ne vérifiait que le verrou d'environnement**, pas l'activation. Un agent retiré du conseil restait joignable par un appel direct : une porte que l'écran ne montre plus mais qui n'était pas fermée |

### Alex

`slug: "alex"`, prompt propre (`lib/agents/prompts/alex.ts`), quatre amorces,
portrait téléversable comme les autres. **Outils en lecture seule**, et c'est
délibéré : l'envoi n'est pas un outil d'agent. En faire un rendrait possible un
courriel décidé par une boucle de modèle — or c'est la moins réversible des
écritures, et « aucune écriture sans clic » l'interdit. Alex propose un texte ;
c'est un formulaire relu par un humain qui déclenche l'envoi.

### La mise en forme, qui est le vrai sujet

`lib/domain/email-format.ts`, **pur et testé** : les règles se vérifient sans
réseau, ce qui compte parce qu'elles sont exactement le genre de chose qu'on
croit juste en lisant le code et qui se révèle fausse à la réception.

- `text/plain` **et** `text/html`, en `multipart/alternative` ;
- le texte n'est **pas reformaté** : aucune coupure à 72 colonnes, aucune
  retouche. Les lignes vides séparent les paragraphes, les fins de ligne
  internes sont conservées ;
- le HTML n'est que des `<p>`, avec `<br>` pour les fins de ligne internes.
  Aucun style, aucune police, aucune couleur, aucun tableau, aucune image,
  aucun pixel de suivi. Un test énumère les huit motifs interdits ;
- un test croisé vérifie que **les deux parties comptent le même nombre de
  paragraphes** — sans quoi elles se contrediraient selon le client ;
- `sanitizeSubject()` coupe les fins de ligne : le sujet vient d'un champ libre
  et, désormais, d'un modèle. Un retour à la ligne dans un en-tête est une
  injection, pas un détail d'affichage.

`Message-ID` porte **le domaine de l'expéditeur** : celui de nodemailer aurait
porté le nom d'hôte de la machine, donc un identifiant de conteneur Railway —
un signal négatif pour les filtres.

### SMTP, et le mot de passe qui n'entre pas en base

Configuration en base (hôte, port, chiffrement, identifiant, adresse et nom
d'expédition), **mot de passe dans `SMTP_PASSWORD` uniquement**. `lib/api/mail.ts`
porte `import "server-only"` ; aucune fonction ne rend la valeur ; le panneau
apprend seulement si elle est **définie**. Conséquence voulue : une sauvegarde
JSON, un export ou un `SELECT * FROM settings` ne peuvent pas la contenir.
`no-key-in-bundle.test.ts` cherche désormais `SMTP_PASSWORD` en plus de la clé
Anthropic.

`requireTLS` est posé en mode STARTTLS : sans lui, un serveur qui n'annonce pas
STARTTLS ferait passer le mot de passe en clair sans rien dire.

**« Tester l'envoi » rend l'erreur du serveur, pas un « échec ».** Même leçon
qu'au jalon 16 : `describeSmtpError()` distingue authentification refusée,
connexion impossible, délai dépassé et expéditeur refusé, **et cite la réponse
brute**. Vérifié avec un mauvais mot de passe : « Authentification refusée par
le serveur : identifiant ou mot de passe incorrect. Réponse du serveur : 535
5.7.8 Error: authentication failed: bad credentials (code EAUTH) ».

**La réception est hors périmètre, et le panneau le dit en toutes lettres** pour
qu'on n'attende pas dans le CRM des réponses qui arrivent dans la messagerie.

### Envoyer, puis consigner — l'ordre n'est pas symétrique

`sendEmailToContact()` envoie **d'abord**, consigne ensuite. Une interaction
écrite pour un message que SMTP a refusé serait un mensonge indiscernable d'un
envoi réussi ; un envoi réussi dont la consignation échoue laisse un courriel
réellement parti et une erreur à l'écran — désagréable, mais vrai.

L'interaction est de type `email`, porte **objet et corps** (« je lui ai écrit
quoi, déjà ? » se répond depuis la chronologie), et **aucune issue** : on vient
d'écrire, on ne sait pas encore si l'on a été lu. Renseigner une issue ferait
entrer l'envoi dans le taux de réponse, qui ne compte que les échanges dont le
résultat est connu.

Un défaut trouvé à la vérification : l'interaction héritait du propriétaire de
la fiche, **vide** sur beaucoup de contacts importés — l'envoi serait sorti des
tableaux par propriétaire de `/rapports`. Elle passe désormais par
`ownerOrDefault()`, comme le formulaire d'interaction.

### Le déclencheur

« Rédiger un email » apparaît sur la confirmation d'interaction, **quelle que
soit l'issue** : un « pas de réponse » est précisément le moment où l'on écrit.
L'identifiant de l'échange voyage jusqu'au brouillon, et le contexte le
**désigne** (`← L'ÉCHANGE QUI VIENT D'AVOIR LIEU`) plutôt que de le noyer dans
la liste — sans quoi le message retomberait sur une relance générique.

Le contexte est collecté par le serveur, pas cherché par le modèle : même
principe que les briefings du jalon 14. Dix interactions au plus, le statut
résolu, la société, les affaires. Trois conséquences : le message ne peut pas
inventer un échange, il n'y a **aucun appel d'outil** donc une seule requête, et
l'entrée est bornée.

**L'adresse du destinataire est affichée en grand** dans le panneau, et c'est le
seul ornement : se tromper de personne est la seule faute qu'aucune annulation
ne rattrape. L'envoi part sans seconde confirmation, comme demandé — le texte
est sous les yeux et modifiable jusqu'au dernier instant, donc le clic *est* la
confirmation.

Après l'envoi : le toast **nomme** le destinataire et son adresse, et propose
une relance à date pré-remplie (délai « après un email » des réglages), jamais
posée d'office.

L'icône enveloppe rejoint le téléphone, le site et LinkedIn dans l'en-tête de
la fiche — désactivée plutôt qu'absente quand le contact n'a pas d'adresse.

### Jalon 32 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (154 fiches), migration `11_email` appliquée puis
`migrate diff` **vide**, et un **puits SMTP local avec STARTTLS** qui écrit sur
disque la source exactement telle qu'elle passe sur le fil :

- **agents** : 2 actifs / 7 désactivés / 9 en base ; Sarah désactivée conserve
  3 conversations, 1 recommandation, 1 vacation ; roster de `/conseil` =
  `["Alex", "Sabrina"]`, aucun des six autres nulle part dans la page ;
- **`/reglages` → Messagerie** : section présente, avertissement « les réponses
  n'arrivent pas dans le CRM », **0 champ de saisie de mot de passe**, état
  « Défini dans la variable SMTP_PASSWORD » ;
- **« Tester l'envoi » cliqué dans le navigateur** → « Message d'essai envoyé à
  yanis@… », message reçu en **deux paragraphes séparés d'une ligne vide** ;
- **mauvais mot de passe** → l'erreur SMTP citée avec son code 535 et la réponse
  du serveur ;
- **source brute du message reçu** : `From` avec nom affiché, `To`, `Reply-To`,
  `Subject` encodé UTF-8, `Message-ID` au domaine de l'expéditeur, `Date`,
  `multipart/alternative`. Partie texte décodée **identique au caractère près**
  au brouillon, 5 paragraphes, signature sur deux lignes sans blanc parasite ;
  partie HTML 5 `<p>` et 2 `<br>`, **aucun** style/police/couleur/tableau/image ;
  **aucune** occurrence de « sent from », « envoyé depuis », `X-Mailer`,
  « nodemailer », « unsubscribe » ni du nom du produit ;
- **parcours complet dans le navigateur** : appel consigné avec « Pas de
  réponse » → bouton « Rédiger un email » sur la confirmation → panneau avec
  destinataire en 19 px, objet, corps en 4 paragraphes → envoi → toast
  « Email envoyé à Sandra Giner (sandra@mymosa.fr) » ;
- **consignation** : interaction `email`, issue vide, notes portant objet et
  corps, `lastContact` avancé ; contact sans adresse → refus **sans rien
  consigner** ;
- **étanchéité** : ni le secret ni `SMTP_PASSWORD` dans `.next/static` ;
  `GET /api/mail` rend `passwordSet: true` et jamais la valeur ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**647 tests**) verts.

### Jalon 32 — ce qui n'est pas vérifié

**Aucun message n'est parti vers IONOS depuis cet environnement.** Il n'y a ni
identifiants ni accès sortant SMTP ici : tout ce qui précède a été exercé contre
un puits local qui parle le protocole (EHLO, STARTTLS, AUTH PLAIN, DATA) et
écrit la source reçue. Ce que cela établit : la mise en forme, les en-têtes, la
consignation, la traduction des erreurs, l'étanchéité du secret. Ce que cela
n'établit pas : que `smtp.ionos.fr` accepte vos identifiants, et le rendu dans
votre client de messagerie. **Le premier clic sur « Tester l'envoi » en
production est le seul juge** — et c'est précisément pour cela que ce bouton
existe et qu'il cite la réponse du serveur.

**Aucun appel Anthropic réel.** Le brouillon a été exercé contre
`scripts/mock-anthropic.ts`, étendu pour ce jalon : il **renvoie le contexte
reçu** dans le corps du message, ce qui prouve que le dossier réel du contact —
l'échange désigné compris — atteint bien le modèle. Vérifié : le brouillon
contient « 17 août 26 · Appel — Pas de réponse ». Ce qui reste à établir, c'est
qu'Alex *écrive bien* : la qualité du texte relève du modèle et du prompt.

**Un défaut du puits a failli passer pour un défaut du produit.** La première
lecture montrait une ligne vide parasite entre « Bien à vous, » et « Yanis ».
Cause : le puits découpait chaque paquet TCP isolément, coupant en deux toute
ligne à cheval sur deux paquets. Corrigé dans le puits, pas dans le produit —
et c'est la raison pour laquelle la vérification compare la partie texte
**décodée** au brouillon d'origine caractère par caractère, plutôt que de se
fier à une lecture à l'œil.

**Le lien de suivi des réponses n'existe pas.** Aucun `In-Reply-To`, aucun
`References`, aucune boîte lue : une réponse du prospect arrive dans la
messagerie et n'apparaîtra pas dans le CRM. C'est le périmètre demandé, et le
panneau le dit.

**`@types/nodemailer` est en `dependencies`**, pas en `devDependencies` — même
posture défensive que `prisma` et `tsx` (voir § Déploiement) : un élagage des
dépendances de développement avant le build casserait le typecheck. C'est
quelques kilo-octets inutiles en production, assumés.

---

## Jalon 33 — le conseil sort de sa page, et Alex apprend le métier

### La signature : le défaut signalé

Le premier vrai brouillon d'Alex se terminait par « Alex ». Le message part de
la boîte de l'utilisateur, sous son adresse : une signature au nom d'un agent
est une contradiction visible **dans le message lui-même**, et elle apprend au
destinataire qu'il ne parle pas à un humain.

La règle est posée à **trois** endroits, parce qu'une seule ne suffisait pas :

1. **le prompt** l'exige, avec le texte exact de la signature ;
2. **`enforceSignature()`** l'impose quoi qu'ait rendu le modèle. Une consigne
   de prompt est une intention : elle tient presque toujours, et « presque »
   n'est pas assez ici ;
3. **`email-signature.test.ts`** échoue si la dernière ligne d'un brouillon
   porte un nom d'agent — sur les neuf noms du registre, pas seulement Alex.

**Un second défaut est sorti de la vérification** : un brouillon signé « Yanis »
ne portait aucun nom d'agent, la signature était donc **ajoutée** plutôt que
substituée, et le message partait avec deux signatures l'une sous l'autre. Le
nom d'expédition configuré (nom complet **et** prénom seul) rejoint donc la
liste des signataires interdits — c'est littéralement la règle « jamais ton
prénom, jamais celui de l'utilisateur », et il se lit là où il est déjà réglé.

`enforceSignature()` ne confond pas une mention avec une signature : « je
transmets à Alex dès demain matin » est une phrase, pas un paraphe. La garde
porte sur la dernière ligne **et** sur sa brièveté.

### Le contexte entreprise, en un seul fichier

`lib/agents/prompts/company.ts` porte trois blocs et rien d'autre :

| Constante | Contenu | Injecté dans |
|---|---|---|
| `COMPANY_CONTEXT` | ce qu'on vend, à qui, quel problème | **tous** les agents |
| `SALES_WRITING_RULES` | jamais de prix, jamais d'affirmation inventée | Alex seul |
| `SIGNATURE_RULE` / `EMAIL_SIGNATURE` | « L'équipe AuraFLOW AI » | Alex seul |

Le positionnement est injecté **pour tous**, pas seulement pour Alex : Sabrina
arbitre sur le même métier, et deux descriptions finiraient par se contredire —
même raison que le nom d'un agent, écrit à un seul endroit. Les interdits de
rédaction, eux, n'appartiennent qu'à Alex : imposer une signature de courriel à
Sabrina serait du bruit dans son prompt, et un test le vérifie.

`AgentDefinition` gagne un champ `rules`, **séparé de `persona`** : la
personnalité décrit un métier et un ton, et son budget de 200 à 400 mots est
vérifié par un test depuis le jalon 2. Coller des règles partagées dedans aurait
fait exploser ce budget sans qu'une ligne de personnalité soit écrite.

Le bloc n'est pas en base, et c'est un choix assumé : un positionnement change
deux fois par an. Le jour où il bougera souvent, il rejoindra `/reglages` — le
point d'injection unique fait que cela ne coûtera qu'une lecture de plus.

### Les agents dans le rail, en panneau latéral

L'entrée « Alfred & Associés » disparaît de `lib/navigation.ts` : **un agent
n'est pas un écran**. Le rail rend les agents depuis la base, sous le titre
`CONSEIL`, avec leur portrait rond et leur rôle — même traitement que le roster
de `/conseil`, même composant `Portrait`, même repli initiales.

Cliquer **n'ouvre pas une page** : un panneau de 480 px glisse par-dessus
l'écran courant. On travaille dans le CRM et on pose une question sur ce qu'on
regarde ; renvoyer vers `/conseil` faisait perdre la liste filtrée ou le
pipeline qu'on avait sous les yeux.

- Échap, ✕ et clic extérieur ferment — mêmes règles que le tiroir de fiche du
  jalon 28, pour que deux surfaces modales ne se comportent pas différemment ;
- **le voile ne bloque pas le défilement** de la page derrière : pouvoir faire
  défiler sa liste tout en questionnant l'agent est la raison d'être de l'écran ;
- l'état du panneau vit dans le **rail**, seul composant présent sur toutes les
  pages : porté par une page, il disparaîtrait à chaque navigation ;
- une flèche mène à `/conseil` pour la vue pleine largeur, qui reste entière.

**Une seule source, littéralement.** `useAgentChat` est extrait de `Console` :
création de fil, envoi, lecture du flux, outils, confirmation, réouverture. Les
deux surfaces l'appellent. Deux implémentations du streaming auraient divergé —
c'est la leçon du test de parité SQL/mémoire du jalon 12. Effet secondaire utile :
`Console` passe de **339 à 186 lignes**, sous la limite de 250 qu'elle dépassait
depuis le jalon 18.

Le fil ouvert est mémorisé par agent le temps de la session : rouvrir le panneau
reprend où l'on s'était arrêté.

### La reprise du brouillon

Sous le brouillon, une saisie : « insiste sur le SAV », « fais plus court ».
Alex rend un objet et un corps révisés qui remplacent les champs.

**Le point qui compte : la reprise part du texte affiché, pas du brouillon
d'origine.** Quelqu'un qui a réécrit un paragraphe puis demande « fais plus
court » veut *son* paragraphe raccourci ; repartir de l'original jetterait son
travail sans le dire, et il ne s'en apercevrait qu'après l'envoi. Le panneau
l'affiche, et le dit plus fort dès qu'une retouche est détectée.

`draft-revisions.ts` (pur, testé) tient la pile : **cinq versions**, plus que les
trois demandées, avec deux règles — une version identique à la précédente n'est
pas empilée (demander deux fois la même chose ne doit pas consommer un cran), et
la version restaurée est celle **d'avant la reprise**, retouches manuelles
comprises.

`reviseEmail()` et `draftEmail()` partagent `complete()` : mêmes garanties de
forme, même imposition de signature. Les écrire deux fois, c'était se garantir
qu'une reprise finirait par oublier la signature ou laisser passer un prix.

### Jalon 33 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (154 fiches) et le serveur standalone :

- **prompts** : Alex et Sabrina portent tous deux « assistants virtuels »,
  « e-commerçants », « Shopify » ; **seul Alex** porte « Jamais de prix » et la
  signature ;
- **brouillon** : dernière ligne = « L'équipe AuraFLOW AI », **une seule
  occurrence**, « Yanis » remplacé et non doublé ;
- **reprise** : après remplacement du corps par un texte écrit à la main, la
  révision **contient la phrase manuelle** et pas le brouillon d'origine ;
- **rail** : titre `Conseil`, Alex (photo, cadre rond 28 px) et Sabrina
  (initiales, cadre rond 28 px) avec leur rôle ; « Alfred & Associés » absent ;
- **panneau** : `aria-label` « Conversation avec Alex », **480 px**, URL
  **inchangée** (`/contacts`), **107 lignes de contacts toujours visibles
  derrière** ; Échap ferme ; réouverture → la question précédente est là ; les
  deux agents sont présents aussi sur `/pipeline` ;
- **panneau de rédaction** : bouton « Revenir au brouillon précédent » absent
  tant qu'il n'y a qu'une version, présent après retouche ; le retour restaure
  **exactement** la version retouchée à la main ; l'échange reste affiché ;
- **0 réponse HTTP ≥ 400, 0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**666 tests**) verts.

### Jalon 33 — ce qui n'est pas vérifié

**Aucun appel Anthropic réel**, comme aux jalons précédents. Le substitut
`scripts/mock-anthropic.ts` a été étendu pour la reprise : il **renvoie le corps
qu'il a reçu**, préfixé de l'instruction. C'est ce qui prouve qu'Alex repart du
texte affiché — mais un substitut qui réécrirait joliment ne prouverait rien, et
celui-ci ne prouve rien sur la *qualité* de la reprise. Que « fais plus court »
produise effectivement un texte plus court relève du modèle.

**La réponse de l'agent dans le panneau n'a pas été jugée** : le substitut ne
sait pas tenir une conversation libre et rend son JSON de vacation. Ce qui est
vérifié, c'est que la question part, que le flux revient, que le fil s'affiche et
qu'il est retrouvé à la réouverture.

**La persistance du fil ouvert est en mémoire de page**, pas en base : recharger
l'onglet repart d'un fil neuf. Les conversations, elles, sont bien en base et
restent accessibles depuis `/conseil` et depuis la liste du panneau plein écran.
Mémoriser le dernier fil par agent demanderait un stockage local ou une colonne ;
ce n'était pas demandé.

**Un piège de méthode, à retenir.** La première vérification en navigateur a
montré un brouillon signé « Yanis » **après** le correctif : le serveur de
vérification n'était pas mort et la nouvelle instance échouait silencieusement
sur `EADDRINUSE`, si bien que le navigateur testait l'ancien binaire. Le
correctif était juste, la mesure était fausse. Toujours lire les deux premières
lignes du journal du serveur avant de conclure, et vérifier qu'un `kill` a
réellement libéré le port.

---

## Jalon 34 — le vrai discours, et une conversation plutôt qu'un formulaire

### Le pitch était la version faible de lui-même

`COMPANY_CONTEXT` disait « des assistants virtuels qui traitent les tickets du
service client ». C'est vrai et c'est mauvais : cela décrit un **centre de coûts
qu'on automatise**. Le vrai argument est commercial.

> Aura Flow AI déploie des « Personal Shoppers » IA premium sur les boutiques
> e-commerce. La solution prend en charge le SAV 24/7, mais son véritable atout
> est d'agir comme un **conseiller proactif** : elle guide les visiteurs vers
> l'achat, augmente le taux de conversion et écoule les stocks.

Le fichier porte désormais l'ordre explicitement : « d'abord ce que ça leur
rapporte, ensuite ce que ça leur épargne ». Un test refuse le retour de l'ancienne
formule.

### Trois règles, tirées d'un vrai message

Le mail de référence a été écrit à la main par le propriétaire du produit. Les
trois règles en sont extraites, et le message lui-même entre dans le prompt
**marqué comme exemple** :

| Règle | Ce qu'elle interdit |
|---|---|
| Ouvrir sur quelque chose de concret sur **leur** activité | « je vous ai écrit le 12 et vous n'avez pas répondu » — cela parle de notre agenda |
| Nommer la douleur **de leur côté** | « nous vous proposons une solution de support » — cela décrit notre catalogue |
| Clore sur une **question légère** | « auriez-vous 15 minutes ? » — un engagement de calendrier avant de se connaître |

**L'exemple est explicitement qualifié** — « à imiter, jamais à recopier », et
« n'en reprends ni les phrases, ni la société ». Un modèle à qui l'on montre un
texte sans le qualifier le reprend mot pour mot, et cinquante prospects
recevraient la même lettre. Un test vérifie que cette mise en garde est présente.

### Signature et lien : de la donnée, plus du code

Quatre colonnes en base (migration `12_pitch`), réglables dans
`/reglages` → Messagerie :

| Réglage | Défaut |
|---|---|
| Nom du signataire | `Yanis Tidahy` |
| Titre | `Fondateur, Aura Flow AI` |
| Libellé du lien | `Diagnostic offert` |
| URL du lien | l'adresse Netlify |

Le jalon 33 avait figé « L'équipe AuraFLOW AI » dans un fichier de prompt : une
valeur en dur qui contredit l'écran le jour où on la change. Elles sont donc
lues à chaque construction de prompt, par `alexDynamicRules()` — **un seul
module, deux appelants** (la rédaction en un coup et la conversation), pour que
les deux ne divergent pas.

**Une URL vide supprime la phrase**, elle ne produit pas un lien mort : la
consigne devient « n'invente aucune adresse, passe directement de l'offre à la
question ».

### Le lien, rendu deux fois

Le même paragraphe doit exister sous deux formes, parce qu'un client texte ne
sait pas rendre une ancre :

```
text/plain :  … sur votre site → Diagnostic offert : https://deluxe-fudge-addd15.netlify.app/
text/html  :  … sur votre site → <a href="https://deluxe-fudge-addd15.netlify.app/">Diagnostic offert</a>
```

Ni bouton, ni style, ni paramètre de suivi : un `?utm_` ajouté à une adresse
qu'on présente comme une démonstration privée dit exactement le contraire de ce
que la phrase affirme. **Une seule ancre par message**, alignée sur la version
texte qui ne développe elle aussi que la première occurrence — deux rendus qui
poseraient le lien à des endroits différents se contrediraient selon le client.

Alex n'écrit **jamais** l'adresse : il pose « → Diagnostic offert » et
l'application fait le reste. Un test vérifie que l'URL n'apparaît pas dans son
prompt.

### La boîte de reprise devient un fil

C'était un formulaire : on tapait une instruction, un brouillon revenait en
silence. On ne pouvait ni demander « pourquoi tu as écrit ça ? », ni « qu'est-ce
qu'on sait d'elle ? ».

C'est maintenant le **même `useAgentChat`** que le panneau du rail : streaming,
outils de lecture du CRM, historique en base. Alex peut donc aller lire la
chronologie pour répondre, sans qu'on ait rien à câbler.

**Ce qui distingue une réponse d'une reprise n'est pas un bouton mais la présence
d'un bloc** dans sa réponse (`lib/domain/draft-protocol.ts`, pur et testé).
Trois options avaient été pesées :

| Option | Verdict |
|---|---|
| un outil d'écriture | **refusé** — les outils passent par la carte de confirmation, or un brouillon n'existe qu'à l'écran : rien à confirmer, rien à écrire |
| deux appels, un pour répondre un pour réécrire | **refusé** — deux fois le coût, et le second ne verrait pas ce que le premier a dit |
| un bloc marqué dans la réponse | **retenu** — un seul appel, compatible avec le streaming, et l'absence de bloc *est* le signal « je ne touche pas au brouillon » |

Deux garde-fous : le bloc n'est appliqué qu'**à la fin du tour** (l'extraire
pendant le flux remplacerait le message par des fragments successifs), et un bloc
ouvert mais jamais refermé — réponse tronquée — est **ignoré** plutôt
qu'appliqué à moitié.

Le brouillon courant voyage **dans chaque message**, retouches comprises : le fil
vit côté serveur, mais le texte est retouché dans un champ que le serveur ne voit
jamais. L'identifiant du contact voyage avec lui, pour qu'Alex lise la bonne
fiche plutôt que de chercher par nom.

Le mode `revise` de `/api/emails` est **supprimé** : garder un second chemin de
réécriture aurait fait deux implémentations d'une même chose, dont une seule
serait exercée.

### Une régression réintroduite par moi, puis rattrapée

En rendant `forbiddenSigners()` synchrone, j'ai perdu le nom de l'expéditeur — le
correctif du jalon 33. Résultat observé dans le navigateur : un brouillon
terminé par « Yanis » ne portait aucun nom d'agent, la signature était donc
**ajoutée**, et le message affichait `Yanis` puis `Yanis Tidahy / Fondateur`.
Corrigé, et un test porte désormais ce cas précis.

### Jalon 34 — ce qui est vérifié

Contre un vrai PostgreSQL 16, migration `12_pitch` appliquée, et un puits SMTP
local :

- **prompt d'Alex** : `Personal Shoppers` ✓, `conseiller proactif` ✓, les trois
  règles de forme ✓, le mail de référence ✓, la signature réglée ✓, le libellé du
  lien ✓, et **l'URL absente du prompt** ✓ ;
- **URL vide** → la consigne devient « n'invente aucune adresse » ;
- **brouillon** : dernière ligne `Fondateur, Aura Flow AI`, **une seule
  signature** ;
- **source brute du message reçu** : `→ Diagnostic offert : https://…` en texte,
  `<a href="https://…">Diagnostic offert</a>` en HTML, `Yanis Tidahy<br>Fondateur,
  Aura Flow AI`, aucun style, aucun `utm_` ;
- **`/reglages` → Messagerie** : les quatre champs présents et pré-remplis ;
- **navigateur** : « qu'est-ce qu'on sait d'elle ? » → réponse affichée dans le
  fil, **corps strictement inchangé** ; retouche à la main puis « fais plus
  court » → le brouillon est repris, **la phrase manuelle survit**, le fil montre
  « J'ai appliqué « fais plus court » » et « ✓ brouillon mis à jour » ; « Revenir
  au brouillon précédent » restaure **exactement** la version retouchée ;
- **0 réponse HTTP ≥ 400, 0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**689 tests**) verts.

### Jalon 34 — ce qui n'est pas vérifié

**Aucun appel Anthropic réel.** Le substitut a été étendu pour jouer les deux cas
du protocole — question sans bloc, reprise avec bloc — et il **renvoie le corps
qu'il a reçu**, ce qui prouve qu'Alex repart du texte affiché. Ce qu'il ne prouve
pas : qu'Alex écrive réellement un bon email, qu'il respecte l'ouverture sur leur
activité, et qu'il n'aille pas recopier le mail de référence. **Ce dernier point
est le risque principal de ce jalon** et ne se lèvera qu'au premier vrai
brouillon.

**Le lien n'a pas été cliqué depuis une vraie boîte.** L'ancre est correcte dans
la source ; qu'elle s'affiche comme un lien dans Gmail ou Outlook relève du
client, pas du code.

**Trois pièges de méthode, tous du même genre.** Le substitut et le puits SMTP
sont morts silencieusement à plusieurs reprises, et le port restait pris par
l'ancien processus : les mesures portaient alors sur un binaire périmé. Deux
symptômes ont été pris pour des défauts du produit avant vérification. **Lire les
deux premières lignes du journal d'un service de vérification avant d'en tirer
une conclusion** — c'est la même leçon qu'au jalon 33, et elle a resservi trois
fois.

**Le substitut a eu deux défauts propres**, corrigés : il ne lisait que les
contenus de type chaîne (les messages de conversation sont des tableaux de blocs,
donc son briefing était vide et il retombait sur sa réponse de vacation), et il
lisait la **première** occurrence de `[Demande]` au lieu de la dernière, faisant
passer tout l'historique pour la demande courante.

---

## Jalon 35 — deux signataires, deux appels à l'action, une reprise fidèle

### Le signataire est une propriété de l'envoi, pas un réglage

Le couple « nom / titre » unique du jalon 34 ne savait décrire qu'une personne.
Deux personnes envoient depuis ce CRM, et la conséquence n'était pas cosmétique :
la moitié des messages seraient partis sous la mauvaise identité, l'erreur ne se
voyant qu'à la réception.

Table `signatories` (migration `13_signatories`), semée avec Yanis Tidahy et
Mohamed Targani. Le choix se fait **message par message**, dans un sélecteur
au-dessus du brouillon.

**Le propriétaire de la fiche décide par défaut.** Si « Yanis » suit ce prospect,
c'est lui qui écrit ; le signataire marqué par défaut ne sert que lorsque le
propriétaire ne correspond à personne. `pickSignatory()` compare des **mots
entiers** — « Marc » ne correspond pas à « Marceau ».

**Changer de signataire réécrit les deux dernières lignes, rien d'autre.**
Régénérer le message jetterait tout ce qui a été relu, retouché et discuté avec
Alex, pour un changement qui ne concerne que la signature. `replaceSignature()`
cherche les signatures **connues** plutôt que « les deux dernières lignes » : un
message terminé par un post-scriptum n'a pas de signature à cet endroit, et
couper à l'aveugle le mutilerait.

### Un angle mort de la garde, trouvé en écrivant le test

`signsWithName()` n'examinait que la **dernière ligne**. Depuis que les
signatures font deux lignes, cette ligne est le *titre* — « Fondateur, Aura Flow
AI » — et la garde était donc **aveugle au nom**. Un brouillon destiné à partir
sous le nom de Mohamed mais signé Yanis passait sans être détecté.

Elle examine désormais **tout le dernier paragraphe**, ligne par ligne, avec le
garde-fou de longueur qui empêche de prendre « je transmets à Alex dès demain
matin » pour un paraphe.

### Le nouveau mail de référence, et deux appels à l'action

L'exemple de Linaé remplace celui de Miye car — un seul exemple, sinon deux
formes se contrediraient. Un test vérifie que l'ancien a bien disparu.

Deux règles structurelles en sortent :

**La démonstration est préparée pour LEUR site.** « Nous avons préparé une
démonstration d'un assistant personnalisé pour votre site » n'est pas la même
proposition que « souhaitez-vous une démonstration ? » — la première a déjà été
faite, la seconde reste à faire.

**Deux appels à l'action, dans cet ordre, jamais un seul :**

1. **répondre à ce message** pour recevoir le lien — le geste le plus facile, et
   il ouvre une conversation ;
2. **puis** la réservation d'un créneau, en alternative.

L'ordre est vérifié par un test sur les positions dans le texte : commencer par
le calendrier demande un engagement à quelqu'un qui ne nous connaît pas encore.
Le lien devient « Réserver un appel » vers Calendly ; une URL vide supprime le
**second** appel seulement — le premier ne dépend d'aucun lien.

### La reprise doit suivre l'instruction, pas produire une variante

C'est le point qui décide de l'usage de la fonction. Quatre consignes ajoutées au
protocole, avec leurs contre-exemples :

| Consigne | Ce qu'elle empêche |
|---|---|
| Applique la demande **littéralement** | « insiste sur le SAV » qui réécrit le message dans un autre style |
| **Ne touche à rien d'autre**, mot pour mot | une formulation travaillée dix minutes, remplacée parce qu'elle plaisait moins |
| Lis **tout l'échange** | « fais plus court » puis « garde la phrase sur les stocks » traités séparément |
| **Demande si c'est ambigu**, ne devine pas | « rends-le plus direct » interprété comme un tutoiement |

La ligne d'explication doit **nommer le changement et l'endroit** — « j'ai ajouté
une phrase sur le SAV au deuxième paragraphe », pas « voici une nouvelle
version », qui oblige à comparer les deux textes ligne à ligne.

**Le fil entier parvient déjà au modèle**, et c'était vrai avant ce jalon :
`loadMessages()` lit toutes les lignes de la conversation, sans `take`. Vérifié
plutôt que supposé, et un test le fixe.

### Un défaut de conception corrigé en vérifiant

La signature était d'abord transmise **entre le corps et la demande**. Elle se
lisait alors comme la fin du message et se retrouvait recopiée dans le brouillon.
Elle est passée dans l'en-tête, avant le brouillon ; un test fixe cet ordre.

### Jalon 35 — ce qui est vérifié

Contre un vrai PostgreSQL 16, migration `13_signatories` appliquée :

- **base** : deux signataires, Yanis par défaut ; lien passé à « Réserver un
  appel » → Calendly ;
- **prompt** : `Linaé` ✓, `Miye car` **absent** ✓, les deux appels à l'action ✓,
  « préparée pour LEUR site » ✓, le signataire **injecté** (Mohamed présent,
  Yanis absent quand c'est Mohamed qui signe) ✓ ;
- **brouillon** : `signatoryId` = le propriétaire de la fiche (`Yanis` →
  `sig_yanis`), les deux signataires renvoyés au panneau ;
- **bascule** : dernière ligne « Co-Fondateur, Aura Flow AI », corps préservé,
  aucune trace de l'autre nom ; aller-retour sans dérive ; un post-scriptum n'est
  pas pris pour une signature ;
- **navigateur** : `/reglages` → section Signataires avec les deux lignes et deux
  boutons radio ; sélecteur du panneau avec les deux entrées, Yanis présélectionné ;
  bascule vers Mohamed → **tout sauf la signature est identique** (comparaison
  chaîne à chaîne) ; « insiste sur le SAV » → le fil affiche « J'ai appliqué
  « insiste sur le SAV » » et « ✓ brouillon mis à jour », signataire conservé ;
- **lien** : `<a href="https://calendly.com/auraflowai-y7hh/30min">Réserver un
  appel</a>` en HTML, `Réserver un appel : https://…` en texte ;
- **0 réponse HTTP ≥ 400, 0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**708 tests**) verts.

### Jalon 35 — ce qui n'est pas vérifié

**Aucun appel Anthropic réel.** Les consignes de fidélité sont vérifiables ;
**leur application ne l'est pas**. Que « insiste sur le SAV » rende réellement le
SAV plus présent sans toucher au reste relève du modèle, et c'est précisément le
point qui décidera de l'usage de la fonction. Le substitut renvoie le corps qu'il
a reçu : il prouve la plomberie, pas le jugement.

**Le risque de recopie du mail de référence reste entier.** L'exemple est
qualifié « à imiter, jamais à recopier » et le test vérifie que la mise en garde
est là — mais rien ne garantit qu'elle soit suivie. À regarder sur les trois
premiers brouillons réels : si deux prospects reçoivent « En observant le
développement de… » mot pour mot, il faudra durcir.

**Le titre de Mohamed est une supposition.** « Co-Fondateur, Aura Flow AI » a été
semé faute d'information exacte, et l'écran permet de le corriger — c'est ce qui
avait été demandé.

**La conversation du rail ne connaît pas le signataire choisi.** `alexDynamicRules()`
y est appelé sans signataire et retombe sur le défaut réglé. Sans conséquence
aujourd'hui — la rédaction passe par le panneau, qui transmet la signature dans
chaque message — mais un email rédigé depuis le panneau du rail signerait le
défaut.


---

## Jalon 36 — le coût de l'API, mesuré puis coupé

### Ce qu'on savait avant, et ce que ça valait

« Environ 20 cents par email rédigé », obtenu en regardant une facture. Le CRM,
lui, ne comptait que deux nombres de jetons sur les vacations — donc **rien sur
la rédaction d'emails, qui est justement ce qui coûte**. Toute réduction décidée
là-dessus aurait été une conviction : on n'aurait pas su après si elle avait
servi.

D'où l'ordre du jalon, qui est celui de la demande : **mesurer, puis couper.**

### Une ligne de facture par appel

Table `api_usage` (migration `14_usage`) : jour, mois, agent, usage, modèle,
jetons d'entrée et de sortie, coût en **micro-dollars entiers** — une somme de
flottants dérive sur un mois — et un drapeau d'anomalie.

`lib/domain/model-pricing.ts` est pur et porte les tarifs, **relus dans la
référence de l'API le 18 août 2026**, pas de mémoire. La date est écrite dans le
fichier (`PRICING_READ_AT`) pour qu'on sache quand elle cesse d'être fraîche.

| Modèle | Entrée $/M | Sortie $/M | Réflexion adaptative | `effort` |
|---|---|---|---|---|
| Haiku 4.5 | 1 | 5 | **non** | non |
| Sonnet 5 | 2 | 10 | oui | oui |
| Opus 5 | 5 | 25 | oui | oui |
| Fable 5 | 10 | 50 | oui | oui |

**La réflexion n'est pas un troisième terme du coût.** Elle fait partie de la
sortie et est facturée comme elle ; l'API ne la ventile pas quand `display` vaut
`omitted`. `thinkingTokens` est donc **nullable**, et `null` veut dire « non
ventilé par l'API » — pas « zéro ». Un zéro ferait croire qu'il n'y en a pas.

### La garde qui ferme le chemin par lequel c'est arrivé

`request.ts` prétendait depuis le jalon 16 être le seul endroit où le modèle, le
plafond, la réflexion et l'effort se décident. Au jalon 32, `email-draft.ts`
s'est mis à appeler l'API directement, avec ses propres valeurs : **le chemin le
plus cher du produit était le seul que rien ne gouvernait**, et personne ne l'a
vu parce que rien ne regardait.

`cost-single-source.test.ts` balaie `lib/` et `app/` et exige, de tout fichier
qui appelle `messages.create` ou `messages.stream`, qu'il compose sa requête
avec le socle commun, consigne son coût, et vérifie le plafond. Une seule
exception, nommée : le diagnostic de `/reglages`, dont les cinq sondes sont
**délibérément** minimales — les faire passer par le socle supprimerait ce
qu'elles mesurent.

**Éprouvée en réintroduisant le défaut exact** : `email-draft.ts` remis à un
appel direct → deux tests tombent en le nommant par fichier.

### Un modèle par usage

| Usage | Défaut | Pourquoi |
|---|---|---|
| Rédaction d'email | **Sonnet 5** | Écrire depuis un dossier fourni et des règles écrites n'est pas du raisonnement, c'est de la mise en forme. 2,5 fois moins cher qu'Opus des deux côtés, pour une prose annoncée proche |
| Reprise de brouillon | **Sonnet 5** | Même travail |
| Conversation | **Sonnet 5** | Le milieu de gamme demandé |
| Vacation | **Opus 5** | Une vacation *juge* : une erreur de jugement quotidienne coûte plus que l'écart de tarif |

**Haiku 4.5 reste dans le sélecteur, à moitié prix, et n'est pas le défaut.** Ces
messages partent à de vrais prospects sous le nom d'une vraie personne : c'est le
dernier endroit où rogner sur la prose. Trois brouillons suffiront à en juger,
et c'est la seule façon d'en juger.

**Le sélecteur est conscient des capacités.** Haiku 4.5 ne connaît pas la
réflexion adaptative : lui envoyer `thinking` renvoie un 400. `requestFor()` lit
la table de capacités et n'envoie que ce que le modèle accepte — sans quoi le
sélecteur casserait au premier essai du modèle le moins cher, c'est-à-dire
exactement celui qu'on veut pouvoir essayer.

Un identifiant inconnu est refusé par le schéma Zod **et** retombe sur le défaut
à la lecture : une faute de frappe dans un réglage ne doit pas devenir une panne
totale qui ne se voit qu'au moment d'écrire un email.

### Ce qui a été coupé

**L'effort, posé explicitement partout.** Sur Opus 5 et Sonnet 5, le défaut de
l'API est `high` : ne rien poser, c'est payer tous les jours un raisonnement
approfondi que personne n'a demandé. `low` pour écrire et reprendre, `medium`
pour converser, `low` pour les vacations, `xhigh` réservé au mode approfondi.

**Le plafond de sortie, par usage.** 32000 pour un email de 200 mots était
absurde : draft 2000, reprise 3000, conversation 8000. Le plafond n'est pas
facturé — seule la sortie réelle l'est — mais c'est le seul garde-fou qui
empêche une réponse partie en boucle de coûter le prix d'un livre. Le plancher
`MIN_OUTPUT_TOKENS` ne s'applique **qu'aux modèles qui réfléchissent** : sur un
modèle sans réflexion il ne ferait que masquer le plafond qu'on vient de choisir.

**La duplication prompt système / message.** `draftInstruction()` redonnait sept
règles déjà écrites quelques lignes plus haut dans la même requête — l'ouverture
sur leur activité, la douleur de leur côté, le conseiller proactif, la
démonstration préparée, les deux appels à l'action, la signature, le libellé du
lien. Le risque n'était pas seulement le coût : **deux formulations d'une même
règle finissent par se contredire**, et c'est alors le modèle qui arbitre. Ne
reste que ce que le prompt système ne peut pas porter, la forme de la réponse.

### La ventilation, mesurée

Contre un vrai PostgreSQL et le substitut, dont la consommation renvoyée est
désormais **dérivée de la charge reçue** (4 caractères par jeton, la convention
d'`estimateTokens`) et non plus une constante de 1234 :

| | Avant | Après |
|---|---|---|
| Entrée d'un brouillon | 3 111 jetons | **2 939** — 172 retirés |
| Entrée d'un tour de reprise | — | **5 029** |

Le contexte d'un tour de reprise se décompose ainsi : prompt système d'Alex
2 754 jetons, protocole de brouillon 694, **schémas des 14 outils 1 562**, plus
le fil. Les schémas d'outils sont donc renvoyés en entier **à chaque tour** :
c'est le premier poste du coût d'une reprise, avant le fil lui-même. Ils sont
conservés — Alex doit pouvoir lire la fiche quand on lui demande « qu'est-ce
qu'on sait d'elle ? » — mais c'est là qu'il faudra revenir si la reprise reste
chère.

**Le brouillon n'envoie aucun schéma d'outil** : il n'en a pas besoin, tout son
contexte est collecté par le serveur.

### Le plafond, et ce qu'il arrête

Plafond mensuel réglable en dollars, `0` valant « pas de plafond » — sans cette
convention on ne pourrait plus le désactiver. Bandeau sur `/accueil` à partir de
80 %, calculé **avant les retours anticipés** de la page, comme celui des
sauvegardes : un plafond franchi ne cesse pas d'être vrai parce que la base est
vide.

Le bandeau n'est **pas acquittable**, contrairement à celui des sauvegardes.
Une sauvegarde périmée est un incident dont on peut décider qu'il attendra
demain ; un plafond franchi arrête la rédaction d'emails séance tenante.

`budgetRefusal()` est vérifié **avant l'appel** sur les quatre chemins — on
n'interrompt pas une complétion en cours, on refuse de la lancer, et on le dit.
Le garde-fou ne couvrait que les vacations depuis le jalon 14.

**Une anomalie est signalée, pas avalée.** Au-delà de quatre fois le coût
ordinaire de son usage, l'appel est marqué en base et journalisé côté serveur
avec son modèle, ses jetons et son agent. Un appel qui coûte dix fois son
ordinaire est soit un contexte qui a gonflé, soit une boucle d'outils qui
tourne : dans les deux cas c'est un défaut.

### Jalon 36 — ce qui est vérifié

Contre un vrai PostgreSQL 16, migration `14_usage` appliquée puis `migrate diff`
**vide**, le serveur standalone de production et le substitut Anthropic :

- **une ligne par appel**, avec le bon usage, le bon agent et le bon modèle :
  `draft | claude-sonnet-5 | alex`, `revision | claude-sonnet-5 | alex`,
  `shift | claude-opus-5` ;
- **la reprise est bien facturée comme telle** : `purpose=revision`, 5 029
  jetons d'entrée — le chiffre prédit par l'audit du contexte à 20 jetons près ;
- **rapport** : agrégats par jour, par agent et par usage, total du mois,
  ventilation du dernier brouillon ;
- **plafond** : sans plafond → aucun refus ; plafond dépassé → refus nommant les
  deux montants, **et le brouillon suivant est refusé sans qu'aucun appel
  parte** (la table ne gagne pas de ligne) ;
- **anomalie** : un appel à 2,50 $ marqué en base et journalisé ;
- **réglages** : modèle inconnu → 400 nommant le champ (`modelDraft: Modèle
  inconnu`) ; modèle valide → écrit en base ;
- **navigateur** : section « Coûts de l'API » avec les quatre usages, le total
  du mois, le plafond et la ventilation du dernier brouillon ; bandeau **absent**
  sous le seuil, « 82 % du plafond mensuel de l'API consommés » à 82 %, « Plafond
  mensuel de l'API atteint » au-delà ; **0 réponse HTTP ≥ 400, 0 erreur
  console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**729 tests**) verts.

### Jalon 36 — ce qui ne l'est pas

**Les 20 cents n'ont pas été reproduits, et le calcul dit pourquoi.** Au tarif
Opus 5, un brouillon à 3 111 jetons d'entrée et 1 500 de sortie coûte **environ
5 cents**, pas 20. Ce qui explique le reste, sans que je puisse le prouver ici :
chaque tour du fil de reprise renvoyait le prompt système, les 14 schémas
d'outils et tout l'historique, à `max_tokens: 32000` et effort hérité `high`.
Trois allers-retours de reprise sur un brouillon suffisent à quadrupler la
facture d'un email. **La mesure réelle s'affichera dans `/reglages` après le
premier brouillon en production** — c'est précisément à cela que sert la table.

**Les jetons mesurés en local sont une estimation à quatre caractères par
jeton**, celle du substitut. Les vrais comptes viennent de l'API et ne seront
exacts qu'en production. L'écart avant/après (172 jetons) est donc un écart de
caractères, honnêtement proportionnel, pas un compte de jetons.

**La qualité de Sonnet 5 sur ces emails n'est pas établie.** Le substitut prouve
la plomberie, pas la prose. Si les trois premiers brouillons sont moins bons
qu'avec Opus 5, le sélecteur permet de revenir en un clic — et c'est la raison
pour laquelle c'est un réglage et non une constante.

**Rien n'est mis en cache.** `costMicros()` sait facturer la lecture et
l'écriture de cache, mais aucun appel ne pose `cache_control`. Le prompt système
d'Alex fait 2 754 jetons identiques à chaque tour de reprise : c'est le candidat
évident, et ce n'est pas fait dans ce jalon.

**Le mois est calculé dans le fuseau du serveur.** Un appel passé le 1er du mois
à 00:30 à Paris tombe dans le mois précédent si le serveur est en UTC. Sans
conséquence sur un plafond mensuel, et à savoir avant de croire un total à la
minute près.


---

## Jalon 37 — les emails laissent une trace

### 1. La copie dans « Envoyés »

**SMTP envoie ; il ne dépose rien dans la boîte de l'expéditeur.** Conséquence
vécue : un message parti du CRM n'existait nulle part dans la messagerie, et une
réponse du prospect arrivait dans un fil orphelin, sans le message auquel elle
répond.

`lib/api/imap.ts` dépose donc une copie par IMAP, **avec les identifiants du
SMTP** — même boîte, même secret, rien à saisir deux fois.

**Le dossier se trouve par son drapeau, pas par son nom.** Il s'appelle « Sent »,
« Envoyés », « Sent Items », « INBOX.Sent » ou « [Gmail]/Messages envoyés » selon
le serveur, la langue du compte et le séparateur de hiérarchie. La RFC 6154
(SPECIAL-USE) donne la réponse sans deviner : le serveur marque lui-même le
dossier `\Sent`. Le nom réglé n'est qu'un **repli**, et l'absence des deux est
dite — avec la liste des dossiers vus — plutôt que devinée. Déposer un message
important dans un dossier choisi au hasard serait pire que ne pas le déposer :
on le croirait rangé.

**Un échec de copie ne fait jamais échouer l'envoi.** Le courriel est parti ;
le rattraper est impossible, et remonter l'échec comme une erreur d'envoi ferait
croire qu'on peut réessayer — un second message partirait. L'échec est journalisé,
consigné sur la ligne d'envoi, affiché dans le bandeau de confirmation, sur la
fiche du contact et en tête de `/emails`.

« Tester la copie » suit le motif de « Tester l'envoi » du jalon 32 : il **cite
la réponse du serveur**, et dit en plus *comment* le dossier a été trouvé — par
son drapeau, ou par le nom de repli, ce second cas méritant d'être su parce
qu'il cassera le jour où le compte changera de langue. Le message d'essai ne
passe pas par SMTP : il n'est envoyé à personne, seulement déposé.

### Un défaut réel, trouvé en comparant les octets

`MailComposer.build()` rend un corps quoted-printable dont les fins de ligne
sont des **LF nus** ; le transport SMTP de nodemailer les convertit en CRLF au
moment d'écrire sur le fil. Les octets « construits » et les octets « envoyés »
différaient donc de sept caractères sur un message de sept lignes — et c'est la
version construite qu'on déposait dans « Envoyés ».

Deux conséquences, dont une seule est visible : la copie n'était pas l'original,
et surtout **la RFC 3501 exige le CRLF dans un `APPEND`**. Un serveur tolérant
l'accepte, un serveur strict refuse, et un client de messagerie peut afficher le
message d'un bloc.

`toCrlf()` normalise **une fois**, et les deux chemins partent des mêmes octets.
Trois tests fixent le comportement, dont l'idempotence — appliquer deux fois la
normalisation ne doit rien changer, sinon chaque passage ajouterait une ligne
vide entre chaque ligne du message.

Le défaut était invisible à la lecture. Il n'est sorti que parce que la
vérification compare `cmp` en main les deux fichiers écrits sur disque, et non
« les deux messages se ressemblent ».

### 2. Le journal des envois, distinct des interactions

Table `email_sends` (migration `15_emails`). **Distincte de l'interaction
consignée**, qui reste la trace lisible de la chronologie : compter les envois
depuis les interactions les aurait mélangés aux appels et aux notes de
correction — c'est le piège du jalon 22, déjà payé une fois.

`Contact.emailCount` et `Contact.lastEmailAt` sont **dénormalisés dans la
transaction d'envoi**. C'est ce qui rend les colonnes « Emails envoyés » et
« Dernier email » triables en SQL : un agrégat calculé à la lecture ne se trie
pas, et promettre un tri qui ne trierait rien serait pire que ne rien promettre.
Écrits dans la même transaction que la ligne d'envoi, ils ne peuvent pas dériver.

### 3. Le suivi d'ouverture, et ce qu'il vaut

Un GIF transparent de 1×1 servi depuis **notre propre domaine**, un jeton
opaque par message, aucun service tiers.

**Le chiffre est systématiquement surestimé, et l'écran le dit.** Apple Mail
Privacy Protection charge toutes les images d'un message à la réception, que
quiconque l'ait lu ou non ; Gmail les fait passer par un proxy qui les met en
cache, ce qui écrase les ouvertures suivantes. La métrique s'appelle donc
**« Ouvertures (estimation) »** partout, et `OPEN_RATE_CAVEAT` — une constante
unique, affichée avec le taux — nomme les deux causes. Un test refuse un libellé
qui ne dirait pas « estimation » et une mise en garde qui ne citerait pas les
deux fournisseurs.

**Les faits passent devant l'estimation.** `/emails` affiche dans cet ordre :
envois, réponses, rendez-vous obtenus, puis le taux d'ouverture — ce dernier sur
un fond distinct, en encadré pointillé. Les trois premiers sont constatés ou
saisis à la main ; le quatrième est estimé. Les aligner sans les hiérarchiser
laisserait le plus gros nombre passer pour le plus solide.

**La réponse se compte par personne, pas par envoi.** Quelqu'un qui a reçu trois
messages et répond une fois a répondu une fois : compter la réponse pour chacun
des trois gonflerait le taux d'un facteur trois, et d'autant plus qu'on relance.
Elle doit aussi être **postérieure** au premier envoi, sinon on compterait comme
réponse à un email une conversation antérieure.

**Trois garanties de vie privée, portées par le code :**

| Exigence | Comment |
|---|---|
| Stocker le jeton, pas un profil | La table porte `trackToken`, `firstOpenAt`, `lastOpenAt`, `openCount`. **Ni adresse IP, ni agent utilisateur.** La route ne les lit même pas |
| Aucun service tiers | Le pixel est servi par `/api/t/[token]`, sur notre domaine |
| Rétention configurable, 12 mois par défaut | `purgeOpens()` efface jeton et horodatages dans le passage quotidien. **L'envoi reste** : c'est un fait de gestion, pas une donnée de comportement |

**Deux interrupteurs, pas un.** Le réglage global coupe le suivi pour tout le
monde ; la case « Suivre l'ouverture » du panneau de rédaction le coupe pour un
message précis. Coupé, **aucun pixel n'est posé et aucun jeton n'est émis** :
c'est un interrupteur, pas un masquage d'affichage — un pixel posé mais non
compté coûterait la délivrabilité sans rien rapporter. Le global est le maître :
coupé là-bas, la case ne rallume rien.

**Sans adresse publique connue, aucun pixel.** `CRM_PUBLIC_URL` ou
`RAILWAY_PUBLIC_DOMAIN` ; à défaut, le panneau le dit et le suivi ne s'active
pas. Une adresse devinée produirait une image cassée dans chaque message.

**La route du pixel est publique, et ne divulgue rien.** Elle est chargée par le
client de messagerie d'un prospect, qui ne présente aucun cookie. Elle rend
**exactement la même image** qu'un jeton soit connu, inconnu, purgé ou malformé :
répondre différemment en ferait un oracle permettant d'énumérer les envois.
`tests/auth-routes.test.ts` a d'ailleurs attrapé l'ouverture au premier essai —
l'exception y est désormais déclarée **une par une, avec sa raison**, jamais par
préfixe.

Le pixel est inséré par `withTrackingPixel()`, **hors de `toHtml()`**. La règle
du jalon 32 — le corps ne porte ni image ni pixel — tient donc toujours, et un
test le vérifie : un message non suivi est exactement ce qu'un humain aurait
tapé. Il est posé juste avant `</body>` : un client qui tronque un message long
coupe par la fin, donc un pixel en tête serait chargé même sur un message jamais
déroulé — ce qui gonflerait encore un chiffre déjà surestimé.

### Jalon 37 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `15_emails` appliquée puis `migrate
diff` **vide**), le serveur standalone de production, un **puits SMTP avec
STARTTLS** et un **serveur IMAP sur TLS**, tous deux versionnés
(`scripts/mock-smtp.ts`, `scripts/mock-imap.ts`) :

- **copie identique à l'octet près** : `cmp` sur les deux fichiers écrits par le
  puits SMTP et par le serveur IMAP → identiques, `Message-ID` compris
  (`<1787063966791.wwgrjicb@aura.test>`), sur les deux messages envoyés par
  l'API HTTP réelle ;
- **dossier trouvé par son drapeau** : « Envoyés », `bySpecialUse: true`, et le
  bouton « Tester la copie » l'annonce en toutes lettres dans le navigateur ;
- **réglage IMAP faux** (port 9996) → l'envoi **réussit**, `copied: false`, et le
  message cite la cause : « Connexion IMAP refusée… ECONNREFUSED 127.0.0.1:9996
  (code ECONNREFUSED) ». La ligne d'envoi est écrite quand même ;
- **journal** : `Yanis Tidahy | copied | tracked`, `Mohamed Targani | copied |
  non suivi` ; compteurs de la fiche à 1 et `lastEmailAt` posé ;
- **pixel** : présent dans la partie HTML du message suivi (`grep -c "img src"`
  → 1), **absent** du message non suivi (→ 0) ; trois requêtes sur `/api/t/<jeton>`
  → `openCount: 3` ; un jeton inconnu répond le **même** GIF de 42 octets,
  `no-store` ;
- **rétention** : envois vieillis de treize mois → `purgeOpens()` en efface 1,
  jeton `null`, `openCount` 0, **et l'objet de l'envoi reste** ;
- **`/emails`** : « Envoyés 2 », « Réponses 1 — 50 % des personnes écrites »,
  « Rendez-vous obtenus 1 », « Ouvertures (estimation) 100 % · 1 sur 1 » suivi de
  la mise en garde Apple Mail / Gmail ; graphiques par semaine, par jour, par
  signataire ;
- **fiche contact** : « 1 email envoyé · dernier le 18 août 26 », puis l'objet,
  la date, le signataire, et « Ouvert le 18 août 26 (3 chargements du pixel —
  estimation) » ;
- **colonnes** : « Emails envoyés » et « Dernier email » proposées par le
  sélecteur, tri `?sort=emailCount&dir=desc` appliqué en SQL ;
- **`/reglages`** : section « Copie dans « Envoyés » (IMAP) », champ hôte,
  bouton d'essai, suivi d'ouverture, rétention, **0 champ de mot de passe** ;
- **0 réponse HTTP ≥ 400, 0 erreur console** sur le parcours complet ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**750 tests**) verts.

### Jalon 37 — ce qui n'est pas vérifié

**Rien n'a touché IONOS depuis cet environnement.** Ni SMTP, ni IMAP : les deux
substituts parlent le protocole et écrivent sur disque ce qu'ils reçoivent, mais
ils ne disent rien de ce que `imap.ionos.fr` acceptera. Ce qui reste à établir au
premier clic en production : que les identifiants passent, et **sous quel nom
IONOS marque le dossier des envoyés** — c'est précisément ce que le bouton
« Tester la copie » répondra, drapeau ou repli.

**Le fil de discussion n'est pas encore prouvé.** L'identité octet pour octet et
le `Message-ID` commun sont la condition nécessaire du rattachement ; que Gmail,
Outlook ou Thunderbird rattachent effectivement la réponse relève du client, et
ne se verra qu'à la première réponse réelle.

**Le taux d'ouverture ne sera jamais juste**, et ce n'est pas un défaut à
corriger : c'est la nature de la mesure. Ce qui est vérifié, c'est que le chiffre
ne s'affiche jamais sans sa mise en garde.

**Deux défauts venaient du substitut IMAP, pas du produit** — et les deux
ressemblaient à des pannes : il comparait le nom de dossier brut alors qu'un
client encode « Envoyés » en UTF-7 modifié (`Envoy&AOk-s`), et il répondait la
même liste à chaque interrogation de hiérarchie, ce qui faisait construire au
client des chemins imbriqués (« Corbeille.Envoyés »). C'est la troisième fois
qu'un substitut produit un faux défaut : **lire le journal du substitut avant de
conclure quoi que ce soit sur le produit.**

**Les réponses restent saisies à la main.** Le CRM ne lit aucune boîte : une
réponse n'entre dans les chiffres que si quelqu'un consigne l'interaction. C'est
le périmètre demandé, et c'est aussi la question centrale des séquences
automatisées — voir la note de conception qui accompagne ce jalon.


---

## Jalon 38 — les séquences d'emails, et ce qui les empêche de nuire

### La décision de conception, et son prix

**La détection des réponses reste manuelle** (option A de la note de conception).
Le CRM ne lit aucune boîte : une réponse n'arrête une séquence que si quelqu'un
consigne l'interaction. C'est un choix assumé, et il a un défaut connu — le
**décalage du week-end** : une réponse arrivée samedi n'est vue que lundi.

Deux garde-fous, demandés et construits dès le premier jour :

1. **Rien n'est composé ni envoyé le samedi ou le dimanche.** La file du lundi
   se construit **lundi matin, à partir de l'état de lundi**. Un brouillon écrit
   vendredi soir décrirait l'état de vendredi, et la réponse du samedi ne
   l'aurait pas arrêté ;
2. **chaque ligne de la file affiche l'ancienneté de la dernière interaction**
   consignée avec ce contact. Au-delà de deux jours, la mention passe en ambre
   et ajoute « ouvrez votre boîte avant d'envoyer ».

Le relevé IMAP de la boîte de réception (option B) reste pour le jalon suivant.

### Ce qui décide, et où ça vit

`lib/domain/sequence-rules.ts`, pur et testé. Un envoi automatique est la moins
réversible des écritures du produit : la règle qui l'autorise ne doit dépendre
ni d'un écran, ni d'un ordre d'appel, ni d'un `if` recopié dans une route.

**Vérifiée à l'envoi, jamais à l'inscription.** Entre l'inscription et le
troisième message il peut s'écouler trois semaines — et c'est exactement dans
cet intervalle que le prospect répond, se désabonne ou passe en `Perdu`.

| Motif | Effet |
|---|---|
| `terminal` — `Perdu`, `Ancien Client` | arrête l'inscription |
| `optout` — « Ne souhaite plus être contacté » | arrête, quel que soit le cycle de vie |
| `no-email` | arrête |
| `replied` — une interaction à issue « a répondu » | **arrête** — la sécurité du système |
| `finished` — trois étapes envoyées | termine |
| `too-soon`, `weekend` | met en pause, ne ferme rien |

Chaque motif porte une phrase lisible, écrite sur l'inscription : **une séquence
qui s'arrête sans dire pourquoi ressemble à une panne**, et on la relance.

### Un défaut de conception trouvé à la vérification

La première version cherchait « une réponse consignée » **sans borne de temps**
sur une inscription neuve. Conséquence : tout contact à qui l'on avait jamais
parlé — c'est-à-dire la moitié d'un CRM — était arrêté avant son premier
message. Ce n'est pas ce qu'« arrêter sur réponse » veut dire.

La borne est désormais le dernier envoi **ou, à défaut, la date d'inscription**.
Le défaut ne se voyait pas à la lecture ; il est sorti d'un `composed: 1,
stopped: 1` inattendu sur deux contacts identiques.

### Trois étapes, et pourquoi c'est une décision

`MAX_STEPS = 3`, refusé par le schéma Zod **et** par l'écran. Une séquence qui
s'arrête d'elle-même au bout de trois messages limite les dégâts d'une réponse
non détectée mieux que n'importe quel mécanisme.

Le délai d'une étape court depuis **l'envoi précédent**, pas depuis
l'inscription : reporter un départ d'un jour décale la suite d'un jour, sinon
trois reports feraient partir deux messages le même matin.

### Le mode automatique, à double verrou

| Condition | Pourquoi |
|---|---|
| **20 départs validés à la main** sur cette séquence | on ne délègue pas ce qu'on n'a pas fait |
| **au moins une réponse obtenue** par cette séquence | une séquence validée vingt fois mais jamais répondue n'est pas éprouvée, elle est **tolérée** |
| **jamais la première étape** | un premier message froid engage la réputation du domaine ; les relances s'adressent à quelqu'un qu'on a déjà approché |

**Le compteur ne compte que les départs `auto: false`.** Compter les envois
automatiques le ferait grandir tout seul une fois le mode activé : la séquence
se justifierait elle-même.

Les trois conditions sont revérifiées **au moment de composer**, pas seulement
au moment de cocher : l'interrupteur exprime une intention, les conditions
expriment un fait, et un fait peut cesser d'être vrai. L'écran verrouille et
**dit ce qui manque** — « Il manque 19 départs validés à la main et au moins une
réponse » — parce qu'un interrupteur grisé sans explication se lit comme une
panne et donne envie de le forcer.

### Les plafonds apprennent du refus

30 par heure et 150 par jour, configurables. **Ces valeurs ne sont qu'une
estimation prudente : le serveur connaît la vraie limite.**

Un `450 … Mail send limit exceeded` abaisse le plafond horaire à **ce qui vient
réellement de passer** — la seule valeur dont on ait la preuve — et le dit **sur
l'accueil**, pas seulement dans un journal. Relever le plafond à la main
acquitte le bandeau : c'est le seul geste qui vaut « j'ai compris ».

**Un 450 n'est pas toujours une limite de débit** : c'est un refus temporaire
qui couvre aussi le greylisting. `isRateRefusal()` exige le code **et** la
formule, sinon chaque greylisting ferait baisser le plafond pour une raison qui
n'a rien à voir. Un test fixe les deux cas.

Le comptage se fait depuis `email_sends`, pas depuis un compteur entretenu à
côté : un compteur finirait par diverger, et il divergerait dans le mauvais
sens, en autorisant plus que le réel.

### Le planificateur muet

**C'est l'absence de passage qu'il faut rendre visible.** Un cron qui cesse de
se déclencher ne produit ni erreur, ni ligne de journal, ni changement à
l'écran : il produit du silence, et le silence ressemble à « tout va bien ».
Avec des séquences en cours, c'est le pire des états.

`Settings.lastCronAt` est écrit **en dernier et seulement en cas de succès** :
l'écrire d'entrée ferait d'un passage à moitié échoué un passage réussi.
Au-delà de 36 heures — pas 24, pour qu'un décalage d'une heure n'allume pas un
bandeau qu'on apprendrait à ignorer — l'accueil le dit. **Jamais exécuté est un
état à signaler**, pas un état neutre : c'est la situation d'un déploiement dont
les secrets du workflow n'ont pas été posés.

### Chaque email de séquence est identifiable

`EmailSend.sequenceId`, `sequenceName` (**copié**, pas seulement référencé) et
`sequenceStep`. L'interaction consignée s'ouvre sur `[Séquence « … », étape N]`,
la fiche l'affiche, et `/emails` porte un graphique par séquence et par étape.
Quand un prospect finit par répondre, il faut savoir **à quoi** il répond — et
« séquence Prospection froide, étape 2 » ne se reconstitue pas après coup.

### Jalon 38 — ce qui est vérifié

Contre un vrai PostgreSQL 16, migration `16_sequences` appliquée puis `migrate
diff` **vide**, le serveur standalone, les substituts SMTP/IMAP/Anthropic :

- **trois étapes** créées ; le mode automatique refusé d'emblée sur une séquence
  neuve, avec sa raison ;
- **samedi** → `skipped`, **0 départ composé** ; mardi → 2 composés ; rejoué →
  0 de plus (contrainte d'unicité, pas vérification) ;
- **file** : deux lignes portant « Prospection froide · étape 1 » et
  « dernière interaction aujourd'hui », trois boutons chacune ;
- **envoi depuis le navigateur** → « Étape 1 envoyée à Laure Favre
  (laure.favre@teledyne.com) », la ligne disparaît ; `email_sends` porte
  `sequenceName` et `sequenceStep`, l'interaction s'ouvre sur
  `[Séquence « Prospection froide », étape 1]` ;
- **report** → le départ est supprimé et sera recomposé demain, pas déplacé ;
- **réponse consignée** → l'inscription passe à `stopped`, motif « Le contact a
  répondu », **et l'étape 2 n'est jamais composée** ;
- **verrou** affiché : « Il manque 19 départs validés à la main et au moins une
  réponse obtenue par cette séquence » ;
- **débit** : plafond à 1 avec un envoi dans l'heure → refus nommant le plafond ;
  greylisting → **aucun changement** ; vrai 450 → plafond 30 → 1, bandeau écrit ;
- **bandeau planificateur** : absent après un passage réussi, présent à 40 h
  (« n'a pas eu lieu depuis 40 heures »), présent aussi si aucun passage n'a
  jamais eu lieu ;
- **passage quotidien réel** par HTTP : `composed: 2`, `lastCronAt` écrit ;
- **0 réponse HTTP ≥ 400, 0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**772 tests**) verts.

### Jalon 38 — ce qui n'est pas vérifié

**Le mode automatique n'a jamais tourné.** Ses conditions sont vérifiées par les
tests, et le chemin d'envoi automatique partage tout son code avec l'envoi
manuel — mais aucune séquence n'a atteint 20 validations et une réponse dans cet
environnement. Ce qui reste à voir en production : que le premier envoi
automatique parte bien, et qu'il parte à l'étape 2.

**Les quotas IONOS restent à confirmer.** Les pages officielles sont bloquées
par le proxy sortant de cet environnement ; les valeurs par défaut viennent d'un
résumé de recherche (montée de 50/h à 500/h selon l'âge de la boîte). La
conception ne dépend pas de leur justesse — c'est le 450 qui fait autorité —
mais les chiffres réglés au départ, eux, sont une supposition.

**L'espacement entre envois automatiques est écrit et testé, jamais appliqué.**
`spacingSeconds()` existe et est couvert, mais la boucle de composition envoie
les départs automatiques à la suite : il n'y a pas encore de file temporisée. À
faible volume c'est sans conséquence ; au-delà d'une dizaine de départs
automatiques par matin, il faudra l'appliquer.

**Le décalage du week-end n'est pas supprimé, il est encadré.** Une réponse
arrivée samedi reste invisible jusqu'à lundi matin. Les deux garde-fous
réduisent le risque ; seul le relevé IMAP de la boîte de réception le supprimera.

**La composition appelle le modèle une fois par départ**, dans le passage
quotidien. À vingt inscriptions actives, c'est vingt brouillons chaque matin —
le compteur de coûts du jalon 36 les verra, et le plafond mensuel les arrêtera
si besoin, mais aucun plafond propre aux séquences n'existe.


---

## Jalon 39 — `/emails` refondu : la forme suit l'histoire

### Le reproche, et la réponse

Onze emails envoyés, et un écran qui montrait surtout du vide : quatre cartes,
puis un graphique de douze semaines à une barre et un graphique de trente jours
à une poignée. Le défaut n'était pas un bug, c'était une affaire de
proportions — et la réponse est un ordre de page : **l'entonnoir, le journal des
envois et la file « Sans réponse » d'abord, les graphiques en dernier et
seulement quand ils portent quelque chose.**

### La forme suit l'histoire disponible

`lib/domain/email-history.ts` (pur) décide de ce qui a le droit de s'afficher :

| Étendue d'activité | Ce qui se rend |
|---|---|
| moins de 7 jours | la liste des envois seule |
| 7 à 27 jours | le quotidien, **sur l'étendue réelle** — pas 30 jours figés |
| 28 jours et plus | le quotidien (plafonné à 30 j) et l'hebdomadaire (12 sem.) |

**Un graphique absent se dit, avec sa condition de retour** — « Graphique
hebdomadaire à partir de 4 semaines d'activité — encore 21 jours » — et revient
tout seul à mesure que l'histoire s'accumule, sans réglage. Vérifié dans les
deux sens contre la base : un envoi vieilli à J−45 fait revenir les deux
graphiques, ramené à J−6 les fait disparaître. Les bornes 6/7 et 27/28 sont
testées des deux côtés.

### Les quatre nombres sont un entonnoir

`lib/domain/email-funnel.ts` (pur) : personnes écrites → ont ouvert
(estimation) → ont répondu → rendez-vous, **en personnes, pas en messages** —
relancer trois fois la même personne ne fait pas trois envois dans l'entonnoir.
La chute entre étapes est dessinée entre les cartes (−4, −8, −1), et chaque taux
**nomme son dénominateur** : « 56 % des personnes suivies », « 20 % des
personnes écrites ». Deux règles y sont fixées par test :

- **une estimation ne sert jamais de dénominateur à un fait** — le taux de
  réponse se rapporte aux personnes écrites, jamais à « ont ouvert » ;
- la première étape n'a ni taux ni chute : « 100 % des personnes écrites »
  serait une tautologie déguisée en mesure.

La mise en garde d'ouverture est ramenée à **une ligne** (`OPEN_RATE_SHORT`),
la version longue au survol (`title`) — repliée, pas supprimée.

### Le journal, et la file de travail

**`readSentEmails()`** (`lib/api/email-list.ts`) : une ligne par message —
date, contact (clic vers le tiroir), société, objet (pastille de séquence,
copie échouée), ouvertures, réponse, signataire. Tri et filtres **dans l'URL**
(`?tri=…&etat=sans-reponse&signataire=…`), appliqués en mémoire parce que
« a répondu » et « a ouvert » sont dérivés — même compromis que `/clients`,
assumé dans le code. La colonne « Réponse » est **postérieure à ce message-ci**,
pas seulement au premier : une réponse d'avant-hier ne répond pas au message de
ce matin.

**`readSilentContacts()`** : les personnes écrites qui n'ont pas répondu, du
plus long silence au plus court, fiches terminales et oppositions exclues. Le
bloc « Sans réponse » porte les **mêmes actions en ligne que la file
d'accueil** — consigner (le vrai `LogForm`), écrire (le vrai `ComposePanel`),
marquer perdu — par le même chemin d'écriture (`POST /api/queue`), avec
l'optimisme local et l'annulation du serveur. **`mark: false`** : ces lignes ne
sont pas la file du jour, et l'anneau de l'accueil ne doit pas compter du
travail qui n'y a jamais été inscrit (vérifié : `queue_marks` reste à 0 après
un « marquer perdu » depuis `/emails`).

**Par signataire** (`signatoryLines()`, domaine) : messages, personnes,
réponses, taux — **la réponse est créditée au signataire du dernier message qui
la précède**, c'est à celui-là qu'on répond. Un tableau, pas un graphique : sur
deux lignes, une barre occupe dix fois la place de ce qu'elle affirme.

`lib/api/email-replies.ts` porte la seule définition de « a répondu »
(postérieure à l'envoi, notes de correction exclues) — trois surfaces
l'appellent, aucune ne la recompose.

### Jalon 39 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` vide), le serveur standalone et le
cas signalé reconstitué — 11 envois, 10 personnes, 7 jours, 2 réponses, 1 RDV :

- **aucun cadre vide** : le quotidien titre « Par jour, sur 7 jours », l'espace
  de l'hebdomadaire porte sa phrase de retour avec le décompte ; à 45 jours
  d'histoire les deux graphiques reviennent seuls ;
- **entonnoir** : 10 · 5 (56 % des suivies) · 2 (20 % des écrites) · 1 (50 % de
  celles qui ont répondu), chutes −4/−8/−1 dessinées, mise en garde en une
  ligne avec la version longue en `title` ;
- **journal** : 11 lignes antichronologiques, clic → tiroir de la fiche
  (`?fiche=p4`), tri par ouvertures `4 3 2 1 1 1 0 0 0 — 0` (« — » pour le non
  suivi, qui n'est pas un zéro), filtre « Sans réponse » → 9 sur 11 avec
  bandeau de réinitialisation ;
- **sans réponse** : 7 personnes triées par silence (5 j → 0 j), les deux
  répondants absents, aucune fiche terminale ; « marquer perdu » → toast,
  ligne retirée, **annulation → la fiche revient à `Prospect`**, 0 marque
  d'anneau écrite ; « consigner » ouvre le vrai formulaire, « écrire » ouvre le
  panneau sur la bonne adresse (substitut Anthropic) ;
- **signataires** : Yanis 7 msg / 6 pers / 1 rép (17 %), Mohamed 4 / 4 / 1
  (25 %) — la réponse de p2 va à Mohamed, dernier à avoir écrit ;
- **1440×900** : entonnoir, journal, « sans réponse » et tableau des
  signataires au-dessus du pli (bas du tableau à 680 px), **0 débordement
  horizontal** (mesuré), 0 erreur console, 0 réponse ≥ 400 ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**804 tests**) verts.

### Jalon 39 — ce qui ne l'est pas

**Le tri et les filtres du journal s'appliquent en mémoire** sur la fenêtre de
90 jours. À quelques centaines d'envois c'est invisible ; à plusieurs dizaines
de milliers il faudrait matérialiser « a répondu » en base, au prix de la
portabilité — le code le dit.

**Les compteurs de l'écran sont calculés sur des fixtures**, pas sur vos onze
vrais messages : la production a sa propre histoire (envois du jalon 37,
réponses réelles). Les règles sont les mêmes ; les chiffres seront les vôtres.

**`compose-panel.tsx` reste à 348 lignes** (dette antérieure au jalon, non
aggravée ici) ; `contact-form.tsx` à 276 — les deux au-dessus de la limite de
250.

**L'état vide (0 envoi) n'a pas été revu dans le navigateur** ce jalon : la
branche est celle du jalon 37 (un `EmptyChart` qui renvoie vers `/contacts`),
seul l'en-tête a changé.


---

## Jalon 40 — « Ma performance » : la personne, pas les fiches

### Ce que l'écran mesure, et la phrase qui l'encadre

`/performance` mesure le rythme de travail : le volume par canal et par jour,
ce qu'il produit, et sa régularité. **La ligne d'honnêteté est dans l'en-tête,
pas en pied de page** : cet écran mesure ce qui est *consigné*, pas ce qui est
fait — il faut l'avoir lue avant les chiffres, sinon une baisse de saisie se
lit comme une baisse de travail.

**Une seule source : les interactions.** Chaque envoi d'email consigne déjà une
interaction `email` (jalon 32) : compter aussi `email_sends` les compterait
deux fois. L'attribution suit le propriétaire de l'interaction. Les notes de
correction sont exclues partout (`CORRECTION_OWNER`, jalon 27) — vérifié : une
note de correction posée le lundi ne change ni le volume, ni les jours actifs,
ni l'entonnoir.

### Le canal LinkedIn existe enfin

`"linkedin"` rejoint `ACTIVITY_TYPES`. Le changement s'est propagé **par le
compilateur** : chaque `Record<ActivityType, …>` (couleurs de chronologie,
libellés, délais de relance, formulaires) a refusé de compiler jusqu'à être
complété — c'est la raison d'être de ces `Record` plutôt que des tableaux.
Migration `17_performance` : `relanceApresLinkedin` (défaut 4 j, comme
l'email) + les deux objectifs hebdomadaires.

### Les périodes, et la comparaison honnête

`lib/domain/performance.ts` (pur, 18 tests) : aujourd'hui · cette semaine · ce
mois · 90 jours · période libre, tout dans l'URL. **Une période calendaire
entamée se compare à la précédente *complète*** — comparer deux jours de
semaine à sept jours pleins ferait de chaque lundi un effondrement — et la
légende le dit : « +8 vs la semaine dernière (complète) ». Une période libre
invalide retombe sur la semaine : un lien vieilli ouvre l'écran, pas une 404.

### Le graphique empilé, et la régularité

`StackedBars` (SVG serveur) : un canal = une couleur, la même que la
chronologie des fiches ; **les jours à zéro restent dessinés** — c'est eux
qu'on veut voir. La régularité se compte **en jours ouvrés** : un samedi
travaillé ne gonfle pas le ratio, un week-end ne casse pas une série, et la
journée en cours non plus (elle n'est pas finie). Relances tenues/manquées :
même définition qu'au jalon 22 — « tenue » = terminée au plus tard le jour de
l'échéance, sur les tâches automatiques.

### Objectifs hebdomadaires

Deux réglages (`/reglages` → Objectifs hebdomadaires), `0` = pas d'objectif —
l'écran n'affiche alors **aucune** barre plutôt qu'un « 4 sur 0 ». La barre
mesure **toujours la semaine en cours**, quel que soit le sélecteur :
l'objectif est hebdomadaire, le rapporter à 90 jours ne signifierait rien.

### L'entonnoir inter-canaux, et le côte à côte

Contactés → répondu → RDV → qualifiés, en personnes, rendu par le même
`FunnelRow` que `/emails` (sa clé d'étape est devenue une chaîne libre). La
dernière étape compte des **affaires ouvertes** (`Deal.createdAt` = date de
qualification depuis le jalon 22) et le dit. « Mauvais interlocuteur » compte
comme réponse : quelqu'un a décroché — seule « pas de réponse » est exclue.
Le tableau Yanis/Mohamed donne volume et résultat par personne, le taux de
réponse **par personne contactée**.

### Jalon 40 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `17_performance` appliquée puis
`migrate diff` **vide**), le serveur standalone et le navigateur à 1440×900,
sur le scénario des cinq tests d'acceptation (2 personnes, 2 semaines, tous
les canaux) :

- **volume comparé** : 5 appels « = vs la semaine dernière (complète) » avec la
  ventilation des issues sous la carte ; filtré Yanis → « 3 · −2 » en rouge ;
- **taux par canal** : Appel 60 % (3 réponses sur 5 issues connues), LinkedIn
  100 %, Email « — » (aucune issue connue — pas de taux inventé) ;
- **côte à côte** : Mohamed 3 interactions / 1 RDV / 50 %, Yanis 5 / 1
  qualifié / 60 % ;
- **régularité** : 1 jour actif sur 3 ouvrés, objectifs 5/20 et 1/10 affichés
  en barres, 1 relance tenue · 1 manquée ;
- **correction** : la note `Correction` ne compte nulle part, l'entonnoir dit
  7 personnes (p9 touché deux fois ne compte qu'une) ;
- **réglage rond** : objectif changé à 25 depuis `/reglages` → « 5 / 25 » sur
  `/performance` au rechargement ; le champ « Après LinkedIn » est apparu dans
  les délais de relance, et « LinkedIn » dans le formulaire d'interaction ;
- **0 débordement, 0 erreur console, 0 réponse ≥ 400** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**822 tests**) verts.

### Jalon 40 — ce qui ne l'est pas

**Les qualifications antérieures au jalon 22 portent leur date de saisie**, pas
de qualification — la carte « Qualifiés » n'est juste que pour les affaires
ouvertes depuis. **Le graphique à 90 jours** n'a été vu qu'avec des fixtures
d'une semaine : les étiquettes s'espacent (1 jour sur 7) mais l'allure à
volume réel reste à voir. **La période libre** passe par un formulaire GET
natif ; le format de date affiché dépend de la langue du navigateur.


---

## Jalon 41 — les réponses se détectent toutes seules

C'est l'**option B** de la note de conception du jalon 38, dont la moitié était
déjà payée : la connexion IMAP, le `Message-ID` conservé sur chaque envoi et la
copie dans « Envoyés » existaient depuis le jalon 37.

### Ce que le relevé lit, et ce qu'il ne lit pas

`lib/api/inbox.ts` ouvre `INBOX` **en lecture seule** (`EXAMINE`) et demande
**sept en-têtes** — `Message-ID`, `In-Reply-To`, `References`,
`Auto-Submitted`, `X-Autoreply`, `From`, `Date` — par
`BODY.PEEK[HEADER.FIELDS (…)]`. Jamais un corps, jamais le sujet du message
reçu, aucun drapeau touché. La boîte n'est pas recopiée dans le CRM, et c'est
vérifiable au protocole : le substitut **refuse** un `FETCH` sans `PEEK` et un
`FETCH` qui demanderait autre chose que des en-têtes, si bien qu'un relevé qui
dériverait échouerait bruyamment au lieu de passer.

### Le rapprochement est exact, ou il n'a pas lieu

`lib/domain/inbox-replies.ts` (pur) compare `In-Reply-To` puis `References`
— **du plus récent au plus ancien**, c'est au dernier message du fil qu'on
répond — aux `Message-ID` de nos propres envois. Aucune heuristique sur
l'expéditeur ni sur le sujet : **une fausse correspondance est pire qu'une
réponse manquée**. La première consigne une réponse sur la mauvaise fiche et
arrête la mauvaise séquence ; la seconde ne coûte qu'un relevé de retard sur la
saisie manuelle.

**L'automate est écarté avant le rapprochement**, et l'ordre est le sujet : un
« absent du bureau » recopie fidèlement `In-Reply-To`, donc il correspondrait
parfaitement. `Auto-Submitted` (RFC 3834, `no` désignant un humain) et
`X-Autoreply` l'écartent ; `MAILER-DAEMON` / `postmaster@` écartent les rebonds.

### Ne jamais consigner deux fois — deux garde-fous

1. **`EmailReply.replyMessageId` est unique en base.** Un second relevé bute sur
   la contrainte ; il ne la contourne pas. Une course non plus.
2. **Une réponse déjà consignée à la main est reconnue.** Si une interaction à
   issue « répondu » existe pour ce contact **postérieurement à l'envoi
   rapproché**, la détection est enregistrée sans créer de seconde interaction.
   L'ancre est l'envoi, pas « à un moment quelconque » : une réponse à un
   message plus récent trouve une ancre plus récente et sera donc bien
   consignée.

Une réponse détectée écrit une interaction `email` d'issue **« Répondu »**
(nouvelle valeur d'`OUTCOMES`, ajoutée parce que le relevé lit des en-têtes et
sait donc qu'il y a une réponse **sans savoir ce qu'elle dit** — lui faire
choisir « intéressé » serait inventer), datée du message reçu, et **arrête les
séquences** du contact en écartant leurs départs en attente.

### Sa propre route, son propre déclencheur, son propre bandeau

`POST /api/cron/inbox` fermée par `CRON_SECRET`, appelée par
`.github/workflows/auraflow-inbox.yml` toutes les 15 minutes —
**séparé du passage quotidien** : les cadences n'ont rien à voir, et surtout un
relevé qui échoue ne doit pas emporter la sauvegarde. `concurrency` avec
`cancel-in-progress` : deux relevés simultanés se disputeraient la boîte, et à
un quart d'heure d'intervalle le suivant fera le travail.

`lastInboxPollAt` est écrit **en dernier et seulement en cas de succès**, comme
`lastCronAt`. Au-delà de **2 heures** — huit passages manqués — `/accueil`
affiche un bandeau : une détection qui s'arrête en silence est pire que pas de
détection, parce qu'on croit alors le CRM à jour. Désactivé ou non configuré
n'allume rien : ce n'est pas une panne.

### Jalon 41 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `18_inbox` puis `migrate diff` **vide**),
le serveur standalone et le substitut IMAP étendu (`EXAMINE`, `UID SEARCH`,
`UID FETCH … BODY.PEEK[HEADER.FIELDS]`) :

- **au protocole** : `EXAMINE INBOX — lecture seule`, et
  `UID FETCH — en-têtes demandés : message-id in-reply-to references
  auto-submitted x-autoreply from date` — rien d'autre n'a transité ;
- **réponse détectée** : interaction `email` / `replied` datée de la réponse
  (pas du relevé), notes citant **le sujet de notre envoi** et rien du message
  reçu ; inscription passée à `stopped` avec « Le contact a répondu » ; départ
  en attente passé à `skipped` ;
- **idempotence** : second relevé → `replies: 0`, 1 seule ligne
  `email_replies`, aucune interaction de plus ;
- **bruit écarté** : répondeur d'absence citant `In-Reply-To` → ignoré, rebond
  `MAILER-DAEMON` citant `References` → ignoré, lettre d'information → sans
  rapport ; **zéro interaction** créée ;
- **déjà consigné à la main** → `alreadyLogged: 1`, `replies: 0`, compteur
  d'interactions du contact **inchangé**, et la ligne de détection écrite avec
  `activityId: null` ;
- **copie « Envoyés » en échec** → la réponse est quand même rapprochée : le
  rapprochement lit `email_sends.messageId` en base, jamais le dossier ;
- **cron** : sans en-tête et avec un mauvais secret → 401 ; avec le bon →
  `{"examined":1,"replies":1}` et l'interaction en base ;
- **navigateur** : panneau « Détection des réponses » avec sa mise en garde,
  « Relever maintenant » → « 1 message examiné · 1 déjà consignée à la main »,
  interrupteur dans les deux sens ; `/emails` montre 5 réponses sur 5 personnes
  écrites et 5 lignes « oui » ; bandeau `/accueil` absent à chaud, présent à
  5 heures, présent si jamais exécuté, **absent si désactivé** ;
- **0 réponse ≥ 400, 0 erreur console** ; `build` / `tsc` / `vitest`
  (**834 tests**) verts.

**Un défaut trouvé au navigateur, pas à la lecture** : l'interrupteur du relevé
était piloté par la réponse du serveur et restait donc immobile le temps de
l'aller-retour — une case qui ignore le clic se lit comme une panne. Il est
désormais optimiste et réversible, comme la file d'accueil du jalon 20.

### Jalon 41 — ce qui n'est pas vérifié, et deux questions rendues

**Rien n'a touché IONOS.** Le substitut parle le protocole, il ne dit rien de ce
que `imap.ionos.fr` acceptera. Ce qui reste à établir au premier relevé réel :
que les identifiants passent en IMAP en lecture, et que `SEARCH SINCE` se
comporte comme prévu.

**Question 1 — un relevé tous les quarts d'heure risque-t-il de heurter les
limites IMAP d'IONOS ?** Je n'ai pas pu le confirmer : les pages d'aide d'IONOS
restent bloquées par le proxy sortant de cet environnement, et aucune source
consultable ne publie de nombre. Ce que je peux dire : IONOS limite les
**connexions simultanées** par boîte, pas la fréquence, et le relevé ouvre
**une** connexion courte puis se déconnecte (`logout` en `finally`), quatre fois
par heure — soit 96 sessions par jour, jamais concurrentes grâce au
`cancel-in-progress`. Un client de messagerie ordinaire est bien plus exigeant :
Thunderbird ou Apple Mail maintiennent une connexion `IDLE` **permanente** sur
la même boîte. Le risque réel n'est donc pas le quota mais la coexistence : si
plusieurs clients sont déjà connectés, une session de plus peut être refusée.
Dans ce cas le relevé renvoie l'erreur du serveur, le bandeau s'allume au bout
de deux heures, et rien n'est perdu — le relevé suivant relit la même fenêtre.
Si le refus devenait fréquent, passer à 30 minutes ne coûterait qu'une ligne du
workflow.

**Question 2 — une réponse arrivée avant que la copie « Envoyés » soit écrite ?**
Elle est détectée normalement, et c'est structurel : **le rapprochement ne lit
jamais le dossier « Envoyés »**, il lit `email_sends.messageId` en base, écrit
dans la transaction d'envoi — donc avant la copie IMAP, et même quand celle-ci
échoue (vérifié). Le seul cas résiduel serait une réponse relevée avant que la
ligne d'envoi existe, c'est-à-dire dans les millisecondes qui suivent
l'acceptation par SMTP. Elle serait alors classée « sans rapport » pour ce
relevé, puis **rattrapée au suivant** : le `SINCE` reprend deux jours en
arrière et rien n'est marqué comme traité côté serveur. Vérifié en supprimant
la ligne d'envoi, en relevant, puis en la recréant — la réponse est consignée au
relevé suivant.

**Le workflow vit hors de `crm/`**, comme celui du jalon 19 et pour la même
raison : le cron de Railway ne sait pas émettre de requête HTTP. C'est la seule
exception à la règle « aucun fichier hors de `crm/` », et elle est assumée
depuis le filet de sécurité.


---

## Jalon 42 — la restauration effaçait la moitié du produit

### L'incident, et ce qu'il a réellement coûté

**Signalé** : une réponse de prospect non détectée, `/emails` à 0 réponse pour
17 messages envoyés, et — le détail qui ne collait pas — les champs SMTP vides
sur `/reglages` alors que 17 messages étaient bien partis.

Deux hypothèses ont été écartées avant d'arriver à la bonne. Le texte périmé
« La réception n'est pas gérée par cette version » **ne prouvait rien** sur
l'état du déploiement : il était toujours dans `main`, c'était une phrase que le
jalon 41 avait oublié de retirer. Et « le panneau ne relit pas les réglages »
était faux : `readMailStatus()` étale `readMailConfig()`, donc le panneau et le
chemin d'envoi lisent **la même ligne par la même fonction**.

**La cause, nommée :** `restoreBackup()` supprime la ligne de réglages
(`lib/api/backup.ts:240`) puis la recrée à partir de ce que `backupSchema` a
laissé passer. Or `settingsRow` déclarait **11 champs** pour une table qui en
porte **44**, et Zod retire les clés qu'il ne connaît pas. Les deux chemins
réels valident *avant* de restaurer — `app/api/backup/route.ts:30` et
`lib/api/snapshots.ts:178` — donc une restauration recréait la ligne avec 11
colonnes et laissait Prisma remplir le reste avec ses valeurs par défaut.

Le défaut ne se limitait pas aux réglages. Audit des dix modèles sauvegardés :

| Modèle | Colonnes | Dans la sauvegarde | Perdues à la restauration |
|---|---|---|---|
| Settings | 44 | 11 | SMTP, IMAP, modèles, plafonds, objectifs, battements de cœur |
| Contact | 24 | 16 | `status`, `statusSetAt`, `lostReason`, `tag`, `website`, `searchText`, `emailCount`, `lastEmailAt` |
| Activity | 11 | 10 | **`outcome`** |
| Company / Deal | 9 / 17 | 8 / 16 | `searchText` |
| Stage | 8 | 7 | `exitCriterion` |

`Activity.outcome` explique le symptôme d'origine à lui seul : sans issue, plus
personne n'a « répondu », et le taux de réponse comme l'entonnoir de `/emails`
retombent à zéro alors que les interactions sont toujours là. Les colonnes SMTP
et IMAP expliquent le reste : `imapMissingFields()` déclare la configuration
incomplète, `pollInbox()` sort sur `skipped: "Relevé non configuré…"` et **ne se
connecte jamais**. Un an de corrections de statuts, les motifs de perte du jalon
11, les domaines extraits aux jalons 24-25 et les miroirs de recherche du jalon
10 partaient dans la même opération.

### Un piège de méthode, à retenir

La première tentative de reproduction appelait `restoreBackup()` **en direct** et
rendait **0 colonne perdue** — un faux négatif rassurant. Le raccourci saute
`backupSchema`, c'est-à-dire précisément l'endroit où la donnée disparaît.
**Vérifier le chemin réel, pas le chemin commode** : c'est la même leçon qu'au
jalon 33 sur le serveur périmé, et elle a resservi ici.

### Ce qui est corrigé

**1. Les dix schémas de ligne portent toutes les colonnes.** Les ajouts sont
**optionnels** : une sauvegarde plus ancienne ne peut pas porter ce qui
n'existait pas quand elle a été prise, et la refuser rendrait le filet inutile au
moment précis où l'on en a besoin.

**2. `tests/backup-columns.test.ts` interdit la rechute.** Il compare le schéma
Prisma aux schémas Zod **lus à l'exécution** — pas à une liste recopiée, qui
serait une seconde source de vérité, donc une seconde occasion de diverger. Il
échoue en nommant chaque colonne, avec le geste à faire. Éprouvé dans les deux
sens : en retirant `smtpHost` et `outcome` (« Ces colonnes de Settings seraient
**effacées** par une restauration : smtpHost »), et en ajoutant une colonne
`quotaMensuelSms` au schéma Prisma sans toucher à la sauvegarde — le test tombe
en la nommant.

**3. Le relevé non configuré cesse d'être muet.** `inboxVerdict()` traitait
« non configuré » comme « pas une panne » — juste pour quelqu'un qui n'a jamais
branché le relevé, faux pour quelqu'un dont la configuration vient d'être
effacée. Ce qui départage les deux : **des envois existent**. Un CRM qui a écrit
à quinze personnes, dont le relevé est allumé et qui ne peut pas tourner est en
panne. Bandeau ambre sur `/accueil`, distinct du bandeau rouge d'ancienneté
parce que le geste n'est pas le même : là il faut aller voir le workflow, ici
ressaisir un réglage.

**4. La phrase contradictoire est retirée** (`mail-panel.tsx`,
`settings-view.tsx`) : elle annonçait que la réception n'était pas gérée, deux
blocs au-dessus du panneau qui la gère.

### Jalon 42 — ce qui est vérifié

Contre un vrai PostgreSQL 16, **par le chemin réel** (export → `backupSchema` →
`restoreBackup`), sur une base portant une configuration IONOS réaliste, un
contact avec statut/motif/étiquette/site et cinq interactions à issue connue :

- **0 colonne perdue** sur les réglages (44 clés après `backupSchema`, contre 11
  avant) et **0 sur le contact** ; 5 issues d'interaction avant, 5 après ;
- **la messagerie survit** : `smtpHost: smtp.ionos.fr`,
  `smtpUser: contact@auraflowai.fr`, `imap.ready: true`, et le lien de démo
  reste Calendly au lieu de revenir au défaut du schéma ;
- **une sauvegarde ancienne reste restaurable** : `smtpHost`, `imapHost`,
  `inboxPollEnabled`, `objectifAppelsSemaine` et `searchText` retirés du JSON →
  toujours acceptée ;
- **bandeau** : silencieux quand tout est configuré, silencieux quand le relevé
  est coupé volontairement, silencieux sans aucun envoi — **présent** dès que
  des envois existent et que la configuration manque, avec le texte exact ;
- **`/reglages`** : plus aucune occurrence de l'ancienne phrase, le panneau
  « Détection des réponses » et les deux nouveaux textes présents ;
- `migrate diff` **vide** — aucune migration ce jalon, seuls des schémas de
  validation ont changé ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**845 tests**) verts.

Un test tiers est tombé au passage et a été corrigé plutôt que contourné : le
substitut Prisma de `home-page.test.ts` n'avait pas `emailSend.count`, que la
page lit désormais pour décider du bandeau. Même classe d'oubli qu'au jalon 36
avec `apiUsage`.

### Jalon 42 — ce qui n'est pas fait

**Les données déjà perdues ne reviennent pas.** Ce jalon empêche la prochaine
restauration de détruire quoi que ce soit ; il ne rend pas les statuts, motifs,
étiquettes, domaines et issues effacés par celle qui a eu lieu. Deux voies pour
les récupérer, dans cet ordre : une sauvegarde antérieure à la restauration —
elles sont datées dans `/reglages` et le JSON exporté, lui, **a toujours porté
les 44 colonnes** — ou les reports de feuille des jalons 11, 21 et 25, qui
savent réécrire statuts et motifs depuis la source.

**La restauration reste un « supprimer puis recréer ».** Une restauration
partielle, colonne par colonne, serait plus sûre encore ; ce n'était pas
nécessaire pour fermer ce défaut et cela changerait la sémantique du filet.

**Le relevé n'a toujours pas tourné contre IONOS.** Le diagnostic explique
pourquoi il ne pouvait pas ; que les identifiants passent reste à établir au
premier relevé réel, et la question de la boîte — `contact@auraflowai.fr` est-il
un compte à part entière ou un alias — reste ouverte côté IONOS.


---

## Jalon 43 — pourquoi le relevé ne trouve rien, et ce que valent les ouvertures

### 1. « 9 examinés, 0 rapproché » ne se diagnostique pas

Le relevé rendait deux nombres et aucune trace. Il rend désormais, **pour chaque
message examiné** : son `Message-ID`, ses `In-Reply-To` et `References`, son
verdict, l'en-tête sur lequel un automate a été écarté, et — quand rien n'a
correspondu — **la liste des identifiants essayés**. `PollReport` porte en plus
`knownSent` (combien de nos envois sont candidats), `searchSince` (la fenêtre
réellement demandée) et `mailbox` (la boîte ouverte).

`components/settings/inbox-detail.tsx` rend ce détail dans `/reglages`. Il **ne
persiste rien** — il vit le temps de la réponse — et ne montre que des en-têtes
de fil : aucun sujet reçu, aucun expéditeur, aucun mot du corps. La promesse du
jalon 41 tient jusque dans l'écran de diagnostic.

### Les trois hypothèses, tranchées

| Hypothèse | Verdict |
|---|---|
| **Le filtre d'automate est trop large** — une signature riche prise pour un répondeur | **Faux.** `isAutoResponse()` ne lit que `Auto-Submitted` (RFC 3834) et `X-Autoreply` ; il ne regarde ni le corps, ni les images, ni la longueur. Un message signé d'un pavé marketing avec badges Trustpilot est classé `reply` — vérifié contre le substitut IMAP avec exactement ce cas |
| **La fenêtre `SINCE`** | **Écartée** : le relevé reprend `OVERLAP_DAYS = 2` en arrière et `SEARCH SINCE` est à la granularité du jour. Une réponse du 19/08 est dans la fenêtre d'un relevé du 20/08. `searchSince` est désormais affiché, donc vérifiable au lieu d'être supposé |
| **La mauvaise boîte** | **La seule qui reste, et elle n'est pas décidable depuis le code.** Le relevé ouvre l'INBOX de `smtpUser` — l'identifiant IMAP. Si l'adresse d'expédition est un **alias** posé sur une autre boîte, les réponses arrivent dans l'autre et aucun relevé ne les verra. Le panneau affiche donc la boîte relevée et le dit en toutes lettres |

**Ce qu'il faut vérifier chez IONOS**, et que le code ne peut pas dire : dans
l'espace client, *E-mail* → la ligne `contact@auraflowai.fr`. Si elle apparaît
comme **boîte e-mail** avec sa propre taille et son propre mot de passe, la
configuration est bonne. Si elle apparaît comme **alias / redirection** vers une
autre adresse, c'est cette autre adresse qu'il faut mettre dans l'identifiant
IMAP — l'alias n'a pas d'INBOX à lui.

### 2. Les 87 % d'ouverture ne voulaient rien dire

Deux causes, nommées avec leur fichier, avant tout correctif :

**a. Notre propre copie portait le pixel.** `email-send.ts` déposait dans
« Envoyés » les octets exacts de l'envoi (jalon 37), pixel compris : ouvrir son
propre dossier « Envoyés », ou laisser un client le pré-charger, comptait comme
une ouverture du prospect.

**b. Chaque requête incrémentait le compteur.** `recordOpen()` faisait deux
`updateMany` sans aucune déduplication ni fenêtre de livraison : un client qui
recharge l'image cinq fois produisait « 5 ouvertures », et un antivirus qui
récupère les images à la livraison produisait une ouverture pour un message que
personne n'avait vu.

**c. Et la question ne pouvait pas se poser.** Le schéma ne portait que
`firstOpenAt`, `lastOpenAt` et `openCount` : « comment ces ouvertures sont-elles
groupées » **n'avait pas de réponse en base**. C'est pour cela que le jalon
commence par mesurer.

### Ce qui est fait

**`EmailOpenHit`** (migration `19_open_hits`) : une ligne par chargement, avec
son délai depuis l'envoi et son verdict. **Elle ne porte que cela** — pas
d'adresse IP, pas d'agent utilisateur : la promesse du jalon 37 est tenue jusque
dans l'instrumentation qui sert à l'auditer.

`lib/domain/open-tracking.ts` (pur) classe chaque chargement :

| Verdict | Règle | Pourquoi |
|---|---|---|
| `delivery` | moins de 30 s après l'envoi | personne n'ouvre un message dans les trente secondes ; c'est un relais ou un antivirus |
| `burst` | moins de 60 s après le chargement précédent | un même client qui recharge n'est pas une seconde lecture |
| `counted` | le reste | la seule chose affichée |

`openCount` ne bouge que pour `counted`, `openNoise` pour les deux autres, et
**`firstOpenAt` n'est plus posé par un chargement à la livraison** : la date de
première lecture cesse d'être la date de livraison. La purge de rétention efface
les chargements avec le reste — ce sont des horodatages de comportement, et les
laisser derrière reconstituerait exactement ce qu'elle efface.

**Le pixel est retiré de la copie « Envoyés ».** `sendMail()` rend deux tampons :
`raw` (parti sur le fil) et `rawForArchive` (déposé par IMAP). Le compromis est
assumé et écrit dans le code : **l'identité octet pour octet du jalon 37 est
perdue** quand le suivi est actif. Ce qu'elle servait — rattacher la réponse au
bon fil — ne tient pas aux octets mais aux en-têtes, et la copie est composée à
partir du **même objet** message : `Message-ID`, `Date`, `From`, `To`, `Subject`
et le corps sont identiques. Sans suivi, les deux tampons restent identiques à
l'octet près, et c'est vérifié.

### 3. L'écran dit ce que le chiffre vaut

**Le passé n'est pas auditable, et c'est le premier nombre affiché.** Les
chargements antérieurs à ce jalon n'ont jamais été enregistrés ligne à ligne :
un envoi qui affiche huit ouvertures sans aucune ligne de détail n'est ni
confirmé, ni infirmé. `/emails` l'écrit sous l'entonnoir — « L'estimation
d'ouverture n'est pas vérifiable sur 1 envoi sur 3 » — et `/reglages` porte le
panneau « Ce que valent les ouvertures » : chargements par verdict, part de
bruit, répartition des délais, et les soixante derniers chargements tels quels.

C'est la réponse à « si le chiffre ne peut pas être cru, je préfère que l'écran
le dise » : il le dit, envoi par envoi, au lieu de retirer la mesure.

### Jalon 43 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `19_open_hits` appliquée puis
`migrate diff` **vide**), le serveur standalone, un puits SMTP et deux serveurs
IMAP substitués :

- **classement** : quatre chargements sur un même envoi (5 s, 1 h, +10 s, 2 h) →
  `delivery, counted, burst, counted`, `openCount: 2`, `openNoise: 2`, et
  **`firstOpenAt` posé sur la lecture, pas sur la livraison** ;
- **jeton inconnu** → aucune ligne écrite, même image rendue ;
- **audit** : 2 comptés / 1 rafale / 1 livraison, part de bruit 50 %, 1 envoi
  déclaré inauditable ;
- **purge** : envois vieillis → chargements supprimés, `openCount` et
  `openNoise` à zéro, jeton effacé, **objet de l'envoi conservé** ;
- **copie « Envoyés »** : le message parti porte le pixel, la copie déposée n'en
  porte **aucun**, et `Message-ID`, `From`, `To`, `Subject`, `Date` sont
  identiques des deux côtés ; **sans suivi, les deux fichiers sont identiques à
  l'octet près** (694 octets contre 694) ;
- **relevé instrumenté** : réponse à signature riche → `reply` avec l'identifiant
  rapproché ; `Auto-Submitted: auto-replied` → `auto` **en nommant l'en-tête** ;
  lettre d'information → `unrelated` avec « ne cite aucun fil » ; `mailbox`,
  `searchSince` et `knownSent` rendus ; second relevé → 0 réponse en double ;
- **navigateur (1440×900)** : panneau « Ce que valent les ouvertures » avec ses
  trois compteurs, la part de bruit et la répartition des délais ; bandeau
  d'`/emails` « n'est pas vérifiable sur 1 envoi sur 3 » ; **0 débordement
  horizontal, 0 erreur console, 0 réponse ≥ 400** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**860 tests**) verts.

### Jalon 43 — ce qui n'est pas fait

**Le taux d'ouverture de production reste inauditable pour l'historique.** Le
tri ne s'applique qu'aux chargements à venir : les 87 % constatés portent sur des
envois dont les chargements n'ont jamais été enregistrés un par un. Ils ne
seront ni corrigés, ni recalculés — ils sont signalés comme non vérifiables, et
c'est tout ce qu'on peut en dire honnêtement.

**Les seuils sont un jugement, pas une mesure.** Trente secondes et une minute
écartent le rechargement mécanique sans prétendre distinguer deux lectures
rapprochées. Les données que ce jalon commence à accumuler diront s'ils sont
justes — c'est précisément pour cela que la répartition des délais est affichée.

**La question de la boîte IONOS reste ouverte.** C'est la seule hypothèse
survivante sur la réponse de Caroline, et elle se tranche dans l'espace client
IONOS, pas dans le code.

**Rien n'a touché IONOS**, une fois de plus : SMTP et IMAP sont exercés contre
les substituts versionnés.


---

## Jalon 44 — la base portait un identifiant qui n'a jamais existé

### La cause, nommée avec sa ligne

Le diagnostic du jalon 43 a désigné le fait au premier relevé : un message
examiné citait `<1787142802796.rpp6m071@auraflowai.fr>` — **notre format, notre
domaine** — et le verdict disait « aucun de ces identifiants n'est des nôtres »,
contre 22 envois connus. Le fil était correct ; c'était la table qui mentait.

**`lib/api/mail.ts:333` rendait `info.messageId ?? id`.** En envoi `raw`,
nodemailer ne relit pas les en-têtes du tampon : son `MimeNode` n'a pas de
`Message-ID`, donc `messageId()` (`mime-node/index.js:952`) en **fabrique** un —
forme UUID `<8-4-4-4-12@domaine>` — et le rend dans `info.messageId`. Cet
identifiant n'apparaît dans aucun message : le MIME était déjà composé quand il
a été inventé.

Mesuré contre le puits SMTP, sur quatre envois réels :

| | Message-ID |
|---|---|
| parti sur le fil | `<1787220230882.och68sxe@aura.test>` — notre générateur |
| stocké en base | `<b58ba737-b4c6-c1a8-3bda-dd2f97989d06@aura.test>` — celui de nodemailer |

**Coût réel : trois jalons de détection de réponses inopérante**, et un
diagnostic qui accusait successivement le filtre d'automate, la fenêtre `SINCE`
et la boîte IONOS.

### Les deux autres hypothèses, écartées avec leur preuve

**La sauvegarde n'a pas tronqué `email_sends`.** La table **n'est pas
sauvegardée du tout** : `BACKED_UP` (jalon 42) porte dix modèles, et `EmailSend`
n'en fait pas partie ; `restoreBackup()` ne supprime que ces dix tables
(`lib/api/backup.ts:320-329`). Les lignes d'envoi ont donc survécu intactes à la
restauration, `messageId` compris — il était simplement faux depuis l'écriture.

**La comparaison n'est pas en cause.** `classify()` compare des chaînes entières
`<…>` extraites par la même expression des deux côtés. Les 22 contre 17 ne sont
pas une anomalie non plus : le relevé compte les envois sur **180 jours**
(`SENT_WINDOW_DAYS`) là où `/emails` en montre **90** — deux fenêtres, deux
nombres, et le rapport les affiche désormais tous les deux.

### Un second défaut, trouvé en écartant la sauvegarde

`EmailSend.contactId` est en `SetNull` (jalon 3 : supprimer une fiche ne doit pas
effacer l'historique commercial). Or **`restoreBackup()` supprime tous les
contacts** avant de les recréer : après la restauration, chaque envoi antérieur
porte `contactId: null`.

La conséquence est muette et grave : `recordReply()` n'écrit **aucune
interaction** et n'arrête **aucune séquence** quand `contactId` est nul
(`lib/api/inbox.ts:398-437`). Une réponse aurait été « détectée » sans que rien
n'apparaisse sur la fiche — donc corriger le seul `Message-ID` n'aurait pas
suffi à faire remonter la réponse de Caroline sur son écran.

### Le rattrapage depuis « Envoyés » — et pourquoi il est solide

L'identifiant n'est ni déduit ni reconstruit : il est **lu dans le message
lui-même**, tel que le serveur l'a archivé. C'est la même source que celle que le
correspondant cite dans sa réponse — donc, par construction, celle qui fera
correspondre le rapprochement.

`lib/domain/sent-match.ts` (pur) porte la règle : la clé est le couple
**destinataire + instant** (à 120 s près), jamais le sujet — il arrive encodé
(`=?UTF-8?Q?…`) et le décoder ajouterait une source d'erreur là où deux champs
suffisent. **Toute ambiguïté est signalée, jamais tranchée** : deux envois
candidats, ou deux messages revendiquant le même envoi, sortent du plan. Écrire
un mauvais `Message-ID` attribuerait une réponse à la mauvaise personne et
arrêterait la mauvaise séquence — c'est pire que ne rien écrire, et c'est la
règle du jalon 41 appliquée à la réparation.

Garanties habituelles : simulation d'abord, **une seule colonne** touchée,
en-têtes seuls, dossier ouvert en **lecture seule**, idempotent, et la condition
d'écriture porte sur la valeur relue — un envoi corrigé entre la simulation et le
clic est ignoré, pas écrasé.

Le même geste re-rattache les envois orphelins **par adresse électronique**, la
seule clé stable au travers d'une restauration. Une adresse portée par deux
fiches est laissée telle quelle.

### Le diagnostic distingue enfin deux pannes

`lib/domain/message-id.ts` (pur) reconnaît un identifiant de **notre générateur
et de notre domaine**. Quand un tel identifiant est cité sans être en base, le
relevé le dit en toutes lettres — « Cite un identifiant de NOTRE domaine, absent
de la base […] c'est le journal des envois qui ne porte pas cet identifiant » —
au lieu de le confondre avec un fil inconnu. **C'est cette confusion qui a caché
la cause pendant trois relevés**, et c'est la moitié du correctif.

### La garde

`tests/message-id-source.test.ts` échoue si `info.messageId` réapparaît dans le
code exécuté de `mail.ts`. Statique parce que le défaut l'est : les deux valeurs
sont des `string`, le typecheck ne peut rien voir, et il n'y a pas de serveur
SMTP dans la suite. Même famille que `cost-single-source` et
`status-single-source`. **Éprouvée en réintroduisant le défaut exact** : le test
tombe en citant la ligne et le geste à faire.

`lib/domain/__tests__/message-id.test.ts` vérifie `looksOurs()` **contre le
générateur du produit** plutôt que contre une chaîne recopiée — une forme
recopiée cesserait de décrire le générateur au premier changement, et le
diagnostic redeviendrait muet sans que rien n'échoue.

### Jalon 44 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration), le
serveur standalone, un puits SMTP et un serveur IMAP substitué servant le
dossier « Envoyés » **depuis ce qu'il y a réellement déposé** :

- **la cause** : sur un envoi réel, l'identifiant stocké est désormais celui
  parti sur le fil, et **pas** la forme UUID de nodemailer ;
- **rattrapage** : défaut rejoué en base → simulation « 1 identifiant à
  corriger », **0 écriture**, la valeur proposée est exactement celle lue dans
  « Envoyés » ; application → 1 corrigé, **sujet et corps inchangés** ; second
  passage → 0 à corriger, 1 déjà correct ;
- **la réponse est enfin rapprochée** : avec l'identifiant fantôme en base, le
  relevé rend `replies: 0` et marque le message « notre identifiant, absent » ;
  après rattrapage, `replies: 1` et une interaction `email` / `replied` est
  consignée sur la fiche ;
- **orphelins** : 6 envois sans fiche détectés, simulation sans écriture, puis
  re-rattachement à la bonne fiche par adresse ;
- **navigateur (1440×900)** : la pastille rouge « Notre identifiant, absent » et
  sa phrase complète ; « Appliquer » **inerte tant qu'aucune simulation n'a rien
  trouvé** ; compte rendu « Dossier relevé : Envoyés · 1 message lu · 10 lignes
  d'envoi dans la fenêtre » ; **0 débordement, 0 erreur console, 0 réponse
  ≥ 400** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**885 tests**) verts.

### Jalon 44 — ce qui n'est pas fait

**Le rattrapage n'a pas tourné contre IONOS.** Le substitut sert le dossier
« Envoyés » depuis ses propres dépôts, ce qui prouve la chaîne complète —
lecture des en-têtes, rapprochement, écriture — mais pas que `imap.ionos.fr`
accepte `EXAMINE` sur ce dossier ni que `SEARCH SINCE` s'y comporte pareil. Le
bouton « Simuler » le dira sans rien écrire.

**Un envoi dont la copie « Envoyés » a échoué n'est pas rattrapable** : son
identifiant réel n'existe nulle part. Ces lignes sortent en « sans envoi
correspondant » — le rapport les compte, il ne les invente pas.

**Les envois antérieurs à la fenêtre de 180 jours ne sont pas relus.** Au-delà,
une réponse n'arrivera plus, et la ligne d'envoi reste un fait de gestion
correct par ailleurs.

**La question de la boîte IONOS reste ouverte**, mais elle n'est plus la
première hypothèse : le rattrapage puis un relevé diront si les réponses
arrivent bien dans la boîte relevée.


---

## Jalon 45 — le relevé rapprochait, et rien n'arrivait sur la fiche

### Ce que la reproduction a établi, et ce qu'elle a démenti

Reproduit contre un vrai PostgreSQL, à l'image de la production : un contact,
un envoi **orphelin** (`contactId: null`) portant le vrai `Message-ID`, et la
réponse de Caroline dans la boîte.

| Preuve | Mesure |
|---|---|
| envois sans fiche rattachée | 1 |
| `<1787142802796.rpp6m071@auraflowai.fr>` | `contactId: null`, destinataire `Caroline@Miye.Care` |
| l'adresse résout-elle vers une fiche ? | **oui** |
| relevé | `replies: 1`, ligne `email_replies` écrite avec `activityId: null` |
| interactions sur la fiche | **0** |

Votre hypothèse est donc exacte, et elle explique le symptôme entier : le relevé
annonçait « 1 réponse », `/emails` en comptait zéro, et les deux avaient raison
— l'un comptait une détection, l'autre une interaction.

**Une hypothèse intermédiaire a été démentie en la testant.** Le rattrapage
rendait d'abord `relinked: 0, unmatched: 1`, ce qui ressemblait à un défaut de
casse dans `email: { in: […], mode: "insensitive" }`. Vérification directe :
cette clause **fonctionne** — elle retrouve `Caroline@Miye.Care` depuis
`caroline@miye.care`. La vraie raison était **deux fiches portant la même
adresse**, écartées par la règle « une adresse portée par deux fiches ne désigne
personne ». Le rattachement par adresse couvrait donc bien la ligne ; c'est le
rapport qui ne le disait pas.

### Les deux défauts, avec leur ligne

**1. Le succès était annoncé sans avoir eu lieu** (`lib/api/inbox.ts`). Le
chemin d'écriture était gardé par `if (manual === null && send.contactId !== null)`,
mais le retour comptait `created: manual === null` **sans regarder la fiche** :
sans contact, aucune interaction, aucune séquence arrêtée — et pourtant une
réponse comptée. Le rapport se contredisait lui-même.

**2. La réparation était impossible** (`lib/api/inbox.ts`, en tête de
`recordReply`). Le test sortait dès qu'une ligne `email_replies` existait :

```ts
if (existing !== null) return { created: false, … };   // avant
if (existing !== null && existing.activityId !== null) { … }   // après
```

Conséquence : une réponse enregistrée sans interaction le restait
**définitivement**. Rattacher la fiche ensuite ne changeait rien, puisque le
relevé suivant ressortait au même endroit. Le seul rattrapage possible passait
par une écriture SQL à la main — mesuré : après rattachement, un nouveau relevé
rendait `replies: 0` et la fiche restait vide.

### Ce qui est fait

**Le relevé ne ment plus.** Une réponse sans fiche sort en `unlinked`, jamais en
`created`, et le rapport porte le compteur **et les adresses concernées** — un
« 3 réponses perdues » sans les noms ne se traite pas.

**Le relevé se répare tout seul.** Une ligne existante sans interaction est
**complétée** — `emailReply.update()`, jamais une seconde ligne : le
`Message-ID` reste la clé d'idempotence. Dès que la fiche est rattachée, le
relevé suivant consigne l'interaction et arrête les séquences. Aucun bouton
supplémentaire, et aucun état à rattraper à la main.

**L'échec est bruyant, à deux endroits.** Le panneau le passe par son canal
d'erreur — pas par la ligne de résumé où il se lirait comme un détail — et
`/accueil` porte un bandeau **rouge** : contrairement au bandeau ambre « relevé
non configuré », il ne manque pas un réglage, une information commerciale est
arrivée et se perd.

> **1 réponse rapprochée mais non consignée.** L'envoi auquel elle répond n'est
> rattaché à aucune fiche — rien n'a donc été écrit sur personne, et aucune
> séquence ne s'est arrêtée. Destinataire : Caroline@Miye.Care. Réglages →
> Messagerie → « Rattraper les identifiants » rattache ces envois par adresse ;
> le relevé suivant consigne alors les réponses.

Le compteur du bandeau porte sur **l'envoi sans fiche**, pas sur `activityId:
null` : une réponse déjà consignée à la main porte elle aussi `activityId: null`,
et la compter ferait sonner l'alarme pour un cas parfaitement traité.

**Le rattrapage nomme ce qu'il n'a pas su faire**, et distingue les deux causes
parce qu'elles appellent des gestes opposés : `missing` (aucune fiche — en créer
une) et `duplicated` (plusieurs fiches — fusionner). Un doublon reste refusé :
choisir attribuerait la réponse au hasard.

### La garde

`tests/reply-repair-source.test.ts` fixe les quatre invariants : la sortie
anticipée exige `activityId !== null`, l'absence de fiche sort en `unlinked`
**avant** tout comptage de création, le rapport porte compteur et adresses, et
une ligne existante est complétée plutôt que dupliquée. Statique parce que les
défauts l'étaient : ni exception, ni type invalide, ni test rouge — seulement du
silence. **Éprouvée en réintroduisant la sortie anticipée** : le test tombe en
nommant la condition.

### Jalon 45 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide**), le serveur standalone et
le substitut IMAP, sur l'état de production reproduit :

- **le relevé ne ment plus** : `replies: 0`, `unlinked: 1`, destinataire nommé,
  **0 interaction** écrite ;
- **le bandeau est actionnable** : `unlinkedReplies: 1` et l'adresse rendue ;
- **le rattrapage couvre la ligne** : simulation 1 rattachable sans écriture,
  application 1 rattaché ;
- **le trou est fermé** : le relevé suivant rend `repaired: 1` et **1
  interaction** apparaît sur la fiche ; le bandeau s'éteint ;
- **idempotence** : un troisième relevé n'écrit rien de plus, une seule ligne
  `email_replies` ;
- **le cas normal n'a pas bougé** : envoi rattaché → `replies: 1`,
  `unlinked: 0`, `repaired: 0` du premier coup ;
- **doublon** : deux fiches pour une adresse → `relinked: 0`, l'adresse est
  listée sous `duplicated` et **pas** sous « aucune fiche » ; le doublon
  supprimé, le rattachement passe immédiatement ;
- **navigateur (1440×900)** : bandeau rouge sur `/` avec le destinataire et le
  chemin du correctif, panneau annonçant « 1 envoi sans fiche rattachée » ;
  **0 débordement, 0 erreur console, 0 réponse ≥ 400** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**889 tests**) verts.

Un test tiers est tombé au passage et a été corrigé plutôt que contourné : le
substitut Prisma de `home-page.test.ts` n'avait pas `emailReply.findMany`, que la
page lit désormais. **Troisième occurrence** de cet oubli — jalon 36
(`apiUsage`), jalon 42 (`emailSend`), jalon 45. Le motif est constant : ajouter
une lecture à `/` sans compléter le substitut.

### Jalon 45 — ce qui n'est pas fait

**Le rattachement n'est pas automatique.** Le relevé ne réécrit jamais
`contactId` de lui-même : c'est une réparation de données, elle passe par un
bouton et une simulation. Un relevé qui rattacherait des fiches tout seul serait
une consultation qui écrit — ce que le jalon 8 s'interdit.

**Les doublons ne sont pas fusionnés**, seulement nommés. Fusionner deux fiches
touche l'historique, les affaires et les séquences : c'est un jalon à soi seul,
pas un effet de bord d'un rattrapage.

**Les chiffres de production restent à mesurer chez vous.** Ceux ci-dessus
viennent de l'état reproduit ; le nombre réel d'envois orphelins s'affichera à la
simulation, et le bandeau dira combien de réponses attendent.

---

## Jalon 46 — le CRM tient dans la main

### L'audit d'abord, et ce qu'il a montré

Chaque écran mesuré à 390×844 et 360×800 **avant tout changement**. Le constat
principal n'était pas celui qu'on attendait : aucune page ne débordait
horizontalement — mais le rail fixe de 236 px mangeait 60 % d'un écran de
téléphone, les tableaux (854 à 1049 px) défilaient dans leur cadre en perdant le
nom de la ligne, et les cibles tactiles étaient à 27–34 px là où le pouce en
demande 44. Le tiroir de fiche, lui, était **déjà** plein écran
(`w-[min(600px,100vw)]`) et fondamentalement utilisable — l'audit a évité de le
réécrire pour rien.

### Le rail repliable, sur toutes les tailles

`components/nav/rail-state.ts` (constantes), `rail-nav.tsx` (le contenu en deux
densités), `rail.tsx` (l'état). Trois décisions :

- **Replié ne veut pas dire caché** : la bande garde une icône par destination
  (44 px, libellé en `title`/`aria-label`), pastille numérique devenue point.
  Les deux densités sortent du même `NAV_GROUPS` — une entrée ajoutée apparaît
  dans les deux.
- **L'état vit dans un cookie, pas dans `localStorage`** : la coquille serveur
  le lit (`cookies()` dans le layout) et le premier octet envoyé est déjà dans
  le bon état — pas de clignotement à l'hydratation. Un an de durée : c'est une
  préférence. `Ctrl+B` bascule ; le cookie est écrit dans un effet, jamais dans
  un setter (React les rejoue en mode strict).
- **Sur téléphone, la bande est l'état permanent** et le bouton ouvre le rail
  complet en surcouche, refermée à la navigation et sur Échap. Deux boutons,
  un par taille d'écran — le même aurait porté un libellé faux sur l'une des
  deux (« Replier » pour un geste qui ouvre).

**Piège trouvé en vérifiant** : une constante exportée d'un module `"use
client"` devient une *référence client* quand un composant serveur l'importe —
le layout recevait autre chose que la chaîne `"rail"`, `cookies().get()` ne
trouvait rien, et l'état ne survivait pas au rechargement. D'où
`rail-state.ts`, sans directive. La loupe du rail ouvre la palette via
l'évènement `aura:search` : le doigt n'a pas de Ctrl+K.

### Priorité 1 — travailler au pouce

- file du jour : nom + société empilés, échéance rouge sous le nom, **icône
  d'appel `tel:` de 44 px**, « Consigner » et « ⋯ » à 44 px, entrées de menu
  à 44 px ;
- fiche : lien téléphone à 44 px de haut et 16 px de corps, icônes
  site/LinkedIn/email à 44 px, onglets à 44 px pleine largeur, ✕ à 44 px ;
- règle CSS globale (`globals.css`) : **tout champ passe à 16 px sous `lg`** —
  sous ce seuil, iOS Safari zoome au focus et l'écran reste zoomé. La règle vit
  dans le CSS pour qu'un formulaire ajouté demain ne puisse pas l'oublier ;
- le tiroir passe de `inset-y-0` à `h-dvh` : le clavier virtuel réduit le
  viewport *dynamique*, et le pied du tiroir (« Envoyer ») restait sinon caché
  sous le clavier.

### Priorité 2 — les tableaux se replient en cartes

`components/table/card-list.tsx` : nom + société en tête, deux ou trois faits
dessous, **le reste à un tap** — toucher la carte ouvre la fiche. Le composant
ne connaît pas les colonnes ; chaque vue choisit ses faits. `/contacts` (avec
appel direct au bord), `/affaires`, `/societes` l'utilisent ; `/clients` et le
côte à côte de `/performance` rendent leurs cartes en marquage serveur — des
fonctions de rendu ne franchissent pas la frontière serveur → client. Le
tableau garde le bureau (`max-lg:hidden`), les cartes prennent le téléphone
(`lg:hidden`) : mêmes lignes, même tri, même filtre, **aucune version mobile
séparée**.

Le pipeline empile ses colonnes (`max-lg:flex-col`) au lieu de défiler sur
1 700 px ; le glisser-déposer reste un geste de bureau et le sous-titre le dit
différemment selon la taille. Le journal de `/emails` était déjà en
`table-fixed` + container queries : rien à changer. Les entonnoirs (accueil,
rapports) perdent leur largeur plancher sous `lg` et se mettent à l'échelle.

### Priorité 3 — `/reglages` assume d'être un écran de bureau

Sous `lg`, la page affiche « Cet écran demande un écran large » et nomme
pourquoi (corrections, séquences, relecture des domaines — un travail qui se
valide ligne à ligne). Le contenu n'est pas rendu en cassé derrière : il est
sous `max-lg:hidden`, même code, même route.

### Jalon 46 — ce qui est vérifié

Contre le serveur standalone de production et un vrai PostgreSQL, navigateur
piloté en émulation mobile (`isMobile`, `hasTouch`) :

- **rail** : 236 → 64 px au bouton, état conservé à la navigation **et** au
  rechargement (HTML serveur déjà replié — vérifié sur la réponse brute),
  Ctrl+B dans les deux sens, cookie `rail=collapsed|open` ; 12 destinations
  restent à un geste en bande d'icônes ; surcouche mobile de 300 px qui se
  referme à la navigation ; la loupe ouvre la palette au doigt ;
- **parcours à 390×844** : « garcia » dans la palette → fiche ouverte plein
  écran → lien tel 206×44 à y=122, **sans défiler ni zoomer** → formulaire de
  consignation ouvert, issue comprise, champs à 16 px, « Enregistrer » 225×44 ;
- **file du jour** : Consigner 81×44, ⋯ 44×44, appel 44×44, échéance visible ;
- **cibles mesurées** : onglets 114×44, ✕ 44×44, cases de /taches 20×20 ;
- **zéro débordement de page** sur les douze écrans, à 390 **et** à 360 ;
- **/reglages** : la notice s'affiche sous `lg` ;
- **0 erreur console, 0 réponse ≥ 400** sur tout le parcours ;
- captures avant/après des écrans les plus retouchés (accueil, contacts,
  fiche, pipeline, performance) ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**889 tests**) verts.

### Jalon 46 — ce qui ne l'est pas

**Aucun vrai téléphone n'a touché l'écran.** L'émulation Chromium vérifie les
tailles, le viewport et le tactile ; le clavier iOS réel, le `tel:` qui
compose, et la règle des 16 px contre le zoom Safari ne se prouvent que sur un
appareil. Le `h-dvh` du tiroir est la bonne construction pour le clavier
ouvert, mais l'émulation ne simule pas de clavier.

**Le tableau de `/rapports` garde un défilement interne** (488 px dans son
cadre) : l'écran n'est dans aucune priorité du jalon et sa page ne déborde
pas ; le replier en cartes reste à faire si l'usage mobile le réclame.

**Le glisser-déposer du pipeline n'existe pas au doigt.** Les colonnes
s'empilent et se lisent ; faire avancer une affaire passe par sa fiche. C'est
un choix, pas un oubli — un drag tactile fiable est un chantier à part.

**Le roster de `/conseil` défile latéralement à 360 px** — c'est la bande
défilante voulue au jalon 15, pas un tableau qui déborde.

---

## Jalon 47 — sortir une affaire du pipeline

### Deux gestes, et tout le jalon tient dans leur écart

| | « Marquer perdue » | « Supprimer » |
|---|---|---|
| Pour | le refus commercial, tous les jours | le doublon, la saisie d'essai |
| Garde | montant, historique, motif | rien |
| Où | tiroir **et** menu de la carte | tiroir seul |
| Réversible | oui, « Rouvrir » | non |
| Refusée si | jamais | l'affaire porte une histoire |

**Perdre n'est pas supprimer**, et l'écran le montre : la perte est un bouton
ordinaire, la suppression vit en bas du tiroir, en rouge, derrière une
confirmation qui nomme l'affaire et son montant. Un geste destructeur à deux
taps depuis une liste est un geste qu'on finit par faire par erreur — d'où
l'absence de « Supprimer » dans le menu des cartes.

### L'étape n'est jamais touchée, et c'est ce qui rend la réouverture exacte

Gagner fait **avancer** : l'affaire rejoint l'étape à 100 %. Perdre fait
**sortir** : elle reste dans la colonne où elle était et disparaît du tableau
parce que le kanban ne montre que les affaires en cours. « Rouvrir » n'a donc
rien à restaurer — la carte revient exactement là où elle était, sans qu'aucune
colonne « étape d'avant » ait eu à exister. Une seconde source de vérité pour
une information que la première n'a jamais perdue aurait fini par diverger.

Le motif, lui, est effacé à la réouverture — l'affaire n'est plus perdue, le
garder ferait mentir la colonne — mais il **passe dans la note système** :
« Affaire rouverte (était perdue — motif : Concurrent) ». Rouvrir ne doit pas
effacer en silence la raison pour laquelle on avait renoncé.

### Le motif que la liste des affaires n'a pas le droit de proposer

Le vocabulaire est celui de la fiche contact — une seule liste à tenir — **moins
« Ne souhaite plus être contacté »**, et ce retrait est la décision de
conception de ce jalon.

Ce n'est pas un motif d'échec commercial : c'est une volonté exprimée par une
personne, et le produit la fait respecter en lisant `Contact.lostReason`
(`optedOut()` — séquences, relances, outils du conseil). Le porter sur une
affaire l'aurait rendu **visible sans être respecté** : l'écran aurait affiché
« ne souhaite plus être contacté » pendant que le moteur de séquences aurait
continué d'écrire à la personne, faute de lire cette colonne-là. Un motif qui
ment de cette façon est pire que son absence. Le tiroir dit donc où le noter :
*« Une opposition au démarchage se note sur la fiche du contact, pas sur
l'affaire : c'est elle que lisent les séquences et les relances. »*

### Ce qui compte comme « histoire », et l'exception qui a demandé à réfléchir

`lib/domain/deal-deletion.ts`, pur et testé. Bloquent la suppression : une
interaction réelle (appel, email, réunion, démo, LinkedIn), un **deuxième**
passage d'étape, un statut gagné ou perdu, une tâche rattachée.

**Les notes ne bloquent pas, et ce n'est pas un oubli.** Le produit en écrit une
à *chaque* déplacement d'étape et une à la qualification d'un contact : les
compter rendrait indélébile toute affaire née d'une qualification — y compris
celle qu'on vient d'ouvrir sur le mauvais contact, c'est-à-dire précisément
l'erreur que la suppression doit réparer. Une note ne sait pas dire si elle
vient d'un humain ou de la comptabilité interne du produit ; tant qu'elle ne le
sait pas, elle ne peut pas servir de preuve. Ce qu'elle emporte est donc
**nommé dans la confirmation** plutôt que d'y faire obstacle. Même raison pour
la première visite d'étape, écrite par `createDeal` dans sa propre transaction.

Le refus est un **409 qui nomme ce qui retient et quoi faire à la place** :
« Cette affaire porte une histoire : 1 tâche(s) rattachée(s). La supprimer
ferait mentir vos taux de conversion. Marquez-la perdue — elle sort du pipeline
et garde son montant, son historique et son motif. » Le verdict est **relu au
moment d'écrire**, pas repris de l'affichage : la confirmation peut rester
ouverte pendant qu'un appel se consigne ailleurs, et c'est exactement le moment
où l'affaire cesse d'être supprimable.

### Le menu des cartes, et pourquoi il compte sur téléphone

Le tableau ne se pilotait qu'au glisser-déposer, **qui n'existe pas au doigt**.
« Déplacer vers » met les étapes à un tap ; c'est ce qui rend le pipeline
utilisable en mobilité, dans le prolongement du jalon 46. Le motif de perte se
choisit dans le menu lui-même — deux taps au total — plutôt que dans une boîte
de dialogue ; « Autre motif » renvoie au tiroir, qui a la place d'un champ
libre.

Le compteur des affaires perdues vit sur la page du pipeline et mène à
`/affaires?status=lost` : quitter le tableau ne doit pas vouloir dire
disparaître de la vue. Muet à zéro — un « 0 perdue » permanent finirait par ne
plus rien vouloir dire.

### La société manquante : le formulaire, pas la qualification

Diagnostic d'abord. **La qualification n'était pas en cause** : `qualifyContact`
recopie déjà `contact.companyId` sur l'affaire qu'elle ouvre. Le trou est dans
`createDeal` : `resolveCompanyLink()` ne connaît que ce que le formulaire lui
envoie, et le formulaire d'affaire laisse choisir un contact **et** une société
séparément. Remplir l'un sans l'autre — le geste le plus naturel du monde —
donnait une affaire sans société alors que la réponse était à un pas.

La conséquence n'est pas cosmétique : l'affaire sort des totaux de `/societes`
(pipeline ouvert, CA signé) et de la chronologie de la fiche société. La maison
paraît plus petite qu'elle n'est, et seul un « Sans société » en petit sur la
carte le signale.

`inheritedCompanyId()` (pur) comble **un vide, jamais un choix** : une société
déjà renseignée n'est pas écrasée — elle peut différer volontairement de celle
du contact (intermédiaire, filiale, acheteur qui n'est pas la maison qui signe),
même raisonnement qu'au jalon 3 sur la promotion en client. Appliquée à la
création **et** à la mise à jour, sur l'état résultant : rattacher un contact à
une affaire sans société suffit désormais à la renseigner. Un `companyId: null`
explicite reste un détachement voulu.

Un rattrapage `/reglages` traite l'existant, avec les garanties habituelles :
simulation d'abord, une seule colonne, condition d'écriture sur la valeur relue,
idempotent, et les affaires sans rien à déduire **nommées** plutôt que tues.

### Jalon 47 — ce qui est vérifié

Contre un vrai PostgreSQL 16, migration `20_deal_loss` appliquée puis
`migrate diff` **vide**, le serveur standalone de production, et un navigateur
piloté :

- **1 · perdue** : statut `lost`, motif `Budget`, **étape inchangée**, sortie du
  kanban, valeur totale 85 268 € → 76 088 € (−9 180 €), retrouvée sous
  `/affaires?status=lost` ;
- **2 · rouverte** : statut `open`, **même étape**, `closedAt` effacé, motif vidé
  de la colonne et repris dans la note ; rouvrir une affaire en cours → **409** ;
- **3 · refusée** : verdict `deletable: false`, `DELETE` → **409** nommant la
  cause, l'affaire toujours en base ; une affaire d'essai déplacée une fois
  devient elle aussi indélébile (« 1 déplacement(s) d'étape ») ;
- **4 · supprimée** : doublon créé puis effacé, confirmation lue à l'écran —
  « Supprimer « Doublon Vérif47 — à supprimer » (7 300 €) définitivement ?
  Partiront avec elle : 1 visite(s) d'étape. » —, tiroir refermé, 404 ensuite ;
- **5 · menu ⋯ à 390×844** : bouton 44×44, entrées 222×44, les cinq étapes plus
  « Ouvrir la fiche » et « Marquer perdue… », **jamais « Supprimer »** ; étape
  changée au doigt « Qualifié » → « Démo planifiée », **sans glisser-déposer** ;
- **motifs à l'écran** : les six de la fiche contact, **« Ne souhaite plus être
  contacté » absente** ;
- **société héritée** : affaire créée avec un contact et sans société → FLOWI ;
  société explicitement choisie **non écrasée** ; contact rattaché après coup à
  une affaire nue → société renseignée ;
- **rattrapage** : 1 affaire sur 2 orphelines rattachable (l'autre nommée comme
  n'ayant rien à déduire), `expected` faux → refus chiffré, application → 1,
  rejoué → 0 ;
- **0 erreur console, 0 réponse ≥ 400** sur tout le parcours ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**919 tests**) verts.

**Deux défauts attrapés avant de partir**, tous deux par des gardes existantes
ou par relecture :

1. `backup-columns.test.ts` (jalon 42) a échoué à la seconde où `lostReason` est
   apparue au schéma sans rejoindre la sauvegarde — la garde a fait exactement
   son travail, un an de motifs de perte aurait sinon disparu à la première
   restauration ;
2. la route du rattrapage rendait `applied` comme un **objet** là où toutes les
   autres opérations rendent un nombre : le panneau l'interpole dans « N ligne(s)
   corrigée(s) » et aurait affiché « [object Object] » sans que rien n'échoue.

Un **flottement de test** préexistant a aussi été corrigé au passage :
`home-page.test.ts` vérifiait « il y a 3 jours » sur un instantané daté à
exactement 72 h, alors que `describeAge` tronque les **heures** et que le
substitut date depuis `Date.now()` au moment de la requête — quelques
millisecondes après l'horloge déjà capturée par la page. Le test tombait une
fois sur dix, sous charge. La valeur passe à 76 h : la même chose est vérifiée
sans dépendre de la milliseconde.

### Jalon 47 — ce qui n'est pas fait

**Une affaire perdue peut encore changer d'étape.** `planStageMove` la laisse
perdue tout en déplaçant sa colonne (règle du jalon 1, testée) : « Rouvrir » la
ramènerait alors ailleurs qu'à l'endroit d'où elle est sortie. Le cas demande
d'ouvrir le tiroir d'une affaire close et de cliquer « Faire avancer » — c'est
un geste délibéré, pas un accident, et le corriger changerait une règle
antérieure sans qu'on ait constaté la gêne.

**La suppression ne descend pas de sauvegarde.** Les corrections de données de
`/reglages` en téléchargent une avant d'écrire ; ici, la confirmation nomme ce
qui part et le verdict interdit tout ce qui a une histoire. Une affaire
supprimable est, par construction, une affaire qui ne contient presque rien.

**Le menu s'ouvre toujours vers le bas.** Sur la dernière carte d'une colonne
longue, il faut faire défiler pour voir ses dernières entrées. Un
positionnement qui se retourne près du bord se fera le jour où la gêne sera
constatée.

**Les chiffres ci-dessus viennent de la base locale**, pas de la vôtre. En
production, le nombre d'affaires orphelines de société — et donc ce que le
rattrapage aura à faire — s'affichera à la simulation. C'est à cela qu'elle sert.

---

## Jalon 48 — Instagram entre dans la prospection

### Un canal, pas un champ de plus

`instagram` rejoint `ACTIVITY_TYPES`, et le changement s'est propagé **par le
compilateur** : chaque `Record<ActivityType, …>` — couleurs de chronologie,
libellés du flux, délais de relance, empilement de `/performance`, étiquettes
des outils du conseil — a refusé de compiler jusqu'à être complété. C'est la
raison d'être de ces `Record` plutôt que des tableaux, et c'est la deuxième fois
qu'ils rendent ce service après le canal LinkedIn du jalon 40.

Migration `21_instagram` : `Contact.instagram`, `Settings.relanceApresInstagram`
(4 jours, comme LinkedIn — un DM ne se relance pas dans l'heure), et la source
« Instagram » semée `WHERE NOT EXISTS`, sans jamais écraser une configuration.

### Connaître le compte n'est pas avoir écrit

C'est la distinction qui structure tout le jalon, et la confondre aurait faussé
la mesure qui le justifie.

| | Ce que ça dit | Où ça vit |
|---|---|---|
| `Contact.instagram` | on sait **où** écrire | un champ, rendu en lien |
| interaction `instagram` | on a **écrit** | une ligne d'historique, datée |

La puce « DM envoyé » sélectionne donc sur l'**interaction**, jamais sur le
champ : filtrer sur le champ ferait entrer dans le segment toutes les marques
repérées mais jamais approchées, et le taux de réponse de la nouvelle stratégie
se mesurerait sur des gens à qui l'on n'a rien envoyé. Un test statique fixe la
clause SQL pour que la confusion ne s'introduise pas plus tard.

Le pseudo n'est pas une URL : `lib/domain/instagram.ts` accepte `@maison_vertu`,
`maison_vertu` ou l'adresse collée entière, et rend `null` sur tout le reste —
une note écrite dans le champ ne devient pas un lien mort. **La valeur stockée
n'est jamais réécrite**, c'est la règle des liens du jalon 10 : la normalisation
a lieu au rendu.

### Un défaut attrapé avant de partir, et il aurait été muet

Les filtres de `/contacts` passent **deux** tamis : la clause SQL ramène les
lignes, puis `applyDerived` les repasse à `matchesContactFilter`. Un filtre
tranché en SQL doit donc être déclaré dans `SQL_ONLY_FILTERS`, faute de quoi le
second passage le compare à un statut de relance — qui ne vaut jamais « dm » —
et **rejette tout ce que SQL vient de retenir**. La puce aurait affiché une
liste vide en ayant l'air de fonctionner : aucune erreur, aucun test rouge, un
segment introuvable.

Le test ajouté échoue en nommant le filtre non déclaré ; il a été éprouvé en
retirant les deux valeurs de la liste.

### Alex ne peut pas inventer un DM

Deux faits sont désormais **cherchés en base et annoncés dans le dossier sous
leurs deux formes**, puis convertis en consignes exclusives :

- **le DM** — « envoyé le 22/08 » ou « AUCUN n'a été envoyé à cette personne ».
  Le déduire de la liste des dix dernières interactions aurait été un pari : sur
  une fiche bavarde le DM en sort, sur une autre non, et Alex se met alors à
  mentionner un message incertain. Quand il n'y en a pas, la consigne est une
  **interdiction explicite**, pas une omission — une absence de ligne se lit
  comme une absence d'information, une ligne qui dit « non » se lit comme une
  règle. L'enjeu est petit et fatal : « je vous ai écrit sur Instagram » se
  vérifie en trois secondes, et ce qui tombe alors n'est pas l'email, c'est la
  relation.
- **le site de la démonstration** — `lib/domain/demo-target.ts` : le site du
  contact, à défaut le domaine de la société, **à défaut le nom de la marque**.
  Ce troisième cas est le plus important : sans lui, un modèle à qui l'on
  demande de citer un site sans lui en donner un **en fabrique un**, et
  `maisonvertu.fr` a toutes les chances d'appartenir à quelqu'un d'autre. Le
  module écarte aussi ce qui ressemble à un site sans en être un — les 59 fiches
  du jalon 24 dont la colonne SITE portait « Shopify » ou un titre de page.

`tests/dm-mention-source.test.ts` fixe les quatre invariants, éprouvé en rendant
la consigne inconditionnelle.

### Le nouveau mail de référence

Approuvé avant d'être câblé, comme au jalon 35. Le DM y est un **paragraphe à
part** qui dit *où* le message se trouve — Instagram range ceux qui viennent de
comptes non suivis dans les demandes de messages privés, où personne ne regarde
spontanément. La phrase de démonstration cite l'adresse (« ce que cela donnerait
sur linae.fr ») : c'est ce qui la fait lire comme préparée pour eux plutôt que
comme un gabarit.

La mise en garde « à imiter, jamais à recopier » précise maintenant que
l'exemple porte un DM **parce que le cas est fréquent, pas parce qu'il y en a
toujours un** : sur une fiche sans DM consigné, le troisième paragraphe
disparaît et le reste ne bouge pas.

### La comparaison qui décide de la stratégie

`lib/domain/dm-lift.ts` partage les personnes **écrites** en deux groupes selon
qu'un DM précède ou non leur **premier** email, et compare leurs taux de
réponse. La borne est le premier email et non le dernier : ce qu'on teste, c'est
l'effet d'une prise de contact préalable, et un DM envoyé après coup n'a rien
préparé.

Trois refus, tous délibérés :

- **aucun taux sur un dénominateur vide** — `rate()` rend `null`, règle du
  jalon 20 ;
- **aucune conclusion sous cinq personnes par groupe** : à trois contre deux, un
  écart de trente points est du bruit, et l'afficher comme un résultat ferait
  changer de stratégie sur rien ;
- **aucune causalité affirmée**. Les marques approchées en DM ne sont pas
  tirées au sort — ce sont celles dont on a trouvé le compte, donc souvent les
  plus visibles. La phrase de lecture le dit avec le chiffre, comme la mise en
  garde du taux d'ouverture depuis le jalon 43.

Le délai DM → réponse est une **médiane** : une réponse arrivée six mois après
tirerait la moyenne au point de ne plus décrire aucun cas. Un seul composant
sert `/emails` et `/performance` — deux rendus du même chiffre finiraient par ne
plus dire la même chose, et c'est ce chiffre-là qui portera une décision.

### Jalon 48 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `21_instagram` appliquée puis
`migrate diff` **vide**), le serveur standalone de production, et un **proxy qui
capte ce qui part réellement vers le modèle** — la discipline du jalon 44 : on
lit le fil, pas l'intention :

- **1 · DM consigné** : interaction `instagram` créée (201), visible dans la
  chronologie de la fiche, et rendue dans l'empilement de `/performance`
  (« 22/08 — Instagram : 3 ») avec Instagram dans la légende des canaux ;
- **2 · segment** : puce « DM envoyé » → 1 fiche, le témoin dedans ; « Pas
  encore de DM » → 103, le témoin dehors ; **1 + 103 = 104 = toutes les fiches
  actives** (les 50 fiches terminales n'entrent dans aucune liste de travail,
  règle du jalon 30) ; `dmAt` remonté sur la fiche ;
- **3 · brouillon avec DM** : le dossier envoyé au modèle porte « DM Instagram :
  envoyé le … », « Site à citer … : miye.fr », et la consigne « Un DM Instagram
  a bien été envoyé » ;
- **4 · brouillon sans DM ni site** : « AUCUN n'a été envoyé à cette personne »,
  la consigne « N'en mentionne donc aucun », « Marque à nommer : Alvadiem », la
  consigne « n'en déduis pas une du nom de la marque », et **aucune URL
  fabriquée nulle part dans la requête** ;
- **5 · comparaison** : le bloc « DM puis email, ou email seul » est présent sur
  `/emails` **et** `/performance`, nomme ses deux côtés, et **refuse de
  conclure** sur l'échantillon actuel ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**964 tests**) verts.

**Deux gardes existantes ont fait leur travail** : `backup-columns` a signalé
`Contact.instagram` et `Settings.relanceApresInstagram` absentes de la
sauvegarde — sans quoi la première restauration aurait effacé tous les comptes
Instagram saisis ; et le test du jeu de puces du jalon 31 a exigé que l'ajout de
deux puces soit un geste délibéré, documenté sur place.

### Jalon 48 — ce qui n'est pas fait

**La comparaison n'a pas encore de quoi trancher.** Sur la base de
vérification, un seul contact porte un DM : le bloc affiche donc son refus de
conclure, ce qui est le comportement voulu mais n'est pas un résultat. Il faudra
cinq personnes de chaque côté — soit quelques semaines de la nouvelle approche —
avant que l'écart veuille dire quelque chose.

**Aucun DM n'est envoyé depuis le CRM**, et ce n'était pas demandé : Instagram
n'ouvre pas d'API de messagerie pour ce cas. Le DM se fait à la main, dans
l'application, puis se consigne ici — comme un appel.

**Le champ Instagram ne se remplit pas tout seul.** Il n'existe aucun rattrapage
qui déduirait un compte du nom d'une marque : ce serait exactement la
supposition refusée au jalon 25 pour les domaines, et le lien mènerait chez
quelqu'un d'autre. Les 154 fiches partent donc avec un champ vide, à remplir au
fil des recherches.

**La qualité du texte d'Alex n'est pas établie**, une fois de plus : le
substitut prouve que le bon dossier et les bonnes consignes partent, pas
qu'Alex écrive un bon paragraphe sur le DM. Les trois premiers brouillons réels
le diront.
