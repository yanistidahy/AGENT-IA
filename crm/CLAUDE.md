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
calque** : le fichier source n'a jamais été lisible côté agent.

**Depuis le jalon 63, ce tracé n'est plus que le repli** : dès qu'un logo est
téléversé dans `/reglages`, il sert le rail, la favicon, `/login` et la
signature des courriels — une seule source, quatre surfaces. Le tracé reprend sa
place quand aucun logo n'est posé, et ce n'est pas un état d'erreur : une
installation neuve doit ressembler à quelque chose.

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
| 85 | **Le panneau lisait un champ que le serveur n'a jamais envoyé** : « Retravailler avec Alex » sur un départ faisait tomber l'écran ; la recherche voyage désormais avec le brouillon rouvert, et le type cesse de promettre ce qu'il ne reçoit pas | **livré, à valider** |
| 84 | **Une relance n'est pas un premier message renvoyé** : l'étape 2 reçoit le message déjà envoyé et des interdits explicites, une garde signale la copie ; plus « Arrêter » sur la composition, « Réécrire tous les départs », et la pause rendue visible | **livré, à valider** |
| 83 | **Le déclencheur de la réouverture était un état d'écran, pas un fait** : une fois les étapes enregistrées, plus aucun enregistrement ne proposait de rattraper les personnes fermées. Plus une porte de secours sur la page de campagne | **livré, à valider** |
| 82 | **Le jalon 81, rendu robuste et bruyant** : la règle ne dépend plus d'un couple statut+libellé exact, l'écriture demande au domaine au lieu de recomposer sa clause, et zéro réouverture ne s'enregistre plus en silence | **livré, à valider** |
| 81 | **Ajouter une étape rattrape ceux qui avaient fini** : réouverture des seules inscriptions épuisées, délai compté depuis leur dernier message, et une confirmation qui nomme les exclus | **livré, à valider** |
| 80 | **Les étapes se lisent comme une suite** : un bloc numéroté par étape, une frise verticale qui porte les délais, un aperçu sans ouvrir, et des flèches pour réordonner | **livré, à valider** |
| 79 | **Les listes rentrent dans /contacts** : la section « Listes » retirée, les tables supprimées, et des « filtres personnalisés » qui se posent comme une puce à côté des autres et se croisent avec elles | **livré, à valider** |
| 78 | **Le tableau des inscrits répond aux questions qu'on lui pose** : une puce « a reçu un premier message », des en-têtes qui trient, les ouvertures vérifiables ligne à ligne, et l'écart entre la carte et le tableau nommé plutôt que laissé à deviner | **livré, à valider** |
| 77 | **Des listes nommées, constituées à la main** : une entrée « Listes » dans le rail, la sélection à la case ouverte à tous les écrans, et un filtre « dans cette liste » qui se croise avec les autres | **livré, à valider** |
| 76 | **La recherche ne partage plus le modèle de la prose** : `allowed_callers` explicites, plancher de capacité, et un avertissement dans /reglages avant le mur de cartes rouges | **livré, à valider** |
| 75 | **Le domaine se lit dans l'adresse email** : troisième source de recherche, provenance affichée sur la carte, et un rattrapage qui rend la déduction permanente | **livré, à valider** |
| 74 | **La recherche dit ce qu'elle a fait** : une carte sur les deux surfaces, l'échec nommé avec sa raison exacte, et un appel raté qui se retente au lieu de geler la société trois mois | **livré, à valider** |
| 73 | **Alex lit le prospect avant d'écrire** — recherche web outillée, mise en cache par société, et la règle qui décide de tout : un fait vient d'une page lue, ou il ne s'écrit pas | **livré, à valider** |
| 72 | **Les listes de référence s'ouvrent alphabétiques** — clé de tri pliée (accents et casse), valeurs vides en fin de liste, et les écrans d'urgence restent chronologiques | **livré, à valider** |
| 71 | **Les campagnes en deux niveaux** — une grille de vignettes pour choisir, une page par campagne pour travailler ; et la dernière puce d'un agent désactivé retirée | **livré, à valider** |
| 70 | **Enregistrer n'écrit plus, « Écrire les mails » écrit** — la sauvegarde redevient une configuration rejouable, le retrait d'un inscrit le retire vraiment sans toucher au passé | **livré, à valider** |
| 69 | **Audit du suivi d'ouverture** — la chaîne vérifiée de bout en bout sur une campagne ; l'écran des emails dit enfin *pourquoi* il ne mesure rien quand c'est le cas | **livré, à valider** |
| 68 | **La virgule mangée par le nettoyage des tirets** — l'objet nomme la marque, la file dit ce qu'Alex avait sous la main, et un départ se retouche à la main sans passer par Alex | **livré, à valider** |
| 67 | **Trois lignes, et le vrai doublon** — l'adresse quitte la signature ; `enforceSignature` ne remplaçait que la dernière ligne du paragraphe, ce qui écrivait le bloc deux fois à la composition | **livré, à valider** |
| 66 | **La signature en double, dans le panneau** — le panneau composait un bloc à deux lignes quand le serveur en composait quatre : `replaceSignature` n'en trouvait aucun et en ajoutait un second | **livré, à valider** |
| 65 | **Le logo à gauche, la signature à droite** — un tableau à deux colonnes, le seul assemblage qu'Outlook rende comme les autres ; la version texte ne bouge pas | **livré, à valider** |
| 64 | **Le signataire d'une campagne, nommé** — le menu dit qu'il choisit la signature, montre l'adresse et les lignes qui partiront, et avertit quand la boîte n'en porte aucune | **livré, à valider** |
| 63 | **Un logo, quatre endroits** — le logo téléversé sert la signature, le rail, la favicon et /login ; second rendu net pour l'interface, et la lisibilité sur fond sombre mesurée plutôt que supposée | **livré, à valider** |
| 62 | **Une signature HTML avec logo** — quatre lignes, logo partagé servi depuis notre domaine, avertissement de poids plutôt qu'un envoi muet | **livré, à valider** |
| 61 | **Supprimer une campagne qui a envoyé, si on le tape** — friction du nom exact, envois effacés (pas détachés), contacts et interactions intacts, et un rouge d'action destructrice qui n'existait nulle part | **livré, à valider** |
| 60 | **La puce qui s'ouvrait dans le vide** — panneau rogné par un conteneur `overflow-hidden`, puce remontée sur la première rangée, et des tests qui cliquent | **livré, à valider** |
| 59 | **Filtrer par date d'ajout** — quatre préréglages et une plage libre dans l'URL, colonne « Ajouté le » triable, fiches ajoutées par semaine sur /performance | **livré, à valider** |
| 58 | **Nouveau discours, et le tiret long banni** — conseiller de vente, accroche sur le fait, quatre paragraphes, tirets retirés à la source et au retour | **livré, à valider** |
| 57 | **Retravailler un départ, et ne plus supposer d'équipe** — le panneau de rédaction rouvert depuis la file, discours conditionnel à ce qu'on sait | **livré, à valider** |
| 56 | **« Enregistrer » compose** — la file se remplit au clic, sans second geste ni passage quotidien ; coût annoncé, avancement à l'écran, planificateur diagnostiqué | **livré, à valider** |
| 55 | **Une campagne au quotidien** — archiver contre supprimer, sélection cochée qui survit au filtre, liste des inscrits, campagne nommée dans /emails | **livré, à valider** |
| 54 | **Trois boîtes et /campagnes** — SMTP/IMAP/signature par boîte, secret par slug, relevé multi-boîtes, campagnes avec sélection /contacts et entonnoir | **livré, à valider** |
| 53 | **Plusieurs personnes par maison** — société dédoublonnée sur les accents, collègues sur la fiche, notes d'angle par rôle, note pour Alex, avertissement collègue | **livré, à valider** |
| 52 | **Le healthcheck traversait le verrou** — cible `/` redirigée, `/api/health` liée à la base ; sonde `/api/live` muette et sans dépendance, contrat sous test | **livré, à valider** |
| 51 | **Quel code sert cet écran** — commit et instant de démarrage lisibles dans le pied de page, dans `/reglages` et sur `/api/version` | **livré, à valider** |
| 50 | **La marque avant le fondateur** — fiche sans personne nommée, marqueur déduit, appel d'email conditionnel, puce « À identifier » | **livré, à valider** |
| 49 | **La file du matin** — deux axes Instagram combinables sous une seule puce, comptée ; filtre de colonne de présence | **livré, à valider** |
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

---

## Jalon 49 — la file du matin : compte connu, DM pas encore envoyé

### Combinables, et non deux puces de plus — pourquoi

La demande laissait le choix : ajouter « Compte Instagram » et « Compte
Instagram · à DM », ou rendre les états combinables. **Combinables, par deux
paramètres indépendants** (`account`, `dm`), pour une raison qui n'est pas
esthétique.

« Le compte est connu » et « le DM est parti » sont deux faits **indépendants**,
lus à deux endroits différents — le premier dans un champ, le second dans une
interaction (jalon 48). Les énumérer comme valeurs d'un filtre unique demande
d'écrire leurs croisements : quatre aujourd'hui, huit si un troisième axe
arrive, et chacun réclame une valeur d'URL, une traduction SQL, un libellé, un
état vide et un test. Deux paramètres donnent **tous** les croisements pour
rien, chacun étant une clause :

|  | DM envoyé | Pas de DM |
|---|---|---|
| **Compte connu** | on a écrit | ← **la file du matin** |
| **Compte inconnu** | (rare : DM sans compte noté) | le vivier à chercher |

L'intersection demandée — celle qui commence la journée — n'a donc pas eu à
être inventée : elle **existe déjà** dès que les deux axes existent.

### Une puce qui ouvre, plutôt que trois de plus

La rangée en portait huit. Les quatre lectures utiles vivent sous une seule
puce « Instagram » qui les ouvre en menu, comme « Filtres » replie la seconde
rangée depuis le jalon 21. **La puce dit ce qu'elle cache** : quand un état est
actif, elle porte son libellé court et reste en surbrillance — règle du filtre
orphelin du jalon 31, appliquée à un menu. Un couple atteint par URL écrite à la
main est nommé lui aussi (`describeCombination`) plutôt que de laisser une puce
muette au-dessus d'une liste filtrée.

Hors sélection, elle porte **le seul nombre qui déclenche une action** — « (22 à
DM) » — et le menu porte les quatre compteurs. Comme depuis le jalon 6, ils
portent sur **tout le portefeuille**, jamais sur la liste filtrée.

### Le compteur et la liste ne peuvent plus se contredire

Trouvé à la vérification, pas à la lecture : un **ancien client** dont on
connaît le compte était compté par la puce (qui exclut les cycles terminaux)
autrement que rendu par la liste (qui n'exclut que `Perdu` par défaut) — 23
annoncés, 24 affichés.

Les deux axes sont désormais des axes de **prospection** : ils excluent les
cycles terminaux, comme toute file de travail depuis le jalon 30. Un ancien
client n'est pas une marque à qui écrire, et une file du matin qui annonce 23
puis en affiche 24 n'est plus un chiffre sur lequel commencer sa journée.

Le **filtre de colonne**, lui, ne les exclut pas : c'est un filtre de tableur
sur la donnée, pas une file de travail. Les deux nombres diffèrent parce que les
deux questions diffèrent.

### Le filtre de colonne : une source de « présence »

`ColumnSource` gagne le genre `presence` — on filtre sur le fait qu'une colonne
soit remplie, pas sur sa valeur : cent pseudos distincts feraient cent entrées
de menu et aucune ne servirait. Deux entrées, « Compte connu » et « (vide) »,
combinables avec le cycle de vie et la source. **Les deux cochées ne
contraignent rien**, comme aucune cochée.

### Trois défauts trouvés en vérifiant, tous muets

1. **La puce écrivait `compte`, le schéma lisait `account`.** Zod **ignore** une
   clé inconnue : la requête revenait entière, la puce s'allumait quand même, et
   la file du matin affichait tout le portefeuille. Aucune erreur, aucun test
   rouge. `presetParams()` vit désormais dans le domaine, et
   `instagram-params.test.ts` fait l'aller-retour complet préréglage → URL →
   schéma → préréglage. Éprouvé en réintroduisant `compte` : trois tests
   tombent.
2. **`{ in: ["", null] }` est refusé par Prisma sur une colonne non nulle**
   (« Expected ListStringFieldRefInput »). `Contact.instagram` en est une. La
   **page** tombait en erreur là où l'API répondait — seule la page passe par
   les facettes. La source de présence déclare donc si sa colonne accepte NULL.
3. **L'évaluateur « volontairement strict » du test de parité ne l'était pas.**
   Prisma accepte la forme abrégée `{ champ: "valeur" }` ; elle arrivait comme
   une condition sans opérateur, `Object.entries("")` est vide, et `.every`
   renvoyait **vrai pour toutes les lignes**. Le test validait en silence une
   clause qui filtre — exactement le faux positif qu'il existe pour interdire.
   Il lève maintenant sur toute forme qu'il ne modélise pas.

Le troisième mérite d'être noté comme leçon de méthode : ma première « preuve »
du garde-fou de présence modifiait le littéral `in: ["", null]` **partout**,
donc cassait les colonnes voisines et non la présence. Un test qui tombe ne
prouve rien tant qu'on n'a pas lu **quel** cas tombe.

### Jalon 49 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration, la
colonne `instagram` datant du jalon 48), le serveur standalone de production et
un navigateur piloté, sur une base portant 23 comptes Instagram dont 1 déjà
contacté par DM :

- **1 · « Compte Instagram »** rend exactement les fiches au champ rempli :
  23 lignes, contre 23 en SQL direct ; « compte inconnu » 131 ; 23 + 131 = 154 ;
- **2 · la file du matin** (`account=connu&dm=aucun`) : **22 lignes** = 23
  comptes connus moins le seul déjà DMé ; « connu + DM envoyé » → 1 ;
- **3 · les compteurs égalent les lignes** : puce « Instagram (22 à DM) »,
  menu « Compte connu, à DM 22 · Compte Instagram 23 · DM envoyé 1 · Pas encore
  de DM 103 », et les listes correspondantes rendent 22, 23, 1 et 103 ;
  un **ancien client** portant un compte est exclu des deux côtés, y compris
  sous `lifecycle=all` ;
- **4 · rechargement** : `GET /contacts?account=connu&dm=aucun` rend 22 lignes
  au **rendu serveur**, la puce affichée active et libellée « à DM » ; le filtre
  de colonne survit de même — `f.instagram=Compte connu` → 24, croisé avec
  `f.lifecycle=Lead` → 11, `(vide)` → 85 ;
- **5 · à 1440×900** la rangée des puces tient sur **une ligne** (481 + 176 +
  60 + 220 + 180 = 1117 px pour 1156 utiles) ; à **390×844** puce et entrées de
  menu à **44 px**, **0 débordement horizontal** aux deux tailles, sélection au
  doigt fonctionnelle ; **0 erreur console, 0 réponse ≥ 400** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**975 tests**) verts.

### Jalon 49 — ce qui ne l'est pas

**Le champ Instagram ne se remplit toujours pas tout seul** (jalon 48) : les 23
comptes de la base de vérification ont été semés pour distinguer les quatre
états. En production, la file du matin vaudra ce que vaut la recherche déjà
faite — c'est-à-dire zéro au premier jour.

**Le menu de la puce n'a pas de test de rendu**, comme tous les composants
clients de ce projet : il est vérifié dans un navigateur piloté, pas par la
suite, qui n'a pas de DOM.

**« Compte inconnu » n'a pas de préréglage dans le menu.** L'axe l'accepte —
l'URL fonctionne et la puce se nomme — mais aucune entrée ne le propose : c'est
le vivier à chercher, pas une file d'envoi. À ajouter si l'usage le réclame.

---

## Jalon 50 — la marque avant le fondateur

### Le manque est déduit, jamais stocké

Une fiche est « à identifier » si et seulement si elle ne porte aucun nom de
personne. **Pas de colonne `unidentified`, pas de drapeau, pas de migration** —
`firstName` et `lastName` acceptaient déjà la chaîne vide. Trois conséquences,
et c'est pour elles que le choix a été fait :

1. **le marqueur disparaît tout seul** dès qu'on saisit le prénom : il n'y a
   rien à mettre à jour, donc rien qui puisse rester en retard. C'est le
   quatrième test d'acceptation, vrai **par construction** plutôt que par un
   crochet qu'on pourrait oublier de câbler ;
2. **rien à reprendre sur l'existant** : une fiche importée sans nom est « à
   identifier » depuis toujours, sans qu'on l'ait retouchée ;
3. une colonne de plus serait une colonne à tenir cohérente avec les deux
   qu'elle décrit — et un jour elle les contredirait.

`lib/domain/contact-identity.ts` porte tout : `personName`, `isUnidentified`,
`contactTitle`, `greeting`, `greetingRule`, `repairGreeting`.

### Une fiche doit porter quelque chose

Le nom devient facultatif, mais pas gratuitement : `createContactSchema` exige
**une personne ou une marque**. Sans cette contrainte, « nom facultatif »
deviendrait « fiche vide autorisée », et une liste de contacts anonymes qu'on ne
sait ni nommer ni joindre n'est pas un vivier, c'est du bruit. L'erreur porte
sur `companyName` — le champ que la bascule rend obligatoire à l'écran — parce
qu'un message d'erreur doit renvoyer là où l'on peut agir.

**La marque *est* la société.** La bascule ne crée pas un second concept : le
champ société du formulaire devient « Marque (obligatoire) », et
`resolveCompanyLink()` fait ce qu'il fait depuis le jalon 6 — retrouver ou créer,
en comparant les noms **en mémoire** donc sans accent ni casse. Vérifié :
« maison VERTU » rejoint « Maison Vertu », une seule société pour quatre fiches.

**L'import continue de refuser une ligne sans nom**, et c'est écrit sur place :
il ne transmet pas `companyName` au schéma, donc le refus est structurel. Le
rapprochement de doublon y retombe sur « nom + société », qui confondrait toutes
les fiches anonymes d'une même marque. Une fiche sans nom se crée depuis le
formulaire, où l'on voit ce qu'on fait.

### Trente-neuf endroits recomposaient le nom

`${contact.firstName} ${contact.lastName}` était écrit **trente-neuf fois dans
vingt fichiers**. C'est exactement ce qui produit le « — » orphelin : chaque
endroit qui recompose le nom lui-même est un endroit qui oubliera le cas vide,
et les corriger un par un aurait tenu jusqu'au prochain écran ajouté.

`contactTitle()` est désormais la seule façon de nommer une fiche — personne, à
défaut marque, à défaut adresse ou pseudo, à défaut « Fiche sans nom ». Le
dernier repli est une phrase et non un tiret : une ligne vide dans une liste ne
se clique pas, on croit à une panne d'affichage.

`tests/contact-name-source.test.ts` ferme le chemin. Statique parce que le
défaut l'est : les deux champs sont des `string`, le typecheck ne voit rien, une
chaîne vide ne lève pas. Même famille que `status-single-source`,
`cost-single-source` et `message-id-source`. Trois fichiers restent autorisés —
export CSV, import, rapprochement de feuille — parce que leur objet est **la
colonne**, pas l'affichage : y substituer « Fiche sans nom » dans un export
serait une invention.

**La garde a immédiatement trouvé sept sites que j'avais manqués** (`alerts.ts`,
`open-audit.ts`, `/taches`, le journal des envois…), et deux cas fixent qu'elle
attrape bien les trois formes interdites et laisse passer une lecture d'un seul
champ — sans quoi une expression régulière devenue fausse la rendrait verte pour
toujours.

### « Bonjour — », et ce que la vérification a réellement trouvé

Deux couches, comme la signature au jalon 33 : le prompt **demande**,
`repairGreeting()` **impose**. Une consigne de prompt est une intention ; elle
tient presque toujours, et « presque » n'est pas assez pour la première ligne
que lit le destinataire.

Le dossier annonce le prénom **sous ses deux formes** — « Prénom du destinataire :
INCONNU » — et la consigne du cas négatif est une **interdiction** explicite,
pas une omission : c'est la règle du DM du jalon 48, appliquée à l'appel.

**Ce que le test d'acceptation a trouvé, et que je n'avais pas prévu :** sur la
fiche « Maison Vertu » sans personne, le brouillon s'ouvrait sur **« Bonjour
Maison, »**. Pas un tiret — un prénom **fabriqué à partir de la marque**. Ma
première réparation ne visait que les formes qui pendent, et celle-ci ressemble
à un vrai prénom : elle passe la relecture, et se lit chez le destinataire comme
un publipostage mal fusionné.

La règle est donc devenue plus forte, et elle reste entièrement fondée sur la
donnée : **sans prénom connu, l'appel ne peut nommer personne.** On le sait de
source sûre — la fiche ne porte aucun prénom — donc tout nom dans l'appel est
inventé, quelle que soit sa vraisemblance. Avec un prénom connu, la réparation
redevient étroite et ne touche que ce qui pend : réécrire plus large mutilerait
un texte que quelqu'un vient peut-être de relire.

**L'appel n'est pas adressé à la marque non plus.** « Bonjour Maison Vertu, »
s'écrit à une entreprise, pas à la personne qui lira. Nu — « Bonjour, » — il
fonctionne dans les deux cas.

### La puce « À identifier »

Septième puce. Elle **ne double aucune existante**, et c'est le reproche qui
avait fait retirer « Déjà contactés » au jalon 31 : elle porte sur le **nom de
la fiche**, pas sur son historique ni sur ses dates. Une marque sans décideur
connu peut être jamais contactée, relancée ou silencieuse — le test de parité la
classe donc hors des puces de statut, et vérifie qu'elle en reste dehors.

C'est un **arriéré de recherche**, pas un statut : des marques déjà approchées
dont il reste à trouver le décideur, et une personne nommée répond mieux qu'une
boîte générique. D'où le compteur sur la puce.

**Le compteur et la liste ne peuvent pas diverger** : les deux excluent les
cycles terminaux, et le code le dit. Le jalon 49 a payé une fois cet écart — la
puce Instagram annonçait 23 et en affichait 24.

### Dette réduite, pas aggravée

`contact-form.tsx` passe de **276 à 265 lignes** malgré la bascule : elle est
extraite (`brand-only-toggle.tsx`), et le composant `Field` — écrit **deux
fois**, dans le formulaire et dans les coordonnées, à deux détails de style près
— devient `form-field.tsx`. Toujours au-dessus de la limite de 250, mais plus
bas qu'avant ce jalon.

### Jalon 50 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration), le
serveur standalone de production, le substitut Anthropic derrière un proxy qui
capte ce qui part sur le fil, et un navigateur piloté :

- **1 · création** : fiche créée avec une marque, un compte Instagram et une
  adresse générique — `firstName: ""`, société « Maison Vertu », visible dans
  les listes **sous la marque**, marqueur « Contact à identifier » rendu ;
- **2 · société** : la marque rejoint la société **existante** (`c2`), pas de
  doublon ; « maison VERTU » y retombe aussi — **une** société, quatre fiches ;
- **3 · appel** : sur la fiche sans personne, la requête porte « Prénom du
  destinataire : INCONNU », « Ouvre par « Bonjour, » exactement » et « N'invente
  aucun prénom » ; le brouillon rendu s'ouvre sur **« Bonjour, »** et l'en-tête
  du panneau affiche **« Maison Vertu »**. Sur une fiche nommée, « Bonjour
  Christian, » — aucune régression ;
- **4 · nom saisi plus tard** : `PATCH` du prénom et du nom → **156 fiches avant
  et après**, aucune seconde fiche ; le tiroir affiche « Camille Rouvier /
  Maison Vertu », le marqueur a disparu, la puce passe de 2 à 1 ;
- **5 · puce** : « À identifier(1) », lignes rendues = compte = SQL ; à
  **1440×900** 107×31 px, à **390×844** cible de bascule 346×98 px, **0
  débordement horizontal** aux deux tailles, **0 erreur console, 0 réponse
  ≥ 400** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1006 tests**) verts.

### Jalon 50 — ce qui n'est pas fait

**Aucun appel Anthropic réel**, comme aux jalons précédents. Ce qui est établi :
le bon dossier et la bonne consigne partent, et la réparation impose l'appel
quoi qu'il revienne. Ce qui ne l'est pas : qu'Alex écrive un bon paragraphe pour
une marque dont il ne connaît personne.

**La bascule n'est proposée qu'à la création.** Sur une fiche existante, les
champs sont de toute façon facultatifs et le manque se lit dans la donnée ; un
interrupteur qui ne ferait que décrire un état déjà visible serait un endroit de
plus où se contredire.

**Deux fiches anonymes sur la même marque restent deux fiches.** Rien ne les
rapproche, et c'est délibéré : ce peut être deux personnes différentes de la
même maison. La fusion de doublons reste le jalon à part signalé au jalon 45.

**Le marqueur n'apparaît pas dans les cartes mobiles ni dans `/clients`.** Le
nom y passe bien par `contactTitle()` — donc la marque s'affiche — mais la
mention « Contact à identifier » n'est rendue que dans le tableau et le tiroir,
là où il y a la place de la lire.

**Un piège de méthode, pour la quatrième fois.** Le serveur de vérification est
resté attaché au port pendant plusieurs essais : je lisais un binaire périmé et
son ancienne configuration, et j'ai d'abord conclu que la clé d'API n'était pas
transmise. C'est la leçon des jalons 33, 34 et 37 — **vérifier quel processus
répond avant de conclure quoi que ce soit sur le produit**.


---

## Jalon 51 — quel code sert cet écran, et depuis quand

### Le diagnostic, d'abord — et il a coûté deux allers-retours

Signalé : la bascule « Je n'ai pas encore le contact » toujours absente **après**
la fusion de la PR #22. Trois hypothèses, prises dans l'ordre du moins cher au
plus cher, et tranchées avec des preuves plutôt qu'avec des lectures de code.

| # | Hypothèse | Verdict |
|---|---|---|
| 1 | Le déploiement ne porte pas `54324b6` | **la seule qui reste** — et elle n'est pas décidable depuis cet environnement |
| 2 | Le tiroir de création n'utilise pas le composant câblé | **faux, prouvé au navigateur** |
| 3 | Un cache sert l'ancien formulaire | **faux** — même preuve |

**La fusion, elle, est établie** : `origin/main` est à `54324b6` (« Merge pull
request #22 »), `git cat-file -e` trouve les cinq fichiers du jalon 50 dans
`main` — les mêmes commandes qui répondaient « exists on disk, but not in
'origin/main' » deux jours plus tôt —, `git log origin/main..origin/<branche>`
est **vide** et aucune PR n'est ouverte.

**L'hypothèse 2 a été fermée par mesure, pas par relecture.** Le code dit bien
que `contacts-view.tsx:230` passe `contact={null}` et que `contact-form.tsx:124`
rend la bascule sur cette seule condition — mais après deux erreurs de
diagnostic, une lecture de code ne vaut plus preuve. Un build standalone de
production du commit fusionné, une vraie base PostgreSQL, un navigateur piloté :

```
bascule présente : 1
libellé prénom (décoché) : Prénom            | requis : true
libellé prénom (coché)   : Prénom (si connu) | requis : false
puce « À identifier » : 1        erreurs console : 0
```

Le code de `54324b6` **rend la bascule**. Il ne reste donc que le déploiement,
et c'est exactement ce qu'aucune preuve d'ici ne peut trancher : cet
environnement n'a ni jeton Railway, ni CLI `railway`, ni variable `RAILWAY_*`.

### Le vrai livrable : rendre la question vérifiable en une seconde

Deux fois de suite, « ça ne marche pas » a coûté un aller-retour entier parce
que **deux situations produisent le même écran** : un déploiement en retard, et
un défaut d'affichage. Le pied de page portait le commit sur sept caractères ; il
lui manquait **depuis quand** ce code sert les requêtes — le fait qui les sépare.

`lib/deploy-info.ts` rend désormais `commitFull`, `environment`, `deploymentId`
et `startedAt`, plus `describeUptime()`. Trois décisions :

- **`startedAt` vient de `process.uptime()`**, calculé **une fois à l'import**.
  Railway n'injecte aucun horodatage de déploiement, et une date figée au build
  mentirait après un redémarrage de conteneur — or c'est précisément le cas
  qu'on cherche à distinguer. Recalculé à chaque requête, il varierait de
  quelques millisecondes et ferait douter d'un affichage qu'on consulte pour
  trancher ;
- **`deploymentId` change à chaque déploiement, même à commit identique** : c'est
  ce qui permet de dire « j'ai bien redéployé » quand rien n'a été poussé ;
- **l'âge plutôt que la date brute** : « démarré il y a 16 h » à côté d'une
  fusion faite ce matin **est** le diagnostic, sans soustraction mentale.

Trois surfaces, choisies pour couvrir trois usages :

| Où | Pour |
|---|---|
| pied de page de `/` | le coup d'œil, **y compris sur téléphone** — `/reglages` est un écran de bureau depuis le jalon 46 |
| `/reglages` → « Version déployée » | le commit **entier**, à comparer au copier-coller, avec branche, environnement et identifiant de déploiement |
| `GET /api/version` | vérifier sans naviguer, depuis un onglet ou un `curl` |

**`/api/version` n'est pas publique**, et c'est délibéré : le middleware ferme
tout ce qui n'est pas dans `PUBLIC_PATHS`. C'est la règle du jalon 9, quand la
sonde publique a été rendue muette — branche, commit et environnement
renseignent un tiers sur le rythme de livraison et la structure du dépôt.
`no-store` : une réponse mise en cache répondrait un jour l'ancien commit, ce qui
recréerait exactement l'ambiguïté que la route supprime.

### Le déploiement en échec — ce que je peux affirmer, et ce que je ne peux pas

« Deployment failed during network process », initialisation et build passés.
**Notre chemin de démarrage ne peut pas produire une erreur à cette phase, parce
qu'il n'a pas encore tourné** : le « network process » se situe entre l'image
construite et le conteneur lancé, et `scripts/start.sh` s'exécute après. Chacun
de ses modes d'échec porte d'ailleurs une signature différente — `HOSTNAME` non
forcé et port non lié échouent au **healthcheck** (« service unavailable »),
et une migration en échec **ne bloque rien** par conception (`if … else`, jamais
`&&`).

La bannière de `start.sh` tranche en un coup d'œil : **si les Deploy Logs ne
portent pas les lignes `AuraFLOW CRM — Next.js standalone / commit / branche`,
notre code n'a jamais démarré.**

**Ce que je ne peux pas déterminer d'ici** : il n'y a ni jeton Railway, ni CLI,
ni variable `RAILWAY_*` dans cet environnement — je ne peux lire ni les Deploy
Logs ni l'état du service. Au vu de la phase, cela ressemble à une défaillance
d'infrastructure Railway, la troisième sur leurs builders, et **il n'y a rien à
corriger dans notre chemin de démarrage**. Un *Redeploy* qui passe sans qu'une
ligne de code ait changé en est la preuve.

### Jalon 51 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration), le
serveur standalone de production lancé avec les cinq variables `RAILWAY_*`, et
un navigateur piloté :

- **la bascule du jalon 50 rend bien** sur le commit fusionné (mesures
  ci-dessus) — l'hypothèse « défaut d'affichage » est close ;
- **pied de page** : `commit 54324b6 · main · démarré à l'instant · rendu à
  14:17:34 · /api/health` ;
- **`/reglages`** : section « Version déployée » unique, portant le commit
  entier `54324b6c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f60`, `main`, `crm`,
  `production`, `dep_4f2a91c7` et « 31/08/2026 12:17 — à l'instant » ;
- **`/api/version`** : 200 avec session et les neuf champs ; **401 sans
  session** ;
- **variable absente** → `null`, jamais une chaîne vide : « — » à l'écran veut
  dire « Railway ne l'a pas injectée », ce qui est une information ;
- **`startedAt` stable** d'un appel à l'autre, et toujours dans le passé ;
- **0 erreur console, 0 réponse ≥ 400** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1012 tests**) verts.

### Jalon 51 — ce qui n'est pas fait

**L'état réel du déploiement de production reste inconnu depuis ici.** C'est la
limite que ce jalon rend inoffensive plutôt qu'il ne la lève : la réponse est
désormais à un coup d'œil dans le produit, au lieu d'un aller-retour.

**`startedAt` est l'instant du processus, pas celui du déploiement.** Un
redémarrage de conteneur sans nouveau déploiement remet le compteur à zéro. C'est
le fait dont on dispose de source sûre, et il est nommé « Démarré » plutôt que
« Déployé » pour ne pas prétendre autre chose.

**Un piège de méthode, nouveau celui-là.** `pkill -f "standalone/server.js"` a
tué le shell qui l'exécutait : la commande contenait le motif, donc `pkill` s'est
trouvé lui-même. Deux tours de vérification perdus sur un script jamais écrit.
Un motif de `pkill` ne doit pas figurer littéralement dans la ligne qui le lance.


---

## Jalon 52 — le healthcheck traversait le verrou

### La cause, nommée avec sa ligne

Railway l'a désigné : *Network › Healthcheck ✗*, initialisation, build et deploy
passés. Le conteneur démarre, puis ne répond pas ce que le healthcheck attend.

**`crm/railway.json:8` — `"healthcheckPath": "/"`.** La cible du healthcheck est
la page d'accueil, et `/` **n'est pas dans `PUBLIC_PATHS`**. Sans cookie — un
healthcheck n'en présente aucun — le middleware la traite comme tout le reste :

```
sans cookie, WORKSPACE_PASSWORD posée, base ARRÊTÉE
  /api/live    -> 200      ← la nouvelle cible
  /api/health  -> 503      ← interroge la base, par conception
  /            -> 307      ← l'ancienne cible : redirection vers /login
```

Cette valeur n'a **jamais changé** : `git log -L` sur la ligne ne rend qu'un
commit, `5e7d22a` (phase 1). Ce n'est donc pas une régression — c'est une
fragilité qui a fini par se réaliser, et **je ne peux pas dire depuis ici
pourquoi la PR #21 est passée et les deux suivantes non**. Un healthcheck qui
suit les redirections voit `/login` en 200 ; un qui ne les suit pas voit 307. Ce
qui est certain, c'est que la cible dépendait de trois choses qui n'ont rien à
voir avec « le processus est-il debout » : le verrou, une variable
d'environnement, et dix requêtes Prisma.

### Les trois autres pistes, écartées avec leur preuve

| Piste | Verdict |
|---|---|
| **`config.ts` lève au démarrage** | **Faux.** Aucun `throw`, aucune validation au chargement : `workspacePassword()` **rend `null`** quand la variable manque, et c'est le middleware qui décide d'un 503. Le module n'a aucune dépendance — ni Prisma, ni réglages. `SNAPSHOT_GITHUB_*`, non posées en production, ne sont lues nulle part dans `lib/auth/` |
| **Le jalon 50 ou `/api/version` ont touché le routage** | **Faux, mesuré** : `git diff f4f38a2 HEAD -- crm/middleware.ts crm/lib/auth/ crm/railway.json crm/next.config.ts crm/scripts/start.sh` est **vide**. Une seule route a été ajoutée sous `app/api/` depuis le déploiement vivant : `api/version` |
| **`/api/version` visée par le healthcheck** | **Elle rend bien 401 sans session** — donc l'hypothèse était juste dans son raisonnement — mais elle n'est pas la cible : `railway.json` dit `/`. Le risque était réel et il est désormais fermé par un test |

**Où lire la valeur configurée, et quoi vérifier chez Railway** : le fichier
`crm/railway.json` fait foi **sauf** si le service porte un réglage propre —
*Service → Settings → Deploy → Health Check Path* et *Healthcheck Timeout*. Un
réglage saisi là **écrase** le fichier, et c'est la seule chose que ce dépôt ne
peut pas savoir. S'il y est renseigné, le mettre à `/api/live` ou le vider pour
laisser `railway.json` décider.

### La sonde ne dit qu'une chose

`app/api/live/route.ts` : `{"status":"live","at":"…"}`, `no-store`. **Aucun
import de `lib/`, aucun Prisma, aucun `process.env`** — et ce ne sont pas trois
scrupules, ce sont trois modes de défaillance :

- **la base** — le conteneur vient d'exécuter `prisma migrate deploy` ; c'est
  précisément l'instant où PostgreSQL peut ne pas encore répondre. Un
  healthcheck qui l'interroge refuse un binaire sain, et l'ancien continue de
  servir sans que rien ne dise pourquoi ;
- **une variable optionnelle** — `SNAPSHOT_GITHUB_TOKEN` absente doit se
  signaler *dans* l'application, pas en empêchant sa mise en ligne ;
- **un import** — il suffirait qu'un module de la chaîne lise un réglage au
  chargement pour que la route redevienne fragile sans qu'on l'ait voulu.

**`/api/health` n'est pas la cible et garde son rôle** : elle rend 503 quand la
base ne répond pas, c'est tout son intérêt comme diagnostic depuis le jalon 5,
et c'est exactement ce qui la disqualifie comme porte de déploiement. La
distinction est celle, classique, entre *liveness* et *readiness* — le
déploiement se décide sur la première.

Publique par nécessité, donc **muette** : ni compteur, ni commit, ni nom de
service, même règle que la sonde du jalon 9. L'identité du déploiement se lit
derrière le verrou, sur `/api/version` (jalon 51).

### La garde : le contrat, pas l'intention

`tests/healthcheck-contract.test.ts` lit `railway.json` **à l'exécution** — pas
une constante recopiée, qui cesserait de décrire la configuration réelle au
premier changement — et fixe six invariants : le chemin configuré est public ;
le **vrai middleware** le laisse passer, mot de passe présent **et** absent ; la
route qui le sert n'importe rien de `lib/`, ne nomme pas Prisma et ne lit aucune
variable d'environnement ; elle ne rend que `status` et `at` ; et ce n'est pas
`/api/health`.

