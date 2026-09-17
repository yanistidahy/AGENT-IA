import "server-only";
import { prisma } from "../db";
import { anthropic, describeAnthropicError } from "../agents/runtime/client";
import { requestFor } from "../agents/runtime/request";
import { modelFor } from "./reference";
import { recordUsage, usageOf, budgetRefusal } from "./usage";
import { costMicros } from "../domain/model-pricing";
import {
  resolveResearchTarget,
  storedTarget,
  type ResearchTarget,
} from "../domain/research-target";
import {
  isStale,
  usableFacts,
  type Research,
  type ResearchFact,
  type ResearchGap,
  type ResearchSource,
} from "../domain/research";

/**
 * La recherche préalable : lire le prospect avant de lui écrire.
 *
 * ### Un appel séparé, et non des outils greffés sur la rédaction
 *
 * C'est la décision qui structure le module. Brancher `web_search` sur l'appel
 * de rédaction aurait été plus court à écrire et faux sur trois points :
 *
 * 1. **le cache.** Une recherche appartient à la *société*, pas au contact :
 *    trois personnes d'une même maison doivent la partager. Inline, chacun des
 *    trois brouillons la repaierait ;
 * 2. **la persistance.** Recomposer un brouillon — ce que « Écrire les mails »
 *    fait délibérément depuis le jalon 70 — repaierait la lecture à chaque fois ;
 * 3. **le garde-fou.** Vérifier qu'une affirmation vient d'une page lue suppose
 *    de *disposer* de ce qui a été lu, comme donnée, séparément du brouillon.
 *    Fondus dans un seul appel, les deux ne sont plus comparables.
 *
 * La rédaction garde donc exactement la forme qu'elle avait — un appel, pas
 * d'outil, un JSON — et reçoit la recherche comme un fait de plus dans son
 * dossier.
 */

/** Ce que le modèle doit rendre. Le schéma est décrit dans l'instruction. */
interface RawResearch {
  readonly summary?: unknown;
  readonly facts?: unknown;
}

const SYSTEM = `Tu documentes une entreprise pour un commercial qui va lui écrire.

Ta seule tâche est de **lire** et de **rapporter**. Tu ne rédiges aucun message.

Règles, dans l'ordre où elles comptent :

1. **Le site de l'entreprise est la source première.** Commence par le lire.
   La recherche web ne sert qu'à compléter ce que le site ne dit pas : presse,
   levée de fonds, lancement récent.
2. **Chaque fait que tu rapportes doit venir d'une page que tu as réellement
   lue, et tu donnes son URL.** Tu ne déduis rien du nom de la marque, rien du
   secteur, rien de ce qui te semble probable. Un fait que tu ne peux pas
   rattacher à une page, tu ne le rapportes pas.
3. **Si tu ne trouves rien d'exploitable, dis-le** en rendant une liste de
   faits vide. C'est une réponse valide et utile. Inventer ne l'est pas.

Ce qu'on cherche, et rien d'autre :

- ce que l'entreprise vend, concrètement (la catégorie de produit) ;
- son positionnement, tel qu'elle le formule ;
- son modèle d'affaires : abonnement, achat ponctuel, place de marché, B2B ;
- **ce qui fait hésiter un visiteur avant d'acheter** chez elle : les questions
  qu'il se pose et auxquelles la fiche produit ne répond pas toujours.

Réponds en JSON, sans bloc de code :
{"summary": "une phrase sur ce que tu as appris",
 "facts": [{"label": "produit|positionnement|modèle|hésitation",
            "detail": "le fait, en une phrase",
            "sourceUrl": "https://la-page-lue"}]}`;