Les commentaires sont retirés du source avant l'examen — sans quoi la garde
attrape sa propre documentation (le fichier explique justement pourquoi il ne
touche pas Prisma) et deviendrait un test qu'on contourne en reformulant une
phrase plutôt qu'en corrigeant du code. Le défaut a été trouvé au premier
lancement du test.

**Une seule source, prouvée et non inspectée.** Deux invariants de plus, ajoutés
après que la question « quel fichier Railway lit-il vraiment ? » eut coûté un
aller-retour de plus : `crm/` doit porter **exactement un** fichier de
configuration Railway, et la racine du dépôt **aucun**. Le Root Directory du
service vaut `crm`, donc `crm/railway.json` gouverne — un fichier posé à la
racine appartiendrait à un autre service tout en déclarant un second
`healthcheckPath`, et c'est cette ambiguïté-là qu'on relit alors au lieu de la
valeur qui gouverne. Éprouvés en posant les deux fichiers fautifs : chacun fait
tomber sa garde en nommant le fichier. État constaté du dépôt : `backend/` et
`crm/` portent chacun le leur, la racine n'en porte aucun — **il n'y a donc
aucun doublon à supprimer**.

**Éprouvée en réintroduisant les trois régressions**, dont la cause exacte de
l'incident :

| Régression | Ce qui tombe |
|---|---|
| `railway.json` revient à `/` | **4 tests** : « railway.json vise « / », qui n'est pas dans PUBLIC_PATHS : le healthcheck traverserait le verrou » |
| la route lit `process.env.NODE_ENV` | 2 tests : la dépendance nommée, et le corps qui divulgue plus |
| la cible redevient `/api/health` | 2 tests, dont « Prisma — une base momentanément indisponible refuserait le déploiement » |

### Jalon 52 — ce qui est vérifié

Contre le serveur standalone de production, **base volontairement arrêtée** —
le cas qui refusait le déploiement :

- **`/api/live` → 200** sans session, base éteinte, `no-store`, corps
  `{"status":"live","at":"…"}` ; `/api/health` → **503** et `/` → **307** dans
  les mêmes conditions ;
- **sans `WORKSPACE_PASSWORD`** : le vrai middleware laisse passer `/api/live`
  (test unitaire — en local, `.env` fournit la variable au serveur standalone,
  donc le cas ne s'exerce pas au navigateur) ;
- **le verrou n'a pas été affaibli** : `auth-routes.test.ts` continue d'exiger
  que toute autre route ajoutée soit fermée ; `/api/version` reste 401 ;
- `migrate diff` **vide** — aucune migration ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1018 tests**) verts.

### Jalon 52 — ce qui n'est pas fait

**Je ne peux pas dire pourquoi la PR #21 est passée et les deux suivantes non.**
La cible était la même depuis la phase 1 ; ce jalon supprime la fragilité, il
n'explique pas le déclencheur. Sans accès aux Deploy Logs, l'honnête est de le
dire.

**Un réglage de healthcheck saisi dans l'interface Railway écrase
`railway.json`**, et le test ne peut pas le voir — il vérifie le fichier du
dépôt. C'est à contrôler une fois dans *Settings → Deploy*.

**Le piège du `pkill`, résolu pour de bon.** Le serveur standalone se **renomme**
`next-server (v15.5.23)` : `pkill -f "standalone/server.js"` ne l'a donc jamais
trouvé, et c'est pourquoi le port restait pris — la cause des faux diagnostics
des jalons 33, 34, 37, 50 et 51. La bonne commande cherche **le tenant du
port** : `ss -lptn 'sport = :<port>'`, puis `kill -9` sur le PID rendu. Et ici
encore, c'est la lecture du journal (`EADDRINUSE`) **avant** toute conclusion qui
a évité de prendre une mesure périmée pour un défaut du correctif.

---

## Jalon 53 — plusieurs personnes par maison, écrites différemment

### Ce que l'import faisait vraiment, mesuré avant de le corriger

Quatre lignes d'une même maison, par le **chemin réel** de l'import (la leçon du
jalon 42 : le raccourci saute précisément l'endroit où la donnée se perd) :

| Variante | Avant | Après |
|---|---|---|
| « Miye » / « MIYE » | fusionnées | fusionnées |
| « MiYé » | **doublon créé** | fusionnée |
| « Miye Care » | société distincte | société distincte — **et c'est correct** |
| `searchText` des sociétés créées | **vide** | écrit |

**Une cause pour les deux défauts : deux règles pour une même question.**
`contact-import.ts` comparait en SQL (`mode: "insensitive"` — la casse, pas les
accents) et créait la société lui-même, donc sans miroir de recherche ; le
formulaire normalisait en mémoire depuis le jalon 6, accents compris, et
écrivait le miroir depuis le jalon 12. C'était le chemin des **fichiers importés
en masse** qui portait la règle la plus faible.

`resolveCompanyDetailed()` est désormais la seule porte, et elle rend en plus
**si elle a créé** — le rapport d'import annonce les sociétés créées, et le
déduire en comptant la table avant et après aurait été deux requêtes par ligne
pour une information que la fonction qui écrit possède déjà.

**« Miye Care » reste distincte, et ce n'est pas un manque.** C'est un autre nom,
pas une variante d'écriture ; les rapprocher serait deviner — la faute que le
jalon 25 s'est interdite sur les domaines. Rapprocher des noms réellement
proches est une **fusion de fiches**, avec son historique, ses affaires et ses
séquences à recoudre : c'est le jalon à part déjà signalé au jalon 45.

`tests/company-match-source.test.ts` ferme le chemin, éprouvé en réintroduisant
le défaut exact : deux tests tombent en nommant le fichier.

### L'angle est réglé, jamais deviné

```
lib/domain/role-angles.ts     appariement + consignes — pur, testé
lib/api/role-angles.ts        rôles, étiquettes, couverture, angle d'un contact
app/api/role-angles/          GET (couverture) / PUT (remplacement de la liste)
components/settings/          panneau, fonctions non reconnues, fenêtre collègue
```

Un rôle porte un nom, une **note d'angle écrite à la main** et autant
d'étiquettes qu'il faut : « Head of Customer Care », « Responsable service
client », « SAV Manager » désignent le même métier selon le fichier. L'appariement
n'absorbe que ce qui ne veut rien dire — casse, accents, ponctuation, espaces —
et **ne devine jamais** :

1. **égalité** de l'intitulé normalisé avec une étiquette ;
2. **inclusion en mots entiers**, l'étiquette la plus longue l'emportant :
   « responsable sav » décrit mieux que « responsable ». Sur les mots et non les
   caractères, sans quoi « ops » se reconnaîtrait dans « opsourcing » ;
3. **ambiguïté** — deux rôles à égalité : on **renonce**, et l'intitulé remonte
   dans les non appariés. Trancher reviendrait à tirer au sort l'angle sous
   lequel on écrit à quelqu'un.

`normalized` est **unique en base** : une même étiquette ne peut pas désigner
deux rôles. Une contrainte plutôt qu'une vérification — une course ne contourne
pas un index unique. Le service refuse quand même *en nommant les deux rôles*,
parce qu'un message Prisma sur un index ne dit pas quelle ligne retirer.

**Un rôle reconnu sans note ne vaut pas un angle.** C'est l'état des quatre rôles
semés par la migration : leur annoncer « angle pour Responsable SAV » puis rien
ferait remplir le vide par le modèle. La consigne dit alors explicitement qu'il
n'y en a pas.

**La liste des fonctions non reconnues est la moitié utile du panneau.** Un
appariement qui échoue en silence fait retomber Alex sur l'angle générique sans
que personne l'apprenne : les messages partent, ils sont corrects, et ils sont
tièdes. Chaque ligne est une étiquette à écrire, chiffrée en nombre de fiches.
Les fiches **sans fonction** sont comptées à part : elles n'appellent pas une
étiquette mais une saisie.

### Ce qu'Alex reçoit, et pourquoi c'est cherché plutôt que déduit

Trois faits rejoignent le DM du jalon 48 dans le dossier, **toujours présents, y
compris à la forme négative** — une absence de ligne se lit comme une absence
d'information, une ligne qui dit « aucun » se lit comme une interdiction :

| Fait | Cas positif | Cas négatif |
|---|---|---|
| Fonction | « Fonction du destinataire : Head of Customer Care » | « NON RENSEIGNÉE » |
| Angle | la note de l'utilisateur, mot pour mot, avec le nom du rôle | « AUCUN — … N'invente pas l'angle d'un métier que tu crois deviner » |
| Collègue écrit | nom, rôle, date, objet **et sa phrase d'ouverture** | « AUCUN — personne d'autre de cette maison n'est en base » |

La **note pour Alex** (`Contact.alexNote`) est un champ distinct des Notes, et le
dossier l'annonce comme « écrit à la main ». Les Notes portent le déversoir de
l'import — lignes `SITE :`, `N° :`, titres de page (jalon 24) — qu'on ne peut pas
envoyer à un modèle sans lui faire prendre un titre d'onglet pour un fait.

**La consigne du collègue porte la phrase exacte à ne pas reprendre**, jamais un
« varie un peu » : un modèle à qui l'on montre ce qu'il ne doit pas écrire s'en
écarte, un modèle à qui l'on demande de la variété reformule la même idée — ce
qu'un lecteur humain reconnaît immédiatement. Le positionnement, lui, ne bouge
pas : une entreprise qui raconte deux histoires à deux collègues n'est pas plus
crédible que celle qui leur envoie deux fois la même.

### L'avertissement avertit, il n'interdit pas

Fenêtre réglable (`colleagueWarningDays`, 30 j par défaut, `0` la coupe — même
convention que le plafond mensuel de l'API). Le panneau de rédaction nomme le
collègue et la date, **et laisse partir le message** : écrire à plusieurs
personnes d'une maison est l'intention même de la campagne. Ce qui fait écrire
une bêtise, c'est de ne pas le savoir. Refuser à la place de l'utilisateur serait
décider pour lui, ce que le produit s'interdit depuis le jalon 8.

### Le compte se travaille

- **fiche société** : les contacts avec leur fonction, le **dernier email envoyé
  à quiconque** de la maison (avec son signataire et son objet), et un lien vers
  toutes ses fiches. Les liens vont vers `?fiche=<id>` et non `?q=<nom>` — ce
  dernier retombait sur une recherche, et sur une liste **vide** pour une fiche
  sans personne nommée depuis le jalon 50 ;
- **fiche contact** : les collègues déjà en base, cliquables, avec la date du
  dernier message reçu par chacun ; la note pour Alex, éditable sur place ;
- **`/contacts?societe=<id>`** : toutes les fiches d'une maison, par identifiant
  et non par nom — un nom se renomme. Un filtre actif se **nomme** dans un
  bandeau avec son bouton d'annulation, sinon la liste serait filtrée sans
  qu'aucun contrôle ne dise par quoi (règle du jalon 31) ;
- **colonne « Fonction »** : hors des six par défaut, **triable et filtrable**.

Ces lectures vivent dans `lib/api/account.ts`, **hors de `listContacts`** : la
liste est un chemin chaud rendu pour cent cinquante lignes, et y joindre les
collègues de chacun coûterait une requête par ligne pour une information que
seuls le tiroir et la rédaction affichent.

`ContactSortKey` était une recopie à la main de `CONTACT_SORT_KEYS` — deux
sources pour un même vocabulaire. Elle en est désormais **dérivée** : une clé
ajoutée à l'une sans l'autre donnait soit un tri refusé en 400, soit un tri
accepté qu'aucune colonne n'offrait, sans que rien n'échoue à la compilation.

### Jalon 53 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `22_roles` appliquée puis `migrate diff`
**vide**, seed rejoué → 4 rôles / 27 étiquettes, idempotent), et le substitut
Anthropic dont la capture (`MOCK_DUMP`) permet de lire **ce qui part réellement
sur le fil**, comme pour le DM au jalon 48 :

- **1 · une maison, une société** : « Miye », « MiYé », « Miye » → **1** société,
  3 contacts, `searchText` écrit ;
- **2 · le compte se lit** : la fiche société liste les trois avec leur fonction ;
  les collègues de Sophie sont Léa et Caroline ; `?societe=` rend 3 fiches ;
- **3 · l'angle atteint le modèle** : note écrite pour « Responsable SAV » → le
  fil porte « SAV absorbé, pas de conversion », « Angle pour ce rôle
  (« Responsable SAV ») » et « Fonction du destinataire : Head of Customer Care ».
  L'appariement s'est fait sur l'étiquette « Head of Customer Care » ;
- **4 · rien n'est deviné** : « Office Manager » → « Angle pour ce rôle : AUCUN »,
  « N'invente pas », et **l'angle SAV n'a pas fuité** dans cette requête ; la
  fonction apparaît dans les non appariés avec son compte ;
- **5 · le deuxième message** : l'avertissement nomme « Caroline Petit » et sa
  date, le fil porte « a reçu un email il y a … », **sa phrase d'ouverture
  exacte** et « ni une reformulation » ;
- **la note pour Alex** part sur le fil, annoncée « écrit à la main », et les
  Notes brutes (`SITE : Shopify`) restent dans leur propre bloc ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1045 tests**) verts.

### Jalon 53 — ce qui n'est pas fait

**Aucun appel Anthropic réel**, comme aux jalons précédents. Ce qui est établi :
le bon angle, la bonne note et le bon avertissement partent, et l'angle d'un rôle
ne fuite pas vers un autre. Ce qui ne l'est pas : qu'Alex **écrive** réellement
autre chose à la responsable SAV qu'à la fondatrice. C'est le point qui décidera
de l'usage de la fonction, et il se juge sur les trois premiers brouillons réels.

**Les doublons de société ne sont pas fusionnés**, seulement évités à l'écriture.
« Miye » et « Miye Care » restent deux comptes ; les réunir demande une fusion de
fiches — historique, affaires, séquences — qui reste un jalon à part.

**Le tri par fonction est alphabétique, pas hiérarchique.** « CMO » précède
« Fondatrice » : c'est l'ordre de la chaîne, pas celui du pouvoir de décision.
Un ordre par rôle demanderait de trier sur le rôle apparié, qui n'existe qu'après
lecture.

**Les panneaux ne sont pas exercés au clavier dans un navigateur**, comme tous
les composants clients de ce projet : l'éditeur de rôles, la note pour Alex et le
bandeau d'avertissement sont vérifiés par leurs services et par le rendu, pas par
une frappe.

### Défaut latent trouvé au passage, et non corrigé

**Sur une base neuve, `prisma migrate deploy` échoue.** Prisma applique les
migrations dans l'ordre **lexicographique** du nom de dossier : `10_domain_review`
et `11_email` passent avant `2_automation`, et `11_email` référence la table
`agents` que `6_agents` n'a pas encore créée. Mesuré ici, sur une base vide.

La production n'en souffre pas : ses migrations ont été appliquées une par une, à
mesure qu'elles étaient écrites. Le risque est ailleurs — **toute base neuve**
(nouvel environnement, base recréée après incident, base de test) refusera de se
construire, c'est-à-dire précisément le jour où l'on a besoin qu'elle marche.

Ce n'est pas corrigé dans ce jalon, et délibérément : renommer les dossiers
appliqués ferait voir à Prisma des migrations inconnues sur la base de
production, qu'il tenterait de rejouer. La correction sûre est un jalon à elle
seule — renommer **et** réécrire `_prisma_migrations` dans la même transaction,
ou repartir d'une migration de consolidation. À traiter avant le prochain
changement d'environnement.

---

## Jalon 54 — trois boîtes d'envoi, et une section Campagnes

### Les boîtes : la configuration unique du jalon 32 devient une liste

Table `mailboxes` : libellé, SMTP, IMAP (copie « Envoyés » **et** relevé — même
boîte, même secret, jalon 37), et **la signature**. Le signataire du jalon 35
cesse d'être une table : c'est une propriété de la boîte, et `signatories.ts`
devient une projection de `mailboxes` — `Signatory.id` **est** un identifiant de
boîte, ce qui a laissé le panneau de rédaction, le dossier d'Alex et
`replaceSignature` fonctionner sans réapprendre un vocabulaire. Le sélecteur du
panneau s'appelle désormais « Envoyé depuis » : choisir la boîte choisit la
signature.

**Le mot de passe : `SMTP_PASSWORD_<SLUG>`, jamais en base.** Le slug est choisi
à la création et **immuable** (comme celui des agents, jalon 15) : il indexe une
variable d'environnement, et le rendre modifiable transformerait un renommage
d'étiquette en panne d'authentification. La boîte migrée porte le slug
`principale` et **retombe sur `SMTP_PASSWORD`** quand
`SMTP_PASSWORD_PRINCIPALE` n'est pas posée — le déploiement en cours continue
d'envoyer sans qu'on touche à Railway. Le repli est réservé à cette boîte :
l'étendre ferait authentifier la boîte de Mohamed avec le mot de passe de
Yanis, et l'erreur ne se verrait qu'au refus du serveur.

**À poser sur Railway** : `SMTP_PASSWORD_MOHAMED` et la variable de la
troisième boîte (affichée dans Réglages à côté de son état). `SMTP_PASSWORD`
existant continue de servir la boîte principale.

**Le relevé passe sur toutes les boîtes, séquentiellement.** Une connexion
IMAP courte par boîte, l'une après l'autre — jamais en parallèle : la
contrainte d'IONOS porte sur les connexions simultanées (jalon 41). Trois
boîtes × un passage par quart d'heure = 288 sessions par jour au total, cadence
du workflow inchangée. **Une boîte en échec n'arrête pas les autres** ; le
rapport nomme chaque échec avec sa boîte, et le battement de cœur
(`lastInboxPollAt`) n'avance que si toutes les boîtes prêtes ont réussi — un
échec partiel doit finir par allumer le bandeau, pas s'endormir derrière le
succès des voisines. Le rapprochement, lui, reste **global** : les envois sont
indexés une fois pour toutes les boîtes, une réponse arrivée chez Mohamed à un
message parti d'ailleurs reste une réponse.

« Tester l'envoi » et « Tester la copie » sont par boîte, et **la réponse la
nomme** : à trois boîtes, un échec anonyme ferait vérifier les deux mauvaises
d'abord. `EmailSend.mailboxId` dit qui a réellement expédié (vide pour les
envois antérieurs — une absence est une information).

### Les campagnes : une boîte, une sélection, une séquence

`/campagnes` entre dans le rail. Une campagne ne réinvente rien : sa séquence
est celle du jalon 38 (relation `EmailSequence.campaignId`), et la migration 23
enveloppe chaque séquence existante dans une campagne portée par la boîte
principale — aucune inscription en cours n'est interrompue. La définition des
étapes déménage de /reglages : l'éditeur du jalon 38 est monté tel quel dans la
carte de campagne (prop `embedded`), même route, mêmes règles — trois étapes au
plus, mode automatique à double verrou.

**La sélection est une query string de /contacts.** On choisit ses contacts
avec les outils qu'on utilise déjà — la carte renvoie vers
`/contacts?campagne=<id>`, une bannière y affiche la campagne et le compte, et
« Inscrire cette sélection » ré-évalue le filtre **côté serveur avec les mêmes
fonctions que la page** (`parseContactsQuery` + `parseFilters` +
`listContacts`) avant d'appeler l'`enroll()` du jalon 38. Rien ne s'inscrit
sans ce clic ; l'inscription est idempotente par la contrainte d'unicité.

**Aucun garde-fou ne bouge** : première étape par la file des départs du matin,
fiches closes et oppositions refusées à l'envoi (`sequence-rules.ts`), plafonds
de débit, arrêt sur réponse. Les messages d'une campagne partent de **sa**
boîte : `departures.ts` passe le `mailboxId` de la campagne à `draftEmail` et à
l'envoi, et la signature suit.

**L'entonnoir par campagne** reprend les définitions de /emails, bornées :
inscrits, en cours, personnes écrites, messages, ouverts (estimation, jalon
37), réponses et rendez-vous via `readReplyFacts` — la seule définition de
« a répondu » du produit (jalon 39).

### Le trou fermé : deux collègues composés le même matin

La règle du jalon 53 lit les **envois** — or dans la boucle de composition,
deux collègues d'une même maison sont composés avant que quiconque soit envoyé :
le second n'aurait rien vu, et les deux brouillons seraient partis avec la même
accroche. `departures.ts` relit donc les départs **déjà composés ce matin** pour
la même maison (toutes séquences confondues) et joint la phrase d'ouverture du
premier à la consigne du second, en interdiction — la garde `contact-name-source`
du jalon 50 a d'ailleurs attrapé la première version de cette ligne, qui
recomposait un nom à la main.

### Restauration : une table née après la sauvegarde n'est plus effacée par elle

Les boîtes sont sauvegardées (configuration écrite à la main, jamais le mot de
passe), et restaurées **par identifiant** : une boîte tenue par une campagne ne
peut pas disparaître sous elle, et une boîte inconnue de la sauvegarde survit.
Corrigé au passage : le jalon 53 vidait les rôles avant de vérifier que la
sauvegarde en portait — une sauvegarde antérieure les aurait effacés. La
suppression est désormais conditionnelle à la présence de la section.

### Jalon 54 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `23_mailboxes` appliquée puis
`migrate diff` **vide**, seed rejoué sans doublon), un puits SMTP STARTTLS,
**trois** serveurs IMAP substitués (un par boîte, identifiants distincts) et le
substitut Anthropic avec capture du fil :

- **1 · trois boîtes indépendantes** : envoi et copie « Envoyés » réussis pour
  chacune, `From` conforme, un dépôt par dossier ; variable absente → l'échec
  nomme `SMTP_PASSWORD_TROISIEME`, pas une autre ;
- **2 · réponse sur la deuxième boîte** : envoi depuis « Mohamed »
  (`mailboxId` et `signatoryName` corrects), réponse déposée dans **son** INBOX
  → `replies: 1`, interaction « Répondu » consignée, les trois boîtes relevées
  (`yanis@…, mohamed@…, tiers@…`), zéro erreur ;
- **3 · campagne** : créée sur la boîte Mohamed, sélection
  `societe=<id>&lifecycle=all` → 2 inscrits ; 2 départs composés, **les deux
  brouillons signés « Mohamed Targani / Co-Fondateur »** ; l'angle SAV du rôle
  part sur le fil pour la fiche appariée ;
- **4 · collègues** : le second brouillon reçoit l'accroche du premier en
  interdiction (« composé ce matin … ni une reformulation »), sur le fil ;
- **5 · entonnoir** : 2 inscrits · 2 écrits · 2 messages · 1 ouvert · envois
  partis de la boîte de la campagne ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1046 tests**) verts.

### Jalon 54 — ce qui ne l'est pas

**Rien n'a touché IONOS**, comme toujours : trois boîtes réelles restent à
éprouver au premier clic sur leurs boutons d'essai — c'est exactement ce qu'ils
citent en réponse. **La qualité des brouillons de campagne** relève du modèle ;
le fil prouve la signature, l'angle et l'interdiction d'accroche, pas la prose.
**L'avertissement « collègue déjà écrit » du panneau** reste celui du jalon 53
(fondé sur les envois) ; dans la file du matin, c'est la consigne d'accroche qui
joue ce rôle — la file est déjà une relecture humaine. **Le rattrapage des
`Message-ID`** (jalon 44) ne relit que la boîte principale : les envois
antérieurs au jalon 54 partaient tous d'elle, les autres n'ont pas de passé à
réparer.

---

## Jalon 55 — travailler une campagne au quotidien

### Archiver contre supprimer, la distinction du jalon 47 appliquée

| | « Archiver » | « Supprimer » |
|---|---|---|
| Pour | la campagne finie, tous les jours | la campagne créée par erreur |
| Garde | envois, ouvertures, réponses, entonnoir | rien |
| Réversible | oui, « Désarchiver » | non |
| Refusée si | jamais | **la campagne a envoyé au moins un message** |

**Un envoi est un fait ; l'effacer ferait mentir /emails.** Le refus le dit
mot pour mot et renvoie vers « Archiver » — un blocage qui ne nomme pas
l'alternative se lit comme une panne. Le bouton « Supprimer » est **absent**
plutôt que grisé sur une campagne qui a envoyé (jalon 26), et une phrase à sa
place dit combien de messages retiennent la suppression.

**Le verdict est relu au moment d'écrire**, jamais repris de l'affichage : la
confirmation peut rester ouverte pendant qu'un départ part, et c'est exactement
l'instant où la campagne cesse d'être supprimable (leçon du jalon 47).

**Ni l'un ni l'autre ne touche aux contacts**, et la confirmation l'écrit :
archiver arrête les inscriptions actives avec le motif « Campagne archivée » et
écarte les départs en attente ; supprimer emporte la séquence, ses étapes et ses
inscriptions. Les fiches, leur historique et leurs envois restent — ce ne sont
pas des enfants de la campagne.

### La sélection est une vraie sélection

Case par ligne, case d'en-tête qui prend **tout ce que le filtre courant
affiche**, moins les déjà inscrits — qui apparaissent « ✓ inscrite » plutôt que
cochables. Barre collée en haut (`sticky`) portant « 23 sélectionné(s) » et le
bouton de confirmation : une barre qui défile hors du champ obligerait à
remonter pour valider, et l'on finirait par cocher sans jamais confirmer.

**Elle survit au filtrage, et c'est ce qui décide de tout le reste.** Filtrer,
sur cet écran, est une **navigation** : la page est rendue côté serveur et
l'état React repart de zéro. Trois rangements possibles, et pourquoi
`sessionStorage` (`lib/client/campaign-selection.ts`) :

| Où | Verdict |
|---|---|
| l'URL | **non** : cent cinquante identifiants dans la barre d'adresse, une limite de longueur, un favori qui fige une sélection périmée |
| la base | **non** : une sélection en cours de composition n'est pas un fait, et chaque clic de case deviendrait une écriture — une inscription sans témoin, ce que le jalon 8 s'interdit |
| `sessionStorage` | **retenu** : par onglet, survit à la navigation, disparaît à la fermeture — la durée de vie exacte d'un brouillon de sélection |

Toutes les lectures et écritures sont gardées : un navigateur qui refuse le
stockage rend l'écran **dégradé mais jamais faux** — la sélection ne survit
alors pas au filtre, au lieu de casser la page.

**Les fiches cochées font foi quand il y en a**, le filtre n'étant alors qu'un
souvenir de la façon dont on les a trouvées : cocher huit fiches sur un filtre
puis cinq sur un autre ne se décrit par aucune requête unique.

Cibles à 44 px, comme partout depuis le jalon 46.

### Qui est dans la campagne

Par ligne : nom (vers sa fiche), société, rôle, étape `n/total`, dernier message
avec `◔` s'il a été ouvert, état et — quand elle est arrêtée — **pourquoi**.

**L'état est dérivé, jamais stocké** : `memberState()` (pur) rend « a répondu »
en premier, puis « arrêtée », puis « pas encore écrit » / « silencieux ». Le
dériver garantit qu'il ne peut pas contredire l'entonnoir affiché au-dessus —
c'est la règle du statut de relance du jalon 6. Les puces filtrent exactement
là-dessus, et un test vérifie que **chaque état produit a sa puce**.

**Retirer arrête l'inscription, ne la supprime pas.** La supprimer sortirait la
personne du dénominateur, et le taux de réponse s'améliorerait à chaque
retrait — une statistique qui se bonifie quand on renonce est une statistique
qui ment. La fiche, son historique et ses envois passés restent, et /emails
continue de les compter.

Les inscrits sont lus **côté serveur** et `onRefresh` rejoue la page : après un
retrait, c'est le serveur qui redit qui reste, pas le navigateur qui devine.

### Un seul entonnoir, et la campagne nommée sur chaque envoi

**Le jalon 54 avait écrit `readCampaignFunnel` comme un second calcul** — ses
propres requêtes, ses propres additions, à côté de celles de /emails. Deux
séries qui comptent les mêmes personnes finissent par se contredire, et
personne ne sait alors laquelle croire.

`readFunnelFacts(scope)` est extraite d'`email-stats.ts` : /emails l'appelle
sans portée, la campagne avec `{ sequenceId }`. `buildFunnel` par-dessus, et la
carte rend **le même composant `FunnelRow`** que la page des emails. Il n'y a
plus qu'une addition.

`EmailSend.campaignId` / `campaignName` (migration `25_send_campaign`) : le nom
est **copié**, comme celui de la séquence au jalon 38 — un renommage ne doit pas
réécrire l'histoire. Et la campagne est **déduite de la séquence**
(`campaignOfSequence`), jamais reçue de l'écran : `EmailSequence.campaignId` est
unique, donc une seule campagne peut revendiquer un message. Un champ transmis
par la requête laisserait un écran s'attribuer les envois d'un autre, et
l'entonnoir compterait ce qu'on lui dit. La migration rattache les envois déjà
partis à la campagne qui portait leur séquence.

Dans /emails, la pastille de l'objet nomme la campagne et l'étape — « seq. 2 »
ne disait pas de quoi — et mène au journal filtré sur elle. **Les puces
filtrent par campagne plutôt que par séquence** : depuis le jalon 54 une
séquence n'existe qu'au sein d'une campagne et porte son nom, deux rangées de
puces identiques feraient choisir entre deux formulations d'une même question
(c'est ce qui avait fait retirer « Déjà contactés » au jalon 31). `sequence`
reste une **valeur valide sans puce**, avec sa puce de rattrapage quand elle est
active : un lien mis en favori doit continuer d'ouvrir sa liste, et un filtre
actif qu'aucun contrôle ne nomme est un écran qui ment.

Sur la fiche d'un contact, un envoi de campagne le dit et renvoie vers son
journal : sans cette ligne, un message de séquence et un message écrit à la main
se ressemblent, et l'on relance quelqu'un qu'une campagne relance déjà.

### La garde

`tests/campaign-funnel-source.test.ts` fixe qu'aucun étage de l'entonnoir n'est
recomposé dans `campaigns.ts` (chacun vient de `facts.input`), qu'il n'y a
aucune seconde définition de « a répondu », que `readFunnelFacts` accepte une
portée et sert bien les deux écrans, et que la campagne d'un envoi est déduite
plutôt que reçue. Statique parce que le défaut l'est : deux additions justes
chacune de son côté ne lèvent rien et ne font échouer aucun type.

**Éprouvée en réintroduisant les deux régressions exactes** — l'addition locale
des messages, et `campaignId` repris de la requête : deux tests tombent en les
nommant. Une première version de la garde était **trop large** (elle interdisait
tout `emailSend.count`, donc aussi le verdict de suppression, qui ne demande pas
un étage d'entonnoir mais un fait binaire) : resserrée, comme la garde de
rapprochement des sociétés au jalon 53.

### Un défaut de frontière, attrapé par le build

`components/campaigns/campaign-members.tsx` importait `MEMBER_STATES` de
`lib/api/campaigns.ts`, qui porte `import "server-only"` : Prisma entrait dans
le paquet du navigateur et le build refusait — à raison. Le vocabulaire des
inscrits (états, libellés, `memberState`) vit désormais dans
`lib/domain/campaign-members.ts`, pur. Le typecheck ne pouvait rien voir : les
types sont effacés, seul l'import de valeur comptait.

### Jalon 55 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `25_send_campaign` appliquée puis
`migrate diff` **vide**), les substituts SMTP/IMAP/Anthropic avec capture du
fil :

- **1 · supprimer refusé** : 3 messages partis → `deletable: false`, refus citant
  le compte **et** « Archivez », campagne toujours en base ; archivage → date
  posée, **3 envois et 3 fiches intacts**, 3 inscriptions arrêtées ; campagne
  vide → supprimée avec sa séquence, **les 3 fiches ne bougent pas** ;
- **2 · inscrits** : 3 lignes portant nom, société, rôle, étape 1/1 et date du
  dernier message ; une réponse consignée → l'état passe à « a répondu »
  **par-dessus « arrêtée »** ; retrait → **toujours 3 lignes**, fiches et envois
  intacts ;
- **3 · traçabilité** : les 3 envois portent « SAV septembre » et leur étape ;
- **4 · l'accord des nombres** : journal filtré par campagne = 3 lignes, et
  **entonnoir 3 écrits / 3 messages / 1 réponse = journal 3 / 3 / 1** — mêmes
  nombres, une seule addition ; le premier étage de l'entonnoir égale « personnes
  écrites » ;
- **2 bis · deux filtres successifs** : une fiche cochée sous `f.title=Head of
  Customer Care`, une autre sous `owner=Mohamed` → **les deux sont inscrites**,
  aucune perdue au changement de filtre ; re-cocher une déjà inscrite →
  « 0 nouvelle, 1 déjà », pas de doublon ;
- **5 · une réponse relevée par IMAP** (et non saisie à la main), sur une
  campagne **vivante** : déposée dans la boîte d'où la campagne part →
  `replies: 1`, rattachée à « Nova octobre » étape 1, inscription passée à
  `stopped` « Le contact a répondu », la liste des inscrits la montre « a
  répondu », et **entonnoir 1 réponse = journal filtré 1** ;
- **6 · garde-fous** : la réponse arrête l'inscription avec son motif,
  l'interdiction d'accroche entre collègues (jalon 54) est toujours sur le fil,
  aucun départ en attente sur une campagne archivée ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1056 tests**) verts.

### Jalon 55 — ce qui n'est pas fait

**La sélection à la case n'a pas été exercée dans un navigateur.** Le service
qu'elle appelle est vérifié de bout en bout ; les cases, la barre collante et la
survie au changement de filtre sont du code client, et cette suite n'a pas de
DOM. C'est le point à regarder en premier sur le déploiement.

**Un onglet fermé perd sa sélection.** C'est la durée de vie choisie, pas un
oubli — mais quelqu'un qui compose une sélection sur deux jours devra la
reprendre. Le jour où cela gêne, la réponse est une sélection nommée en base,
avec son écriture explicite.

**Une campagne archivée peut être désarchivée sans repartir.** Sa séquence reste
inactive : c'est délibéré — relancer des envois doit être un geste séparé — mais
rien à l'écran ne le rappelle au moment de désarchiver.

**Une réponse datée dans la même seconde que son envoi n'entre pas dans
l'entonnoir.** L'en-tête `Date` d'un message est à la seconde, l'envoi porte des
millisecondes : une réponse arrivée 400 ms après tombe donc *avant* son propre
envoi, et `readReplyFacts` l'écarte — à raison, puisque c'est la règle qui
empêche de compter comme réponse une conversation antérieure (jalon 39). Trouvé
en écrivant la recette, où l'envoi et la réponse tenaient dans la même seconde.
Sans conséquence réelle : personne ne répond dans la seconde. À savoir avant de
conclure qu'un relevé « n'a rien compté ».

**Les envois antérieurs à la migration portent la campagne de leur séquence**,
déduite après coup. C'est exact tant qu'une séquence n'a jamais changé de
campagne, ce que le produit n'a jamais permis.


---

## Jalon 56 — composer maintenant, plutôt que demain matin

### Le diagnostic d'abord : le planificateur va très bien

C'était la première question, et la réponse change ce qu'il fallait construire.
**Le workflow tourne, tous les jours, et il a réussi ce matin même** — 32
exécutions, toutes en succès, la dernière le 09/09 à 09:26 UTC sur `main`.

Ce que son journal a rendu, mot pour mot :

```json
"departures":{"skipped":null,"composed":0,"sentAutomatically":0,"stopped":0,"waiting":0}
```

**`waiting: 0` est le chiffre qui tranche.** Il ne dit pas « personne n'était
prêt », il dit que la requête n'a **ramené aucune inscription** : au moment du
passage, il n'existait aucune inscription active sur une séquence active. Deux
causes se cumulaient, et aucune n'est une panne :

1. **la campagne n'existait pas encore** à 09:26 — elle a été créée après. Un
   passage quotidien ne peut pas composer pour une campagne qui n'existe pas,
   et c'est exactement la boucle de vingt-quatre heures que ce jalon supprime ;
2. **la séquence d'une campagne neuve est inactive**, et son unique étape est
   vide : `createCampaign` (jalon 54) la crée ainsi délibérément — rien ne doit
   pouvoir partir avant d'avoir été relu. Mais **rien à l'écran ne le disait**,
   si bien qu'attendre le lendemain n'aurait rien donné non plus.

Le jalon 54-55 n'a rien cassé de ce dont le planificateur dépend : la clause de
composition a gagné `sequence: { active: true }` bien avant (jalon 38), et
l'archivage désactive la séquence — c'est voulu, et c'est nommé.

### Comment le vérifier soi-même

| Question | Où | Ce qu'on lit |
|---|---|---|
| Le passage a-t-il eu lieu ? | onglet **Actions** du dépôt → « AuraFLOW — passage quotidien » | une exécution par jour, en vert |
| Qu'a-t-il fait ? | le journal de l'exécution, dernière ligne | le JSON complet, `composed` compris |
| Le CRM l'a-t-il vu ? | `/accueil` | le bandeau apparaît au-delà de 36 h de silence (jalon 38) |

**Deux constats de plus, trouvés dans ce même journal**, sans rapport avec les
campagnes mais qui méritent d'être dits :

- **les sauvegardes ne tournent pas.** `"snapshot":{"ok":false,"message":"Sauvegardes
  non configurées : renseignez SNAPSHOT_GITHUB_REPO et SNAPSHOT_GITHUB_TOKEN"}` —
  le filet du jalon 19 est en place dans le code et **n'a jamais été branché sur
  le service**. C'est deux variables à poser sur Railway, et c'est la chose la
  plus importante de cette liste ;
- **la vacation de Sabrina échoue** : « Réponse du modèle non conforme au format
  attendu. » Elle échoue proprement — le reste du passage n'en souffre pas — mais
  elle ne produit rien depuis au moins ce matin.

### La composition immédiate est une **portée**, pas une seconde boucle

C'est la décision qui structure tout le reste, et c'est la leçon du jalon 55
appliquée une fois de plus : `composeDepartures(now, scope?)`. Le passage
quotidien appelle sans portée et balaie tout le CRM ; l'enregistrement d'une
campagne appelle avec `{ sequenceId }`.

Écrire une seconde boucle aurait donné deux jeux de garde-fous, et le second
aurait fini par oublier la fiche passée en « Perdu » depuis l'inscription ou
l'opposition au démarchage. Les deux chemins auraient écrit des brouillons
plausibles — l'un d'eux à des gens à qui l'on n'a plus le droit d'écrire.

**Tout ce qui vaut le matin vaut ici**, par construction : cycle de vie
terminal, opposition, réponse déjà reçue, adresse manquante, week-end,
espacement des accroches entre collègues d'une même maison, et la contrainte
d'unicité `(inscription, étape)` qui empêche de recomposer ce qui est déjà en
file — donc de payer un appel pour remplacer un brouillon qu'on est peut-être
en train de relire.

**Rien n'est envoyé.** La distinction du jalon 38 ne bouge pas d'un pouce : la
composition remplit la file, on la relit, on valide à la main. Le mode
automatique reste le seul chemin qui envoie sans clic, avec son double verrou.

### Le prix, annoncé avant d'être dépensé

`GET /api/campaigns/compose` rend le **plan** et **n'appelle aucun modèle** ;
`POST` fait le travail. Un point d'entrée unique ferait payer l'affichage d'un
écran — et « aucune écriture sans clic » (jalon 8) vaut d'autant plus quand
l'écriture se facture.

L'estimation **apprend de ce qui a réellement été facturé** : la moyenne des
brouillons du modèle courant sur quatre-vingt-dix jours, lue dans le compteur du
jalon 36. Une constante cesserait d'être vraie au premier changement de prompt,
et le prompt d'Alex a grossi à chaque jalon. En dessous de trois appels mesurés,
la moyenne ne décrit rien : on retombe sur les repères mesurés au jalon 36
(3 000 jetons d'entrée, 1 500 de sortie) — et **l'écran dit laquelle des deux
sources il utilise**, parce qu'une estimation dont on ignore la provenance ne se
conteste pas.

Vérifié par test : un brouillon à ces repères, au tarif Sonnet 5, coûte
**0,021 $** — les deux centimes annoncés. Cinquante coûtent 1,05 $.

Le rendu refuse deux facilités : « 0,00 $ » n'est écrit que pour zéro brouillon
(un coût réel arrondi à zéro se lirait « gratuit », et l'on composerait sans y
penser), et en dessous du centime on écrit « moins de 0,01 $ ».

### Au-delà de dix, l'arrière-plan

**Le seuil n'est pas une préférence, c'est une limite de transport.** Un
brouillon prend quelques secondes ; cinquante dépasseraient le délai du proxy et
l'écran afficherait un échec sur un travail à moitié fait — le pire des deux
mondes, puisque les brouillons déjà écrits ont bel et bien été payés.

`composition_jobs` (migration `26_composition_jobs`) porte le compte rendu :
attendu, avancement, coût annoncé, début, fin, erreur. **Une table plutôt qu'un
compteur en mémoire** — le travail dure plus qu'une requête, l'écran qui
l'observe est rendu par le serveur, et un état gardé dans le processus
disparaîtrait au redéploiement en laissant une bannière éternelle. Ici, un
travail interrompu se voit : sa date de fin manque, ou son erreur est écrite en
clair.

L'avancement affiché est **le nombre de départs réellement en file**, pas le
compteur du journal : celui-ci n'est écrit qu'à la fin, et une barre qui saute
de 0 à 47 d'un coup n'est pas un avancement.

### Le silence est nommé, et c'est la moitié du jalon

« 0 départ » sans raison est exactement ce qui a fait chercher du côté du
planificateur. Chaque cause a désormais sa phrase, sur la confirmation :
séquence inactive (« une campagne neuve l'est toujours »), étape sans consigne
(« Alex écrirait sans savoir quoi dire »), campagne archivée, week-end, et
« personne n'est éligible ».

**Le week-end reste refusé**, y compris ici, et c'est un choix : un brouillon
écrit le samedi décrirait un état vieux de deux jours au moment de partir
(jalon 38). Mais il est désormais **dit** au lieu d'être un silence.

### Jalon 56 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `26_composition_jobs` appliquée puis
`migrate diff` **vide**), les substituts SMTP/IMAP/Anthropic avec capture du
fil — **sept sections, zéro échec** :

- **1 · le silence est nommé** : séquence inactive puis étape sans consigne, la
  cause citée à chaque fois ; 4 inscrits sur 5, la fiche sans adresse refusée
  **dès l'inscription** avec son motif ;
- **2 · le plan** : 2 brouillons annoncés (5 sélectionnés − perdue − opposition
  − sans adresse), coût et modèle affichés, **0 appel facturé** par le plan
  lui-même (47 → 47) ;
- **3 · composer** : 2 départs en file, **0 envoi**, l'angle du rôle et
  l'interdiction d'accroche entre collègues bien partis sur le fil, les deux
  inéligibles arrêtées avec leur motif en clair ;
- **4 · rejouer** : 0 recomposé, la file ne double pas ; une inscription
  ajoutée ensuite → 1 composé **pour elle seule**, les deux premiers intacts ;
- **5 · arrière-plan** : 12 brouillons → plan à 0,09 $, `background: true`, **la
  main rendue en 37 ms**, bannière « 12 départs en préparation », avancement
  observé 11 → 12, terminé sans erreur, 12 départs en file, **toujours 0
  envoi** ;
- **6 · la boucle complète** : 15 départs validés en lot et envoyés, chacun
  portant sa campagne, son étape et la boîte de la campagne ;
- **7 · le passage quotidien** : inchangé, sans portée, il balaie tout le CRM et
  ne recompose rien de déjà en file ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1072 tests**) verts.

**La garde `compose-source.test.ts`** ferme les deux façons de rater ce jalon —
une seconde boucle, et un envoi enchaîné à la composition. **Éprouvée en
réintroduisant les deux régressions exactes** : deux tests tombent en les
nommant.

**Dette payée au passage** : `campaign-card.tsx` était à 275 lignes **avant** ce
jalon, au-dessus de la limite de 250. Deux extractions (`compose-action.tsx`,
`campaign-delete.tsx`) le ramènent à **220**.

### Le défaut qui restait, et sa correction

La première version de ce jalon composait à l'**inscription** et derrière un
bouton « Composer les départs ». Elle ne composait **pas** au geste que l'on
fait réellement : « Enregistrer », dans l'éditeur d'étapes monté au sein de la
carte de campagne. On enregistrait, la file restait vide, et il fallait trouver
un second bouton — c'est-à-dire exactement le défaut que le jalon prétendait
fermer.

Deux verrous, tous deux fermés :

1. **`POST /api/sequences-email` ne composait pas.** C'est pourtant là qu'on
   écrit la consigne d'une étape, donc le moment où la campagne devient prête.
   Elle appelle désormais `composeAfterSave`, qui retrouve la campagne de la
   séquence et compose pour elle ;
2. **une campagne naissait avec une séquence `active: false`** (jalon 54), si
   bien que même la composition à l'inscription répondait « séquence inactive »
   et n'écrivait rien. Or `active` n'a jamais été le garde-fou qui protège de
   l'envoi : **ce qui protège, c'est qu'un départ ne part que sur un clic**, et
   que le mode automatique garde son double verrou et ne couvre jamais la
   première étape. Une campagne naît donc active, et la migration
   `27_campaign_sequences_active` répare les campagnes existantes — **sauf les
   archivées**, dont la séquence a été désactivée délibérément.

Ce qui empêche encore d'écrire n'importe quoi n'a pas bougé : **aucune étape
sans consigne ne compose**, et la cause est dite.

### Le clic rend la main, la file se remplit sous les yeux

Composer trois brouillons, c'est trois appels au modèle — et **trois collègues
d'une même maison se composent l'un après l'autre**, parce que la règle du jalon
53 interdit de reprendre l'accroche du voisin, ce qui suppose de l'avoir déjà
écrite. Une vingtaine de secondes de travail réel, donc.

Les attendre dans la requête ferait tourner un sablier pendant tout ce temps sur
un clic qui a déjà tout déclenché. Les gestes du parcours — « Enregistrer » et
« Inscrire » — composent donc **en arrière-plan systématiquement** : la main est
rendue immédiatement, et « Départs du jour » se rafraîchit tout seul toutes les
trois secondes tant qu'un travail tourne (`CompositionRefresh`), en affichant
« 2 sur 3 préparés » et sa barre.

Le rafraîchissement **s'arrête de lui-même** dès que la composition est finie :
une page qui clignote pendant qu'on la lit rendrait la validation en lot
désagréable.

### Le substitut mentait sur le temps

Mesurer « le temps entre le clic et les brouillons » contre un substitut qui
répond instantanément donnait **317 ms** — un chiffre qu'on ne reverrait jamais
en production. `scripts/mock-anthropic.ts` accepte désormais `MOCK_DELAY`, et la
mesure est faite à **8 s par appel**, la latence d'un vrai brouillon. C'est la
discipline du jalon 43 : le substitut doit reproduire ce que la production nous
a appris, y compris ce qui est désagréable.

### Jalon 56 — le parcours, chronométré

Par **HTTP contre le serveur standalone de production**, avec une session, donc
par les mêmes routes que le navigateur, middleware compris — appeler les
services en direct sauterait précisément l'endroit où le défaut vivait :

| Étape | Mesure |
|---|---|
| campagne créée, séquence **active** | 200 |
| trois contacts inscrits | 3 — et la cause du silence dite : « aucune étape ne porte de consigne » |
| **« Enregistrer » rend la main** | **76 ms** |
| premier brouillon lisible dans la file | **8,3 s** |
| **les trois lisibles** | **24,8 s** |
| envois | **0** |
| la page `/departs` les rend côté serveur | Nina, Paul, Rita |

Le plancher est physique : trois appels au modèle, en série parce que ce sont
des collègues d'une même maison.

### Jalon 56 — ce qui n'est pas vérifié

**Rien n'a été cliqué dans un navigateur.** Le parcours est exercé par HTTP sur
le serveur de production, ce qui couvre les routes, le middleware et le rendu
serveur de `/departs` — mais le rafraîchissement automatique de la file est du
code client, vérifié par lecture et non par une frappe.

**La composition reste séquentielle, y compris entre maisons différentes.** Elle
doit l'être **au sein** d'une maison (règle des accroches, jalon 53) ; elle
pourrait tourner en parallèle d'une maison à l'autre, ce qui diviserait
l'attente sur une campagne large. Ce n'est pas fait : le cas mesuré ici — trois
collègues d'une même société — n'en aurait tiré aucun gain, et paralléliser des
appels facturés demande son propre garde-fou.

**L'arrière-plan vit dans le processus du serveur.** Un redéploiement ou un
redémarrage de conteneur au milieu d'une composition la coupe : les brouillons
déjà écrits restent en file, le journal garde sa date de fin vide, et la
bannière le dit. Il n'y a **pas de reprise automatique** — relancer la
composition depuis la campagne compose ce qui manque, sans repayer ce qui existe.
Une vraie file de travaux persistante serait un jalon à elle seule.

**Les plafonds de débit ne s'appliquent pas à la composition**, et c'est
conforme au planificateur : ils portent sur l'**envoi** (`checkRate`), qui est le
seul geste qui touche le serveur SMTP. Composer cinquante brouillons ne
consomme aucun quota d'envoi ; les valider en fera cinquante envois, et c'est là
que le plafond mord — exactement comme le matin.

**L'estimation est un majorant quand des inscriptions sont en cours.** Sur la
confirmation d'inscription, chaque fiche cochée compte pour un brouillon ; les
garde-fous s'appliquent ensuite, et une fiche close n'appellera rien. Annoncer
plus que ce qui sera dépensé est le bon sens de l'erreur.

**Le coût réel n'est pas comparé au coût annoncé.** Le journal stocke
l'estimation, et le compteur du jalon 36 stocke la facture : le rapprochement
est possible, il n'est pas affiché.


---

## Jalon 57 — retravailler un départ, et ne plus supposer d'équipe

### Une seule surface de rédaction, rouverte depuis la file

La file proposait trois gestes — envoyer, reporter, retirer. Il en manquait un :
**ouvrir le brouillon et le retravailler avec Alex**, comme depuis une fiche
contact.

C'est le **même `ComposePanel`**, avec une prop `departureId`. Pas un second
éditeur : le fil avec Alex, la reprise depuis le texte affiché (retouches
manuelles comprises), le retour en arrière et le changement de signataire sont
ceux du jalon 34 — parce que c'est le même code. Deux surfaces de rédaction
auraient fini par ne plus se ressembler, et c'est la deuxième qu'on aurait
oublié de corriger.

Trois différences, et trois seulement :

| | Depuis une fiche | Depuis la file |
|---|---|---|
| d'où vient le texte | Alex l'écrit (un appel) | **la file** — `mode: "departure"`, aucun appel |
| bouton principal | « Envoyer maintenant » | **« Enregistrer le brouillon »** |
| après | le message part | la ligne garde sa place, en attente |

**Rouvrir ne coûte rien.** Le brouillon a déjà été composé et payé : le
recomposer à l'ouverture écrirait un second texte et effacerait celui qu'on
venait relire. Vérifié : 90 appels facturés avant l'ouverture, 90 après.

**Enregistrer n'envoie pas**, et ne se contourne pas : le schéma d'enregistrement
est distinct de celui des trois décisions, parce qu'un `action: "send"` mal formé
qui traînerait un objet et un corps ferait partir un message qu'on voulait
seulement ranger. C'est la distinction du jalon 38, tenue jusque dans la forme
de la requête.

**Une recomposition ne l'écrase pas** : la contrainte d'unicité
`(inscription, étape)` qui empêche de composer deux fois protège aussi le
travail fait à la main. Un départ qui n'est plus en attente refuse d'être
rouvert **et** modifié, en disant son état.

### Le discours ne suppose plus d'équipe

« Votre équipe doit certainement gérer un volume important de questions
récurrentes » se lit faux à une marque de trois personnes — et la moitié du
vivier en est une. Le prospect sait qu'il n'a pas d'équipe : la phrase le lui
rappelle, et le message est mort à la première ligne.

**L'erreur n'est pas symétrique**, et c'est ce qui décide du défaut : écrire à
une grande marque sans mentionner son équipe ne coûte rien ; l'inverse coûte le
prospect. En l'absence d'information — **le cas de toutes les fiches
aujourd'hui**, `Company.size` étant vide partout — c'est donc la formulation
sans supposition qui s'applique.

Trois endroits du discours présumaient du personnel ; les trois sont corrigés :

| Où | Avant | Après |
|---|---|---|
| ciblage (`COMPANY_CONTEXT`) | « dont **l'équipe gère un volume important** » | « de toutes tailles, et **le plus souvent petites** […] ne présume jamais qu'un prospect a une équipe » |
| règle de rédaction | ordonnait d'écrire « votre équipe doit gérer un volume important » | nomme la **répétition** des mêmes questions, et interdit nommément l'ancienne formule |
| mail de référence, §2 | « Votre équipe doit certainement gérer… » | « Sur votre site, une part des questions se ressemble d'un visiteur à l'autre — composition, délais, choix du produit — et chacune demande pourtant une réponse. » |

Le nouveau paragraphe a été **approuvé avant d'être câblé**, comme le DM du
jalon 48 et la fiche sans personne nommée du jalon 50.

**« Soulage l'équipe quand l'activité grimpe » est introuvable dans le dépôt** —
ni dans les prompts, ni ailleurs. C'est vraisemblablement une formulation
produite par le modèle sous l'ancienne consigne, pas une phrase écrite : elle
disparaît avec la consigne qui l'engendrait.

### La permission vient de la note, jamais de la taille

Décision prise par le propriétaire du produit : la formulation « équipe » n'est
autorisée **que lorsqu'il l'écrit dans la note pour Alex**. Ni le champ
`size` de la fiche société, ni une déduction du modèle.

C'est défendable au-delà de la préférence : `size` est un champ libre rempli au
fil de l'eau, et rien ne garantit qu'il décrive encore l'entreprise ; une
déduction, elle, est exactement le pari qu'on refuse. La taille est donc **dite**
au modèle comme un fait du dossier — sous ses deux formes, « NON RENSEIGNÉE »
comprise — accompagnée de la mention qu'elle **n'autorise rien**.

`noteAllowsTeam()` est volontairement étroite : quelques formules qui ne peuvent
pas apparaître par hasard dans une note de prospection. Une reconnaissance large
autoriserait la mention sur « j'ai vu leur équipe au salon », qui n'affirme rien
sur le service client — et un test fixe précisément ce cas.

La consigne est émise **dans les deux sens**, comme le DM du jalon 48 et l'angle
de rôle du jalon 53 : une absence de ligne se lit comme une absence
d'information, une ligne qui dit « non » se lit comme une règle.

### Jalon 57 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (aucune migration — `migrate diff` **vide**) et le
substitut qui capte ce qui part réellement sur le fil, **cinq sections, zéro
échec** :

- **1 · le discours** : taille inconnue → interdiction explicite, autorisation
  absente ; « 3 personnes » → idem ; « 250 personnes » **avec la note qui
  l'affirme** → autorisation, interdiction absente. La taille figure au dossier
  dans les trois cas, et l'ancienne formule n'est plus donnée en exemple ;
- **2 · rouvrir** : le texte rendu est **celui de la file**, destinataire et
  signataire (la boîte de la campagne) corrects, **0 appel facturé** (90 → 90) ;
- **3 · enregistrer** : la file porte le texte retravaillé, la ligne reste
  `pending`, **0 envoi** ;
- **4 · recomposer** : « personne n'est éligible », le brouillon retravaillé
  **intact** ;
- **5 · un départ envoyé** refuse d'être rouvert et modifié, en nommant son état ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1084 tests**) verts.

`tests/team-assumption-source.test.ts` fixe que **chaque mention restante
d'« équipe » dans le discours est une interdiction** — un test qui compte les
lignes plutôt qu'une chaîne, pour qu'une reformulation ne le rende pas vert par
accident.

### Jalon 57 — ce qui n'est pas vérifié

**Rien n'a été cliqué dans un navigateur.** Le panneau rouvert depuis la file,
son fil et son bouton d'enregistrement sont vérifiés par leurs services et par
le typage, pas par une frappe.

**La qualité du nouveau paragraphe n'est pas établie.** Le substitut prouve que
la bonne consigne part et que l'ancienne a disparu ; qu'Alex écrive un meilleur
deuxième paragraphe se jugera sur les trois premiers brouillons réels.

**`noteAllowsTeam` reconnaît des formules, pas du sens.** Écrire « ils ont une
grosse équipe » dans la note n'autorisera pas la mention : il faut l'une des
tournures reconnues. C'est le prix d'une règle étroite, et le choix est assumé
dans ce sens-là.


---

## Jalon 58 — le nouveau discours, et le tiret long banni

### Ce qui change dans le pitch

| | Avant | Après |
|---|---|---|
| l'offre | « **Personal Shoppers** IA **premium** » | « un **conseiller de vente** » |
| ce qu'il fait | guide vers l'achat et « écoule efficacement les stocks » | répond à toute heure, oriente vers le bon produit, accompagne jusqu'à l'achat |
| l'accroche | « en observant le développement de… » | **le fait** : 69 % des visiteurs partent après une question restée sans réponse |
| la forme | six paragraphes | **quatre** |
| Instagram | un paragraphe dans la référence | **hors de la forme**, conditionnel comme au jalon 48 |

**« Écouler les stocks » est du vocabulaire de fournisseur.** Le prospect ne
pense pas « j'ai du stock qui dort », il pense « je perds des ventes ». Le mot
disparaît du discours.

**L'accroche est le fait, pas la marque.** Une petite marque ne se pense pas
débordée : elle pense qu'elle répond à tout. Ce qui la touche est la vente
qu'elle n'a jamais vue passer. Ouvrir sur « en observant le développement de
Linaé » est une politesse, pas un argument, et elle repousse la seule phrase qui
retient l'attention. La marque et son site reviennent au troisième paragraphe,
là où l'on montre ce qu'on a préparé pour eux.

**Le paragraphe Instagram sort de la référence, pas du produit.** La règle du
jalon 48 est intacte : quand un DM est consigné, Alex le mentionne ; quand il
n'y en a pas, l'interdiction est explicite. Ce qui change, c'est qu'il n'est
plus dans la forme montrée en exemple, donc il n'est plus inséré par imitation.

### Le tiret long : une garantie, pas une consigne

Le tiret cadratin est devenu un marqueur reconnaissable de texte engendré, et
nos destinataires lisent beaucoup de démarchage. Celui qui le repère cesse de
lire le message et commence à juger l'expéditeur.

Trois verrous, et le troisième est celui qui compte :

1. **la consigne** dans le prompt, qui **nomme les caractères sans les
   montrer** : un prompt qui interdit le tiret tout en en contenant apprend au
   modèle à en écrire ;
2. **la source** : les onze fichiers dont le texte atteint le modèle en sont
   nettoyés, commentaires compris. Un tiret dans un commentaire ne part pas sur
   le fil, mais il finit recopié dans la chaîne voisine à la prochaine retouche ;
3. **le retour** : `stripDashes` s'applique à l'objet **et** au corps de chaque
   brouillon, au même endroit que la signature depuis le jalon 33. Une consigne
   de prompt est une intention ; ici on veut une garantie.

Le **trait d'union ordinaire n'est pas concerné** : « e-commerce » et
« dites-le-moi » s'écrivent ainsi, et les confondre abîmerait l'orthographe pour
rien. La consigne le dit explicitement.

**Le substitut a appris à désobéir.** `MOCK_DIRTY=1` lui fait rendre un
brouillon avec des tirets longs dans l'objet et dans le corps : un substitut qui
n'en produit jamais ne prouve rien du second garde-fou. C'est la discipline du
jalon 43, où il avait déjà fallu lui apprendre à mentir comme la production.

### Trois dégâts causés par ma propre correction, et comment ils ont été pris

Le nettoyage a été fait par expression régulière sur les fichiers, et **il a
cassé du code trois fois** :

| Ce qui a été abîmé | Ce qui l'a rattrapé |
|---|---|
| `[...AGENT_NAMES, ...extra]` privé de sa virgule | `tsc` |
| deux `...(condition ? {} : {…})` de Prisma, idem | `tsc` |
| deux classes de caractères `[-–—]` dans les expressions de `repairGreeting` | la suite de tests |

La règle `,\s*[.!?]` destinée à recoller « mot, . » mangeait la virgule devant
un `...`. Les trois sont réparés, et les deux expressions régulières portent
désormais `\u2013` et `\u2014` plutôt que les caractères eux-mêmes : elles
décrivent la même chose, et le fichier reste exempt de tiret. **Aucun de ces
dégâts n'était visible à la lecture du diff** ; c'est la vérification qui les a
nommés, et c'est la raison pour laquelle elle passe avant l'annonce.

### Jalon 58 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (aucune migration, `migrate diff` **vide**) et le
substitut qui capte ce qui part réellement sur le fil, **cinq sections, zéro
échec** :

- **1 · le discours** : « conseiller de vente » présent ; « Personal Shopper »,
  « premium » et « écoule … les stocks » **absents** ;
- **2 · la forme** : le fait 69 % dans la consigne, « Quatre paragraphes, pas
  six », l'ancienne ouverture n'est plus prescrite, le mail de référence est le
  nouveau, et il ne porte plus de paragraphe Instagram ;
- **3 · les tirets** : **0 tiret long dans la requête complète** partie sur le
  fil, consigne d'interdiction présente ;
- **4 · le DM** : la fiche avec DM reçoit l'instruction de le mentionner, celle
  sans DM l'interdiction explicite. Jalon 48 intact ;
- **5 · la garantie** : substitut réglé pour désobéir → **0 brouillon** portant
  un tiret long en file, l'objet fautif « … , relance » ayant été réparé ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1099 tests**) verts.

`tests/em-dash-source.test.ts` fixe les deux moitiés : rien de ce qu'Alex lit
n'en contient (neuf constantes plus onze fichiers), et l'enforcement est câblé
sur l'objet comme sur le corps.

### Jalon 58 — ce qui n'est pas vérifié

**Aucun appel Anthropic réel.** Le substitut prouve que le nouveau discours part
et que l'ancien a disparu ; que le modèle écrive effectivement quatre
paragraphes ouvrant sur le fait relève du modèle, et se jugera sur les trois
premiers brouillons.

**Le chiffre de 69 % n'est pas sourcé dans le dépôt.** Il vient du propriétaire
du produit et est repris tel quel. S'il doit être défendu devant un prospect qui
le conteste, la source est à ajouter.

**Les prompts des sept autres agents gardent leurs tirets longs.** Le nettoyage
porte sur ce qu'Alex lit, qui est le périmètre demandé : Sabrina et les autres
ne rédigent pas de courriel de prospection, et leurs constats ne partent chez
personne.


---

## Jalon 59 — depuis quand une fiche est dans le vivier

### Ce que `createdAt` contient réellement, vérifié plutôt que supposé

La question posée avant tout le reste, et sa réponse tient au code de l'import.
`importContacts()` **ne renseigne jamais `createdAt`** : c'est `@default(now())`
qui l'écrit, à l'instant de l'import. Les 122 fiches entrées d'un même collage
portent donc **le même horodatage à la milliseconde près**, et non la date à
laquelle elles ont été trouvées.

Mesuré sur une base reconstituée à cette image (122 importées d'un coup, 19
ajoutées une par une depuis) :

```
141 fiches, 20 instants distincts, 18 jours distincts
plus gros lot au même instant : 122 fiches à 2026-07-11T09:14:32.118Z
```

**Les deux populations sont donc parfaitement distinguables** — pas parce que le
CRM porte un marqueur, mais parce qu'un lot de cent vingt-deux fiches à la même
milliseconde ne peut être qu'un import. Ce que le filtre en fait :

- **les préréglages restent utiles tels quels** : « aujourd'hui », « cette
  semaine » et « ce mois » ne peuvent pas ramener le lot, qui est plus vieux
  qu'eux. C'est précisément la question qu'on se pose le matin — ce que j'ai
  ajouté depuis, pas ce que j'ai importé une fois ;
- **« 30 derniers jours » et la plage libre peuvent le ramener**, et c'est
  correct : ces fiches ont bien été ajoutées ce jour-là ;
- **la semaine de l'import se voit d'un coup d'œil sur /performance** — une
  barre à 123 au milieu de barres à 1 ou 2. L'écran ne la masque pas et n'a pas
  à la masquer : c'est un fait de sourcing, et c'est le seul graphique où l'on
  distingue « j'alimente » de « j'ai importé une fois ».

**Ce que je n'ai pas fait, et pourquoi.** Aucune colonne « source de création »,
aucune exclusion du lot d'import. Les deux exigeraient d'écrire en base une
information qu'on peut lire, et une exclusion codée en dur sur un instant
choisi cesserait d'être vraie au prochain import. Si le lot devient gênant, la
réponse la moins chère est un filtre de colonne sur `source` (« Import »), qui
existe déjà — les fiches importées le portent.

**Les chiffres ci-dessus viennent de la base de vérification, pas de la vôtre.**
Le fait de code — l'import ne pose pas `createdAt` — vaut pour les deux ; la
répartition exacte de production se lira sur `/performance` au premier
affichage.

### Semaine et mois calendaires, trente jours glissants

`lib/domain/added-window.ts`, pur et testé, porte les quatre préréglages et la
plage libre. Trois décisions y sont écrites :

- **« cette semaine » part du lundi**, pas de sept jours en arrière : c'est
  ainsi qu'on juge sa semaine de travail, et sept jours glissants feraient d'un
  lundi matin le bilan de la semaine passée. « Les 30 derniers jours » reste
  glissant, parce que c'est une mesure de rythme ;
- **la borne haute est exclue**, au lendemain à minuit. Une borne inclusive
  posée à 23:59:59 laisse passer entre les mailles une fiche créée à
  23:59:59,400 : le jour a des millisecondes ;
- **l'horloge est injectée** — sans quoi « cette semaine » serait vrai six jours
  sur sept dans les tests.

Une plage à une seule borne reste valide (« depuis le 1er mars » est une
question légitime), deux bornes inversées sont remises dans l'ordre plutôt que
refusées, et **un préréglage l'emporte sur une plage** : deux fenêtres actives à
la fois ne décrivent aucune question.

### La puce dit ce qu'elle cache, et porte le nombre qui déclenche

Une seule puce « Ajoutés » ouvre les quatre préréglages et la plage libre, comme
la puce Instagram du jalon 49 replie ses quatre lectures. Active, elle porte son
libellé court et reste en surbrillance — **y compris pour une plage écrite à la
main dans l'URL** (`describeWindow`), parce qu'une liste filtrée dont rien ne
nomme le filtre est un écran qui ment (jalon 31). Hors sélection, elle porte le
nombre de la semaine, comme « À relancer » porte le sien.

La colonne « Ajouté le » rejoint le sélecteur « Colonnes », **hors des six par
défaut**, triable dans les deux sens en SQL — `createdAt` est une vraie colonne,
donc le tri est réel et non promis.

### Un défaut d'affichage antérieur, trouvé en dessinant une grande barre

`BarChart` calculait `y = height - barHeight - 5` pour l'étiquette de valeur : la
barre la plus haute occupant toute la hauteur, **son étiquette tombait à `y = -5`,
hors du `viewBox`**. Le seul chiffre systématiquement illisible était donc celui
du maximum, sur tous les graphiques en barres du produit depuis le jalon 5. Il
ne s'était jamais vu parce que les valeurs y sont proches ; une barre à 123 au
milieu de barres à 1 l'a rendu évident. Corrigé par une marge haute de 14 px
dans le `viewBox`.

### Jalon 59 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration,
`createdAt` existant depuis le jalon 0) et le serveur standalone de production,
par le **chemin réel de la page** (URL → schéma Zod → filtres → `listContacts`) :

- **1 · « cette semaine »** : fenêtre du lundi 07/09 inclus au 11/09 exclu,
  **SQL 5 = liste rendue 5**, 0 fiche hors fenêtre dans la liste ;
- **2 · plage libre** : `?du=2026-08-21&au=2026-08-31` → SQL 3 = rendu 3 =
  **rechargé 3** (même URL, second rendu serveur) ; croisée avec
  `lifecycle=Lead` → SQL 1 = rendu 1 ;
- **3 · tri** : 141 lignes croissant et décroissant, ordre vérifié ligne à
  ligne, **premier croissant = dernier décroissant** ; croisé avec
  `lifecycle=Lead` → 36 = 36 ;
- **4 · /performance** : 12 semaines rendues, **total de la série 140 = SQL sur
  la même fenêtre**, dernière barre = « cette semaine » = 5 ; rendu **côté
  serveur** vérifié sur le HTML (« Fiches ajoutées — 140 sur 12 semaines · dont
  5 cette semaine », les douze étiquettes, le lien vers la semaine) ;
- **5 · le rapport `createdAt`** : ci-dessus ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1111 tests**) verts.

### Jalon 59 — ce qui n'est pas fait

**Le menu de la puce n'a pas été cliqué dans un navigateur**, comme tous les
composants clients de ce projet : les deux champs de date, « Appliquer la plage »
et l'exclusion mutuelle préréglage/plage sont vérifiés par leurs paramètres
d'URL et par le rendu serveur, pas par une frappe.

**La série de /performance suit le propriétaire sélectionné**, comme le reste de
l'écran ; le compteur de la puce de `/contacts`, lui, porte sur tout le
portefeuille (règle du jalon 6). Les deux nombres peuvent donc différer, et ils
répondent à deux questions différentes.

**Aucune exclusion de cycle de vie dans la série** : une fiche ajoutée puis
perdue a bel et bien été ajoutée cette semaine-là. C'est une mesure de sourcing,
pas une file de travail.


---

## Jalon 60 — une puce qui s'ouvrait dans le vide, et le trou qui l'a laissée passer

### Reproduit d'abord, dans un vrai navigateur

Signalé : « la puce Ajoutés ne fait rien ». Reproduit à l'identique avant tout
correctif, contre le serveur standalone de production et un Chromium piloté, en
suivant l'ordre demandé :

| Question | Réponse mesurée |
|---|---|
| La puce est-elle à l'écran ? | **Non.** Boîte de 0×0 : un ancêtre à `display: none` |
| Le menu s'ouvre-t-il au clic ? | Oui — `aria-expanded` passe à `true` |
| Le menu est-il visible ? | **Non.** Boîte de 288×305 px, et `elementFromPoint` en son centre rend un `<td>` du tableau : le panneau est **rogné** |
| Le préréglage atteint-il l'URL ? | Oui, quand on parvient à cliquer une entrée qu'on ne voit pas |
| Erreurs de console, hydratation ? | **Aucune** |

### La cause, avec sa ligne

`components/contacts/contacts-chips.tsx:171` (jalon 59) rendait `<AddedChip>`
**dans le groupe segmenté de la seconde rangée** — le `<div>` de la ligne 108,
qui porte `${expanded ? "flex" : "hidden"} overflow-hidden`. Deux conséquences,
et la seconde est celle qui rendait le contrôle mort :

1. **`hidden`** : la puce n'apparaît qu'après avoir déplié « Filtres » ;
2. **`overflow-hidden`** : le panneau d'une puce à menu est posé en `absolute`
   sous son bouton, donc **entièrement hors du groupe**. Il s'ouvrait, et le
   conteneur le découpait. Le bouton répondait, l'écran ne montrait rien.

La puce Instagram du jalon 49 n'a jamais eu ce défaut parce qu'elle vit sur la
première rangée, qui ne rogne rien. C'est là que « Ajoutés » va, et pour la même
raison de fond : « qu'est-ce que j'ai ajouté cette semaine » est une lecture
quotidienne, pas un filtre qu'on ouvre une fois sur dix.

**La règle qui en sort** : une puce à menu ne peut pas vivre dans un conteneur
qui rogne.

### Le trou dans la vérification, et ce qu'il a coûté

Deux fois de suite un contrôle a été livré qui **rend correctement et ne fait
rien** : le rafraîchissement de la file des départs (jalon 56) et cette puce.
Les deux ont été « vérifiés par lecture », faute de DOM dans la suite. Une
lecture de code ne peut pas voir un `overflow-hidden` posé deux composants plus
haut.

`tests/e2e/` ouvre donc la page dans un navigateur et clique.

**L'assertion qui manquait n'est pas « le menu est-il visible ».** Mesuré sur le
défaut lui-même, avec la seconde rangée dépliée :

```
Playwright isVisible() : true
elementFromPoint       : TD.border-b border-line-2 …   reachable: false
```

`isVisible()` ne regarde que l'élément — ni `display`, ni `visibility`, ni une
boîte nulle, mais **pas un ancêtre qui le rogne**. Un test écrit avec lui aurait
été **vert sur le défaut**. `reachable()` (`tests/e2e/browser.ts`) interroge donc
le document au centre de l'élément : ce que le navigateur y trouve est ce qu'un
doigt y toucherait. C'est la technique du bouton ✕ du jalon 28, promue en règle.

### Ce que ça coûte, et ce que ça ne coûte pas

| | Choix | Pourquoi |
|---|---|---|
| Paquet | `playwright-core`, **pas** `playwright` | `playwright` télécharge un navigateur à l'installation ; `playwright-core` non. `npm ci` de la chaîne de déploiement ne doit pas se mettre à tirer cent mégaoctets de Chromium pour construire une application Next. Coût réel : **14 Mo** de dépendance de développement, **zéro** téléchargement |
| Navigateur | celui de l'environnement (`PLAYWRIGHT_BROWSERS_PATH`, ou `E2E_CHROMIUM`) | La révision est lue dans le dossier, jamais écrite en dur : `chromium-1194` cesserait d'exister à la mise à jour suivante |
| Lancement | `npm run e2e`, **séparé de `npm test`** | Ils demandent un serveur debout, une base peuplée et un navigateur. Les mettre dans `npm test` en ferait un test qu'on cesse d'exécuter |
| Sans navigateur | la suite **s'ignore en le disant** | Un rouge sur une machine sans Chromium apprend à ignorer le rouge |
| Durée | **2,7 s** pour six tests | Le prix est le `npm run build` préalable, pas les tests |

```bash
npm run build && npm start &          # ou E2E_BASE_URL=…
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers E2E_PASSWORD=… npm run e2e
```

### Jalon 60 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide**), le serveur standalone de
production et un Chromium piloté :

- **le défaut reproduit** avant correction, et les quatre questions tranchées
  ci-dessus ;
- **la garde prouvée sur le défaut exact** : `<AddedChip>` remise dans la
  seconde rangée → **4 tests sur 6 tombent**, le premier sur « la puce se voit
  sans avoir à déplier quoi que ce soit » ;
- **après correction** : puce de 186×33 px à `y=98` sur la première rangée, menu
  **atteignable**, préréglage dans l'URL, plage libre soumise
  (`?du=2026-03-01&au=2026-03-31`, sans `ajout`), puce Instagram toujours
  fonctionnelle ;
- **à 390×844** : puce de 186×**44** px, menu atteignable, **0 débordement
  horizontal**, **0 erreur console** aux deux tailles ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1111 tests**) et
  `npm run e2e` (**6 tests**) verts.

### Jalon 60 — ce qui n'est pas fait