function askFor(name: string, target: ResearchTarget): string {
  return `Entreprise : ${name}
Site : ${target.url}${
    target.source === "email"
      ? `
(Cette adresse est **déduite du domaine des adresses électroniques** des fiches,
elle n'a pas été saisie à la main. Si la page lue n'est manifestement pas le site
marchand de cette entreprise, rends une liste de faits vide : ne rapporte rien
d'un site qui appartient à quelqu'un d'autre.)`
      : ""
  }

Lis ce site, puis complète si besoin par une recherche. Rapporte ce que tu as
lu, avec les URL. Si le site est inaccessible ou n'apprend rien d'exploitable,
rends une liste de faits vide.`;
}

/**
 * Lit la société, ou rend ce qui avait déjà été lu.
 *
 * `force` relit malgré le cache — c'est le geste explicite, jamais un effet de
 * bord : une recherche coûte un appel avec outils, le plus cher du produit.
 */
export async function researchCompany(
  companyId: string,
  options: { readonly force?: boolean; readonly now?: Date } = {},
): Promise<Research | null> {
  const now = options.now ?? new Date();

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      domain: true,
      research: { include: { facts: true, sources: true } },
      // Les fiches de la maison, pour y lire un site saisi ou, à défaut, le
      // domaine porté par une adresse électronique (jalon 75). Bornée : au-delà
      // de vingt fiches, la vingt-et-unième n'apprendra rien de plus.
      contacts: { select: { website: true, email: true }, take: 20 },
    },
  });
  if (company === null) return null;

  const stored = company.research === null ? null : toResearch(company.research);
  if (stored !== null && options.force !== true && !isStale(stored, now)) return stored;

  /*
    **L'ordre est la décision** : un champ saisi l'emporte sur une déduction, et
    la déduction ne comble qu'un vide. Voir `research-target.ts` pour le
    raisonnement complet, et pour l'exclusion des messageries grand public.
  */
  const target = resolveResearchTarget({
    website: company.contacts.map((c) => c.website).find((w) => w.trim() !== "") ?? "",
    companyDomain: company.domain,
    emails: company.contacts.map((c) => c.email),
  });

  if (target === null) {
    // **Aucun site : on n'invente pas de recherche.** Un modèle à qui l'on
    // demande de documenter une entreprise sans lui donner d'adresse en
    // fabrique une — c'est le défaut du jalon 48 sur les sites de démonstration,
    // une strate plus haut.
    return save(companyId, {
      gap: "no-domain",
      summary: "",
      facts: [],
      sources: [],
      corpus: "",
      target: null,
      model: "",
      micros: 0,
      durationMs: 0,
      fetchedAt: now,
    });
  }

  const refusal = await budgetRefusal();
  if (refusal !== null) {
    // Un plafond atteint n'est pas une société sans site : c'est la chaîne qui
    // s'arrête, et l'écran doit le nommer pour qu'on sache où agir.
    return save(companyId, {
      gap: "failed",
      summary: refusal,
      facts: [],
      sources: [],
      corpus: "",
      target,
      model: "",
      micros: 0,
      durationMs: 0,
      fetchedAt: now,
    });
  }

  // L'usage « research » décide du modèle, du plafond et de l'effort : lire et
  // rapporter n'est pas mettre en forme, et `request.ts` reste la seule porte.
  const model = await modelFor("research");
  const started = Date.now();

  try {
    const response = await anthropic().messages.create({
      ...requestFor("research", model),
      system: SYSTEM,
      /*
        **Les deux outils serveur, et rien d'autre.** `web_fetch` ne va chercher
        que des URL déjà présentes dans la conversation — c'est pour cela que
        l'adresse du site est écrite en toutes lettres dans la demande. Et on ne
        déclare surtout pas `code_execution` à côté : ces variantes l'exécutent
        déjà sous le capot pour leur filtrage, et un second environnement
        embrouille le modèle.

        **`allowed_callers: ["direct"]` est posé explicitement**, et ce n'est
        pas une précaution de style : omis, ces variantes prennent un jeu
        d'appelants qui comprend l'exécution de code, donc exigent l'appel
        d'outil programmatique — et l'API refuse la requête entière (400) sur
        tout modèle qui ne le sait pas faire. Nous ne déclarons aucun
        environnement d'exécution : « direct » est littéralement la seule façon
        dont ces outils sont appelés ici.
      */
      tools: [
        {
          type: "web_fetch_20260209",
          name: "web_fetch",
          max_uses: 4,
          allowed_callers: ["direct"],
        },
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 3,
          allowed_callers: ["direct"],
        },
      ],
      messages: [{ role: "user", content: askFor(company.name, target) }],
    });

    const durationMs = Date.now() - started;
    const usage = usageOf(response.usage);
    await recordUsage({ agentId: "alex", purpose: "research", model, usage });

    const read = harvest(response.content);
    const parsed = parseJson(response.content);
    const facts = usableFacts(toFacts(parsed?.facts));

    return save(companyId, {
      // **`thin` plutôt qu'une prose inventée.** Un site lu qui n'apprend rien
      // est une réponse honnête ; le brouillon retombera en générique et le
      // dira.
      gap: facts.length === 0 ? "thin" : null,
      summary: typeof parsed?.summary === "string" ? parsed.summary.trim() : "",
      facts,
      sources: read.sources,
      corpus: read.corpus,
      target,
      model,
      micros: costMicros(model, {
        input: usage.input,
        output: usage.output,
        thinking: null,
        cacheRead: 0,
        cacheWrite: 0,
      }),
      durationMs,
      fetchedAt: now,
    });
  } catch (error) {
    /*
      **L'échec est enregistré nommé, et il ne se fige pas.** `gap: "failed"`
      porte la raison exacte dans `summary` ; `isStale` le considère périmé au
      bout de `RETRY_MINUTES`, donc le brouillon suivant retente au lieu de
      rester générique jusqu'à la fin de la fenêtre de fraîcheur.
    */
    const reason = describeAnthropicError(error);
    console.error(`[research] échec sur la société ${companyId} : ${reason}`);
    return save(companyId, {
      gap: "failed",
      summary: reason,
      facts: [],
      sources: [],
      corpus: "",
      target,
      model,
      micros: 0,
      durationMs: Date.now() - started,
      fetchedAt: now,
    });
  }
}

/* ---------------------------------------------------------------- lecture */

interface Harvested {
  readonly corpus: string;
  readonly sources: ResearchSource[];
}

/** Borne le corpus : il sert à chercher un mot, pas à être relu en entier. */
const CORPUS_MAX = 20_000;

/**
 * Ce que les outils serveur ont réellement ramené.
 *
 * **Les erreurs d'outil ne lèvent pas** : elles arrivent en HTTP 200, dans un
 * bloc de résultat dont le `content` est un objet d'erreur au lieu d'une liste.
 * On distingue donc les deux avant d'indexer, sans quoi une recherche refusée
 * ressemblerait à une recherche vide.
 */
function harvest(content: readonly unknown[]): Harvested {
  const sources: ResearchSource[] = [];
  const parts: string[] = [];

  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const typed = block as { type?: unknown; content?: unknown };

    if (typed.type === "web_fetch_tool_result") {
      const result = typed.content;
      if (typeof result !== "object" || result === null) continue;
      const fetched = result as { url?: unknown; content?: unknown };
      const url = typeof fetched.url === "string" ? fetched.url : "";
      const document = fetched.content as { title?: unknown; source?: unknown } | undefined;
      const title = typeof document?.title === "string" ? document.title : url;
      const source = document?.source as { data?: unknown } | undefined;
      if (typeof source?.data === "string") parts.push(source.data);
      if (url !== "") sources.push({ url, title });
      continue;
    }

    if (typed.type === "web_search_tool_result") {
      // Succès : une liste. Erreur : un objet. La branche est la garde.
      if (!Array.isArray(typed.content)) continue;
      for (const entry of typed.content) {
        if (typeof entry !== "object" || entry === null) continue;
        const hit = entry as { url?: unknown; title?: unknown; page_age?: unknown };
        if (typeof hit.url !== "string") continue;
        sources.push({ url: hit.url, title: typeof hit.title === "string" ? hit.title : hit.url });
        if (typeof hit.title === "string") parts.push(hit.title);
      }
    }
  }

  return { corpus: parts.join("\n").slice(0, CORPUS_MAX), sources: dedupe(sources) };
}

function dedupe(sources: readonly ResearchSource[]): ResearchSource[] {
  const seen = new Map<string, ResearchSource>();
  for (const source of sources) if (!seen.has(source.url)) seen.set(source.url, source);
  return [...seen.values()];
}

function parseJson(content: readonly unknown[]): RawResearch | null {
  const text = content
    .filter(
      (block): block is { type: "text"; text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text)
    .join("")
    .trim();

  const json = text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1");
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null ? (parsed as RawResearch) : null;
  } catch {
    return null;
  }
}

function toFacts(raw: unknown): ResearchFact[] {
  if (!Array.isArray(raw)) return [];
  const facts: ResearchFact[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const fact = entry as { label?: unknown; detail?: unknown; sourceUrl?: unknown };
    facts.push({
      label: typeof fact.label === "string" ? fact.label : "",
      detail: typeof fact.detail === "string" ? fact.detail : "",
      sourceUrl: typeof fact.sourceUrl === "string" ? fact.sourceUrl : "",
    });
  }
  return facts;
}

/* -------------------------------------------------------------- écriture */

interface Stored {
  readonly gap: ResearchGap;
  readonly summary: string;
  readonly facts: readonly ResearchFact[];
  readonly sources: readonly ResearchSource[];
  readonly corpus: string;
  readonly target: ResearchTarget | null;
  readonly model: string;
  readonly micros: number;
  readonly durationMs: number;
  readonly fetchedAt: Date;
}

async function save(companyId: string, input: Stored): Promise<Research> {
  const data = {
    gap: input.gap ?? "",
    summary: input.summary,
    corpus: input.corpus,
    targetHost: input.target?.host ?? "",
    targetSource: input.target?.source ?? "",
    model: input.model,
    micros: input.micros,
    durationMs: input.durationMs,
    fetchedAt: input.fetchedAt,
  };

  await prisma.$transaction(async (tx) => {
    const row = await tx.companyResearch.upsert({
      where: { companyId },
      update: data,
      create: { companyId, ...data },
      select: { id: true },
    });
    // Remplacer plutôt qu'ajouter : une relecture décrit l'état d'aujourd'hui,
    // et empiler les faits ferait cohabiter deux lectures contradictoires.
    await tx.researchFact.deleteMany({ where: { researchId: row.id } });
    await tx.researchSource.deleteMany({ where: { researchId: row.id } });
    await tx.researchFact.createMany({
      data: input.facts.map((fact) => ({ researchId: row.id, ...fact })),
    });
    await tx.researchSource.createMany({
      data: input.sources.map((source) => ({ researchId: row.id, ...source })),
    });
  });

  return {
    gap: input.gap,
    summary: input.summary,
    facts: [...input.facts],
    sources: [...input.sources],
    target: input.target,
    fetchedAt: input.fetchedAt,
  };
}

interface Row {
  readonly gap: string;
  readonly summary: string;
  readonly targetHost: string;
  readonly targetSource: string;
  readonly fetchedAt: Date;
  readonly facts: readonly { label: string; detail: string; sourceUrl: string }[];
  readonly sources: readonly { url: string; title: string }[];
}

function toResearch(row: Row): Research {
  return {
    gap: row.gap === "" ? null : (row.gap as ResearchGap),
    summary: row.summary,
    facts: row.facts.map((fact) => ({ ...fact })),
    sources: row.sources.map((source) => ({ ...source })),
    target: storedTarget(row.targetHost, row.targetSource),
    fetchedAt: row.fetchedAt,
  };
}

/** La recherche déjà en base, sans jamais en déclencher une. */
export async function readResearch(companyId: string): Promise<Research | null> {
  const row = await prisma.companyResearch.findUnique({
    where: { companyId },
    include: { facts: true, sources: true },
  });
  return row === null ? null : toResearch(row);
}

/** Le corpus, pour le garde-fou. Lu à part : il est volumineux. */
export async function readCorpus(companyId: string): Promise<string> {
  const row = await prisma.companyResearch.findUnique({
    where: { companyId },
    select: { corpus: true },
  });
  return row?.corpus ?? "";
}