**Le reste du produit n'est pas couvert au clic.** Six tests couvrent les deux
puces à menu de `/contacts` — le défaut signalé et son voisin le plus proche.
Les autres contrôles clients restent vérifiés comme avant. Les candidats
suivants, par ordre de dégât potentiel : le rafraîchissement de « Départs du
jour » (jalon 56, l'autre contrôle mort), la sélection à la case des campagnes
(jalon 55, jamais cliquée), le panneau de rédaction et la file d'accueil.

**Ces tests demandent une base peuplée.** Ils n'écrivent rien et ne dépendent
d'aucun volume — les assertions portent sur l'URL et sur ce qui est atteignable,
pas sur un nombre de lignes — mais une base vide masquerait le tableau qu'ils
attendent au chargement.

**Ils ne tournent pas tout seuls.** Aucun workflow ne les déclenche : ils se
lancent à la main à la fin d'un jalon, comme les recettes. Les brancher sur
GitHub Actions demanderait un PostgreSQL de test et un build à chaque poussée —
c'est un jalon à soi seul, et il vaudra d'être fait quand la couverture au clic
dépassera deux écrans.


---

## Jalon 61 — supprimer une campagne qui a envoyé, si on le tape

### La règle du jalon 55 n'était pas fausse, elle était absolue

« Un envoi interdit la suppression » protégeait d'un clic distrait sur des
chiffres qu'on ne recalcule jamais soi-même. Mais l'absolu n'était plus la
bonne réponse à une demande explicite : reprendre une campagne en main quitte
à en perdre l'histoire. La porte reste fermée par défaut — elle s'ouvre
maintenant sur un second geste, pas sur un premier.

### `email_sends` : supprimé, pas détaché

Deux options existaient pour ce que devient une ligne d'envoi : l'effacer, ou
la garder avec `campaignId: ""`, comptée dans les totaux globaux comme un
envoi « sans campagne ». La seconde était la plus simple à écrire et la plus
trompeuse à lire — un chiffre qui reste dans `/emails` sans qu'on sache jamais
dire d'où il vient est une trace muette, pas une donnée.

**Retenu : la suppression, jusqu'au bout.** C'est aussi la seule cohérente
avec le refus initial : un envoi qui bloquait la suppression parce qu'il est
un fait mesuré ne peut pas, une fois le passage forcé, devenir un fait à
moitié mesuré. `EmailSend.sequenceId`/`campaignId` ne sont **pas** des clés
étrangères (valeurs copiées, jalon 54) — rien ne les efface toutes seules, la
suppression les cible explicitement, avant la séquence. Les cascades de la
base font le reste : `email_open_hits` suit en `CASCADE`, `email_replies`
perd seulement son `emailSendId` (`SET NULL`) — une détection de réponse
n'est pas un enfant de l'envoi, elle garde son contact et sa date.

### Ce qui ne bouge jamais : les contacts, et leurs interactions

`SequenceEnrollment.contactId` n'est jamais touché — supprimer la séquence
efface l'inscription, pas la fiche qu'elle désignait. Et **les interactions
consignées (`Activity`) ne sont supprimées par aucun chemin de ce jalon** :
c'est l'historique de la personne, pas un sous-produit de la campagne.

**Conséquence à connaître, et non résolue en silence : `/performance` ne
change pas.** Son volume par canal compte les `Activity` de type `email` —
qui existent indépendamment de toute campagne, y compris celle d'un envoi de
campagne (chaque envoi consigne une interaction depuis le jalon 32) — et
`/performance` n'a **jamais** su distinguer une interaction venue d'une
campagne d'un email écrit à la main : il n'existe aucun champ pour le faire.
Supprimer ces lignes pour faire baisser ce chiffre reviendrait à effacer ce
qu'une personne a réellement écrit sur une fiche — exactement ce que ce
jalon promet de ne jamais faire. `/emails` (funnel, journal, par signataire)
et l'entonnoir de la campagne, eux, sont **entièrement** dérivés d'`EmailSend`
et disparaissent immédiatement, comme demandé.

### La friction : taper le nom, revérifié des deux côtés

`lib/domain/campaign-deletion.ts` (pur, testé) porte les deux fonctions
utilisées par l'écran **et** par le serveur — une seule définition de
« est-ce que ça confirme ». `nameConfirms()` exige une correspondance exacte,
espaces de bord mis à part : ni casse ni accents assouplis, parce que la
friction demandée perdrait son sens si elle s'assouplissait. Le serveur la
revérifie dans `deleteCampaign(id, confirmName)` avant d'écrire quoi que ce
soit — un client altéré ne peut pas sauter la saisie en n'envoyant que la
requête.

`historyLossWarning()` compose la phrase exacte demandée, avec les comptes de
l'entonnoir déjà affiché sur la carte (`messages`/`opened`/`replied`) — aucun
second calcul qui pourrait diverger de ce que l'écran montrait la seconde
d'avant.

À l'écran (`campaign-delete.tsx`) : « Supprimer » simple **n'apparaît pas**
sur une campagne qui a envoyé — un bouton qui échouerait neuf fois sur dix se
lit comme cassé (jalon 26). À la place, le compte qui bloque et un second
geste moins visible, « Supprimer quand même », dont la confirmation nomme les
comptes exacts et n'active « Supprimer définitivement, avec son historique »
que lorsque le nom tapé correspond au caractère près.

### Un rouge qui n'existait nulle part

En construisant le bouton de confirmation, mesuré plutôt que supposé : `bg-
danger` produisait `background-color: rgba(0, 0, 0, 0)` — **transparent**.
`--color-danger` n'était défini dans **aucune** feuille de style du projet,
alors que `bg-danger`/`text-danger`/`border-danger` étaient utilisés dans
**douze fichiers** depuis le jalon 32 (bannières d'erreur, boutons de
suppression du jalon 47 et du jalon 55, bandeau de composition du jalon 56).
Tailwind ne lève pas sur une classe qu'il ne sait pas résoudre — il ne génère
simplement rien, et un bouton « dangereux » sans couleur passe inaperçu
précisément parce qu'il reste lisible et cliquable. C'est la même famille de
défaut que la puce du jalon 60, cette fois cosmétique plutôt que
fonctionnelle.

Ajouté à `app/globals.css` : `--color-danger: #c2382a`, même teinte que
`--color-pulse` (l'alerte rouge déjà établie) mais **assombrie pour de vrai**,
pas cosmétiquement — `pulse` ne tient que 3.7:1 en blanc plein, sous le seuil
AA, et c'est exactement l'usage (texte blanc sur fond plein) ; `danger` tient
5.4:1. Un seul jeton corrige les douze emplacements d'un coup — c'est la
règle du projet, « on change la couleur à la source, jamais classe par
classe », qui n'avait simplement jamais eu l'occasion de s'appliquer ici.

### La garde : un test qui clique, pas qui lit

`tests/e2e/campaign-delete.e2e.ts` — septième test de la famille ouverte au
jalon 60, cette fois sur une campagne qui a réellement envoyé (semée par
Prisma directement, hors du service, pour ne dépendre d'aucun état laissé par
un jalon précédent). Il vérifie, au clic réel : le bouton simple absent, le
panneau forcé atteignable (`reachable()`, pas `isVisible()`), le bouton
désactivé avant saisie, **toujours désactivé** avec une casse différente, activé
avec le nom exact, et — le point qui a trouvé le défaut de couleur —
`backgroundColor` du bouton actif n'est **pas** transparent. Puis le clic
réel, la disparition de la carte, l'absence d'erreur console, et la vérité en
base : campagne partie, contact intact.

**Éprouvé en retirant `--color-danger`** : un seul test tombe, exactement
celui qui compare la couleur, avec le message qui nomme la valeur fautive.
Les six autres passent — disabled/enabled fonctionnent très bien sans
couleur, ce qui est exactement pourquoi ce défaut ne se serait jamais vu à la
lecture du code ni à un test qui n'aurait vérifié que `disabled`.

### Jalon 61 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration, tout
le mécanisme tient sur les contraintes déjà posées aux jalons 54, 18 et 19),
le service, la route HTTP réelle et un navigateur piloté :

- **1 · confirmation exacte** : sans nom → refusé ; casse différente → refusé,
  la campagne toujours en base après les deux refus ; texte de confirmation
  produit mot pour mot : « 3 messages envoyés, 3 ouvertures, 1 réponse seront
  retirés de vos statistiques. Les contacts et leur historique de conversation
  restent intacts — seule l'attribution à cette campagne disparaît. » ;
- **2 · les contacts, intacts** : 3 fiches avant, 3 après, cycle de vie et
  adresse inchangés, **5 interactions avant, 5 après** — aucune perdue ;
- **3 · /emails et /performance reflètent le retrait** : `/emails` total
  passe à 0 immédiatement ; `/performance` (canal email) **ne bouge pas** —
  4 interactions, la même chose qu'avant, pour la raison documentée plus haut ;
- **4 · campagne vide** : `deletable: true`, supprimée sans taper de nom,
  comme avant ;
- **5 · archiver** : campagne et envoi toujours en base après, `archivedAt`
  posé — inchangé ;
- **HTTP réel** (serveur standalone) : sans `confirmName` → 400 ; nom faux →
  400 ; nom exact **avec guillemets français dans le nom lui-même**,
  correctement encodé → 200, campagne absente de la base ensuite ;
- **navigateur, au clic** : bouton simple absent, panneau forcé atteignable,
  bouton désactivé → toujours désactivé casse différente → activé nom exact
  **en rouge réel** (`rgb(194, 56, 42)`, pas transparent) → clic → carte
  disparue, 0 erreur console, campagne et envois absents de la base, contact
  toujours là ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1121 tests**) et
  `npm run e2e` (**13 tests**, les deux fichiers) verts.

### Jalon 61 — ce qui n'est pas fait

**`/performance` ne distingue toujours pas une interaction de campagne d'une
interaction écrite à la main** — ni avant ce jalon, ni après. Le corriger
demanderait de porter l'origine de l'envoi jusque sur l'`Activity` elle-même
(un champ `campaignId` sur `Activity`, ou une jointure structurée), ce qui
dépasse ce qu'un jalon de suppression doit décider seul : c'est un changement
de modèle, pas un effet de bord.

**Les détections de réponse orphelines (`email_replies.emailSendId = null`)
ne sont visibles nulle part à l'écran.** Elles survivent en base avec leur
contact et leur date, mais aucun panneau ne les liste séparément — ce n'était
pas plus visible avant ce jalon (elles n'existaient simplement pas encore
dans ce cas), et ce n'est pas non plus ce qui a été demandé.

**Les onze autres emplacements `bg-danger`/`text-danger`/`border-danger`
n'ont pas été revus un par un.** Le jeton corrige leur couleur à la source ;
personne n'a vérifié que chacun des douze est par ailleurs bien composé
(taille, contraste du texte porté par-dessus). C'est un jeton qui répare, pas
un audit visuel complet.


---

## Jalon 62 — une signature HTML, avec logo

### Quatre lignes, et une adresse qui ne peut pas mentir

La signature passe de deux lignes à quatre : nom, titre, téléphone, adresse.
Trois viennent de la boîte (`signName`, `signTitle`, **`signPhone`** ajouté ici) ;
la quatrième est **`smtpFrom`**, et elle n'a délibérément pas de champ à elle.
Une adresse de signature saisie à part finirait par contredire l'en-tête `From`
du message, et une signature qui affiche autre chose que l'expéditeur réel est
exactement ce qu'un filtre — et un lecteur attentif — traite comme une
usurpation. Un champ vide **retire sa ligne**, il n'en laisse pas une blanche :
une boîte sans téléphone signe sur trois lignes.

`signatureBlock()` reste la source unique : le prompt l'annonce, la garde
l'impose, le test le vérifie.

### Un seul logo, partagé — et pourquoi

**Partagé par toutes les boîtes, pas un par signataire.** C'est la marque de
l'entreprise, pas celle d'une personne : deux collègues signant de deux logos
différents se liraient comme deux sociétés, et le jour où la marque change il
faudrait penser à le remplacer autant de fois qu'il y a de boîtes. Ce qui varie
légitimement d'un signataire à l'autre — nom, titre, téléphone, adresse — est
déjà porté par la boîte.

En base (`mail_logo`, table séparée) et non sur disque, pour la raison du
jalon 15 : le disque du conteneur est effacé à chaque déploiement. Table à part
des réglages parce que les octets n'ont aucune raison de voyager à chaque
lecture de configuration d'envoi — `readLogoSummary()` rend la version, la
largeur et le poids, jamais l'image.

### Délivrabilité : ce qui est tenu, et par quoi

| Exigence | Comment |
|---|---|
| Servi depuis notre domaine | `/api/logo/[version]`, composé depuis `publicBaseUrl()` (jalon 37). **Aucune adresse publique connue = aucun logo** : une URL devinée produirait une image cassée dans chaque message |
| Petit | Réencodé par `sharp` à **120 px** de large, PNG palettisé. Mesuré : 11,1 Ko et 512 px à l'entrée, **1,7 Ko et 120 px** en sortie |
| Aucun suivi, aucun lien | `<img>` nu, sans ancre autour et sans paramètre dans l'adresse. La route **ne compte rien** — mesurer les chargements d'un logo reviendrait à pister les ouvertures par une seconde porte, sans l'avoir dit |
| Ratio texte / image | `logoWeight()`, pur et testé, avertit **à l'écran** au lieu de laisser partir |

**La route est publique**, comme le pixel du jalon 37 : c'est le client de
messagerie du destinataire qui la charge, sans cookie. Elle sert un seul
fichier, le même pour tout le monde, celui qu'on a soi-même mis dans ses
messages ; une version inconnue rend 404 plutôt que l'image courante, donc elle
n'énumère rien. Le **téléversement**, lui, reste privé. La garde
`auth-routes.test.ts` a exigé que cette ouverture soit déclarée une par une
avec sa raison — elle a fait exactement son travail.

### Le seuil d'avertissement, et la règle qu'on a refusée

La tentation était de comparer les octets du logo à ceux du texte : « l'image
ne doit pas peser plus que le message ». **Mesuré, cette règle sonnerait sur
tous les messages légitimes** — un PNG de 120 px pèse 2 à 6 Ko, un corps
d'email 1 à 1,5 Ko. Une alerte qui sonne toujours est une alerte qu'on apprend
à ignorer, et ce projet en a déjà fait la démonstration au jalon 36.

Deux règles honnêtes la remplacent : un **plafond absolu** (20 Ko — un logo de
signature n'a pas d'affaire à peser davantage) et un **plancher de texte**
(400 caractères — un message de trois lignes avec un logo est ce que les
filtres appellent image-heavy). Les deux raisons se cumulent plutôt que de
s'effacer l'une l'autre.

### Assemblé à l'envoi, jamais dans le brouillon

`withSignatureLogo()` vit **hors de `toHtml()`**, comme le pixel du jalon 37 :
la règle du jalon 32 — « aucune image dans le corps » — tient toujours, et le
test de mise en forme continue de la vérifier. Le logo est une décision
d'envoi, posée après le dernier paragraphe donc juste sous la signature texte.
Ordre imposé : **le logo d'abord, le pixel ensuite**, celui-ci devant rester la
toute dernière chose du corps (jalon 43).

Un brouillon composé avant ce jalon dort encore dans la file des départs avec
une signature à deux lignes : `signatureBlocks()` connaît donc **les deux
formes**, pour que changer son signataire remplace sa signature au lieu d'en
ajouter une seconde en dessous.

### Jalon 62 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `28_signature_logo` appliquée puis
`migrate diff` **vide**), un puits SMTP réel, le serveur standalone et un
navigateur piloté :

- **1 · téléversement** : 11,1 Ko / 512 px → **1,7 Ko / 120 px**, aucun
  avertissement de poids ; **SVG refusé** en le nommant, faux PNG refusé au
  décodage et non au type déclaré ;
- **2 · signatures** : Yanis et Mohamed rendent chacun **quatre lignes**, les
  siennes, téléphone et adresse compris ;
- **3 · sur le fil** (source MIME brute du message reçu) : la partie **texte**
  porte les quatre lignes et **aucune image** ; la partie **HTML** porte les
  mêmes quatre lignes plus
  `<img src="https://crm.auraflowai.fr/api/logo/…" alt="Aura Flow AI" width="120">` ;
  **aucune image d'un hôte tiers**, aucun lien autour du logo, aucun paramètre
  dans l'adresse ;
- **4 · bascule** : le message signé Mohamed porte son nom, son titre, son
  téléphone et son adresse, **plus rien de Yanis**, et **le même logo** ;
- **5 · ratio** : 481 caractères de texte pour 1,7 Ko de logo, sous le seuil ;
- **6 · sans `CRM_PUBLIC_URL`** : aucun logo posé, plutôt qu'une image cassée ;
- **route publique, par HTTP réel** : 200 `image/png` de 1 774 octets **sans
  session**, `Cache-Control: public, max-age=31536000, immutable`, 304 sur
  ETag, **404** sur une version inconnue, et `/api/mail/logo` (téléversement)
  **401** sans session ;
- **au navigateur** : panneau présent, aperçu 120×120 rendu, champs
  « Signature — téléphone » distincts par boîte (`07 85 28 35 36` /
  `06 12 34 56 78`), **0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1135 tests**) et
  `npm run e2e` (**18 tests**, trois fichiers) verts.

**Un défaut trouvé en regardant l'écran, pas le code** : l'aperçu du panneau
passait d'abord par l'adresse publique, et disparaissait donc sur toute
installation où `CRM_PUBLIC_URL` n'est pas posée — au moment précis où l'on
veut vérifier à quoi ressemble l'image qu'on vient de choisir. Il passe
désormais par un **chemin relatif** : le navigateur qui affiche cet écran parle
déjà au CRM. L'adresse absolue reste affichée à côté, comme information de
délivrabilité, avec son avertissement quand elle manque.

### Jalon 62 — ce qui n'est pas fait

**Le logo n'est pas sauvegardé.** `mail_logo` ne fait pas partie des dix
modèles de `BACKED_UP` (jalon 42) : mettre des octets binaires dans chaque
instantané JSON quotidien ferait grossir la sauvegarde pour un fichier qui se
retéléverse en dix secondes. La conséquence est assumée et connue — après une
restauration, le logo est à reposer. Le **téléphone**, lui, est bien sauvegardé :
la garde du jalon 42 l'a exigé, et elle avait raison, c'est une saisie qu'on ne
retrouverait pas.

**Le rendu réel dans un client de messagerie n'a pas été vu.** Ce qui est
vérifié, c'est la source MIME : deux parties, les quatre lignes des deux côtés,
une seule balise `<img>` vers notre domaine. Que Gmail ou Outlook affichent ce
logo plutôt que de le bloquer derrière « afficher les images » relève du client
et de la réputation du domaine, pas du code.

**L'avertissement de poids ne bloque jamais.** Il est rendu à l'écran au moment
du téléversement ; on peut passer outre. Le seuil acceptable dépend d'un
jugement de marque qui n'appartient pas au code — mais il ne part plus en
silence, ce qui était la demande.

---

## Jalon 63 — un logo, quatre endroits

### Deux rendus, un seul téléversement

Le logo posé dans `/reglages` sert désormais **la signature des courriels, le
rail, la favicon et `/login`**. Une seule source, et c'était la demande ; ce qui
méritait une décision, c'est que les deux usages n'ont pas les mêmes
contraintes, et qu'elles sont **incompatibles** :

| | Signature | Interface |
|---|---|---|
| Largeur | 120 px | **256 px** |
| Encodage | PNG palettisé | PNG pleine couleur |
| Plafond de poids | 20 Ko — **délivrabilité** | aucun |
| Servi par | `/api/logo/<version>` | `/api/logo/<version>/app` |

Étirer le rendu de courriel à la taille du rail donne une image molle : 120 px
tiennent à 34 px d'affichage, mais montrent leurs marches sur un écran à deux
fois la densité. À l'inverse, un rendu assez net pour le rail serait trop lourd
pour la signature, et le plafond de 20 Ko sonnerait sur un logo parfaitement
légitime — **ce plafond existe pour les filtres anti-spam, pas pour notre propre
écran**, et le laisser déborder dans l'interface serait appliquer une règle là
où elle ne veut rien dire.

Les deux rendus sortent du **même fichier d'origine**, jamais l'un de l'autre :
réencoder un réencodage empilerait deux pertes. Mesuré : un PNG source de
12,8 Ko donne 3,6 Ko en signature et 8,7 Ko en interface, **octets distincts**.

### La lisibilité sur le rail est mesurée, jamais supposée

C'était la question posée, et elle a une vraie réponse plutôt qu'un pari. Un
logo dessiné pour du papier blanc — encre foncée, fond transparent — **disparaît
sur le bleu nuit du rail**, et cela ne se découvre qu'en regardant l'écran.

`sampleInk()` lit donc les pixels **une fois, au téléversement** : couleur
moyenne des pixels visibles et part de vide autour. `readsOnDark()` (pur) en
tire un contraste WCAG contre `--color-rail` et tranche à **3:1** — le seuil AA
des éléments graphiques non textuels (1.4.11), parce qu'un logo est une forme à
reconnaître, pas du texte à lire.

**Les pixels entièrement transparents sont exclus de la moyenne**, et ce détail
décide du verdict : leurs composantes RVB valent zéro sous un alpha nul, donc
les compter ferait tendre vers le noir la couleur de tout logo cerné de vide —
et un logo **blanc** sur fond transparent serait déclaré illisible sur fond
sombre, soit exactement l'inverse de la vérité.

Mesuré sur trois logos construits pour le cas :

| Logo | Contraste sur le rail | Verdict |
|---|---|---|
| encre claire, fond transparent | **13,9:1** | se détache, le rail passe au travers |
| encre foncée, fond transparent | **1,1:1** | illisible → **plaque claire** |
| fond blanc opaque | 13,6:1 | porte son propre fond, aucune plaque |

**Le verdict n'est pas un refus.** Un logo trop sombre reste un logo légitime :
il est posé sur une plaque claire dans le rail et la favicon, et l'écran de
réglages **dit ce qui a été mesuré** — le contraste, la raison, et le fait
qu'une version claire du logo réglerait la question. Refuser aurait été décider
à la place de l'utilisateur ; poser tel quel et se taire aurait laissé l'écran
mentir. Un fond opaque ne reçoit jamais de plaque : encadrer de blanc un logo
qui porte déjà son fond dessinerait un cadre autour d'un cadre.

### `Mark` reste la seule à connaître la forme

C'était déjà la règle (jalon 23) et elle n'a pas bougé : `Mark` rend l'`<img>`
quand un logo existe, le tracé dessiné sinon. Le rail, la favicon, `/login` et
la console du conseil lisent tous `readBrandLogo()`, **et jamais la table**.
Sans cela, remplacer le logo redeviendrait un geste à répéter écran par écran —
précisément ce que ce jalon supprime.

La favicon passe par `generateMetadata()` plutôt qu'un objet figé : elle est de
la **donnée** maintenant, pas une constante de build. L'adresse porte la
version, ce qui est la seule façon de déloger une favicon des caches de
navigateur — réputés pour garder l'ancienne bien après le remplacement.

### Un second téléversement aurait été plus simple à écrire, et c'était non

La consigne était explicite : ne pas demander deux fois le même fichier. Or le
logo déjà en base a été téléversé avant ce jalon, et **son original n'est jamais
conservé** (jalon 62) : seuls ses octets réencodés à 120 px existent. Supprimer
la ligne en migration aurait été une ligne de SQL — et aurait forcé exactement
le second téléversement qu'on s'interdit.

Les colonnes sont donc **nullables**, et `readChromeLogo()` calcule ce qui
manque à la première lecture : elle dérive un rendu du PNG de courriel, le range
pour ne pas le refaire, et lève `chromeFromEmail`. **L'écran annonce alors une
image adoucie** et invite à retéléverser l'original. Le logo apparaît dans le
rail sans aucun geste, et sa mollesse est nommée plutôt que servie en silence.

Mesuré, et c'est la démonstration du jalon : le rendu dérivé pèse **16,4 Ko**
contre 3,3 Ko pour un rendu natif de même taille — agrandir un PNG palettisé de
120 px produit un fichier à la fois plus lourd et plus flou. C'est précisément
pourquoi le second rendu existe.

### Une seule composition pour le panneau

`readLogoPanelState()` est extraite : la route de téléversement et la page de
réglages composaient le même objet chacune de son côté. Le jour où l'une gagne
un champ que l'autre ignore, l'écran affiche une chose après un téléversement et
une autre après un rechargement, sans que rien n'échoue — le motif payé au
jalon 55 sur l'entonnoir des campagnes.

### Jalon 63 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `29_logo_chrome` appliquée puis
`migrate diff` **vide**), le serveur standalone de production et un navigateur
piloté :

- **1 · deux rendus, une source** : 12,8 Ko / 512 px → signature 120 px / 3,6 Ko
  **et** interface 256 px / 8,7 Ko, **octets distincts** ;
- **2 · le verdict de fond sombre** : les trois mesures du tableau ci-dessus,
  plaque posée **uniquement** sur le logo foncé à fond transparent ;
- **3 · les quatre surfaces, au navigateur** : rail
  `<img src="/api/logo/<v>/app">` affiché à 34 px depuis une **source de
  256 px** ; favicon `/api/logo/<v>/app` ; `/login` **sans session** rend le
  logo, et la route répond 200 `image/png` ; `/conseil` idem ;
- **4 · le repli** : sans logo en base, **aucun `<img>`** dans le rail et le
  tracé dessiné à sa place, favicon sur `app/icon.svg`, `/login` sur le tracé ;
- **5 · les deux rendus ne se croisent pas** : la signature d'un message pointe
  vers `/api/logo/<v>` (120 px, 3,6 Ko) et **`/app` n'apparaît nulle part dans
  le corps** ;
- **6 · le rattrapage de migration** : colonnes remises à NULL → `chromeWidth`
  vaut 0 et le verdict est « non mesuré » ; une lecture le dérive (256 px,
  16,4 Ko), lève `chromeFromEmail` et mesure l'encre ;
- **version inconnue → 404**, jamais l'image courante ;
- **0 erreur console** sur tout le parcours ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1145 tests**) et
  `npm run e2e` (**23 tests**, quatre fichiers) verts.

### Jalon 63 — ce qui n'est pas fait

**Le logo n'est toujours pas sauvegardé** (jalon 62), et ce jalon en double
l'enjeu : `mail_logo` porte maintenant deux rendus, et une restauration les
emporte tous les deux — donc le rail, la favicon et `/login` retombent sur le
tracé dessiné en même temps que la signature perd son image. Le geste de
réparation reste le même (retéléverser), mais il se voit désormais sur quatre
écrans au lieu d'un.

**Le rendu réel de la favicon n'a pas été jugé à l'œil.** Ce qui est vérifié,
c'est que le navigateur demande la bonne adresse et qu'elle répond une image. Un
logo lisible à 256 px peut être illisible à 16 px — c'est une question de
dessin, pas de code, et aucune mesure ne la tranche.

**La plaque claire est un repli, pas une solution.** Elle rend un logo sombre
visible sur le rail ; elle ne le rend pas beau. L'écran le dit et propose la
vraie réponse — une version claire du logo — sans pouvoir la fabriquer.

**Le seuil de 3:1 est un jugement**, comme les seuils d'ouverture du jalon 43.
Il vient de WCAG 1.4.11, il est juste pour un élément graphique, et il n'a pas
été calé sur un échantillon de logos réels : il n'en existe qu'un.

---

## Jalon 64 — le signataire d'une campagne se voit et se choisit

### Reproduit avant de conclure, et les trois réponses

Écrans ouverts dans un vrai navigateur, base réelle, `/campagnes` :

| Question | Réponse mesurée |
|---|---|
| Le formulaire de création a-t-il un champ signataire ? | **Non — un champ boîte seulement.** Deux contrôles en tout : un texte et un `<select>` intitulé « BOÎTE D'ENVOI ». Le nom du signataire était bien *dans* l'option (`{box.label} · {box.signName}`, `campaigns-view.tsx:98-111`) mais rien ne le nommait comme tel, et l'adresse n'y figurait pas. Même chose à l'édition, `campaign-card.tsx:121-133`, sous « Envoyée depuis » |
| Une boîte sans signataire donne-t-elle une campagne sans signature, en silence ? | **Oui.** Boîte `mb_nosign` insérée en base → l'option rendait **`« Sans signataire · »`**, un séparateur qui pend dans le vide ; campagne créée dessus par l'interface, rien n'avertit, rien ne bloque, et `signatureBlock()` rend pour elle un **bloc vide** — les messages seraient partis non signés |
| Quel signataire un brouillon utilise-t-il réellement ? | **Celui de la boîte de la campagne** — ni codé en dur, ni aucun. `lib/api/departures.ts:237` passe `enrollment.sequence.campaign?.mailboxId` à `draftEmail`, et depuis le jalon 54 `Signatory.id` **est** un identifiant de boîte. Sur une reprise sans `mailboxId`, `:636-641` retombe sur `pickSignatory(signatories, contact.owner)` |

**Le modèle était donc juste, et c'est l'écran qui mentait par omission.** Choisir
la boîte choisissait bien la signature ; simplement, aucun des deux écrans ne le
disait, et le cas « pas de signature » se lisait comme une étiquette tronquée
plutôt que comme un manque.

### Une seule définition de « comment un signataire se lit »

`lib/domain/signatory-choice.ts`, pur : `signatoryOptionLabel`, `signatureLines`,
`signatoryGap`, `chosenSignatory`, et le type `MailboxOption`. **Les trois
surfaces l'appellent** — création, édition, panneau de rédaction — et aucune ne
recompose l'étiquette. C'est la règle du projet, et elle vaut ici pour une raison
précise : le panneau de rédaction affichait déjà l'adresse d'expédition, les
campagnes non. Deux écrans décrivaient la même chose de deux façons, et **c'est
toujours le second qu'on oublie de corriger**.

L'étiquette est `Boîte · Nom (adresse)`, chaque morceau disparaissant avec **son
séparateur** quand il est vide — `« Sans signataire · »` était le symptôme exact
d'un gabarit qui suppose ses morceaux remplis. Un nom manquant n'est pas escamoté
pour autant : il est **nommé** (« signataire non renseigné »). Une entrée réduite
au seul libellé de la boîte se lirait comme une boîte sans problème, alors que
c'est une campagne qui partira sans signature.

### Montrer les lignes, avertir sans bloquer

`SignatoryPreview` rend, sous chaque menu, **les lignes que le destinataire
verra**. Lire « Mohamed » dans une liste ne dit pas quelles quatre lignes
partiront, et c'est pourtant la seule partie du message qui engage un nom.

Quand la boîte ne porte aucun nom, c'est un **avertissement ambre qui nomme le
geste** — « Réglages → Messagerie → nom et titre de la signature » — et non un
refus : c'est la posture du produit depuis le jalon 8, et une boîte peut être
configurée dans la minute qui suit. Mais le silence n'était pas une option : une
campagne qui part sans signature ne se découvre que chez le destinataire.

Le même composant sert les deux écrans. Deux rendus de la même promesse
finiraient par ne plus dire la même chose — le motif payé au jalon 55 sur
l'entonnoir des campagnes.

### Jalon 64 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration : la
signature vit sur `mailboxes` depuis le jalon 54), le serveur standalone de
production et un navigateur piloté :

- **création** : intitulé « BOÎTE D'ENVOI ET SIGNATAIRE » ; options rendues
  `Yanis · Yanis Tidahy (yanis.tidahy@auraflowai.fr)` et
  `Mohamed · Mohamed Targani (mohamed.targani@auraflowai.fr)` ; la boîte muette
  rend `Sans signataire · signataire non renseigné`, **plus aucun séparateur
  nu** ;
- **l'aperçu suit le menu** : boîte signée → les lignes de la signature ; boîte
  muette → « La boîte « Sans signataire » ne porte aucun nom de signataire […]
  Réglages → Messagerie » ;
- **édition** : même intitulé (« Envoyée depuis et signée par »), mêmes
  étiquettes, même aperçu ; bascule vers une boîte signée → l'avertissement cède
  la place aux quatre lignes, **et le choix est écrit en base**, pas seulement
  affiché ;
- **0 erreur console** sur tout le parcours ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1153 tests**) et
  `npm run e2e` (**29 tests**, cinq fichiers) verts.

`tests/e2e/campaign-signatory.e2e.ts` **éprouvé en réintroduisant le défaut
exact** sur l'écran d'édition — intitulé d'origine et `{box.label} · {box.name}` :
le test tombe en nommant l'intitulé manquant.

### Jalon 64 — ce qui n'est pas fait

**On ne choisit toujours pas un signataire indépendamment de la boîte**, et
c'est le modèle du jalon 54, pas un manque de cet écran : une signature est une
propriété de la boîte d'envoi, et faire partir un message signé Mohamed depuis
l'adresse de Yanis afficherait dans la signature autre chose que l'en-tête
`From` — ce qu'un filtre traite comme une usurpation (jalon 62). Pour que Yanis
et Mohamed signent la même campagne, il faut deux boîtes, et elles existent.

**L'avertissement ne bloque pas la création.** Une campagne peut naître sur une
boîte sans signature ; elle le dit à chaque affichage, et la composition des
départs ne la refuse pas pour autant.

**Les campagnes existantes ne sont pas auditées.** Aucun écran ne liste « les
campagnes dont la boîte ne signe pas » : l'avertissement se lit campagne par
campagne, sur sa carte.

---

## Jalon 65 — le logo à gauche, la signature à droite

### Un tableau, et c'est une contrainte du support

La signature HTML empilait le logo **sous** les quatre lignes : un `<p>` de plus
à la fin du corps. Elle les met désormais côte à côte, logo à gauche, texte à
droite, centrés l'un par rapport à l'autre.

**En `<table>`, pas en flex ni en grid**, et ce n'est pas un goût : Outlook rend
le HTML par le moteur de Word, qui ignore `display:flex` et `display:grid`. La
mise en page retomberait en pile — donc exactement ce qu'on cherche à éviter, et
**seulement chez une partie des destinataires**, ce qui est le pire des cas :
invisible à la relecture, cassé à l'arrivée. Deux cellules sont le seul
assemblage que tous les clients rendent de la même façon.

```html
<table role="presentation" cellpadding="0" cellspacing="0" border="0"
       style="border-collapse:collapse;border:0;margin-top:12px"><tr>
  <td width="120" valign="middle" style="width:120px;padding:0;border:0"><img …></td>
  <td valign="middle" style="padding:0 0 0 12px;border:0">Yanis Tidahy<br>…</td>
</tr></table>
```

Trois détails qui tiennent la mise en page plutôt que de la décorer :

- **la largeur de la cellule du logo, en attribut *et* en style.** Sans elle, un
  client répartit l'espace lui-même et la colonne de texte se colle au logo ou
  s'en éloigne selon la longueur des lignes ;
- **`display:block` sur l'image**, qui supprime le blanc que les navigateurs
  réservent sous une image en ligne — un ou deux pixels de décalage du centrage ;
- **`width` en attribut**, comme depuis le jalon 62 : un client qui ignore le CSS
  doit quand même réserver la place, sinon la signature saute au chargement.

**Il ne doit jamais se lire comme un tableau** : ni bordure, ni fond, ni
quadrillage, `border-collapse:collapse` pour fermer le dernier interstice qu'un
client dessinerait de lui-même, et `role="presentation"` pour qu'un lecteur
d'écran l'annonce comme une mise en page et non comme des données.

### Le texte de la signature n'est pas retransmis, il est déplacé

`withSignatureLogo()` prend **le dernier paragraphe du corps HTML** et le pose
dans la cellule de droite. C'est la signature : la règle du jalon 33 l'impose en
fin de message, et `signsWithName()` l'y cherche déjà. Lui repasser le texte de
la signature en paramètre aurait fait deux sources pour une même chose, et elles
auraient fini par diverger — le motif payé au jalon 55 sur l'entonnoir des
campagnes. Conséquence vérifiée : la signature est rendue **une seule fois**,
elle n'est pas recopiée à côté de l'originale.

**La version `text/plain` ne bouge pas d'un caractère** : elle n'a pas de mise en
page, et ses quatre lignes sont ce qu'elles étaient. C'est vérifié explicitement,
parce que c'est exactement le genre de chose qu'une refonte du HTML emporte sans
qu'on s'en aperçoive.

### Jalon 65 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration), un
puits SMTP réel, et la source du message telle qu'elle passe sur le fil :

- **deux colonnes** : `<table role="presentation" … border-collapse:collapse>`,
  exactement **2 cellules**, le `<img>` dans la **première**, les quatre lignes
  dans la **seconde** — et aucun `display:flex` ni `display:grid` nulle part ;
- **centrage** : `valign="middle"` sur les deux cellules ; mesuré au rendu, les
  centres verticaux du logo et du bloc de texte sont à **0,0 px** l'un de
  l'autre ;
- **côte à côte, mesuré** : logo `x=8 … 120×120`, texte `x=128` — le texte
  commence après le logo, avec les 12 px de retrait de la cellule ;
- **invisible en tant que tableau** : `border="0"`, aucune déclaration de fond,
  aucune bordure non nulle dans tout le corps ;
- **la partie texte est intacte** : les quatre lignes dans l'ordre, **aucun
  `<table>`, aucun `<td>`, aucune image, aucune adresse de logo** ;
- **bascule Yanis → Mohamed** : ossature de tableau **identique au caractère
  près**, même cellule de logo, seul le contenu de la cellule de droite change ;
- **capture** du rendu des deux signatures, à partir du corps HTML tel qu'il part
  (seule substitution : l'adresse publique du logo devient celle du serveur
  local, qui sert les mêmes octets) ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1155 tests**) et
  `npm run e2e` (**29 tests**) verts.

### Jalon 65 — ce qui n'est pas fait

**Le rendu n'a pas été vu dans un vrai client de messagerie.** La capture est
celle de Chromium sur le corps HTML exact du message ; qu'Outlook, Gmail ou Apple
Mail le rendent à l'identique relève du client. Le tableau à deux cellules est
précisément le motif choisi pour que ce risque soit le plus faible possible, mais
ce n'est pas une mesure.

**Aucun repli en colonne sur écran étroit.** Une signature de 120 px plus une
colonne de texte tient dans la largeur d'un téléphone ; si un jour le logo
grandit, le tableau ne se réorganisera pas tout seul — et c'est le prix du
tableau, qui est aussi ce qui le rend prévisible.

**Le corps sans paragraphe garde l'ancien rendu** (le logo seul dans un `<p>`).
Le cas n'arrive pas en usage — un message a toujours au moins sa signature — mais
il ne fabrique pas un tableau à une colonne, qui serait une mise en page sans
mise en page.

---

## Jalon 66 — la signature en double, et la ligne qui la produisait

### Reproduit dans le panneau, avant tout correctif

Contact réel, panneau de rédaction ouvert, brouillon chargé, puis le geste
signalé : choisir sa boîte dans le sélecteur.

```
--- brouillon à l'ouverture ---        Yanis Tidahy / Fondateur / 07 85 28 35 36 / adresse
                                       >>> « Yanis Tidahy » : 1 fois
--- après bascule, puis retour ---     Yanis Tidahy / Fondateur / 07 85 28 35 36 / adresse
                                       (ligne vide)
                                       Yanis Tidahy / Fondateur
                                       >>> « Yanis Tidahy » : 2 fois
```

Deux blocs, dont le second **tronqué** : c'est ce que le rapport décrivait.

### La cause, avec sa ligne

**`components/emails/compose-panel.tsx:70-74` — `blockOf()`.** Le panneau
assemblait son propre bloc de signature, **nom et titre, deux lignes**, dans une
fonction locale héritée d'avant le jalon 62 — pendant que le serveur en compose
**quatre** (nom, titre, téléphone, adresse) via `signatureBlock()`.

`replaceSignature()` (`lib/domain/email-format.ts:433`) compare des paragraphes
**entiers** : c'est délibéré, un message qui se termine par un post-scriptum n'a
pas de signature à cet endroit et couper à l'aveugle le mutilerait. Aucun des
blocs à deux lignes que le panneau lui donnait ne correspondait donc au bloc à
quatre lignes du brouillon, et la fonction faisait ce qu'elle promet dans ce
cas : elle **ajoute** (ligne 440). Ce qu'elle ajoutait était le bloc tronqué.

**Rien n'échouait.** Deux chaînes, deux assemblages corrects chacun de son côté,
aucun type violé, aucun test rouge — et le défaut n'apparaît qu'au *second*
geste, pas à l'ouverture du panneau. C'est exactement la famille de défauts que
les gardes statiques de ce projet attrapent depuis le jalon 36.

La déclaration de type du panneau portait la même moitié de vérité : son
interface `Signatory` ne déclarait ni `phone` ni `email`, **alors que la route
les renvoie depuis le jalon 54**. Le panneau ignorait des champs qu'il recevait.

### Une seule définition, dans le domaine

`lib/domain/signatory-choice.ts` porte désormais `signatureLines()`,
`signatureText()` et `knownSignatureBlocks()`. `signatureBlock()` du dossier
d'Alex délègue en une ligne, `signatureBlocks()` de `lib/api/signatories.ts`
aussi, et le panneau appelle la même fonction que le serveur. Il n'y a plus
qu'un assemblage.

**`knownSignatureBlocks()` connaît les formes héritées** — deux lignes, trois
lignes avec ou sans téléphone — parce qu'un brouillon composé avant le jalon 62
dort peut-être encore dans la file des départs. Une forme absente de cette liste
n'est pas remplacée : elle est doublée. C'est précisément le mécanisme du défaut,
et l'oublier le ferait revenir par la porte de derrière.

**Effet de bord corrigé au passage** : `signatureLines()` omettait le téléphone
depuis le jalon 64, si bien que l'aperçu des écrans de campagne annonçait trois
lignes là où le message en porte quatre. Une seule définition règle les deux.

### La garde

`tests/signature-block-source.test.ts` échoue si un écran réassemble un bloc de
signature, si le panneau cesse de passer par la fonction du domaine, ou si la
liste des formes connues se dédouble. **Éprouvée en réintroduisant le défaut
exact** : deux tests tombent, dont celui qui nomme
`components/emails/compose-panel.tsx`.

Une première version de la garde était **sensible à l'ordre des champs** — elle
cherchait « nom puis titre », et la réintroduction du défaut écrivait « titre
puis nom ». Elle passait donc au vert sur le défaut qu'elle devait attraper. Une
garde qu'on contourne sans le vouloir ne garde rien : les deux ordres sont
désormais testés.

### Jalon 66 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration), le
serveur standalone de production, un puits SMTP réel et le substitut Anthropic :

- **dans le panneau** : brouillon à l'ouverture, **1** bloc ; après bascule vers
  une autre boîte, **1** bloc, celui de la nouvelle ; après retour, **1** bloc,
  identique à l'original au caractère près ; **0 erreur console** ;
- **trois bascules d'affilée** — c'est en les enchaînant que le doublon
  s'accumulait : « Mohamed Targani » **1 fois**, « Yanis Tidahy » **0 fois** ;
- **sur le fil**, message envoyé depuis le panneau : la partie `text/plain`
  porte **une seule** signature, ses quatre lignes en ordre ; la partie HTML en
  porte **une seule**, dans la cellule de droite du tableau du jalon 65
  (`Mohamed Targani<br>Co-Fondateur, Aura Flow AI<br>06 12 34 56 78<br>adresse`),
  **quatre lignes** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1161 tests**) et
  `npm run e2e` (**29 tests**) verts.

**Une boîte fantôme trouvée en vérifiant**, sans rapport avec le doublon mais
capable de bloquer un envoi : le test e2e du jalon 61 créait une boîte
`e2e-campaign-delete` et **ne la supprimait pas**. Restée en base, elle
apparaissait dans le sélecteur du panneau et, n'étant pas configurée, faisait
refuser l'envoi avec un message nommant une boîte que personne n'avait choisie.
Le test nettoie désormais sa boîte, et la ligne a été retirée de la base locale.

### Jalon 66 — ce qui n'est pas fait

**Les brouillons déjà en file ne sont pas réparés.** Un départ composé avant ce
correctif et dont on aurait changé le signataire porte deux signatures dans son
texte enregistré ; le correctif empêche d'en produire de nouvelles, il ne relit
pas la file. Rouvrir le départ et rebasculer le signataire suffit à le nettoyer,
puisque les deux formes sont désormais reconnues.

**La garde porte sur l'assemblage, pas sur toute écriture concevable.** Un écran
qui écrirait les quatre lignes à la main, sans passer par les champs d'un
signataire, ne serait pas attrapé. Ce que le test ferme, c'est le chemin par
lequel le défaut est réellement arrivé.

---

## Jalon 67 — trois lignes, et le doublon qui restait

### 1. La signature perd son adresse

`signatureLines()` rend **nom, titre, téléphone**. L'adresse en sort : elle est
déjà l'expéditeur du message, et la répéter sous le texte n'apprend rien à
personne. Le changement se fait à **un seul endroit** — la version texte, la
cellule droite du tableau HTML (jalon 65), l'aperçu des campagnes et le panneau
de rédaction lisent tous cette fonction, et c'est ce que le jalon 66 avait
acheté.

`knownSignatureBlocks()` garde en revanche **la forme à quatre lignes** parmi les
formes connues, avec celles d'avant le jalon 62 : les brouillons composés entre
les jalons 62 et 66 la portent, et une forme absente de cette liste n'est pas
remplacée — elle est doublée.

### 2. Le doublon ne venait pas du panneau

Le correctif du jalon 66 est bien en production (`2fc5c61`, fusionné dans `main`
par la PR #38), et il était juste — il fermait le chemin du **changement de
signataire**. Mais le texte signalé se produit **à la composition**, avant tout
clic, et par un autre chemin.

**`lib/domain/email-format.ts:391` — `enforceSignature()`** ne remplaçait que la
**dernière ligne** du dernier paragraphe. Tant que le modèle écrivait « Bien à
vous, » puis un seul nom, c'était juste. Mais le modèle écrit souvent la formule
de politesse **et le bloc entier** dans le même paragraphe : seule la dernière
ligne était alors remplacée par la signature complète.

Rejoué sur le texte exact du rapport :

```
entrée (ce que le modèle rend)      sortie (avant correctif)
À bientôt                           À bientôt
Yanis Tidahy                        Yanis Tidahy
Fondateur, Aura Flow AI             Fondateur, Aura Flow AI
0785283536                          0785283536
yanis.tidahy@auraflowai.fr          Yanis Tidahy
                                    Fondateur, Aura Flow AI
                                    0785283536
                                    yanis.tidahy@auraflowai.fr
```

**Identique au caractère près à ce qui a été signalé.** La cause est nommée par
reproduction, pas par lecture.

Le remplacement coupe désormais à la **première ligne qui porte un nom** : la
formule de politesse reste, tout le bloc part, quelle que soit sa longueur et sa
forme. Et la signature repart dans **son propre paragraphe** — c'est le dernier
paragraphe que la cellule droite du tableau HTML rend, et y laisser « À bientôt »
ferait porter la formule de politesse au logo.

### 3. Le même défaut, à l'autre bout

Vérification faite, le changement de signataire ratait le même cas :
`replaceSignature` comparait des paragraphes **entiers**, donc une signature
collée à la formule de politesse n'était pas trouvée — et une seconde était
ajoutée. Elle accepte maintenant une correspondance **en fin de paragraphe**,
toujours ancrée sur un bloc connu (un post-scriptum n'est donc toujours pas
coupé), et elle retire **toutes les signatures qui se suivent** : c'est ce qui
permet à un brouillon déjà doublé de se réparer en rebasculant son signataire.

### Jalon 67 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide**), le serveur standalone, un
puits SMTP réel et le substitut Anthropic **étendu** (`MOCK_SIGNED=1`, qui
reproduit la forme fautive observée en production — même discipline qu'au
jalon 43) :

- **brouillon frais** : une seule signature, **trois lignes**, aucune adresse ;
- **trois bascules de signataire d'affilée** : « Mohamed Targani » 1 fois,
  « Yanis Tidahy » 0 fois, **0 erreur console** ;
- **départ composé avant le correctif**, semé avec le texte doublé exact :
  rouvert depuis la file, le texte enregistré porte bien 2 signatures ;
  rebasculer le signataire le ramène à **1**, adresse comprise. La réparation
  annoncée au jalon 66 est donc réelle, et elle nettoie tout le bloc ;
- **sur le fil** : partie `text/plain` **une seule** signature, trois lignes,
  sans adresse ; cellule droite du tableau HTML
  `Mohamed Targani<br>Co-Fondateur, Aura Flow AI<br>06 12 34 56 78` ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1166 tests**) et
  `npm run e2e` (**29 tests**) verts.

### Jalon 67 — ce qui n'est pas fait

**La file des départs n'est pas repassée en masse.** Un brouillon déjà doublé se
répare en rebasculant son signataire, ce qui est vérifié ci-dessus ; aucun script
ne parcourt la file pour le faire à la place de l'utilisateur.

**Le piège de méthode a resservi.** La première vérification du départ ancien
montrait deux signatures après rebascule : le serveur tournait sur un build
antérieur au dernier correctif. C'est la leçon des jalons 33, 34, 37, 50 et 51 —
**vérifier quel binaire répond avant de conclure**.

---

## Jalon 68 — la virgule, la marque, et la retouche à la main

### 1. L'appel perdait sa virgule, et ce n'était pas `repairGreeting`

Reproduit d'abord, fonction par fonction, sur la chaîne réelle :

```
1 repairGreeting    : "Bonjour Roxana,"
2 enforceSignature  : "Bonjour Roxana,"
3 stripDashes       : "Bonjour Roxana"      <- la virgule disparaît ici
```

**`lib/domain/em-dash.ts` — `.replace(/,\s*$/gm, "")`.** La règle « une virgule
en fin de ligne ne ponctue plus rien » est juste **pour une virgule que cette
fonction vient de poser** : « … texte, » à la place de « … texte — » ne veut
plus rien dire. Mais elle s'appliquait à **toutes les lignes de tous les
brouillons**, y compris celles qu'aucun tiret n'a jamais approchées, et la
première d'entre elles est l'appel. Systémique depuis le jalon 58, sur chaque
brouillon.

Le défaut ne pouvait pas se voir : les tests du module ne portaient que sur des
textes contenant des tirets, et un texte sans tiret n'était jamais comparé à
lui-même. Le nettoyage est désormais **borné aux lignes réellement modifiées**,
et un texte sans aucun tiret ressort identique à l'octet près.

`repairGreeting` est durci au passage, pour les brouillons déjà en file :
« Bonjour Roxana » et « Bonjour Roxana. » deviennent « Bonjour Roxana, ». La
réparation ne touche que la **ponctuation finale** — « Bonjour Roxana et Marc »
garde son nom. Elle est appliquée à la lecture de la file et à l'envoi, donc ce
qu'on relit le matin est ce qui partira ; le texte stocké n'est réécrit que si
on l'enregistre, une consultation n'écrit pas (jalon 8).

### 2. L'objet ne nommait pas la marque : le prompt n'en disait rien

Cause mesurée : `draftInstruction()` décrivait le corps ligne à ligne et **ne
disait rien de l'objet**, qui n'apparaissait qu'en clé du JSON attendu. Le
modèle retombait donc sur la formule générique de la consigne la plus proche.
Ce n'était pas une donnée manquante — la marque est dans le dossier depuis le
jalon 53 — mais un **trou dans la consigne**.

`subjectRule(brand)` est ajoutée, construite depuis la donnée comme les autres :
elle nomme la marque quand la fiche en porte une, et **interdit d'en inventer**
quand elle n'en porte pas. `enforceSubjectBrand()` garantit ce que la consigne
demande, avec la posture de la signature (jalon 33) et du tiret long (jalon 58).
Le remplacement est **étroit** : seules les formules génériques (« votre
boutique », « votre site », « votre marque ») sont remplacées, et seulement
quand la marque est connue. Un objet de relance n'est pas réécrit.

### 3. « sur votre boutique » : la fiche, ou le modèle ?

Les deux lectures étaient possibles, et elles appellent des gestes opposés —
l'une se corrige dans la fiche, l'autre dans le prompt. La file le dit désormais
elle-même, brouillon par brouillon :

| Ce que la carte affiche | Ce que ça veut dire |
|---|---|
| `site dermoplant.fr` | un site est connu, Alex devait le citer |
| `aucun site, marque « Dermoplant »` | repli du jalon 48 : nommer la marque, jamais inventer d'adresse |
| `ni site ni société liée` | la fiche ne porte rien, c'est elle qu'il faut compléter |

**Le cas signalé n'a pas pu être tranché depuis ici** : cet environnement n'a
accès qu'à la base locale. La phrase exacte relevée — « sur votre boutique »,
sans marque — est **mot pour mot** la consigne du cas `ni site ni société liée`,
ce qui désigne une fiche sans société liée plutôt qu'un modèle désobéissant.
La ligne de la file le confirmera au premier brouillon.

### 4. Retoucher un départ à la main

Deux champs et un bouton sur la carte : objet, message, « Enregistrer ». **Aucun
appel au modèle** — la route `PATCH /api/departures` existe depuis le jalon 57
et n'écrit que le texte. Corriger une virgule ne doit coûter ni un appel
facturé, ni le risque qu'une reprise réécrive autre chose que ce qu'on voulait.

« Modifier » est placé **avant** « Retravailler avec Alex » : l'ordre des boutons
dit lequel est le geste ordinaire. Le fil avec Alex reste entier pour quand on
veut son aide.

La garde du jalon 57 interdisait tout `<textarea>` dans la file — elle visait
juste (pas de second éditeur *assisté par le modèle*) mais trop large. Elle
décrit maintenant la règle plutôt qu'une de ses formes : aucun `useAgentChat`,
aucun appel à `/api/emails`, et la retouche passe par `PATCH`.

### Jalon 68 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide**), le serveur standalone de
production, le substitut Anthropic étendu (`MOCK_GENERIC=1`, qui rend l'objet
générique observé en production) et un navigateur piloté :

- **composition** : « Bonjour Roxana, » et « Bonjour Alice, », **virgule
  comprise** ; objet « Une démonstration préparée pour Dermoplant » quand la
  marque est connue, générique quand la fiche ne porte **aucune** société —
  jamais une marque inventée ;
- **file** : deux brouillons semés **tels qu'ils sortaient avant le correctif**
  (appel sans virgule, objet générique) s'affichent avec leur virgule, et
  chaque carte annonce ses données de démonstration ;
- **retouche à la main** : champs ouverts, objet et corps modifiés, enregistrés
  — **un seul appel réseau, `PATCH /api/departures`**, aucun appel au modèle,
  **0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1181 tests**) et
  `npm run e2e` (**29 tests**) verts.

### Jalon 68 — ce qui n'est pas fait

**Les brouillons en file ne sont pas réécrits en base.** Leur appel s'affiche et
part avec sa virgule, mais le texte stocké garde sa forme d'origine tant qu'on
ne l'enregistre pas. L'objet, lui, n'est pas rattrapé : un brouillon déjà
composé garde son objet générique, et c'est précisément ce que le bouton
« Modifier » permet de corriger en dix secondes.

**Le cas Roxana n'est pas tranché depuis cet environnement** — voir plus haut.

**La retouche n'a pas de retour en arrière.** Enregistrer écrase le texte
précédent ; le panneau d'Alex garde le sien (jalon 34), pas la carte.

---

## Jalon 69 — audit du suivi d'ouverture, de bout en bout

Rien de cassé par les jalons 54 à 68 : la chaîne complète a été rejouée sur le
fil, contre une base réelle, avec un envoi **de campagne** (et non une rédaction
manuelle). Un seul défaut trouvé, et il est d'affichage.

### 1 · Le pixel survit à l'assemblage HTML des jalons 62 et 65

Envoi réel d'un départ de campagne par `POST /api/departures`, source MIME
inspectée :

```
<img src="http://…/api/t/a9afab2a02b450974a428c8602d8138c" width="1" height="1"
     alt="" style="display:none;border:0" />
```

- logo de signature présent, **tableau à deux colonnes** du jalon 65 intact ;
- **le pixel vient après le logo** et reste la **toute dernière chose** avant
  `</body>` — la règle du jalon 43 tient malgré la réécriture du dernier
  paragraphe en tableau ;
- la partie `text/plain` n'en porte aucune trace ;
- le jeton du pixel est **celui de la ligne d'envoi**, et la ligne porte bien
  `tracked = true` et l'identifiant de la campagne.

### 2 · Un chargement se classe, se compte et se propage

Sur le vrai chemin HTTP, depuis un contexte étranger (sans cookie) :

| Geste | Verdict | `openCount` |
|---|---|---|
| chargement immédiat | `delivery` | 0 |
| chargement dix minutes plus tard | `counted` (delaySeconds 600) | 1 |
| rechargement dans la foulée | `burst` | 1 |

`firstOpenAt` et `lastOpenAt` sont posés par le chargement **compté**, jamais
par celui de la livraison. `/emails` montre alors « Ont ouvert (estimation) 1 »
et la ligne du journal passe de `0` à `1`.

### 3 · L'écran ne disait pas *pourquoi* il ne mesurait rien

**Le seul défaut trouvé.** « Ont ouvert (estimation) 0 » se lit « personne n'a
ouvert » ; il peut vouloir dire « aucun message n'a jamais porté de pixel ». Ce
sont deux situations opposées, et l'avertissement n'existait que dans
`/reglages` — c'est-à-dire pas là où l'on constate l'absence.

`trackingGap()` (`lib/domain/open-tracking.ts`, pur) nomme les trois causes, et
l'ordre compte : **sans adresse publique aucun pixel ne peut être composé**,
quel que soit le réglage.

| Cause | Ce que l'écran dit |
|---|---|
| `no-public-url` | « le CRM ne connaît pas son adresse publique (`CRM_PUBLIC_URL` ou `RAILWAY_PUBLIC_DOMAIN`) » |
| `disabled` | « le suivi est coupé dans Réglages → Messagerie » |
| `none-tracked` | « aucun message de cette fenêtre ne porte de pixel » |

Une fenêtre vide n'allume rien : il n'y a rien à suivre. Des messages suivis
sans ouverture non plus — c'est un résultat, pas une panne.

### 4 · Les deux interrupteurs, vérifiés sur le fil

- case du message décochée → **aucun pixel, aucun jeton émis**, `tracked=false` ;
- **interrupteur global coupé, case cochée → aucun pixel** : le global reste le
  maître, comme au jalon 37 ;
- global rétabli → le pixel revient.

**Les envois de campagne respectent les deux** : `sendDeparture` passe par
`sendEmailToContact`, qui lit `input.track ?? tracking.enabled`. Il n'existe pas
de réglage de suivi par campagne, et c'est assumé.

### 5 · L'écran se recalcule, il n'est pas mis en cache

`export const dynamic = "force-dynamic"` sur `/emails`, et rien n'y passe par le
cache de `fetch` : les compteurs viennent de Prisma à chaque requête. Vérifié en
chargeant la page, en chargeant le pixel, puis en rechargeant : la ligne du
journal passe de `0` à `1`, en-tête `private, no-cache, no-store`.

### Jalon 69 — les seuils, et ce qu'ils font vraiment

`DELIVERY_WINDOW_SECONDS = 30`, `BURST_WINDOW_SECONDS = 60`. Ce qu'on peut en
dire honnêtement, sans données de production sous la main :

- **le seuil de livraison ne peut pas attraper Apple Mail Privacy Protection.**
  MPP récupère les images à la réception, mais rien ne garantit que ce soit dans
  les trente secondes : une boîte relevée dix minutes plus tard produit un
  chargement **compté**, indiscernable d'une vraie lecture. On ne stocke ni IP ni
  agent utilisateur (jalon 37, et c'est une promesse de vie privée, pas un
  oubli), donc **aucune règle ne peut les séparer**. Le chiffre reste un
  majorant ;
- **la rafale protège surtout le compteur par envoi**, pas le taux : l'entonnoir
  compte des **personnes** via `firstOpenAt`, donc un rechargement ne peut pas
  gonfler le taux d'ouverture. C'est ce qui rend le taux plus solide que le
  nombre de chargements ;
- **un vrai lecteur très rapide est écarté**. Ouvrir dans les trente secondes
  arrive — une relance attendue — et ce chargement est classé `delivery`. Le
  biais va donc dans les deux sens, mais il est **asymétrique** : MPP est
  fréquent, le lecteur en trente secondes est rare.

**Où vous lisez votre propre distribution** : Réglages → Messagerie → « Ce que
valent les ouvertures ». Le panneau donne les trois compteurs, la part de bruit,
et surtout **la répartition des délais** (moins de 30 s / 30 s à 5 min / 5 min à
1 h / 1 h à 1 j / plus d'un jour). C'est elle qui dira si les seuils sont bien
placés : un pic massif entre 30 s et 5 min désignerait de la récupération
automatique comptée comme lecture, et justifierait de relever le seuil. Sans ce
pic, les seuils actuels n'ont pas de raison de bouger.

### Jalon 69 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration), le
serveur standalone de production, un puits SMTP réel et le substitut Anthropic :
les cinq sections ci-dessus, plus

- **le cas « aucune adresse publique »**, serveur redémarré sans
  `CRM_PUBLIC_URL` ni `RAILWAY_PUBLIC_DOMAIN` : le bandeau le nomme sur
  `/emails` ;
- **le panneau d'audit du jalon 43** rend toujours ses compteurs, sa part de
  bruit et sa répartition des délais ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1185 tests**) et
  `npm run e2e` (**29 tests**) verts.

### Jalon 69 — ce qui reste invérifiable, et qu'il faut lire avec prudence

**Apple Mail Privacy Protection.** Les images sont récupérées par un relais
Apple à la réception, que le message soit lu ou non, avec un délai variable. Ces
chargements sont comptés comme des ouvertures dès qu'ils dépassent trente
secondes. C'est la principale cause de surestimation, et elle est structurelle.

**Le proxy d'images de Gmail.** Il récupère l'image une fois et la met en cache :
la première ouverture est vue, **les suivantes ne le sont pas**. Le nombre de
chargements d'un destinataire Gmail est donc un plancher, pas un compte.

**Les images bloquées.** Beaucoup de clients ne les chargent pas par défaut : une
lecture réelle peut ne produire **aucun** chargement. Le taux sous-estime ce
cas-là autant qu'il surestime le précédent, et **rien ne dit lequel domine** dans
un portefeuille donné.

**Ce que le CRM ne fera pas pour lever le doute** : stocker l'adresse IP ou
l'agent utilisateur, qui permettraient de reconnaître un relais. C'est la
décision du jalon 37, et elle n'est pas rouverte ici.

**Le chiffre reste donc une estimation, jamais une mesure** — c'est pourquoi
l'écran l'écrit à côté du nombre, et pourquoi les réponses et les rendez-vous
passent devant lui dans l'entonnoir.

---

## Jalon 70 — enregistrer configure, « Écrire les mails » dépense

### 1 · Retirer quelqu'un le retire vraiment

`removed` rejoint le vocabulaire des inscriptions (`lib/domain/campaign-members.ts`),
**distinct de `stopped`** : le produit *arrête* une inscription (réponse reçue,
fiche close) et doit le dire avec son motif ; une personne *retirée* l'a été par
quelqu'un, et n'a plus à figurer dans la campagne. Les confondre coûtait deux
choses : la ligne restait affichée « Arrêtée » juste après le retrait, et la
fiche restait comptée comme inscrite — donc **impossible à réinscrire**.

Ce que le retrait fait, et ce qu'il ne fait pas :

| | |
|---|---|
| disparaît de la liste des inscrits | `listCampaignMembers` filtre `status != removed` |
| le départ en attente quitte la file | `updateMany` → `skipped`, « Retiré de la campagne » |
| l'inscription est **arrêtée, pas supprimée** | la supprimer sortirait la personne du dénominateur de l'entonnoir, et le taux de réponse s'améliorerait à chaque retrait |
| la fiche, ses interactions, ses envois | **intacts** — retirer quelqu'un d'une campagne ne réécrit pas le passé |
| réinscrire | réactive la même ligne (`lastStep: 0`), la contrainte d'unicité interdisant le doublon |

**Un défaut trouvé à la recette, pas à la lecture** : la réinscription
réactivait bien l'inscription, mais laissait derrière elle le départ `skipped`
du retrait — et la composition refuse d'écrire là où un départ existe déjà,
quel qu'il soit. La personne revenait dans la campagne sans que rien ne puisse
plus lui être écrit : un retour sans retour. Les départs **jamais partis** sont
donc effacés à la réinscription ; les envoyés restent, ce sont des faits.

### 2 · Enregistrer deux fois : la cause, avec sa ligne

Reproduit dans un navigateur avant tout correctif, et mesuré :
**une consigne avant la première sauvegarde, deux après**, la seconde
sauvegarde écrivant dans une séquence orpheline (`campaignId` NULL) pendant que
l'étape de la campagne gardait l'ancien texte.

**`components/settings/email-sequences-panel.tsx` — `setSequences(result.data.sequences)`.**
Le panneau est monté *dans* la carte de campagne depuis le jalon 54 (`embedded`),
avec **une** séquence ; la réponse du serveur en porte **toutes**. Après une
sauvegarde, le panneau embarqué adoptait donc la liste entière du CRM. Il ne
remplace plus désormais que **sa** séquence, par identifiant.

### 3 · Deux gestes, et un seul dépense

Le jalon 56 avait branché la composition sur « Enregistrer » pour supprimer la
boucle de vingt-quatre heures. C'était juste au premier enregistrement et faux à
tous les suivants : corriger une consigne relançait des appels facturés et
écrasait des brouillons qu'on était peut-être en train de relire. Même chose sur
l'inscription.

| Geste | Ce qu'il fait |
|---|---|
| **Enregistrer** | configuration pure : aucun appel au modèle, aucun brouillon, aucun effet de bord, rejouable autant de fois qu'on veut |
| **Inscrire** | choisit qui, pas ce qu'on écrit |
| **« Écrire les mails »** | le seul geste qui dépense, et il annonce son prix avant |

Ce qui est supprimé n'est pas l'immédiateté du jalon 56 — le bouton est sur la
même carte, à un clic — mais le fait qu'elle partait d'un geste qui ne la
demandait pas. `composeAfterSave` est supprimée.

**La confirmation dit trois nombres plutôt qu'un**, parce qu'ils n'engagent pas
la même chose : `fresh` (des contacts qui n'ont rien reçu), `rewritten` (des
brouillons en attente **délibérément** reconstruits avec les consignes du jour —
c'est ce qui fait qu'un nouvel angle profite à ce qui n'est pas encore parti) et
`edited` — **le seul qui coûte quelque chose à l'utilisateur**, et il est nommé :
« 1 brouillon que vous avez retouché à la main sera remplacé ». Un « certains
brouillons seront remplacés » ne se décide pas : on ne sait pas s'il s'agit d'un
texte ou de douze. `SequenceDeparture.editedAt` (migration `30_departure_edited`)
porte cette retouche, posée par `saveDeparture`.

**Les contacts déjà servis ne sont jamais réécrits** : on ne réécrit pas un
message qui est parti. Et **l'envoi seul démarre la séquence** — composer
n'avance aucun `lastStep`, ce qui était déjà vrai et reste vérifié.

### Jalon 70 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `30_departure_edited` appliquée puis
`migrate diff` **vide**), le serveur standalone de production, un puits SMTP
réel, le substitut Anthropic, **par les routes HTTP réelles et au navigateur** :

- **enregistrer deux fois** : HTTP 200 les deux fois, **0 départ créé**, la
  seconde consigne réellement en base, **1 seule séquence** (plus d'orpheline) ;
  au clic : un seul appel, `POST /api/sequences-email`, et rien d'autre ;
- **le plan ne facture rien** : 3 brouillons annoncés, 0 appel, 0 départ ;
- **écrire** : 3 départs en file, **0 envoi** ;
- **retouche à la main** : `editedAt` posé, le plan suivant annonce
  « neufs 0 · réécrits 3 · retouchés 1 », et la réécriture remplace bien l'objet
  écrit à la main ;
- **envoyer** : `lastStep` passe de 0 à 1 pour le seul inscrit servi, et le plan
  suivant ne le réécrit plus (« réécrits 2 ») ;
- **retirer** : statut `removed`, 0 départ en attente restant, fiche, envois et
  interactions **intacts**, la carte de campagne ne le montre plus, `/emails`
  garde son envoi passé ; réinscription → **1 seule** inscription, `active`,
  `lastStep=0`, et le contact redevient composable ;
- **au navigateur** : « Écrire les mails » atteignable, la confirmation nomme la
  portée, le coût, « les contacts déjà servis ne sont pas réécrits » et le
  nombre de retouches ; **les deux boutons sont désactivés pendant l'écriture**
  (mesuré à +150 ms et +1,6 s), **0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1193 tests**) et
  `npm run e2e` (**29 tests**) verts.

`tests/campaign-removal-source.test.ts` fixe le vocabulaire du retrait, le fait
que rien de la fiche n'est touché, la réactivation sans doublon, et que la
réécriture ne vise qu'un brouillon en attente. Les deux gardes de
`compose-source.test.ts` qui exigeaient la composition à l'enregistrement sont
**réécrites dans l'autre sens**, avec la raison du renversement.

### Jalon 70 — ce qui n'est pas fait

**Le retrait n'a pas d'annulation.** Réinscrire ramène la personne et la remet à
l'étape 1 ; cela ne rejoue pas l'historique de sa précédente inscription, qui
n'existait de toute façon que comme envois — et ceux-là n'ont pas bougé.

**Aucun écran ne liste les brouillons retouchés à la main.** Le nombre est
annoncé dans la confirmation ; savoir *lesquels* demande de parcourir la file.

**La réécriture est tout ou rien.** « Écrire les mails » reconstruit tous les
brouillons en attente, ou aucun — on ne choisit pas d'épargner celui qu'on vient
de corriger. Le refuge est le même qu'ailleurs : ne pas cliquer, ou renvoyer le
départ depuis sa carte.

---

## Jalon 71 — une grille, puis une page ; et l'audit des agents

### 1 · Où les six autres agents restaient visibles

Audit fait **avant tout correctif**, page par page, sur le rendu réel — le
tableau est la réponse à la question posée :

| Surface | Agents désactivés visibles | Verdict |
|---|---|---|
| rail (toutes les pages) | aucun | filtre `enabled && !locked` depuis le jalon 32 |
| `/conseil` (bande, roster, pied) | aucun | filtre `enabled` |
| `/`, `/contacts`, `/campagnes`, `/emails`, `/taches` | aucun | ils n'en parlent pas |
| **`/conseil/suggestions`** | **`sarah`** | **le seul défaut** |
| `/reglages` → Conseil | les sept | **voulu** : c'est l'écran où l'on réactive |
| `GET /api/agents` | les sept | **voulu** : c'est ce qui alimente `/reglages` |

**La cause, avec sa ligne.** Les puces d'agent de `/conseil/suggestions`
venaient de `SHIFTS` (`lib/agents/shifts/run.ts`), une liste **écrite dans le
code** qui ne peut par construction rien savoir de l'activation. C'est
exactement le défaut que le jalon 32 avait corrigé dans le lanceur de vacations,
au même endroit et pour la même raison : **le filtre appartient au code qui lit
la base, jamais à la liste écrite en dur**. Sarah, désactivée et dont aucune
vacation ne tourne plus, y gardait donc sa puce — et elle la portait sous son
slug, pas sous son nom réglé.

`lib/domain/shift-chips.ts` (pur, testé) filtre sur `enabled` et rend le **nom**.
Une exception, et c'est la règle du filtre orphelin du jalon 31 : un agent
**actuellement sélectionné** garde sa puce même désactivé, sinon un lien mis en
favori sur `?agent=sarah` ouvrirait une liste filtrée qu'aucun contrôle ne nomme.

**Rien n'a été supprimé.** Les sept gardent leurs conversations, leurs constats
et leur historique de vacations, et se réactivent d'un interrupteur dans
`/reglages`.

### 2 · Les campagnes, en deux niveaux

| | La grille (`/campagnes`) | La page (`/campagnes/[id]`) |
|---|---|---|
| Pour | **choisir** une campagne | **travailler** une campagne |
| Porte | nom, boîte et signataire en une ligne, état, trois nombres, avancement | en-tête et actions, entonnoir, sélection, inscrits, étapes, départs |
| Ne porte pas | ni étapes, ni inscrits, ni entonnoir | — |

**L'état est dérivé, jamais stocké** (`lib/domain/campaign-status.ts`) — même
règle que le statut de relance du jalon 6 : une colonne à tenir à jour finirait
par afficher « brouillon » au-dessus de trois cents messages partis.
« Brouillon » veut dire **ne peut pas envoyer**, et la vignette dit alors
pourquoi : « Aucune étape ne porte de consigne », « Personne n'est encore
inscrit ». Une campagne qui a fini d'envoyer reste « en cours » jusqu'à ce qu'on
l'archive : la faire retomber en brouillon ferait lire un travail terminé comme
un travail jamais commencé.

**L'avancement compte des messages dus**, pas des jours : `inscrits × étapes` au
dénominateur, et **il ne recule pas quand quelqu'un répond**. Retirer les étapes
qu'une inscription arrêtée n'enverra plus ferait grimper la barre à chaque
réponse, c'est-à-dire exactement quand la campagne réussit — c'est le
dénominateur de l'anneau du jalon 20, appliqué ici.

**« Lancer » n'est pas « Désarchiver ».** La pause coupe l'écriture et l'envoi et
laisse tout le monde où il en est ; l'archivage clôt la campagne (inscriptions
arrêtées avec leur motif, départs en attente écartés). Les départs déjà composés
restent en file pendant une pause : ils ont été écrits et payés, et la file se
valide à la main de toute façon.

**Deux contrôles pour une même chose, supprimés** : le panneau d'étapes embarqué
portait encore son propre champ de nom et sa case « Active », que l'en-tête
porte désormais. Deux contrôles d'un même réglage sur un même écran finissent
par se contredire, et l'on ne sait plus lequel a décidé.

**La liste ne lit plus les inscrits de chaque campagne** — c'était une requête
par campagne pour une liste qui n'apparaît nulle part sur cet écran. Les trois
nombres viennent de la même lecture que l'entonnoir, et `mailbox-options.ts`
donne aux deux pages **exactement** les mêmes options de boîte.

`/departs?campagne=<id>` borne la file du matin à une campagne, **avec son
bandeau et de quoi l'annuler** (règle du jalon 31) : une copie de la file dans la
page d'une campagne aurait fait deux endroits où valider un même brouillon.

### Jalon 71 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration), le
serveur standalone de production et un navigateur piloté, sur six campagnes
couvrant les trois états :

- **la grille** : 3 vignettes par rangée à 1440×900, **les 6 visibles sans
  défiler**, page haute de 900 px là où une seule carte occupait l'écran ;
  chaque vignette porte nom, boîte · signataire, état, inscrits / envoyés /
  réponses et sa barre ; **aucune étape, aucun inscrit, aucun entonnoir** ;
- **les trois états rendus** — en cours, brouillon, archivée — et la cause du
  brouillon nommée sur la vignette ;
- **le détail** : clic → `/campagnes/<id>` avec l'en-tête, « Écrire les mails »,
  « Mettre en pause », « Archiver », l'entonnoir, la sélection, les inscrits avec
  leur étape et leur état, les étapes éditables et le lien vers ses départs ;
- **les étapes se modifient et s'enregistrent** (relu en base par position) ;
  **« Mettre en pause » → `active: false`, « Lancer » → `active: true`** ;
- **`/departs?campagne=`** nomme la campagne et propose de revenir à toute la
  file ;
- **à 390 px** : une vignette par rangée, **0 débordement horizontal** sur les
  deux écrans, « Écrire les mails » à 44 px et atteignable ;
- **agents** : `/conseil/suggestions` ne porte plus que Sabrina, sous son nom ;
  `?agent=sarah` garde sa puce pour pouvoir l'annuler ; `/reglages` montre
  toujours les sept ; **0 agent supprimé** ;
- **0 erreur console, 0 réponse ≥ 400** sur tout le parcours ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1205 tests**) et
  `npm run e2e` (**34 tests**, six fichiers) verts.

`tests/e2e/campaign-grid.e2e.ts` **mesure** ce qui a été reproché : combien de
vignettes tiennent dans un écran, combien par rangée, et qu'une vignette ne
porte aucun champ du détail. Cela ne se lit pas dans le code — c'est la leçon du
jalon 60.

### Jalon 71 — ce qui n'est pas fait

**Le nom de la campagne et celui de sa séquence peuvent diverger.** L'en-tête
renomme la campagne ; la séquence garde le sien, qui sert les pastilles de
`/emails`. La divergence existait déjà avant ce jalon — le panneau embarqué
permettait de renommer la séquence séparément — mais le champ qui le faisait a
disparu, donc elle ne se corrige plus depuis cet écran.

**La grille ne se filtre ni ne se trie.** Les campagnes sortent par date de
création, archivées comprises. À six c'est lisible ; à trente il faudra au moins
une puce « actives / archivées ».

**Aucun écran ne liste « les campagnes dont la boîte ne signe pas »** — la
vignette le dit campagne par campagne, comme la carte le faisait au jalon 64.

**Les six agents restent visibles dans `/reglages` et dans `/api/agents`**, et
c'est voulu : c'est l'écran et la route qui servent à les réactiver. Rien ne les
supprime, et rien ne le fera sans demande explicite.

---

## Jalon 72 — chercher une marque, c'est lire une liste alphabétique

### La question posée, et la réponse mesurée

**`searchText` ne pouvait pas servir.** Il concatène *tous* les champs
cherchables — pour une société nom + domaine + secteur + ville, pour un contact
prénom + nom + adresse. Trier dessus classerait « Alpha » d'après
« alpha lyon » : il est fait pour `contains`, pas pour `ORDER BY`.

**La collation du serveur ne pouvait pas servir non plus**, et c'est mesuré
plutôt que supposé. Cette base tourne en **`C.UTF-8`**, donc en ordre d'octets :

```
ORDER BY name  →  Alpha | ELIXIR | Eden | Effet | Zèbre | elixir | Édition | Élixir
```

C'est exactement le défaut signalé. Une collation ICU (`fr-FR-x-icu`) rend le
bon ordre — vérifié, elle est disponible ici — mais elle dépend de la
construction du serveur et du `datcollate` de la base : **un tri juste en
développement et faux en production est ce que le jalon 10 a refusé** en
écartant `unaccent`. Et Prisma ne sait pas exprimer `COLLATE` dans un
`orderBy` : il faudrait passer chaque liste en SQL brut et y perdre la
composition des filtres de colonne.

**Retenu : une colonne miroir dédiée**, `nameKey`, écrite par l'application —
le motif de `searchText`, avec une clé qui ne porte *que* le nom. La règle vit
dans `lib/domain/sort-key.ts`, en TypeScript, testable sans base.

### Nulle, et non vide

`sortKey()` rend **`null`** quand il n'y a pas de nom, jamais `""`. La chaîne
vide est le plus petit préfixe de tout : stockée, elle classerait les fiches
sans nom **en tête**, en poussant les vraies entrées vers le bas — l'inverse de
ce qui est demandé. `null` laisse `ORDER BY … NULLS LAST` faire le travail en
SQL, sans tri en mémoire et sans valeur sentinelle, qui serait une décision
d'affichage rangée dans une colonne. `compareKeys()` applique la même règle aux
listes agrégées, qui se trient après lecture.

**Les ligatures aussi.** `fold()` retire les accents *combinants* ; « ł », « ø »
et « œ » sont des lettres à part entière que NFD laisse intactes, et dont le
point de code passe après « z » — « Œuvre de Peau » se serait classée après
toutes les autres. Une petite table les ramène à leur base, **dans
`sort-key.ts` et non dans `fold()`** : modifier `fold()` changerait la valeur
stockée de `searchText` sur chaque fiche sans que rien ne la recalcule.

### Ce qui change de défaut, et ce qui n'en change pas

| Écran | Avant | Après |
|---|---|---|
| `/societes` | `name` (donc ordre d'octets) | **`nameKey`, plié** |
| `/contacts` | par nom de personne | **par maison, puis par personne** |
| `/clients` | par chiffre d'affaires | **par maison, puis par personne** |
| `/campagnes` | par date de création | **par nom** |
| `/departs` | échéance | **inchangé** |
| file d'accueil | urgence | **inchangé** |
| journal `/emails` | antichronologique | **inchangé** |

**Aucun contrôle de tri n'est retiré**, et le choix continue de vivre dans
l'URL : `?sort=createdAt` s'ouvre toujours, et `/clients` garde son classement
par chiffre d'affaires à un clic. `lastName` rejoint le vocabulaire de tri des
contacts, pour qu'une vue mise en favori sur l'ancien défaut continue de
l'ouvrir.

**Tous les menus de noms sont alphabétiques**, et le combobox trie **en son
sein** plutôt que chez ses appelants : laisser l'ordre à chaque appelant
garantissait qu'un seul l'oublierait. Les facettes (secteur, étiquette), les
sélecteurs de `/emails` (signataire, séquence, campagne) et les contacts d'une
société suivent la même clé. Les `localeCompare` qui traînaient sont remplacés :
ils suivaient la locale du **conteneur**, pas celle de l'utilisateur, et
faisaient varier l'ordre d'un environnement à l'autre.

### Deux gardes, et ce qu'elles ont attrapé

`tests/name-key-source.test.ts` échoue si un chemin d'écriture écrit un nom sans
sa clé. **Le jalon 12 a payé cette leçon une fois** : `searchText` était composé
à la main sur chaque chemin, deux l'oubliaient, et les fiches entrées par là
restaient introuvables. Ici le défaut serait plus discret encore — la fiche
s'affiche, simplement reléguée après toutes les autres. Éprouvée en retirant la
clé de l'import de contacts : le test tombe en nommant le fichier et en comptant
« 2 miroir(s), 1 clé(s) ».

**La garde du jalon 42 a fait son travail toute seule** : `nameKey` absente de
la sauvegarde, et deux tests sont tombés — une restauration aurait rendu toutes
les fiches sans clé, donc toutes en fin de liste alphabétique. C'est le genre de
perte qui ne ressemble pas à une perte.

### Jalon 72 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `31_name_key` appliquée puis
`migrate diff` **vide**), le serveur standalone de production et un navigateur
piloté, sur des marques réellement accentuées :

- **l'ordre rendu** : `Åby Nordic · argalys essentiels · Éclat Naturel · Eden
  Botanique · Édition Limitée · Effet Papillon · ELIXIR Cosmétiques · Linae ·
  Numorning · Ôdyssée Beauté · Œuvre de Peau · Über Clean · Zénith Labs` —
  « Édition » entre « Eden » et « Effet », « ELIXIR » majuscule avec les E, et
  rien après « Z » ;
- **l'écran dit la même chose que SQL**, comparé ligne à ligne ;
- **`/contacts`** : par maison, puis par personne à l'intérieur (« Ardent
  Bruno » avant « Ardent Élodie »), la **fiche de marque sans personne en fin de
  sa maison**, et les fiches **sans société en fin de liste** ;
- **`/campagnes`** : `Alpha test · eden relance · Élan printemps · Zèbre
  septembre` ;
- **le journal `/emails` reste antichronologique** — le message du jour en
  tête — et son tri par nom, lui, est plié (`?tri=objet` → Alpha, Édition,
  Zèbre) ;
- **le combobox de société** s'ouvre alphabétique, et la recherche reste
  insensible aux accents (« eclat » trouve « Éclat Naturel ») ;
- **le rattrapage de migration** : clés vidées puis recalculées en SQL pur →
  ordre identique à celui qu'écrit l'application ;
- **0 erreur console** ; `npm run build`, `npx tsc --noEmit`,
  `npx vitest run` (**1220 tests**) et `npm run e2e` (**37 tests**) verts.

### Jalon 72 — ce qui n'est pas fait

**Le rattrapage SQL n'est pas l'exacte règle TypeScript.** `translate()` ne sait
pas rendre deux lettres pour une : les ligatures sont traitées par des
`replace()` explicites (œ, æ, ß, þ), et la liste d'accents couvre l'alphabet
latin courant. Un caractère exotique hors de ces deux listes garderait sa forme
jusqu'à la prochaine écriture de la fiche, où `sort-key.ts` — la référence —
réécrit la valeur exacte. Les deux ont été comparés sur le jeu de vérification :
ordre identique.

**Le tri de `/contacts` par maison ne regroupe pas visuellement.** Les fiches
d'une même société se suivent, mais rien ne dessine le groupe : c'est une liste
triée, pas une liste groupée.

**`/clients` change de défaut**, de « plus gros clients d'abord » à
alphabétique. C'est ce qui a été demandé — une liste de référence —, mais la
lecture « qui pèse le plus » demande maintenant un clic sur la colonne.

**Aucun index sur `campaigns.nameKey`** : la table se compte en dizaines, là où
contacts et sociétés se comptent en centaines et portent chacune le leur.

---

## Jalon 73 — Alex lit le prospect avant de lui écrire

### La règle qui décide de tout le jalon

**Un fait sur le prospect vient d'une page lue, ou il ne s'écrit pas.** Un
brouillon qui parle de « votre gamme de probiotiques » à une marque de bougies
ne coûte pas un email, il coûte le prospect, définitivement. La recherche ajoute
de la précision ; elle n'ajoute jamais de licence à supposer.

Tout le reste en découle : la recherche ne rend pas une prose libre mais des
**faits attribués**, chacun avec son URL. Une prose se recopie sans qu'on sache
ce qui vient de la page et ce qui vient du modèle ; un fait porte sa source, et
la carte de départ peut la montrer.

### Un appel séparé, et non des outils greffés sur la rédaction

C'est la décision d'architecture. Brancher `web_search` sur l'appel de rédaction
était plus court à écrire et faux sur trois points :

1. **le cache** — une recherche appartient à la *société*. Trois personnes d'une
   même maison la partagent ; inline, chacun des trois brouillons la repaierait ;
2. **la persistance** — recomposer un brouillon, ce que « Écrire les mails » fait
   délibérément depuis le jalon 70, repaierait la lecture à chaque fois ;
3. **le garde-fou** — vérifier qu'une affirmation vient d'une page suppose de
   *disposer* de ce qui a été lu, comme donnée, séparément du brouillon. Fondus
   dans un seul appel, les deux ne sont plus comparables.

La rédaction garde donc exactement la forme qu'elle avait — un appel, aucun
outil, un JSON — et reçoit la recherche comme un fait de plus dans son dossier.

`web_fetch_20260209` et `web_search_20260209`, et **rien d'autre** : ces variantes
exécutent déjà du code sous le capot pour leur filtrage, et déclarer
`code_execution` à côté embrouillerait le modèle. `web_fetch` ne va chercher que
des URL déjà présentes dans la conversation, d'où l'adresse du site écrite en
toutes lettres dans la demande.

### Ce qu'Alex reçoit, sous les deux formes

Même construction que le DM du jalon 48 et l'angle de rôle du jalon 53 : la
consigne se déduit du fait, et **le cas négatif est une interdiction explicite**,
jamais une omission.

| | Ce que la consigne dit |
|---|---|
| recherche exploitable | les faits, un par ligne, avec leur URL, puis « tout ce qui ne figure pas dans cette liste, tu ne le sais pas » |
| rien d'exploitable | « AUCUNE RECHERCHE EXPLOITABLE » + la cause + « les déduire de son nom ou de son secteur est exactement l'erreur qui fait perdre un prospect » |

« Exploitable » demande **deux faits, pas un** : un seul produit l'accroche
générique qu'on cherche à quitter. Un fait **sans URL est écarté avant d'atteindre
le prompt** — le modèle peut rendre un fait parfaitement plausible sans l'avoir
lu, et c'est précisément le mode de défaillance qu'on craint.

### Le garde-fou, et pourquoi il signale au lieu de corriger

`ungroundedClaims()` compare les affirmations produit du brouillon au **texte
réellement lu** — le corpus, pas le résumé : un résumé aurait déjà perdu le mot
cherché, et la garde signalerait un fait pourtant exact.

Elle **ne réécrit rien** : un remplacement automatique dans un texte commercial
ferait plus de dégâts qu'il n'en répare. Elle signale, en rouge, sur la carte,
avant l'envoi. Et elle est volontairement **étroite** — le vocabulaire de
catégorie, pas toute phrase : une garde large sonnerait sur chaque brouillon, et
une alerte qui sonne toujours est une alerte qu'on apprend à ignorer (jalon 62).

Elle est **recalculée à la lecture**, comme la virgule de l'appel au jalon 68 :
c'est ce qui fait qu'une retouche à la main est vérifiée elle aussi.

### Le coût, et ce qui est mesuré séparément

`research` devient un **usage à part entière** du compteur du jalon 36. Le mêler
à `draft` ferait une moyenne qui ne décrit ni l'un ni l'autre : une recherche lit
des pages, son entrée pèse un ordre de grandeur de plus. Elle n'a pas de réglage
de modèle propre pour autant — elle suit celui de la rédaction : un usage
distinct pour la *mesure*, pas une seconde décision à prendre dans un écran.

La confirmation de « Écrire les mails » annonce les recherches **par maison** :
une campagne de cinquante contacts chez dix marques paie dix lectures, pas
cinquante, et le dire évite la surprise dans les deux sens.

### Jalon 73 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `32_company_research` appliquée puis
`migrate diff` **vide**), le serveur standalone, le substitut Anthropic étendu
pour rejouer **les blocs de résultat des outils serveur** tels que l'API les
rend, et un navigateur piloté :

- **une recherche pour trois collègues** : 4 contacts, 2 maisons, **1 seul appel
  de recherche facturé** ; recomposer les quatre brouillons n'en déclenche
  **aucun** de plus, et le plan annonce alors « 0 recherche » ;
- **sur le fil** : outils `web_fetch_20260209 ×4` et `web_search_20260209 ×3`,
  **aucun `code_execution`**, l'URL du site dans le message, effort `medium` ;
- **la rédaction reçoit les faits** : produit, modèle d'affaires, hésitation
  d'achat et l'URL source, plus l'interdiction d'écrire autre chose ;
- **le contact sans site reçoit l'interdiction**, avec sa cause nommée, et
  **aucun fait de l'autre maison ne fuite** dans sa requête ;
- **une lecture qui échoue ne fabrique rien** : erreur d'outil rejouée (un objet
  là où le succès met une liste, en HTTP 200) → 0 fait, cause `thin`, corpus vide ;
- **le garde-fou** : une retouche à la main inventant « bougies parfumées » est
  signalée en rouge sur la carte (« « bougie » n'apparaît dans aucune des pages
  lues ») ; une phrase appuyée sur le site ne déclenche rien ;
- **la carte** : « Alex a lu : … » avec deux sources cliquables
  (`target="_blank"`, `rel="noopener noreferrer"`), et « Aucune recherche : Aucun
  site connu sur la fiche ni sur la société » pour le repli ;
- **les règles précédentes tiennent**, vérifiées sur le fil : le fait des 69 %,
  « conseiller de vente », la signature, le DM conditionnel, l'angle de rôle,
  l'appel, l'objet qui nomme la marque, **aucun tiret long** ;
- **0 erreur console** ; `npm run build`, `npx tsc --noEmit`,
  `npx vitest run` (**1246 tests**) et `npm run e2e` (**37 tests**) verts.

`tests/research-grounding-source.test.ts` ferme les trois façons de rater ce
jalon, et a été **éprouvée en réintroduisant deux d'entre elles** : la consigne
rendue inconditionnelle, et le garde-fou débranché. Chaque fois un test tombe en
nommant le défaut.

### Jalon 73 — ce qui n'est PAS vérifié, et c'est important

**Aucun site réel n'a été lu, et aucun appel Anthropic réel n'a eu lieu.** Deux
blocages indépendants dans cet environnement : il n'y a pas de clé d'API, et la
sortie réseau est restreinte à une liste blanche (npm, PyPI, l'API Anthropic) —
`minimiil.com` est injoignable d'ici. Le contenu de page servi au substitut est
donc **écrit à la main**, pas récupéré.

Ce que cela établit : la forme de la requête, la lecture des blocs de résultat,
le cache par société, la persistance, le repli nommé, le garde-fou, la carte, et
que les faits atteignent bien le modèle. Ce que cela **n'établit pas** :

1. **que la recherche ramène de bonnes pages.** Que `web_search` trouve le bon
   site et que `web_fetch` en tire ce qui compte relève de l'outil et du modèle ;
2. **qu'Alex juge bien ce qui est pertinent.** C'est le point que seul un vrai
   brouillon montrera, et c'est le risque principal du jalon ;
3. **le coût et la durée réels.** Le substitut facture ce qu'il reçoit, or les
   pages ramenées par les outils sont facturées en entrée par la vraie API. Les
   chiffres mesurés ici (462 jetons d'entrée, 48 ms) ne décrivent donc **pas** une
   vraie recherche. L'estimation part de repères prudents — 25 000 jetons
   d'entrée, 1 200 de sortie — et le compteur du jalon 36 les remplacera par la
   moyenne réelle dès les trois premières recherches facturées, l'écran disant
   laquelle des deux sources il utilise.

**Le premier vrai brouillon en production est le seul juge** des trois points.

### Jalon 73 — ce qui n'est pas fait

**La recherche n'est pas sauvegardée.** `CompanyResearch` ne fait pas partie des
dix modèles de `BACKED_UP` : c'est de la donnée dérivée et volumineuse (le corpus
d'une page), qui se relit. Même décision que le logo au jalon 62, avec la même
conséquence assumée — après une restauration, la première composition relit les
sites.

**Aucun bouton pour relancer une recherche à la main.** `researchCompany(id,
{force: true})` existe et est exercée, mais aucun écran ne l'appelle : une
recherche se rafraîchit quand elle a plus de `FRESH_DAYS` (90 jours), ou jamais.

**Le garde-fou ne connaît que des noms de catégorie.** Une affirmation fausse
formulée sans l'un de ces mots — « votre modèle par abonnement » sur une marque
qui vend à l'unité — passera. La liste est volontairement courte pour ne pas
sonner à tort ; elle s'allongera avec ce que les vrais brouillons montreront.


---

## Jalon 74 — une recherche cassée ne ressemble plus à une fiche incomplète

### Le diagnostic, dans l'ordre des trois hypothèses

**1 · La recherche est-elle branchée sur le chemin du tiroir de contact ?**
**Oui, et elle l'a toujours été.** `draftEmail` est le seul appelant de
`researchCompany` (`lib/agents/email-draft.ts:599`), et les deux chemins y
passent : `app/api/emails/route.ts:66` pour le tiroir,
`lib/api/departures.ts:258` pour la campagne. Le brouillon du tiroir portait donc
bien sa recherche.

**Ce qui divergeait, c'est l'écran.** `ResearchNote` n'était monté que dans
`components/sequences/departures-view.tsx` ; `components/emails/compose-panel.tsx`
n'en portait aucune trace. Le tiroir ne pouvait donc **rien** montrer de la
recherche, réussie ou non — « aucun signe de recherche » était garanti par
construction, indépendamment de ce qui s'était passé.

Une seconde divergence, trouvée en lisant les deux : la file jugeait
qu'une recherche était exploitable sur son seul `gap`
(`usable: gap === null`), **sans regarder les faits**, et ne chargeait même pas
la table des faits. Elle pouvait annoncer « Alex a lu » au-dessus d'un brouillon
qui n'avait rien lu.

**2 · L'appel part-il ?** Non vérifiable depuis cet environnement — il n'y a ni
clé d'API ni accès à la base de production. **Où le lire chez vous** :
`/reglages` → « Coûts de l'API », ventilation par usage. La ligne `research`
existe depuis le jalon 73 et n'est écrite qu'**après une réponse reçue**
(`recordUsage` est appelé après `messages.create`). Zéro appel facturé veut donc
dire l'un de trois choses, et elles ne se corrigent pas au même endroit :
aucune société rattachée, aucun site connu, ou un appel qui n'a jamais abouti.
C'est précisément ce que la carte distingue désormais.

**3 · Les identifiants d'outil sont-ils les bons ?** **Oui.**
`web_fetch_20260209` et `web_search_20260209` figurent tous deux dans le
`ToolUnion` **hors bêta** du SDK installé (`@anthropic-ai/sdk` 0.115.0,
`resources/messages/messages.d.ts:1701` et `:1954`) — ce sont des identifiants
courants, sans en-tête bêta. Le SDK connaît aussi des variantes plus récentes
(`web_fetch_20260309`, `*_20260318`) ; celles employées restent valides. Ce que
je **ne peux pas** établir d'ici : qu'elles soient activées **sur ce compte**.
Une garde compare maintenant les deux chaînes au SDK installé, à chaque suite de
tests.

### La cause nommée

**Aucune des trois hypothèses n'était la cause unique, et c'est le fond du
problème : rien à l'écran ne permettait de les départager.** Un appel refusé
était rangé sous le même `gap: "unreachable"` qu'un site illisible, et une
société sans site rendait une phrase de la même couleur, du même ton, au même
endroit. Pire, le tiroir n'en montrait aucune. On cherchait donc la donnée
manquante pendant que la chaîne pouvait être en panne.

**Et l'échec se figeait.** `researchCompany` enregistrait l'erreur avec
`fetchedAt: now`, donc `isStale` la tenait pour fraîche pendant les 90 jours de
`FRESH_DAYS` : **une coupure d'une minute coûtait un trimestre de messages
génériques sur cette maison**, sans rien qui le dise et sans aucun bouton pour
relancer (dette reconnue au jalon 73).

### Ce qui change

| | Avant | Après |
|---|---|---|
| états de recherche | `no-domain` / `unreachable` / `thin` | **`failed` séparé**, avec la raison exacte en `summary` |
| un appel refusé | `unreachable`, indiscernable d'un site illisible | `failed`, nommé, et journalisé côté serveur |
| un plafond de budget atteint | `unreachable` | `failed` — ce n'est pas une fiche à compléter |
| un échec en cache | frais 90 jours | périmé après `RETRY_MINUTES` (30 min), donc **retenté** |
| le verdict d'exploitabilité | recomposé dans la file | `researchCard()`, dans le domaine |
| le tiroir de contact | **rien** | la même carte que la file |

`researchCard()` (pur, testé) rend les trois états demandés, et ils sont
**visuellement distincts** :

- « Aucun site connu sur la fiche » / « Aucune société rattachée à cette fiche »,
  en gris : c'est la fiche qu'il faut compléter ;
- « **La recherche a échoué : <raison exacte>** », en rouge encadré : c'est nous
  qu'il faut corriger, pas la fiche ;
- « Recherche effectuée, N sources lues », avec le résumé et les pages
  cliquables.

Les deux surfaces montent le **même composant**. Deux rendus d'une même
recherche finiraient par ne plus dire la même chose, et c'est toujours le second
qu'on oublie de corriger (jalons 55, 66 et 67).

### La garde

`tests/research-single-source.test.ts` ferme les trois façons de refaire le
défaut : un second point d'appel de `researchCompany`, une seconde carte, et un
échec rangé sous le même manque qu'une fiche sans site. Elle vérifie aussi les
identifiants d'outil **contre le SDK installé** plutôt que contre un souvenir :
un nom périmé fait échouer l'appel, et le repli rend exactement le brouillon
générique qu'on cherche à quitter — le vérifier coûte une lecture de fichier, le
découvrir en production a coûté une journée.

**Éprouvée en réintroduisant deux défauts exacts** : la note retirée du tiroir,
et l'échec remis sous `unreachable`. Deux tests tombent, chacun nommant le
fichier.

### Jalon 74 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration, `gap`
étant déjà une colonne texte), le serveur standalone de production, le substitut
Anthropic, et **par la route réelle du tiroir de contact**
(`POST /api/emails`, `mode: "draft"`) — c'est le chemin signalé :

- **société avec site lisible** → `state: "read"`, « Recherche effectuée, **2
  sources lues** », le résumé, et les deux URL ;
- **société sans site** → `state: "none"`, « **Aucun site connu sur la fiche** » ;
- **recherche échouée** → `state: "failed"`, « La recherche a échoué » **avec la
  raison exacte** (« L'API Anthropic a refusé la requête (400) : tools.0:
  unknown tool type ») ;
- **le substitut réellement arrêté** en cours de recette → la carte a rendu
  « La recherche a échoué : Impossible de joindre l'API Anthropic. Vérifiez la
  connexion réseau du service. » C'est exactement la situation qui, avant ce
  jalon, se lisait comme une fiche incomplète ;
- **la reprise** : un échec vieilli de 31 minutes est retenté au brouillon
  suivant et rend « Recherche effectuée, 2 sources lues » — la société n'est plus
  gelée ; un échec de moins de 30 minutes est servi depuis le cache, sans
  rappeler l'API ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1262 tests**) verts.

### Jalon 74 — ce qui n'est pas vérifié

**Toujours aucun appel Anthropic réel, et aucun site réel lu.** Les deux
blocages du jalon 73 tiennent : pas de clé dans cet environnement, et la sortie
réseau est sur liste blanche. Ce que cela établit, c'est la chaîne, les trois
états et la reprise ; pas que les outils serveur soient activés sur le compte.

**Le compteur `research` de production n'a pas été lu.** Il est à lire dans
`/reglages` → « Coûts de l'API ». S'il reste à zéro alors qu'une carte annonce
« Recherche effectuée », c'est que tout venait du cache ; s'il reste à zéro avec
des cartes rouges, la raison exacte est maintenant à l'écran.

**Le chemin campagne n'a pas été rejoué dans un navigateur ce jalon.** Il rend
le même `ResearchCard` par le typage, et la garde exige que les deux surfaces
montent la note ; ce qui n'est pas mesuré, c'est son allure sur la carte de
départ après le changement de composant.

**Le garde-fou du tiroir n'est pas recalculé à la retouche.** La file recalcule
`ungrounded` à chaque lecture (jalon 73) ; le tiroir le reçoit avec le brouillon
et ne le recalcule pas si l'on modifie le texte à la main avant d'envoyer.

**Toujours aucun bouton pour relancer une recherche à la main.** La reprise
automatique après échec supprime le cas le plus grave ; rafraîchir une lecture
réussie mais périmée reste l'affaire des 90 jours.


---

## Jalon 77 — des listes nommées, qui ne changent que quand on les change

### La distinction qui justifie la table

| | Ce que ça décrit | Quand ça change |
|---|---|---|
| un **filtre** | une question (« les Lead sans DM ») | à chaque écriture du CRM |
| une **liste** | un choix (« les vingt marques du salon ») | quand quelqu'un le change |
| une **inscription** de campagne | ce qu'on envoie, et où on en est | à chaque étape envoyée |

Les trois cohabitent, et c'est délibéré. Une liste qui se recalculerait serait un
filtre portant un nom — donc un second vocabulaire pour une chose qui existe
déjà ; et enregistrer un filtre sous un nom ne saurait pas décrire « ces
vingt-là », qu'aucune requête unique ne retient. Cocher huit fiches sous un
filtre Instagram puis cinq sous un filtre de rôle produit treize personnes, et
c'est exactement ce qu'une liste sait garder.

Migration `34_contact_lists` : `contact_lists` et `contact_list_members`.
**Une table de jointure, pas une colonne sur la fiche** — une fiche appartient à
autant de listes qu'on veut, et c'est l'usage demandé. L'unicité
`(listId, contactId)` est portée par la base : ajouter deux fois la même fiche
est impossible plutôt qu'improbable, et une course ne contourne pas un index
unique (jalon 8).

`onDelete: Cascade` des deux côtés ne dit pas la même chose : supprimer la liste
efface les appartenances **et rien d'autre** ; supprimer une fiche du CRM emporte
évidemment les siennes, puisqu'elle n'existe plus.

### Un seul tableau, deux routes

`/listes` est une grille de vignettes — nom, compte — et la page d'une liste est
**l'écran de `/contacts` avec une portée** (`app/(crm)/contacts/screen.tsx`).
C'était la demande (« le même tableau, avec les colonnes et le sélecteur
existants ») et la seule façon de la tenir dans le temps : un second tableau
aurait fini par ne plus offrir les mêmes colonnes, et c'est toujours le second
qu'on oublie de compléter (jalons 55, 64 et 66). Colonnes, sélecteur de colonnes,
tri, filtres, tiroir de fiche et sélection à la case viennent donc tels quels.

**Deux défauts que cette réutilisation a créés, et corrigés :** les liens de
filtre écrivaient `/contacts` en dur — au premier clic sur une puce, on aurait
quitté la page de la liste — et le cycle de vie par défaut. Le chemin courant est
maintenant lu (`usePathname`), et la page d'une liste ouvre en `lifecycle=all`
**sauf si l'URL en choisit un** : une liste est un choix fait à la main, en
masquer les fiches closes ferait diverger le compte de la vignette de ce que la
page montre — l'écart que le jalon 49 a payé une fois entre une puce et sa liste.

### Une seule barre de sélection, trois destinations

La sélection à la case du jalon 55 n'existait que pour les campagnes. Elle est
désormais **toujours disponible**, et la barre collée en haut propose, selon le
contexte : « Ajouter à une liste » (partout, avec création à la volée),
« Inscrire dans la campagne » (en arrivant de /campagnes), « Retirer de la
liste » (sur la page d'une liste). Une barre par destination aurait dupliqué le
compteur, le « Vider » et la promesse de survie au filtre.

La portée de la sélection (`lib/client/selection.ts`) distingue
`campagne:<id>`, `liste:<id>` et `contacts` : cocher douze fiches pour une liste
puis passer à une campagne ne doit pas retrouver les douze — on ne voulait pas
les inscrire, on voulait les ranger.

**`resolveSelectionIds` est extraite** (`lib/api/contact-selection.ts`) : la
primauté des fiches cochées sur le filtre est une règle subtile, et la réécrire
pour les listes aurait garanti que la seconde version l'oublie. L'inscription de
campagne l'appelle désormais elle aussi — pas une copie de la logique, la
logique.

### Ce que ces gestes ne font jamais

- **retirer quelqu'un d'une liste n'écrit rien sur sa fiche** : ni cycle de vie,
  ni statut, ni relance. Même discipline que le retrait d'un inscrit de campagne
  (jalon 70), et la confirmation le dit avant le clic ;
- **supprimer une liste ne supprime aucun contact**, et la phrase de
  confirmation — composée dans le domaine, pour qu'elle ne soit pas dite de deux
  façons — répond à la seule question qu'on se pose devant ce bouton ;
- **aucune friction de nom à retaper**, contrairement à une campagne qui a envoyé
  (jalon 61) : là-bas des faits mesurés disparaissaient. Ici rien
  d'irremplaçable ne part, et exiger une cérémonie pour un rangement apprendrait
  à cliquer sans lire les vraies confirmations ;
- **ajouter à une liste n'inscrit personne à une campagne**, et l'inverse non
  plus : lier les deux ferait partir des messages depuis un geste de rangement.

### Les listes se sauvegardent, contrairement à la recherche et au logo

Ces deux-là sont dérivés : ils se relisent, se retéléversent. Une liste, non —
c'est un choix fait à la main, que **rien ne sait reconstituer**. La perdre à une
restauration serait l'incident du jalon 42 sur la donnée la plus chère du
produit. `contactLists` et `contactListMembers` rejoignent donc l'export, le
schéma de restauration et la garde `backup-columns` ; la restauration ne les
efface que si le fichier en porte (règle du jalon 54), et une appartenance dont
la fiche n'est pas dans la sauvegarde est écartée plutôt que de faire échouer la
restauration entière.

### Les gardes

`tests/contact-lists-source.test.ts` ferme les trois façons de rater ce jalon :
une seconde résolution de sélection, un second tableau de contacts, un retrait
qui touche la fiche. **Éprouvée en réintroduisant deux régressions exactes** —
un `contact.updateMany` dans le retrait, et `/contacts` réécrit en dur dans les
liens de filtre : deux tests tombent, chacun nommant le défaut.
`lib/domain/__tests__/contact-lists.test.ts` couvre le nom, la clé de tri, les
deux nombres de l'ajout et la promesse de la suppression.

### Jalon 77 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** (migration `34_contact_lists` appliquée puis
`migrate diff` **vide**), le serveur standalone de production, **par les routes
HTTP réelles** et **dans un navigateur piloté** :

- **1 · créer** : « &nbsp;Salon Beauté 2026&nbsp; » → nom nettoyé de ses espaces,
  liste ouverte sur sa propre page ;
- **2 · dix fiches choisies au fil de deux filtres** (7 sous `owner=Mohamed`,
  3 sous `owner=Yanis`) → `{added: 10, already: 0}`, et la liste contient
  **exactement ces dix-là** — pas les sept du filtre mémorisé ; rejoué →
  `{added: 0, already: 10}`, toujours dix membres ;
- **3 · retirer une fiche** → 1 appartenance retirée, 9 restantes, et
  l'enregistrement du contact **identique champ pour champ** avant/après ;
- **4 · depuis la liste, inscrire à une campagne** → 4 inscrites, 0 refusée ;
- **5 · filtrer /contacts par liste, croisé** : `?liste=…` → 9 fiches ;
  `?liste=…&lifecycle=Prospect` → 3 ; la page nomme la liste et l'offre à
  annuler ;
- **6 · supprimer la liste** → 9 appartenances parties, **14 fiches avant, 14
  après**, et les 8 inscriptions de campagne conservées ;
- **au navigateur (1440×900)** : création depuis `/listes`, cases cochées sur
  `/contacts`, barre et panneau **atteignables** (`reachable()`, jamais
  `isVisible()`), ajout confirmé, retrait confirmé avec sa promesse, suppression
  et retour à `/listes` — **0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1320 tests**) et
  `npm run e2e` (**42 tests**, huit fichiers) verts.

**Un défaut trouvé au navigateur, pas à la lecture** : vider la sélection après
un ajout faisait disparaître la barre — donc le « 8 ajoutées · 2 déjà dans la
liste » avec elle, au moment précis où l'on veut le lire. La barre décide
désormais elle-même de son affichage et reste tant qu'elle a quelque chose à
dire. C'est la troisième fois qu'un test qui clique attrape ce qu'aucune lecture
n'aurait vu (jalons 60, 61, 77).

### Jalon 77 — ce qui n'est pas fait

**Aucune liste ne se remplit toute seule**, et c'est la définition : il n'y a ni
règle d'entrée, ni « ajouter automatiquement les nouvelles fiches d'une
société ». Le jour où ce serait souhaité, ce serait un autre objet — une liste
dynamique — et il faudrait alors dire à l'écran laquelle des deux on regarde.

**La fiche ne dit pas à quelles listes elle appartient.** Le tiroir de contact
n'affiche rien de ses appartenances : on les voit depuis les listes, pas depuis
la personne. Ce n'était pas demandé, et la lecture existe déjà en base — c'est
un affichage à ajouter, pas un modèle à changer.

**Deux listes peuvent porter le même nom.** Le nom est une étiquette humaine, pas
une clé : refuser un homonyme obligerait à inventer « Salon 2026 (2) » là où
l'utilisateur sait ce qu'il fait. Les deux restent distinctes par leur contenu.

**La grille ne se filtre ni ne se trie** — alphabétique, comme toute liste de
référence depuis le jalon 72. À trente listes il faudra au moins une recherche.

**L'export CSV de la page d'une liste exporte le filtre courant**, donc bien les
membres de la liste ; mais rien à l'écran ne le dit, et le bouton porte le même
libellé que sur `/contacts`.

**Les chiffres ci-dessus viennent d'un jeu de vérification** (14 fiches semées),
pas de votre base. Le mécanisme est celui-ci ; vos comptes seront les vôtres.

---

## Jalon 76 — la recherche ne partage plus le modèle de la prose

### La cause, nommée par l'API elle-même

```
400 : 'claude-haiku-4-5-20251001' does not support programmatic tool calling.
The following tools have `allowed_callers` that require it: web_fetch, web_search.
```

Deux défauts se cumulaient, et il fallait corriger les deux — c'est la réponse à
la question posée, « laquelle des deux corrections ».

**1 · Les outils étaient déclarés sans `allowed_callers`.** `web_fetch_20260209`
et `web_search_20260209` portent un filtrage dynamique qui exécute du code sous
le capot : omis, leur jeu d'appelants par défaut comprend l'exécution de code,
donc exige l'appel d'outil programmatique. Nous ne déclarons aucun environnement
d'exécution (c'était déjà écrit au jalon 73, et c'est toujours vrai) : `direct`
est littéralement la seule façon dont ces outils sont appelés ici. Le poser
explicitement retire l'exigence.

**2 · La recherche héritait du modèle de rédaction.** `modelFor("research")`
rendait `row.modelDraft` — décision du jalon 73, et elle n'était pas absurde :
un usage distinct pour la *mesure*, pas une seconde décision à prendre dans un
écran. Mais le réglage de prose décidait ainsi de ce que la lecture peut faire,
et Haiku 4.5 **n'a pas ces outils du tout** : la référence de l'API ne les liste
que sur Opus 5 / 4.8 / 4.7 / 4.6, Sonnet 5 et Sonnet 4.6. La correction n° 1
seule aurait donc échoué autrement, sur le même écran.

### Quel modèle ce compte utilisait, et depuis quand

Le réglage `modelDraft` valait `claude-haiku-4-5` — un choix légitime pour la
prose, que le jalon 36 a explicitement mis dans le sélecteur pour être essayé.
Rien n'avertissait qu'il emportait la recherche avec lui.

**La recherche n'a jamais été exercée contre un modèle qui porte ces outils.**
Les jalons 73, 74 et 75 le disent tous les trois dans leur section « ce qui n'est
pas vérifié » : aucun appel Anthropic réel, aucun site réel lu, environnement
sans clé et sortie réseau sur liste blanche. Le jalon 74 a ajouté une garde qui
compare les deux identifiants à l'union de types du SDK installé — elle ne peut
pas, par construction, savoir sur quels modèles ils sont disponibles. C'est la
limite exacte qui a coûté ce jalon.

### Ce qui change

| | Avant | Après |
|---|---|---|
| déclaration des outils | sans `allowed_callers` | `allowed_callers: ["direct"]` sur les deux |
| modèle de la recherche | `modelDraft`, quel qu'il soit | `researchModelFor(modelDraft)` — conservé s'il sait chercher, sinon **Sonnet 5** |
| capacité d'un modèle | deux drapeaux (réflexion, effort) | un troisième : `researchTools` |
| `/reglages` | muet | avertit **avant d'enregistrer** un modèle incompatible |

`researchModelFor()` vit dans `lib/domain/model-pricing.ts`, à côté des deux
autres capacités — le module pur que le runtime **et** l'écran des réglages
importent déjà. L'avertissement de `/reglages` appelle donc exactement la
fonction que le service appellera : il décrit ce qui va se passer, pas ce qu'on
croit qui se passe. C'est ce qui rend la régression silencieuse impossible —
changer le modèle en Haiku affiche « Haiku 4.5 ne sait pas lire le site d'un
prospect […] la recherche continuera de tourner sur Sonnet 5 », et la recherche
continue de fonctionner plutôt que de produire un mur de cartes rouges.

**Un modèle inconnu rend `false`**, donc retombe sur un modèle capable : même
posture que `modelFor`, où une faute de frappe dans un réglage ne doit pas
devenir une panne. Fable 5 est marqué `false` faute de figurer sur la liste
publiée : marquer « non » coûte un repli, marquer « oui » à tort coûte une
recherche en panne sur chaque société.

### La garde

`tests/research-model-source.test.ts` ferme les trois façons de refaire le
défaut : outils redéclarés sans `allowed_callers`, recherche recollée sans garde
au modèle de rédaction, écran muet. **Éprouvée en réintroduisant les deux
régressions exactes** — `allowed_callers` retiré des deux outils, et
`research: row.modelDraft` remis dans `reference.ts` : deux tests tombent, chacun
nommant le défaut. Un quatrième cas vérifie qu'un modèle capable est **conservé**
tel quel, sans quoi « retomber toujours » passerait la garde tout en ignorant le
réglage de l'utilisateur.

### Jalon 76 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration, la
capacité étant du code pur) et un serveur de capture substitué à l'API, qui écrit
sur disque le corps exact de la requête émise par `researchCompany` :

| `modelDraft` réglé | modèle réellement envoyé | outils sur le fil |
|---|---|---|
| `claude-haiku-4-5` | **`claude-sonnet-5`** | les deux, `allowed_callers: ["direct"]` |
| `claude-sonnet-5` | `claude-sonnet-5` | idem |
| `claude-opus-5` | **`claude-opus-5`** | idem |

- **aucun `code_execution`** déclaré, sur aucune des trois requêtes ;
- la cible de recherche est bien résolue pour les trois sociétés
  (`anatae.fr`, `typology.com`, `nubiance.fr`, source `company-domain`) ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1295 tests**) verts.

### Jalon 76 — ce qui n'est PAS vérifié, et il faut le lire

**Je n'ai pas pu lancer la recherche contre les vrais sites, et la demande
supposait le contraire.** Deux blocages mesurés dans cet environnement, pas
supposés :

1. **aucune clé d'API.** `ANTHROPIC_API_KEY` est vide, le binaire `ant` n'existe
   pas, aucun fichier de justificatifs n'est présent. Un appel nu à
   `api.anthropic.com` rend `401 — x-api-key header is required`
   (`req_011Cf9bV12P8G3Vm973rMsfN`) ;
2. **la sortie réseau est sur liste blanche.** `https://anatae.fr/` et
   `https://www.typology.com/` rendent tous deux `CONNECT tunnel failed,
   response 403` — refus de la politique d'egress, pas une panne de site.

Le compte et l'accès API dont dispose le produit sont ceux **du service
Railway**, pas ceux de cet environnement de développement : c'est bien depuis la
production que le 400 a été obtenu, et c'est depuis elle que la vérification
réelle se fera. Ce qui reste donc à établir au premier vrai brouillon, et que
personne ne peut établir d'ici :

- que les outils serveur soient **activés sur ce compte** ;
- que `web_search` trouve le bon site et que `web_fetch` en tire ce qui compte ;
- le **coût et la durée réels** d'une recherche — le compteur de `/reglages`,
  usage `research`, les remplacera par la moyenne facturée dès les trois
  premières.

Ce que la vérification ci-dessus établit, en revanche, est exactement ce que le
400 mettait en cause : le corps de la requête. Le modèle envoyé et les appelants
déclarés sont lus **sur le fil**, pas dans le code.

**Le repli est silencieux pour la mesure.** Une recherche faite sur Sonnet 5
alors que la rédaction tourne sur Haiku est facturée au tarif de Sonnet, et la
ligne `research` du compteur le reflète — mais aucune carte ne dit « cette
recherche n'a pas tourné sur votre modèle ». L'avertissement vit dans
`/reglages`, là où la décision se prend.

**La recherche n'a toujours pas de réglage de modèle propre**, et c'est
délibéré : ce jalon ajoute un plancher de capacité, pas un second menu.

---

## Jalon 75 — le domaine était dans l'adresse depuis toujours

### Une déduction, pas une supposition

`roxana.beraud@dermoplant.com` **dit** que le site est `dermoplant.com`. La
chaîne est dans la valeur saisie : on ne la devine pas, on la lit. C'est ce qui
sépare cette règle de celle que le jalon 25 a refusé de généraliser — `name`
fabrique `bacha.com` à partir de « Bacha », et rien dans la donnée ne dit que ce
domaine existe, encore moins qu'il appartient au prospect.

La cible de recherche se résout donc en quatre temps, dans l'ordre de certitude
décroissante (`lib/domain/research-target.ts`, pur) :

| Ordre | Source | Ce que la carte affiche |
|---|---|---|
| 1 | `Contact.website` | `dermoplant.com (fiche)` |
| 2 | `Company.domain` | `dermoplant.com (société)` |
| 3 | **domaine de l'adresse électronique** | `dermoplant.com (déduit de l'adresse email)` |
| 4 | rien de lisible | « Aucun site exploitable » — la marque est nommée, aucune adresse n'est inventée (jalon 48) |

**L'ordre est la décision.** Un champ que quelqu'un a saisi l'emporte toujours,
même quand il contredit l'adresse : corriger une valeur saisie à partir d'une
déduction serait décider à la place de l'utilisateur (jalon 8). Vérifié — une
fiche dont le site est `minimiil.test` et la société `societe-autre.test` lit le
premier.

**Un cran moins sûr qu'un champ saisi, tout de même.** Une adresse peut être
celle d'un revendeur, d'une agence, ou fausse dans le fichier source
(`@teledyne.com` sur deux marques de cosmétique, jalon 26). Quand la cible est
déduite, la demande envoyée au modèle porte donc une mise en garde explicite :
*« si la page lue n'est manifestement pas le site marchand de cette entreprise,
rends une liste de faits vide »*. C'est un **échec de recherche**, nommé comme
tel depuis le jalon 74 — jamais une licence à inventer des faits.

### La liste d'exclusion, en un seul exemplaire

Elle vit dans `lib/domain/domain-guess.ts` depuis le jalon 25 et sert désormais
trois choses : la proposition de domaine, l'acceptation groupée, et la cible de
recherche. **Deux listes finiraient par diverger, et c'est la seconde qu'on
oublie de compléter** — une garde statique le vérifie.

Ce qu'elle contient, en entier :

- **Google / Microsoft / Yahoo / Apple** : `gmail.com`, `googlemail.com`,
  `hotmail.com`, `hotmail.fr`, `hotmail.be`, `hotmail.es`, `hotmail.it`,
  `hotmail.co.uk`, `outlook.com`, `outlook.fr`, `outlook.be`, `outlook.es`,
  `outlook.it`, `live.com`, `live.fr`, `live.be`, `msn.com`, `yahoo.com`,
  `yahoo.fr`, `yahoo.co.uk`, `yahoo.es`, `yahoo.it`, `yahoo.de`, `yahoo.ca`,
  `yahoo.com.br`, `ymail.com`, `icloud.com`, `me.com`, `mac.com`, `aol.com` ;
- **fournisseurs d'accès français**, actuels et historiques — ils survivent
  longtemps au fournisseur et restent nombreux dans un vivier importé :
  `orange.fr`, `wanadoo.fr`, `free.fr`, `sfr.fr`, `neuf.fr`, `laposte.net`,
  `bbox.fr`, `numericable.fr`, `club-internet.fr`, `aliceadsl.fr`, `voila.fr`,
  `cegetel.net`, `9online.fr`, `dbmail.com` ;
- **messageries gratuites sans attache** : `gmx.fr`, `gmx.com`, `gmx.de`,
  `gmx.net`, `web.de`, `mail.com`, `email.com`, `protonmail.com`,
  `protonmail.ch`, `proton.me`, `pm.me`, `tutanota.com`, `tuta.com`,
  `fastmail.com`, `hushmail.com`, `zoho.com`, `yandex.com`, `yandex.ru`,
  `qq.com`, `163.com`, `126.com`, `naver.com`.

**Un domaine absent de la liste est traité comme professionnel.** C'est le bon
sens de l'erreur : le manque se voit alors comme une recherche qui n'apprend
rien — nommée, rouge, avec sa raison (jalon 74) — et non comme une invention.

### La provenance voyage jusqu'à l'écran

Deux colonnes sur `CompanyResearch` (migration `33_research_target`) :
`targetHost` et `targetSource`. La carte écrit « Site lu : dermoplant.com
(déduit de l'adresse email) », et l'échec écrit « Site visé : … ».

**C'était la demande, et elle est juste** : si la recherche dérape, la première
question est de savoir si la cible elle-même était déduite. Une recherche
antérieure au jalon 75 ne porte aucune source et la carte **se tait** sur la
provenance plutôt que d'affirmer « fiche » par défaut — afficher une valeur par
défaut ferait passer une inconnue pour un fait.

### Le rattrapage rend la déduction permanente

`/reglages` → « Domaine de société, depuis les adresses email ». Simulation
d'abord, compte relu au moment d'écrire, sauvegarde rendue, idempotent.

Trois décisions, et aucune n'est nouvelle :

1. **Seule la règle `email`.** `proposeDomain` (jalon 25) porte déjà les deux
   règles ; ce panneau filtre sur `rule === "email"`. La supposition tirée du
   nom reste à relire ligne à ligne dans « Domaines proposés », et ce n'est pas
   un rattrapage groupé qui va lui accorder ce que le jalon 26 lui a refusé.
2. **L'écriture passe par `acceptDomain`**, le seul écrivain de domaine du
   produit : il porte la garde « renseigné entre-temps », le recalcul du miroir
   de recherche, la clé de tri et l'effacement d'un refus devenu sans objet.
   Réécrire ces quatre gestes ici en oublierait un, et ce serait le miroir — la
   société resterait introuvable par son propre domaine, défaut du jalon 12.
3. **Les cas douteux en tête** : plusieurs domaines parmi les fiches d'une même
   maison sont proposés en ambre, parce que c'est là que la relecture compte.

**Et cela ferme la boucle** : une fois le domaine écrit, la carte passe de
« déduit de l'adresse email » à « société ». Vérifié.

### La couverture — ce que je peux dire, et ce que je ne peux pas

**Je n'ai pas pu mesurer votre base.** La base locale de vérification a été
vidée au fil des recettes précédentes : elle porte quatre sociétés semées pour
ce jalon, et un chiffre tiré de là ne décrirait rien.

**Le chiffre que je peux citer vient de votre vraie feuille**, relue au
jalon 25 : sur **125 sociétés sans domaine**, **96 portaient une adresse
professionnelle** permettant la déduction et 29 n'offraient que leur nom. Soit
**77 % des sociétés aveugles qui gagnent une cible de recherche**, sans rien
saisir. C'est l'ordre de grandeur, pas votre compte d'aujourd'hui.

**Votre compte exact est désormais affiché dans le produit** : `/reglages` →
« Domaine de société, depuis les adresses email » annonce en tête « N société(s)
sans domaine dont une adresse professionnelle en porte un » et « M autre(s)
n'offrent aucune déduction ». C'est la mesure, et elle se lit sans rien écrire.

### Jalon 75 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (migration `33_research_target` appliquée puis
`migrate diff` **vide**), le serveur standalone de production, le substitut
Anthropic, et **par la route réelle du tiroir de contact** :

- **adresse professionnelle seule** → `state: "read"`, « Recherche effectuée,
  2 sources lues », **« dermoplant.test (déduit de l'adresse email) »** ;
- **adresse chez un fournisseur grand public** → `state: "none"`, **« Aucun site
  exploitable »**, et non un échec : rien n'a été tenté, c'est la fiche qu'il
  faut compléter ;
- **site saisi sur la fiche** → « minimiil.test (**fiche**) », alors que la
  société porte un autre domaine : le champ saisi l'emporte ;
- **domaine de société saisi** → « linae.test (**société**) » ;
- **le rattrapage** : simulation « 1 société, 1 sans déduction possible », la
  raison citée ; `expected: 99` → refus chiffré ; application → 1 domaine écrit,
  **miroir de recherche recalculé** (`dermoplant dermoplant.test`), les trois
  autres sociétés **intactes**, sauvegarde rendue ; rejoué → 0 ;
- **la boucle se ferme** : après le rattrapage, la même fiche rend
  « dermoplant.test (**société**) » ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1286 tests**) verts.

`tests/research-target-source.test.ts` ferme les trois rechutes : une seconde
liste d'exclusion, une seconde résolution de cible dans le service, une seconde
règle de déduction dans le rattrapage. `lib/domain/__tests__/research-target.ts`
couvre l'ordre des sources, les quatorze familles de fournisseurs, le titre de
page refusé et la provenance affichée.

### Jalon 75 — ce qui n'est pas vérifié

**Toujours aucun appel Anthropic réel, aucun site réel lu.** Les deux blocages
des jalons 73 et 74 tiennent. Ce qui est établi : la résolution de la cible, son
enregistrement, son affichage, l'exclusion, le rattrapage et la boucle complète.
Ce qui ne l'est pas : qu'une cible **déduite** ramène effectivement le bon site.
C'est le risque propre à ce jalon, et il se juge sur les premiers vrais
brouillons — la mise en garde envoyée au modèle et la ligne de provenance sur la
carte sont là précisément pour le rendre lisible.

**La couverture de production n'est pas mesurée** — voir plus haut, et le
panneau qui l'affiche.

**Une adresse électronique est lue par société, pas par contact.** La cible est
attachée à la maison (jalon 73) : si deux fiches d'une même société portent deux
domaines professionnels différents, le premier rencontré gagne. `proposeDomain`
sait compter et signaler l'ambiguïté ; la cible de recherche, elle, tranche en
silence. Le cas ne s'est pas présenté sur la base de vérification.

**Les recherches déjà en cache ne sont pas relancées.** Une société marquée
« aucun site » avant ce jalon le reste jusqu'à ce que sa lecture ait plus de
90 jours — ou jusqu'au rattrapage, qui écrit un domaine et rend la fiche
composable à la prochaine recherche. Il n'y a toujours pas de bouton « relire
maintenant » (dette du jalon 73).

---

## Jalon 78 — l'audit du tableau des inscrits

### 1 · L'écart de « Personnes écrites », nommé

La question posée — *52 contre 55, est-ce 55 − 3 ?* — a une réponse, et elle est
oui **sur cette campagne**, pour une raison qui n'est pas celle qu'on croit.

**Deux chemins retirent quelqu'un d'une campagne et n'écrivent pas le même
statut :**

| Geste | Statut écrit | Dans le tableau |
|---|---|---|
| « Retirer » sur la carte de campagne (`removeMember`) | `removed` | **la ligne disparaît** |
| « Retirer » depuis la file des départs (`removeFromSequence`) | `stopped`, raison « Retiré de la séquence à la main » | **la ligne reste**, avec un tiret |

Les trois lignes signalées viennent du second chemin. Elles sont donc bien
listées, et n'ont jamais rien reçu — d'où 52 personnes écrites pour 55 lignes.

**« Personnes écrites » n'était pas faux, il était seul.** Deux nombres justes
affichés l'un au-dessus de l'autre, sans phrase entre eux, se lisent comme une
erreur — et l'on cesse alors de croire les deux. La première carte porte donc
son rapprochement : « sur 55 inscrits · 3 jamais écrits · 52 messages partis ».

**Ce n'est pas un second calcul**, et c'est ce qui compte : `listed` est compté
avec **exactement le filtre de `listCampaignMembers`** (`status != removed`), et
`neverWritten` se lit dans `facts.firstSend` — la source du sommet de
l'entonnoir. `written + neverWritten = listed` ne peut donc pas cesser d'être
vrai. Le libellé de la carte, lui, ne bouge pas : « Écrites (hors retraits
manuels) » serait faux le jour où quelqu'un est inscrit sans avoir encore été
servi, ce qui arrive tous les matins.

### 2 · « A reçu un premier message »

Septième puce, **juste après « Tous »** comme demandé. Les quatre puces d'état
découpent les écrits en trois — silencieux, a répondu, arrêtés — et n'en rendent
jamais la somme : la question la plus simple qu'on se pose sur une campagne
n'avait aucun contrôle.

Elle se lit **dans les envois**, jamais dans `lastStep` ni dans `lastSentAt` de
l'inscription : c'est la même source que « Personnes écrites », donc les deux
nombres ne peuvent pas se contredire. Les compteurs portent sur **tous** les
inscrits, jamais sur la liste filtrée (règle du jalon 6).

### 3 · Le tableau se trie par ses en-têtes

Contact, société, rôle, étape, dernier message, ouvert, réponse, état — le motif
de `/contacts`. L'ordre d'insertion ne répond à aucune question : il dit dans
quel ordre on a coché des cases il y a trois semaines.

Trois décisions, toutes reprises de règles déjà payées :

- **les valeurs absentes sortent en fin dans les deux sens** — inverser un tri
  ne doit pas ramener les lignes vides en tête (jalon 30) ;
- **l'ordre des états suit la progression**, pas l'alphabet : jamais écrit,
  silencieux, a répondu, arrêté ;
- **aucun `localeCompare`** : il suit la locale du conteneur, donc l'ordre
  changerait d'un environnement à l'autre (jalon 72).

Le premier clic sur une colonne de date donne le plus récent d'abord, sur une
colonne de texte l'ordre alphabétique : l'inverse obligerait à cliquer deux fois
pour obtenir ce qu'on attendait.

### 4 · Les ouvertures se comptent ligne à ligne

Colonne « Ouvert », portant la **date** de la première ouverture — celle que
compte l'entonnoir — et non une pastille. « 13 sur 52 » ne se vérifie que si
chaque ligne dit *quand*. Une colonne « Réponse » l'accompagne, pour la même
raison et parce que le tri par réponse était demandé. Estimation, toujours :
l'image se charge sans qu'on ait lu (jalon 37).

### 5 · Les retraits à la main ne se mêlent plus au reste

Fond gris, **rangés en fin de tableau quel que soit le tri** (la partition du
tri des fiches closes, jalon 30), et une phrase au-dessus qui les compte et dit
d'où ils viennent. Le tiret de « dernier message » devient « jamais » : un tiret
se lit comme une donnée manquante, alors que c'est un fait.

### Jalon 78 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** (`migrate diff` **vide** — aucune migration,
tout se dérive de colonnes existantes), le serveur standalone de production et
un navigateur piloté, sur une campagne semée à la forme signalée — **55
inscrits, 3 retirés depuis la file, 52 écrits, 13 ouverts** :

- **l'audit recolle** : `enrolled` 55, tableau 55 lignes, `contacted` 52,
  `neverWritten` 3, et `52 + 3 = 55` ; la carte rend « sur 55 inscrits · 3
  jamais écrits · 52 messages partis » ;
- **la puce rend exactement le compte de la carte** : `written` = 52 = ce que
  compte « Personnes écrites » ;
- **les ouvertures se recomptent** : 13 lignes portant une date d'ouverture,
  égal au 13 de l'entonnoir ;
- **les 3 retirés** sont marqués, sans envoi, et **en fin de tableau dans les
  deux sens de tri** ;
- **au navigateur** : la phrase de rapprochement **atteignable**
  (`reachable()`, jamais `isVisible()`), la puce atteignable et le tableau
  réduit à ses écrits au clic, les en-têtes « Dernier message » et « Contact »
  qui **changent réellement l'ordre** dans les deux sens, les lignes grises
  exactement en fin, la colonne « Ouvert » comptée — **0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1338 tests**) et
  `npm run e2e` (**48 tests**, neuf fichiers) verts.

`tests/campaign-roster-source.test.ts` ferme les trois rechutes : « a reçu un
message » déduit de l'étape plutôt que lu dans les envois, l'écart laissé sans
phrase, un tri ou un filtre réimplémenté dans l'écran. **Éprouvée en
réintroduisant le défaut exact** (`written: enrollment.lastSentAt !== null`) :
deux tests tombent en le nommant.

### Jalon 78 — ce qui n'est pas fait

**Les chiffres ci-dessus viennent d'une campagne semée à l'image de la vôtre**,
pas de votre base. Le mécanisme est celui-ci ; si vos 52 et 55 ne recollent pas
en production, la phrase sous la carte dira exactement où passe l'écart — c'est
précisément ce qu'elle est là pour faire.

**Le tri et le filtre ne vivent pas dans l'URL.** Ils sont dans l'état du
composant : un tri mis en favori n'est pas rejouable, et recharger la page
repart du dernier message décroissant. `/contacts` fait mieux ; ici le tableau
est déjà borné à une campagne, et l'URL de la campagne suffit à y revenir.

**Une personne retirée depuis la carte de campagne reste invisible**, et c'est
le choix du jalon 70 : retirer, c'est sortir de la liste. Elle n'entre donc ni
dans le tableau, ni dans `listed` — mais **ses envois passés comptent toujours**
dans « Personnes écrites ». Sur une campagne où l'on aurait retiré quelqu'un
après lui avoir écrit, `written` peut donc dépasser `listed` : la phrase du
rapprochement l'affiche alors telle quelle plutôt que de la lisser.

**Le tri par étape ne distingue pas deux inscrits à la même étape.** Il n'y a
pas de second critère : l'ordre à l'intérieur d'un groupe est celui que le tri
précédent avait laissé.

---

## Jalon 79 — la liste devient une puce, dans le seul tableau qui existe

### Ce que le jalon 77 avait mal placé, et pourquoi c'est structurel

Le jalon 77 livrait la bonne fonctionnalité au mauvais endroit : une section
« Listes » dans le rail, une grille de vignettes, et la page d'une liste qui
était **l'écran de `/contacts` avec une portée**. Deux routes pour un même
tableau, c'est-à-dire deux endroits où ajouter une colonne — et c'est toujours
le second qu'on oublie (jalons 55, 64, 66, 67, 74).

Le choix du propriétaire du produit ferme la question : **il n'existe qu'un
tableau de contacts**, et un groupe nommé y est une puce de plus, à côté de
« Jamais contacté » et « À relancer ». `/listes`, `components/lists/` et
`app/api/lists/` sont supprimés ; `screen.tsx` est replié dans `page.tsx`.

### La distinction que la puce doit porter, et qui est dite à l'écran

| | Les autres puces | Un filtre personnalisé |
|---|---|---|
| ce que c'est | une **question** (« les Lead sans DM ») | un **choix** (« les vingt marques du salon ») |
| quand ça change | à chaque écriture du CRM | quand quelqu'un le change |

Les deux se croisent par construction, parce que la clause vit dans
`contactsWhere` avec le cycle de vie et le reste :
`{ customFilters: { some: { filterId } } }` rejoint le `and` commun. Rien de
particulier n'a été écrit pour la combinaison — c'est ce qui la rend vraie.

Le panneau dit la différence en une phrase, parce qu'elle n'est pas devinable :
*« Contrairement aux autres puces, il ne change jamais tout seul : il ne
contient que ce que vous y mettez. »*

### Le contrôle est en tête de rangée, et ce n'est pas de la mise en page

Deux règles déjà payées, appliquées ici :

1. **sur la première rangée de puces**, jamais la seconde : celle-ci est un
   groupe `overflow-hidden` qui découpe tout panneau posé en `absolute` — le
   défaut du jalon 60, qu'une garde statique interdit désormais de refaire ;
2. **avant ses propres puces.** Le panneau est ancré `left-0` sur son bouton :
   chaque filtre créé poussait le bouton vers la droite, et au troisième le
   panneau de 320 px débordait de l'écran. La ligne « Supprimer » sortait alors
   du champ, atteignable par aucun doigt. **Trouvé par le test qui clique, pas à
   la lecture** — `reachable()` rendait `false` là où `isVisible()` aurait dit
   vrai (quatrième fois : jalons 60, 61, 77, 79).

Le bouton de suppression porte `aria-label="Supprimer le filtre <nom>"` : nommer
le filtre départage les suppressions de l'écran, pour qui clique comme pour qui
teste.

### Ce que ces gestes ne font jamais

- **supprimer un filtre ne touche aucune fiche** : `deleteCustomFilter` ne
  contient aucun `prisma.contact.`, la cascade ne porte que sur les
  appartenances, et la confirmation — composée dans le domaine pour ne pas être
  dite de deux façons — répond à la seule question qu'on se pose devant ce
  bouton : « Ses 9 fiches restent dans le CRM avec tout leur historique : seule
  l'appartenance à ce filtre disparaît. » ;
- **retirer quelqu'un d'un filtre n'écrit rien sur sa fiche** — vérifié champ
  pour champ avant/après ;
- **l'unicité vient de la base** (`@@unique([filterId, contactId])` +
  `skipDuplicates`), pas d'une vérification applicative que deux onglets
  contourneraient (jalon 8).

### La sélection est celle qui existe déjà

`resolveSelectionIds` (jalon 77) reste **le seul** résolveur : les fiches
cochées l'emportent sur le filtre, et c'est ce qui fait que cocher deux fiches
sous un filtre puis deux sous un autre en range quatre. La réécrire pour les
filtres personnalisés aurait garanti que la seconde version oublie la règle.

### La base, et la sauvegarde

Migration `35_custom_filters` : les tables du jalon 77 sont **supprimées avec
leurs données** (décision explicite, rien à migrer), `custom_filters` et
`custom_filter_members` les remplacent. Les deux rejoignent l'export, le schéma
de restauration et la garde `backup-columns` — un choix fait à la main est la
seule donnée du produit que rien ne sait reconstituer (jalon 42).

### Jalon 79 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** (migration `35_custom_filters` appliquée puis
`migrate diff` **vide**), le serveur standalone de production, **par les routes
HTTP réelles** et **dans un navigateur piloté** :

- **les anciennes routes sont parties** : `/listes` → 404, `/api/lists` → 404,
  `/contacts` → 200, `/api/custom-filters` → 200, et « Listes » ne figure plus
  dans le rail ;
- **créer depuis /contacts** : « &nbsp;Salon Paris&nbsp; » → nom nettoyé,
  **l'URL n'a pas changé** — on n'a jamais quitté l'écran ;
- **six puis quatre fiches cochées au fil de deux filtres de colonne** →
  `{added: 10, already: 0}`, et le filtre contient **exactement ces dix-là** ;
  rejoué → `{added: 0, already: 10}` ;
- **la puce se croise** : `?filtre=…` → 10 fiches, `&lifecycle=Prospect` → 3 ;
- **depuis la vue filtrée, inscrire dans une campagne** → 5 inscrites, par la
  sélection `filtre=<id>` ;
- **retirer une fiche** → 1 appartenance partie, l'enregistrement du contact
  **identique champ pour champ** ;
- **renommer** → `nameKey` recalculé (`salon paris 2026`) ;
- **supprimer** → 9 appartenances parties, **les 10 fiches intactes** ;
- **au navigateur (1440×900)** : création, cases cochées sous
  `f.owner=E2eOwnerA` puis `f.owner=E2eOwnerB` avec **« 4 sélectionnés »** —
  le compte ne tombe pas au changement de filtre —, rangement, puce portant son
  compte, croisement à 0 ligne, retrait, suppression par la confirmation, et
  **0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1339 tests**) et
  `npm run e2e` (**49 tests**, neuf fichiers) verts.

`tests/custom-filters-source.test.ts` ferme les quatre rechutes : une seconde
résolution de sélection, un second écran de contacts, un retrait qui touche la
fiche, une clause sortie de `contactsWhere`.

### Jalon 79 — ce qui n'est pas fait

**Rien ne remplit un filtre tout seul**, et c'est la définition : il n'y a ni
règle d'entrée, ni mise à jour automatique. Le jour où ce serait souhaité, ce
serait un autre objet, et il faudrait dire à l'écran lequel des deux on regarde.

**La fiche ne dit pas à quels filtres elle appartient.** L'appartenance se lit
depuis la puce, pas depuis la personne. La donnée existe en base ; c'est un
affichage à ajouter, pas un modèle à changer.

**Deux filtres peuvent porter le même nom** — c'est une étiquette humaine, pas
une clé (même choix qu'au jalon 77).

**Le panneau ne se filtre ni ne se trie**, et les puces sortent dans l'ordre de
la liste rendue par le service. À vingt filtres, la rangée de puces deviendra
illisible bien avant que le panneau ne gêne : il faudra alors n'y épingler que
les filtres choisis.

**Les données des listes du jalon 77 sont perdues**, délibérément et sur
demande : la migration supprime les deux tables. Aucune reprise n'est possible
après coup.

**Les chiffres ci-dessus viennent d'un jeu de vérification**, pas de votre base.

---

## Jalon 80 — une séquence est une suite, et l'écran le montre enfin

### Ce qui n'allait pas

Trois rangées de champs alignées — un délai, une consigne, un « Retirer » — se
lisent comme un tableau de réglages, pas comme « ce message part, puis quatre
jours plus tard celui-ci ». Deux informations manquaient à l'œil : **où
commence et où finit une étape**, et **le rythme**, qui n'apparaissait nulle
part sans lire chaque champ de délai et les additionner soi-même.

### La frise, et où vit le délai

Chaque étape a son bloc — un vrai conteneur, pastille numérotée et titre
« Étape N » — et les blocs sont reliés par un trait vertical qui **porte le
délai** : « J+4 » entre la première et la deuxième. Le délai décrit le passage
de l'une à l'autre, pas un réglage de l'une des deux : il appartient au
connecteur, et c'est ce qui rend la cadence lisible d'un coup d'œil.

Le trait est calé sur le centre des pastilles, pour que la frise passe *par* les
numéros plutôt que de longer le bord. Verticale seule, donc **identique à
390 px** : pas de variante mobile à maintenir, ce qui est aussi la seule façon
qu'elle ne diverge pas.

**Le jour cumulé est calculé, jamais stocké** (`stepDays`) : le stocker le ferait
mentir à la première modification d'un délai. Et la première étape part le jour
de l'inscription **quoi que porte son champ** — c'est la règle du moteur depuis
le jalon 38, et un écran qui promettrait J+9 mentirait.

### Repliées par défaut

On vient d'abord voir la structure, on ouvre celle qu'on veut écrire. Ce n'est
pas un gain de place, c'est l'ordre des deux questions.

Ce que chaque bloc dit sans être ouvert : **quand il part** (« Part 4 jours après
l'étape 1 · jour 4 de la séquence »), **qui l'écrit**, et **un aperçu** — la
première ligne de la consigne, tronquée à quatre-vingt-dix caractères. Un aperçu,
pas le texte : rendre quatre cents caractères remettrait le contenu par-dessus la
structure, exactement ce qu'on vient de défaire.

Quand des départs ont déjà été composés, le bloc porte en plus **le dernier objet
réellement sorti** pour cette étape. C'est le seul aperçu honnête de ce qu'elle
produit : une étape ne porte pas de texte, elle porte une consigne, et le message
est écrit par contact au moment de composer. Vide tant que rien n'est parti,
jamais un exemple inventé.

**Une consigne vide se voit en rouge** — « cette étape n'écrira rien tant qu'elle
reste vide ». C'est la première cause de silence d'une campagne neuve (jalon 56),
et elle méritait d'être lisible sans ouvrir trois blocs.

### La numérotation ne peut pas trouer

Elle **est l'indice**, jamais une valeur stockée : retirer la deuxième étape
renumérote la troisième par construction, il n'existe aucun état à recalculer.
« Étape 1, Étape 3 » n'est donc pas un cas à traiter, c'est un cas impossible.
(`EmailSequenceStep.position` est réécrit à l'enregistrement, déjà depuis le
jalon 38 : les étapes sont remplacées d'un bloc.)

### Réordonner déplace le message, pas le rythme

Flèches ↑↓ plutôt qu'un glisser-déposer : le glisser tactile fiable est un
chantier à part (la même décision qu'au jalon 47 pour le pipeline), et deux
boutons de 44 px fonctionnent au doigt comme à la souris.

**Le délai reste attaché au rang.** Monter la troisième étape veut dire « ce
message part plus tôt », pas « toute la cadence change » — et faire voyager le
délai avec le message donnerait en prime une première étape à J+4 que le moteur
ramènerait à zéro en silence. Vérifié en base : après un déplacement et un
enregistrement, les briefs ont changé de rang et les délais sont restés
0 / 4 / 7.

### Jalon 80 — ce qui est vérifié

Contre un vrai PostgreSQL 16 (`migrate diff` **vide** — aucune migration, tout
se dérive des colonnes existantes), le serveur standalone de production et un
navigateur piloté, sur une séquence de trois étapes 0 / 4 / 7 :

- **trois blocs numérotés et séparés** : trois `<section>` distinctes, empilées
  (le second commence après la fin du premier, mesuré), reliées par des
  connecteurs portant **« J+4 »** et **« J+7 »**, tous deux **atteignables**
  (`reachable()`, jamais `isVisible()`) ;
- **l'aperçu se lit sans ouvrir** : les trois consignes sont à l'écran, et
  **aucun champ d'édition n'est monté** (`input[type=number]` compté à 0) ;
  ouvrir l'étape 2 fait apparaître son délai à « 4 » ;
- **retirer celle du milieu renumérote** : « Étape 3 » disparaît, « Étape 2 »
  porte désormais « clore poliment », et l'ancienne deuxième consigne n'est plus
  nulle part ;
- **réordonner survit à l'enregistrement** : après « Descendre l'étape 1 » puis
  « Enregistrer », la page rechargée rend « Étape 1 · relancer… » et « Étape 2 ·
  présenter… », **avec les délais restés à leur rang** ;
- **à 390×844** : blocs empilés, connecteurs et délais lisibles, commandes sur
  leur propre rangée à 44 px, **0 débordement horizontal**, **0 erreur
  console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1350 tests**) et
  `npm run e2e` (**54 tests**, dix fichiers) verts.

### Jalon 80 — ce qui n'est pas fait

**Une étape ne peut pas être écrite à la main.** La demande parlait d'un bloc
disant « rédigée par Alex ou écrite à la main » ; le modèle ne connaît pas la
seconde possibilité — une étape porte une consigne, et le message est composé
par contact. La pastille dit donc ce qui est vrai : « Rédigée par Alex », ou
« Sans consigne » quand l'étape n'écrira rien. Un vrai texte figé par étape est
un changement de modèle (colonne, chemin de composition, garde-fous d'envoi),
pas un effet de bord d'une refonte d'affichage — à demander si c'est voulu.

**Pas de glisser-déposer**, seulement les flèches — voir plus haut.

**L'aperçu du dernier objet composé est une lecture bornée** aux soixante
derniers départs de la séquence : au-delà, une étape qui n'aurait plus rien
composé depuis longtemps n'affiche pas d'objet. Elle affiche alors sa consigne,
ce qui reste le bon repère.

**Le repli n'est pas mémorisé.** Recharger la page referme tout : c'est l'état
qu'on veut au premier coup d'œil, et le conserver demanderait un stockage local
pour une préférence qui dure une minute.

---

## Jalon 81 — ajouter une étape rattrape ceux qui avaient déjà fini

### Le cas, et pourquoi rien ne se passait

Une campagne à une seule étape ferme chaque inscription dès que cette étape est
partie : la composition écrit `done` avec le motif « Toutes les étapes ont été
envoyées ». Sur la campagne signalée, les cinquante-deux personnes servies
étaient donc **hors de la mécanique** — ajouter une relance ne leur apportait
rien, puisque la boucle ne lit que les inscriptions actives.

Ce n'était pas un défaut : c'est le comportement correct d'une séquence qui n'a
plus rien à dire. Ce qui manquait, c'est le geste qui les fait **rentrer** quand
elle a de nouveau quelque chose à dire.

### Un seul motif rouvre, et c'est toute la sécurité

| Motif | Ce qu'il dit | Rouvert ? |
|---|---|---|
| Toutes les étapes ont été envoyées | **la séquence** n'avait plus rien à dire | **oui** |
| Le contact a répondu | une décision sur la personne | non |
| Fiche close — la relation est terminée | idem | non |
| Opposition au démarchage | idem | non |
| Retiré de la séquence à la main | idem | non |

La distinction est celle-ci : la première ligne est une **fin technique**, les
quatre autres sont des décisions *sur quelqu'un* — et ce sont exactement elles
qui protègent un prospect d'une relance qu'il ne doit pas recevoir. Les traiter
d'un même geste reviendrait à écrire à quelqu'un qui a dit non, pour la seule
raison qu'on a ajouté un paragraphe.

`reopenable()` (pur) vérifie **le statut et le motif**, alors que le premier
suffirait aujourd'hui : `done` n'est écrit qu'à cet endroit du produit. La
redondance coûte une comparaison et ferme la porte au jour où un autre chemin
écrirait `done` pour autre chose — une relance partie par erreur ne se rattrape
pas.

### Le délai court depuis leur dernier message

`daysUntilDue(lastSentAt, delayDays, now)`. Quelqu'un servi il y a dix jours est
**dû tout de suite** pour une étape à J+4 ; le compter depuis l'instant de
l'ajout lui ferait attendre quatre jours de plus sans raison, et surtout ferait
mentir la phrase de confirmation.

C'est aussi pour cela que la réouverture **ne touche ni `lastStep` ni
`lastSentAt`** : la personne reprend là où elle en était, donc son étape suivante
et son échéance se calculent depuis son propre historique. Les remettre à zéro
lui renverrait le premier message.

Rien d'autre n'a eu à changer dans le moteur : `nextStep` calcule déjà
l'échéance depuis `lastSentAt` (jalon 38), et une inscription active est
composable par construction. **« Écrire les mails » les reprend donc sans le
savoir**, avec tous les garde-fous de l'envoi appliqués au moment de l'envoi.

### On ne rouvre jamais sans avoir montré qui

Deux verbes, deux gestes : `POST /api/sequences-email/reopen` **regarde** — il
compose la phrase à partir des étapes *proposées*, avant tout enregistrement —
et `PUT` rouvre, après lecture. Une seule route aurait fait de l'affichage d'un
écran une relance de cinquante-deux personnes.

> **52 personnes ont terminé cette campagne. Elles recevront l'étape 2 :
> 49 immédiatement, 3 dans 2 jours.**
> Le délai court depuis leur dernier message, pas depuis maintenant.
> 4 inscriptions restent arrêtées : Margaux Keller (le contact a répondu), …

La phrase sépare **immédiatement** de **plus tard** parce que ce sont deux
engagements différents ; un total unique laisserait croire que tout part le
matin même. Les retardataires sont groupés par échéance — « 3 dans 2 jours » se
lit, « 1 dans 2 jours, 1 dans 2 jours, 1 dans 3 jours » ne se lit pas.

**Les exclus sont nommés**, et c'est la moitié de la confiance qu'on accorde au
bouton : voir « Margaux Keller (le contact a répondu) reste arrêtée » dit en une
ligne que la garde ne se contente pas d'exister.

Trois réponses possibles, parce que certaines campagnes ne se prolongent pas :
**Enregistrer et relancer**, **Enregistrer sans relancer**, **Annuler**. Et
l'enregistrement seul reste ce qu'il est depuis le jalon 70 : sans effet de
bord, sans coût, rejouable.

### Retirer l'étape rend l'état d'avant, tout de suite

`closeWithoutNextStep` s'exécute après chaque enregistrement : les inscriptions
actives qui n'ont plus d'étape à recevoir redeviennent terminées, avec leur
motif, et les brouillons **jamais partis** de l'étape disparue sont effacés. Ce
qui est **envoyé** ne bouge pas — c'est un fait, et /emails le compte.

Sans cela, il aurait fallu attendre une composition pour que l'état redevienne
cohérent, c'est-à-dire laisser l'écran mentir jusqu'au lendemain matin.

### Jalon 81 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** (`migrate diff` **vide** — aucune migration :
tout se décide sur `status` et `stopReason`, qui existent depuis le jalon 38),
sur le cas signalé reconstitué — **52 terminées** (49 servies il y a 10 jours,
3 il y a 2 jours), plus une réponse, une fiche close, une opposition et un
retrait à la main :

- **le plan n'écrit rien** : « 52 personnes ont terminé cette campagne. Elles
  recevront l'étape 2 : 49 immédiatement, 3 dans 2 jours. », les **4 exclues
  nommées avec leur motif**, et **0 inscription active** après l'appel ;
- **la réouverture est exacte** : 52 rouvertes, 0 terminée, **Margaux reste
  `stopped`** ; `lastStep` reste à 1 et `lastSentAt` au 11/09 — personne ne
  repart du premier message ;
- **le délai compte depuis leur envoi** : la composition écrit **49 brouillons**
  d'étape 2 et laisse **3 en attente**, exactement les trois servis il y a deux
  jours ;
- **retirer l'étape rend l'état d'avant** : 0 active, 52 terminées avec le motif
  d'origine, **0 départ restant** ;
- **au navigateur** : « Ajouter une étape » puis « Enregistrer » ouvre la
  confirmation, qui nomme le compte, l'échéance et Margaux Keller — **avec 0
  inscription active à cet instant** ; « Enregistrer et relancer » rouvre les
  trois et laisse la répondante arrêtée ; **0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1374 tests**) et
  `npm run e2e` (**57 tests**, onze fichiers) verts.

`tests/sequence-reopen-source.test.ts` ferme les trois rechutes : rouvrir large,
rouvrir sans le dire, repartir de zéro. **Éprouvée en retirant le filtre sur le
motif** — et la première version de la garde n'a rien vu : son `slice` allait
jusqu'à la fin du fichier, où `closeWithoutNextStep` écrit le même motif, si bien
qu'elle se satisfaisait de cette autre occurrence. Bornée à `applyReopen`, elle
tombe en nommant le défaut. **Un test qui passe ne prouve rien tant qu'on ne l'a
pas vu échouer sur le défaut qu'il vise** — leçon du jalon 49, resservie.

### Jalon 81 — ce qui n'est pas fait

**La confirmation n'apparaît que lorsque le nombre d'étapes augmente.** Changer
un délai ou une consigne n'ouvre rien et ne rouvre personne : c'est voulu, mais
cela veut dire qu'allonger le délai de l'étape 2 après avoir relancé ne
« rattrape » pas ceux qui l'ont déjà reçue — il n'y a rien à rattraper.

**Aucune réouverture depuis l'API sans passer par le plan.** `PUT` rouvre tout ce
qui est éligible pour la séquence, sans relire ce que l'écran a montré : un appel
direct rouvre donc sans confirmation. C'est le même compromis que partout
ailleurs — l'écran n'est pas la seule porte, mais le garde-fou qui compte (le
motif) est au serveur, pas à l'écran.

**Les personnes dues n'ont pas de vue à elles.** Elles deviennent des inscrits
actifs ordinaires : la liste des inscrits les montre « pas encore écrit » pour
l'étape 2, sans dire qu'elles viennent d'être rouvertes. L'historique du geste
n'est nulle part.

**Le flottement de connexion des recettes est corrigé au passage** : `signIn`
remplissait le champ avant l'hydratation, React reposait sa valeur vide, et le
bouton restait désactivé trente secondes — trois recettes perdues sur ce qui
ressemblait à une panne de la page de connexion. Le helper vérifie désormais que
le bouton a suivi, et refait une passe sinon.

---

## Jalon 82 — pourquoi le jalon 81 pouvait ne rien faire, sans le dire

### Ce que la reproduction a établi, et ce qu'elle a démenti

Les deux hypothèses proposées ont été exercées, dans l'ordre, sur le **vrai
chemin** — l'éditeur en frise du jalon 80, dans un navigateur, sur un état
produit par la composition elle-même (aucun statut écrit à la main) :

| Hypothèse | Verdict |
|---|---|
| Le jalon 80 aurait introduit un chemin d'enregistrement que le jalon 81 n'a jamais vu | **Faux, mesuré.** « Ajouter une étape » ×2, consignes saisies, « Enregistrer » → `POST /api/sequences-email/reopen`, confirmation affichée, 0 erreur console. Le bouton appelle toujours `askThenSave` |
| Le libellé stocké serait une variante | **Faux pour le libellé** : `git log -p` sur `sequence-rules.ts` ne rend **qu'une seule** écriture de la chaîne depuis le jalon 38. Le **statut**, lui, n'est pas vérifiable d'ici |

**Je ne peux pas lire la base de production depuis cet environnement**, et je ne
vais donc pas nommer une ligne qui aurait échoué chez vous : sur l'état que ce
code produit, le chemin marche de bout en bout. Ce que je peux nommer, ce sont
les trois lignes qui rendent ce mécanisme **muet** dès que la base porte autre
chose que ce que le code suppose — et c'est ce silence, pas la règle, qui a
coûté l'aller-retour.

### Les trois causes nommées, avec leur fichier

**1 · `lib/domain/sequence-reopen.ts:39` (jalon 81) — la redondance qui bloque.**

```ts
return status === FINISHED_STATUS && stopReason === BLOCK_LABELS.finished;
```

Écrite comme une ceinture-bretelles — « le statut suffirait, la comparaison
ferme la porte au jour où un autre chemin écrirait `done` pour autre chose ».
C'est un **ET** : il suffit que l'une des deux moitiés diffère — un `stopped`
hérité d'un chemin plus ancien, un accent perdu dans un aller-retour d'export,
un motif vide — pour que **rien ne corresponde**. La garde protégeait d'un
danger imaginaire et créait un mode de panne réel.

La règle repose désormais sur ce qui décide vraiment : jamais une inscription
`active` ni `removed` ; `done` suffit, motif vide ou non ; **le motif
d'épuisement suffit aussi**, comparé sans casse ni accents. Les quatre motifs
qui protègent quelqu'un ne peuvent ressembler à aucun des deux.

**2 · `lib/api/email-sequences.ts` — la règle écrite deux fois.**
`applyReopen` portait sa propre clause SQL (`status: FINISHED_STATUS`,
`stopReason: BLOCK_LABELS.finished`) : une seconde écriture de la règle, à côté
de celle du domaine, et c'est **elle** qui décidait réellement. Le plan et
l'écriture pouvaient donc ne pas voir les mêmes lignes sans que rien ne lève.
Elle lit maintenant les inscriptions closes et demande à `reopenable()` —
une seule fonction tranche, le `updateMany` applique sa liste.

**3 · `components/settings/email-sequences-panel.tsx` — le silence.**

```ts
if (plan.data.plan.candidates.length === 0) { await save(sequence); return; }
```

**C'est la ligne qui a rendu le défaut invisible.** Zéro candidat, on
enregistrait sans un mot : impossible, depuis la production, de trancher entre
« la règle est trop étroite » et « la base ne dit pas ce qu'on croit ».

### Ce que l'écran dit maintenant quand rien ne rouvre

> **Aucune inscription ne sera rouverte.**
> 52 inscriptions closes, aucune rouvrable. Motifs enregistrés :
> 52 × « … » . Seules les inscriptions arrêtées faute d'étape suivante se
> rouvrent ; les autres protègent la personne.

Les motifs sont rendus **tels qu'ils sont écrits en base**, y compris
« (aucun motif écrit) » : c'est le seul moyen de voir ce que la base porte
plutôt que ce que le code croit qu'elle porte. Le cas « elles ont déjà reçu
toutes les étapes existantes » est distingué, parce qu'il appelle un autre
geste — en ajouter une de plus.

Et le bouton « Enregistrer et relancer » **n'existe pas** dans ce cas : il n'y
a rien à relancer. Reste « Enregistrer », qui demande un second clic — un ajout
d'étape ne s'enregistre plus dans le dos.

**Une quatrième contradiction est nommée aussi** : si la confirmation annonce
des réouvertures et que l'écriture n'en fait aucune, l'écran ne dit plus
« Séquence enregistrée » mais le contredit. Le plan lit les étapes *proposées*,
l'écriture celles qui sont *en base* — l'écart est possible, il ne sera plus
silencieux.

### Ce qu'il faut regarder en production, dans cet ordre

1. **`/reglages` → « Version déployée »** (jalon 51) : le commit servi
   porte-t-il ce correctif ? Deux situations produisent le même écran — un
   déploiement en retard et un défaut —, et c'est précisément pour les séparer
   que cette carte existe ;
2. **rouvrir la campagne et cliquer « Enregistrer »** : la confirmation nomme
   désormais soit qui sera relancé, soit **les motifs réellement stockés sur
   ces 52 lignes**. C'est la réponse à la question, et elle vient de votre base.

### Jalon 82 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** (`migrate diff` **vide** — aucune migration),
le serveur standalone de production et un navigateur piloté :

- **les trois formes rouvrent** : `done` + libellé, `done` + motif vide,
  `stopped` + libellé, et `stopped` + libellé sans accents ni casse →
  **4 candidats, 4 rouvertes** ;
- **les quatre protégées ne bougent pas** : a répondu, fiche close, retirée à la
  main, **et le motif vide sur `stopped`** — on ne sait pas pourquoi elle s'est
  arrêtée, donc on ne relance pas, et l'écran le dit ;
- **plan et écriture s'accordent** : les mêmes quatre noms des deux côtés ;
- **la campagne muette parle**, au navigateur : « Aucune inscription ne sera
  rouverte. » + « Motifs enregistrés : 1 × « Le contact a répondu » » + les
  exclus nommés, **aucun bouton « et relancer »**, et **l'étape n'est pas
  enregistrée** tant qu'on n'a pas cliqué une seconde fois ;
- **le cas « déjà tout reçu »** rend sa propre phrase, distincte ;
- **le jalon 81 n'a pas régressé** : confirmation avant toute écriture,
  3 rouvertes, Margaux `stopped`, `lastStep` et `lastSentAt` intacts ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1383 tests**) et
  `npm run e2e` (**59 tests**) verts.

La garde `sequence-reopen-source` a été **réécrite dans l'autre sens** : elle
exigeait la clause SQL jumelle qui est précisément le défaut ; elle exige
maintenant que l'écriture demande au domaine, et que l'écran ne puisse plus
enregistrer en silence.

### Jalon 82 — ce qui n'est pas établi

**La cause exacte de votre échec en production reste inconnue depuis ici**, et
je préfère l'écrire que la deviner : sur l'état que ce code produit, le chemin
complet fonctionne. Les deux mesures ci-dessus la nommeront en un clic — et si
c'est un statut hérité ou un motif vide, le correctif de ce jalon la traite
déjà.

**Aucune migration de données.** Les lignes existantes ne sont pas réécrites :
la règle s'adapte à ce qu'elles portent, plutôt que de les normaliser. Une
correction en masse sur des inscriptions serait un geste à confirmer, pas un
effet de bord d'un correctif.

**`reopenable` reste conservatrice sur le motif vide avec un statut autre que
`done`.** Elle ne rouvre pas — et l'écran compte ces lignes dans son
diagnostic, sous « (aucun motif écrit) ». Si la production en porte beaucoup,
c'est ce qu'il faudra regarder ensuite.

---

## Jalon 83 — le déclencheur était un état d'écran, pas un fait

### Trois jalons verts en recette, trois échecs en production

C'est le troisième aller-retour sur cette fonctionnalité, et il faut nommer ce
qui les relie : **les trois recettes exerçaient le geste qui marche, jamais
l'état dans lequel la production se trouvait.**

Le symptôme signalé était pourtant décisif et je ne l'avais pas pris au
sérieux : l'écran disait « Séquence enregistrée. » — ni la confirmation de
réouverture, ni l'explication bruyante du jalon 82. **Aucun des deux
aboutissements possibles.** Ce n'était pas un troisième mode de panne, c'était
la preuve que la route de réouverture n'était jamais appelée.

### La cause, avec sa ligne

**`components/settings/email-sequences-panel.tsx:217` (jalons 81-82) :**

```ts
const before = savedSteps[sequence.id] ?? 0;
if (sequence.id === "" || sequence.steps.length <= before) { await save(sequence); return; }
```

`savedSteps` est semé **une fois, au montage**, depuis la séquence telle qu'elle
existe en base. Le déclencheur de la réouverture était donc « le nombre
d'étapes a-t-il grandi **dans cette session de navigateur** ? » — un delta
d'état d'interface, pas un fait sur les données.

Conséquence, et elle est définitive : **dès que les étapes sont enregistrées,
le delta retombe à zéro pour toujours.** L'enregistrement silencieux du
jalon 81 les avait persistées ; à chaque visite suivante, `before` valait 3,
`steps.length` valait 3, et l'écran prenait la branche d'enregistrement simple —
sans jamais appeler `/api/sequences-email/reopen`. Les cinquante-deux personnes
étaient inatteignables depuis l'éditeur, quel que soit le nombre de clics.

**Pourquoi les recettes ne l'ont pas vu :** elles ajoutaient une étape puis
enregistraient dans la même session. Le delta valait 1, le chemin passait, tout
était vert. Les deux scénarios, mesurés côte à côte sur la même campagne :

| Scénario | Étapes à l'ouverture | Requête au clic | Message |
|---|---|---|---|
| Étapes **pas encore** enregistrées, j'en ajoute deux | 1 → 3 | `POST …/reopen` | « 52 personnes ont terminé… » |
| Étapes **déjà** enregistrées, je clique | 3 | **`POST /api/sequences-email` seul** | **« Séquence enregistrée. »** |

Le second est la production, mesuré au navigateur sur cinquante-deux
inscriptions fermées par la composition elle-même.

**Ce que la recherche a écarté en chemin**, et qui méritait de l'être :
`« Séquence enregistrée »` n'est émis que par **un seul fichier**, le panneau, à
trois lignes ; `/campagnes/[id]` ne monte qu'un seul éditeur de séquence
(`campaign-detail.tsx:232`), dont l'unique bouton appelle `askThenSave`. Il n'y
avait pas de second bouton non câblé — l'unique bouton était court-circuité par
sa propre garde.

### Le déclencheur devient un fait

`needsDecision(plan)` (domaine, pur) répond à la seule question qui vaille :
**y a-t-il quelqu'un dont il faille parler ?** Quelqu'un à rouvrir, ou au moins
une inscription close dont il faut dire pourquoi elle ne rouvre pas. Le plan est
demandé **à chaque enregistrement** d'une séquence existante ; `savedSteps` est
supprimé.

Une campagne qui n'a rien de clos s'enregistre sans un mot — il n'y a personne à
mentionner, et c'est le seul silence légitime. C'est le serveur qui tranche
(`decision` dans la réponse) : une seconde règle côté navigateur finirait par ne
plus dire la même chose que celle qui compte.

### La porte de secours

`components/campaigns/reopen-action.tsx` — **« Relancer les personnes ayant
terminé »**, sur la page de la campagne, à côté d'« Écrire les mails ».

Elle part des étapes **telles qu'elles sont enregistrées** et ne dépend d'aucun
état de formulaire : elle ne peut donc pas être neutralisée par un delta qui
retombe à zéro. Même service, même confirmation, mêmes garde-fous — `POST`
regarde, `PUT` écrit. Elle n'apparaît que lorsque la séquence porte plus d'une
étape : sans étape suivante, il n'y a rien à rouvrir.

Ce n'est pas une redondance de confort. **Un chemin unique porté par un écran
est un chemin qui peut se dérober en silence** — c'est arrivé trois fois. Celui-ci
est indépendant de l'éditeur, et c'est sa raison d'être.

### La garde

`tests/sequence-reopen-source.test.ts` gagne quatre invariants, dans la famille
de `signature-block-source` et `research-single-source` :

- **un seul composant enregistre une séquence** — la liste des fichiers de
  `components/campagnes/` et `components/settings/` qui font un `POST` vers
  `/api/sequences-email` doit être exactement `email-sequences-panel.tsx` ;
- **son bouton passe par `askThenSave`**, et `save()` n'est atteignable que
  depuis le panneau de confirmation (deux appels directs, pas trois) ;
- **le déclencheur est un fait** : `savedSteps` et `steps.length <= before` sont
  interdits, `plan.data.decision` et `needsDecision` exigés ;
- **la porte de secours existe** et passe par le même service.

**Éprouvée en réintroduisant le défaut mot pour mot** : le test tombe en nommant
`savedSteps`.

### Jalon 83 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** (`migrate diff` **vide** — aucune migration),
le serveur standalone de production et un navigateur piloté, sur cinquante-deux
inscriptions fermées **par la composition elle-même** :

- **le défaut reproduit** avant correctif : étapes déjà enregistrées → clic →
  `POST /api/sequences-email` seul, « Séquence enregistrée. » nu ;
- **après correctif, même campagne, même état** : clic → `POST …/reopen` →
  « 52 personnes ont terminé cette campagne. Elles recevront l'étape 2 : 52
  immédiatement. » ;
- **la porte de secours** : bouton atteignable, `POST` n'écrit rien
  (`done=52` avant et après), `PUT` rouvre → `active=52`, `lastStep` et
  `lastSentAt` intacts ;
- **la boucle entière** : « Écrire les mails » annonce **52 éligibles**, la
  composition écrit **52 brouillons d'étape 2**, **0 envoi** ;
- **aucune régression** : les campagnes sans inscription close s'enregistrent
  toujours sans panneau, la campagne muette dit toujours ses motifs, et la
  protection de celles qui ont répondu n'a pas bougé ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1387 tests**) et
  `npm run e2e` (**62 tests**) verts.

### Jalon 83 — ce qui n'est pas établi

**Je n'ai toujours pas accès à la production depuis cet environnement** — pas de
CLI Railway, pas de variable `RAILWAY_*`, hôte injoignable. Le commit à voir
dans `/reglages` → « Version déployée » est donné à chaque livraison, et c'est
le seul moyen de séparer « déploiement en retard » de « défaut ».

**Un enregistrement de séquence coûte désormais une requête de plus** sur les
campagnes qui portent des inscriptions closes. C'est une lecture, et c'est le
prix d'un déclencheur qui ne peut plus se dérober.

**La leçon de méthode, à retenir pour les prochains jalons :** une recette qui
part d'une base vide n'exerce que le chemin heureux. **Il faut partir de l'état
où se trouve la production**, pas de celui qu'on sait produire — c'est la
troisième fois que cet écart coûte un aller-retour complet.

---

## Jalon 84 — une relance n'est pas un premier message renvoyé

### 3 · Le vrai problème : l'étape 2 refaisait l'étape 1

Alex ne savait ni **qu'il** écrivait une relance, ni **ce qui avait déjà été
dit**. Il refaisait donc le même travail, avec les mêmes arguments, dans le même
ordre : un prospect qui reçoit deux fois le même argumentaire ne lit pas une
relance, il lit un publipostage, et il classe l'expéditeur.

Trois leviers, et aucun ne suffit seul (`lib/agents/prompts/follow-up.ts`) :

1. **le message déjà envoyé, en entier**, lu dans `email_sends` et jamais
   reconstruit. Un résumé de ce qu'on croit avoir écrit laisserait passer
   exactement les phrases qu'on veut éviter ;
2. **des interdits dits comme des interdits** — jamais l'ouverture sur les
   69 %, jamais le conseiller redécrit dans les mêmes termes, jamais la phrase
   de démonstration mot pour mot, jamais une ouverture sur le temps écoulé.
   C'est la construction du DM (jalon 48) et de l'angle de rôle (jalon 53) : une
   omission se lit comme une absence d'information, une ligne qui dit « non » se
   lit comme une règle ;
3. **un but propre à chaque étape**, et une longueur qui décroît — 130 / 80 / 55
   mots au plus. Une relance plus longue que le premier message est une faute de
   raisonnement autant que de forme.

| Étape | Ce qu'elle fait |
|---|---|
| 1 | le premier contact, l'argumentaire complet — le seul message où il se déroule en entier |
| 2 | revient sur le premier **sans le répéter**, ajoute **un** angle neuf ou **un** détail concret, pose **une** question facile. Pas de second lien de réservation |
| 3 | dit que c'est le dernier message, laisse la porte ouverte, **aucune question** — relancer une troisième fois avec une question, c'est reprendre la pression qu'on prétend relâcher |

**La règle des relances, décidée à la relecture des références** :
*« Tu observes leur site, tu ne prêtes rien à leurs visiteurs. »* Ce que la
recherche a lu sur leurs pages est un fait qui s'écrit — « il y a plusieurs
formats sur votre page de recharges » se vérifie en un clic. Ce qui se passe
dans leur trafic ne l'est pas : « la question du format revient à chaque
visite », « vos visiteurs hésitent » sont des affirmations sur des gens que
nous n'avons jamais observés, **et le prospect sait que nous ne pouvons pas le
savoir**. L'hésitation reste donc à l'état de possibilité : « c'est typiquement
le genre de choix sur lequel on hésite ».

**L'objet ne change pas d'une étape à l'autre, et ne prend pas « Re: ».** Les
messageries regroupent par objet et par participants, donc la relance se range
sous le premier message toute seule ; un « Re: » sur un message qui n'est pas
une réponse est un faux signal de conversation.

### La garde : une relance qui recopie se voit avant de partir

`lib/domain/follow-up-echo.ts`, pur et testé. Même posture que la signature
(jalon 33) et le tiret long (jalon 58) : on demande dans le prompt, **et** on
vérifie au retour, parce qu'un prospect qui reçoit deux fois le même paragraphe
ne s'en plaint pas — il cesse de lire, et on ne l'apprend jamais.

Deux déclencheurs, qui ne disent pas la même chose : une **ouverture identique**
(les douze premiers mots utiles) signale qu'Alex a refait le premier message ;
une **suite de huit mots** partagée est une phrase recopiée, souvent celle de la
démonstration. Salutation et bloc de signature sont retirés de la comparaison :
identiques par construction, les compter ferait sonner la garde sur chaque
relance sans rien apprendre.

Elle **ne réécrit rien** — un remplacement automatique dans un texte commercial
ferait plus de dégâts qu'il n'en répare — et elle est **recalculée à la
lecture**, donc une retouche à la main est vérifiée elle aussi.

### 1 · « Arrêter » pendant la composition

`CompositionJob.stopRequestedAt` et `stopped`. La boucle relit le drapeau
**avant de commencer le brouillon suivant** : elle n'interrompt pas celui en
cours, qui est déjà payé — le tuer ne rendrait pas l'argent et perdrait le
texte. Ce qui est écrit reste en file, rien n'est envoyé, et la bande annonce
combien avait été fait : « 2 brouillons écrits avant l'arrêt, sur 12 prévus ».

Le bouton n'existe **que pendant** : arrêter une composition finie n'a pas de
sens, et un bouton inerte se lit comme une panne (jalon 26).

### 2 · « Réécrire tous les départs », et le défaut de recherche qu'il a révélé

Un brouillon en attente porte le discours du matin où il a été écrit. Quand le
mail de référence, les notes d'angle, la recherche ou la signature changent, la
file devient périmée **sans que rien ne le dise**. `lib/api/rewrite-queue.ts`
la recompose, campagne par campagne, chacune avec son propre journal — donc sa
propre barre et son propre bouton d'arrêt. **Rien n'est envoyé**, et la
confirmation reprend celle du jalon 70 : le coût annoncé avant d'être dépensé,
et le nombre de brouillons **retouchés à la main** qui seront remplacés.

**Le défaut nommé, avec sa ligne.** `lib/agents/email-draft.ts:582` appelait
`researchCompany(companyId)` : la déduction du domaine depuis l'adresse
électronique (jalon 75) vivait **à l'intérieur** de cette fonction, donc n'était
atteignable qu'à travers une société. Une fiche sans société rattachée — le cas
de la moitié d'un vivier importé — n'avait **aucune recherche du tout**, malgré
une adresse professionnelle qui portait le domaine. C'est exactement ce que la
file affichait en « aucun site ».

La recherche est désormais **clavetée sur une portée** (`ResearchScope`) :
la société d'abord, la fiche à défaut. `CompanyResearch` gagne un second point
d'ancrage (`contactId`, unique, migration `36_stop_and_contact_research`), et
une fiche sans maison obtient sa propre recherche, visée sur le domaine déduit
de son adresse.

### 4 · Une campagne en pause ne compose ni n'envoie, et la file le dit

La pause du jalon 71 coupait la composition (`sequence: { active: true }` dans
la clause) mais **`sendDeparture` ne la vérifiait jamais** : un brouillon d'une
campagne en pause partait encore d'un clic depuis la file. Le garde-fou est
posé à l'envoi, avec son message : « La campagne « X » est en pause : rien ne
part tant qu'elle ne redémarre pas. » **`postponeDeparture` ne l'a pas** —
reporter n'est pas envoyer, et refuser de décaler une échéance sur une campagne
gelée n'aurait protégé de rien.

Et `/departs` porte une bande ambre qui **nomme** les campagnes gelées : sans
elle, on relit des brouillons en se demandant pourquoi ils ne bougent pas.

### Jalon 84 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** (migration `36_stop_and_contact_research`
appliquée puis `migrate diff` **vide**), le serveur standalone de production,
le substitut Anthropic et un navigateur piloté :

- **1 · arrêter** : composition de 12 brouillons lancée en arrière-plan, clic
  sur « Arrêter » après 12 secondes → journal `arrêtée: true`, **2 brouillons
  écrits**, et **toujours 2** huit secondes plus tard — rien de plus n'a été
  composé ; **0 envoi** ;
- **2 · réécrire** : 6 brouillons en file écrits avant le correctif, sur des
  fiches **sans société** portant une adresse professionnelle →
  « **aucun site » avant : 6 sur 6**, « aucun site » **après : 0 sur 6**, chacune
  visée sur `r84rwN.fr (déduit de l'adresse email)`. Le plan (`GET`) n'appelle
  aucun modèle, et **0 envoi** ;
- **3 · l'étape 2** : composition d'un départ d'étape 2 sur un contact ayant
  déjà reçu l'étape 1 → le message exact parvient au modèle ; la garde reste
  muette sur le brouillon d'Alex et, sur un brouillon qui recopie, rend
  « Cette relance répète le premier message : elle ouvre comme le message
  précédent, elle en reprend « 69 des visiteurs quittent un site apres une
  question restee sans reponse j ai prepare une demonstration … » » ;
- **4 · pause** : campagne en pause → **0 composé**, envoi **refusé** en la
  nommant, et la file la signale (`campaignPaused: true`) ;
- **au navigateur** : « Arrêter » **atteignable** (`reachable()`, jamais
  `isVisible()`) au-dessus de « 3 sur 10 préparés », la bande de pause nomme la
  campagne, « Réécrire tous les départs » ouvre son plan chiffré **sans rien
  dépenser** (le départ en attente n'a pas bougé), **0 erreur console** ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1404 tests**) et
  `npm run e2e` (**65 tests**, douze fichiers) verts.

`tests/follow-up-source.test.ts` fixe les invariants du discours de relance :
le message précédent est **lu** et non reconstruit, les interdits sont dits
comme des interdits, la longueur décroît, et la garde d'écho est câblée. La
garde du tiret long (jalon 58) et celle du nom de contact (jalon 50) ont fait
leur travail sur ce jalon : six tirets longs introduits dans les nouveaux
fichiers, et un nom recomposé à la main dans `research.ts`, attrapés avant de
partir.

### Jalon 84 — ce qui n'est pas vérifié

**« N sources lues » n'a pas pu être mesuré, et c'est la limite de
l'environnement, pas du correctif.** Depuis les jalons 73 à 76 : il n'y a ni clé
d'API ici, ni sortie réseau vers les sites des prospects. Le substitut ne rend
donc aucun fait sourcé, et toute recherche y finit en « le site a été lu mais
n'apprend rien d'exploitable ». Ce que la recette établit est **le défaut qui
était nommé** : la recherche est désormais **lancée et visée** pour une fiche
sans société, alors qu'elle ne l'était pas du tout. Le passage de « aucun site »
à « N sources lues » se lira au premier vrai « Réécrire tous les départs » en
production — et si le nombre reste bas **alors que les cibles sont renseignées**,
c'est la lecture des pages qu'il faudra regarder, plus la déduction.

**La garde d'écho ne compare qu'au message précédent de la même séquence.** Une
relance qui recopierait un email écrit à la main sur la fiche ne serait pas
signalée : c'est `email_sends` filtré sur la séquence qui sert d'ancre.

**Le seuil de huit mots est un jugement**, comme les seuils d'ouverture du
jalon 43. Assez long pour qu'une coïncidence soit improbable, assez court pour
attraper une phrase recyclée ; il se calera sur ce que les vrais brouillons
montreront.

**L'arrêt ne remonte pas dans la boucle en cours.** Le drapeau est relu entre
deux brouillons : sur un appel au modèle qui durerait une minute, l'arrêt
prendrait effet à la fin de celui-là. C'est le compromis assumé — ce brouillon
est déjà payé.

**La réécriture est tout ou rien**, comme au jalon 70 : elle recompose tous les
brouillons en attente de toutes les campagnes, ou aucun. On ne choisit pas
d'épargner celui qu'on vient de corriger — la confirmation le dit, et ne pas
cliquer reste le refuge.

---

## Jalon 85 — le panneau lisait un champ que le serveur n'a jamais envoyé

### La cause, reproduite puis nommée

Reproduite d'abord, au clic, sur un départ **d'avant le jalon 84** (étape 2,
aucune recherche, aucun message précédent enregistré) :

```
exception : Cannot read properties of undefined (reading 'state')
Application error: a client-side exception has occurred
```

**`components/emails/compose-panel.tsx:383` lisait `draft.research.state`**
(par `<ResearchNote research={draft.research} …>`) alors que
**`lib/api/departures.ts` — `departureDraft()` — n'a jamais renvoyé ce champ**.
Le panneau le déclarait pourtant **obligatoire** dans son interface `Draft` :
la réponse traverse la frontière serveur → client en JSON, où le type n'existe
plus, donc rien n'échouait à la compilation et aucun test ne rougissait.

**Ce n'est pas le jalon 84.** `git log -S "ResearchNote"` sur le panneau rend un
seul commit : `4ef7bf4`, **jalon 74** — c'est lui qui a monté la carte de
recherche dans le tiroir, sans que le chemin « départ rouvert » la fournisse.
Le défaut dormait depuis, latent : il ne se déclenche qu'en rouvrant un départ
depuis la file, ce que le jalon 74 n'a pas rejoué (il l'écrit d'ailleurs dans sa
section « ce qui n'est pas vérifié » — *« Le chemin campagne n'a pas été rejoué
dans un navigateur ce jalon »*). Les nouveaux champs du jalon 84 — étape,
message précédent, écho, pause — **ne sont lus nulle part par le panneau** ; ils
vivent sur la carte de la file.

Le défaut ne dépend pas non plus de l'ancienneté du brouillon : **tout** départ
rouvert produisait la même exception, ancien comme frais, puisque le champ
manquait pour tous.

### Corrigé des deux côtés, et les deux sont nécessaires

**À la source** — `departureDraft()` rend désormais la recherche et le verdict
de garde-fou, par `cardFor()` et `ungroundedClaims()`, c'est-à-dire **les mêmes
fonctions que la file**. La société d'abord, la fiche à défaut : l'ordre de
`researchFor` (jalon 84). Un `RESEARCH_SELECT` unique sert les deux lectures —
deux listes de champs finiraient par diverger, et c'est la seconde qu'on oublie
de compléter (jalons 55, 64, 66, 74).

**À l'écran** — `research` et `ungrounded` deviennent **facultatifs** dans le
type du panneau, et la note n'est rendue que lorsqu'elle existe. Ce n'est pas
une ceinture de confort : **c'est ce qui rend le type honnête**. Tant qu'il
promettait un champ obligatoire, il décrivait ce qu'on espérait recevoir plutôt
que ce qui arrive. Effet immédiat et mesuré : avec le champ déclaré facultatif,
**`tsc` refuse la version non gardée du rendu** — le compilateur reprend la
main sur un défaut qui lui échappait entièrement.

### La garde

`tests/e2e/departure-rework.e2e.ts` ouvre « Retravailler avec Alex » sur un
départ semé **dans l'état de la production** (étape 2, sans recherche, sans
retouche) et vérifie qu'aucune exception ne remonte. C'est la leçon du jalon 83,
appliquée : partir de l'état où se trouve la production, pas de celui qu'on sait
produire.

L'assertion qui compte est `expect(session.errors).toEqual([])` autant que
l'absence d'« Application error » : une exception non rattrapée est **la** trace
qui blanchit la page, et aucune assertion de contenu ne l'attrape seule.

**Éprouvée en réintroduisant le défaut mot pour mot** — champ retiré du service
*et* rendu non gardé remis, type redevenu obligatoire : le test tombe sur
« expected 'Application error: a client-side exce…' not to contain 'Application
error' ». Avec le seul type corrigé, c'est `tsc` qui tombe d'abord.

### Jalon 85 — ce qui est vérifié

Contre un **vrai PostgreSQL 16** (`migrate diff` **vide** — aucune migration),
le serveur standalone de production et un navigateur piloté :

- **le défaut reproduit** avant correctif, avec son exception exacte ;
- **après correctif** : le panneau s'ouvre, porte le texte **de la file**
  (« Ancien brouillon. ») et son bouton « Enregistrer le brouillon », **0 erreur
  console** ;
- **la garde éprouvée** sur le défaut exact (voir ci-dessus) ;
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` (**1404 tests**) et
  `npm run e2e` (**66 tests**, treize fichiers) verts.

### Jalon 85 — ce qui n'est pas fait

**Le garde-fou de recherche du tiroir n'est toujours pas recalculé à la
retouche** (dette du jalon 74) : il est calculé à l'ouverture, et modifier le
texte à la main dans le panneau ne le recalcule pas. La file, elle, le recalcule
à chaque lecture.

**Aucun autre champ du panneau n'a été audité de la même façon.** Ce qui est
fermé, c'est le chemin par lequel le défaut est réellement arrivé — un champ
promis obligatoire et jamais envoyé. Une revue systématique des charges utiles
qui traversent la frontière serveur → client serait un jalon à elle seule.
