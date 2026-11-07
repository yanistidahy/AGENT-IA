import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MANUAL_CHANNELS, MANUAL_SHAPES } from "@/lib/domain/manual-count";
import { SENT_TYPES } from "@/lib/domain/pilotage";
import { LEMLIST_MAPPING } from "@/lib/domain/lemlist";

/**
 * **Le compteur manuel, sous garde statique.**
 *
 * Quatre façons de défaire ce jalon sans qu'aucun type ne soit violé, sans
 * qu'aucune exception ne lève et sans qu'aucun test existant ne rougisse :
 *
 * 1. **un message compte deux fois.** `manualDone` de lemlist désigne une tâche
 *    manuelle achevée dans *leur* interface ; si elle entrait dans « messages
 *    envoyés », le même geste serait compté une fois ici et une fois là. Le
 *    jalon 111 l'a rangé dans `other`, et c'est cette garde qui l'y tient ;
 * 2. **le compteur se met à consigner une interaction.** `logActivity` écrit
 *    déjà son propre événement (jalon 109) : écrire les deux doublerait le
 *    message ;
 * 3. **une ligne sans fiche devient quelqu'un.** Le filtre vit dans
 *    `contactsOf` et nulle part ailleurs ; une fonction qui lirait `contactId`
 *    sans le garder pourrait faire entrer une ligne sans fiche dans « nouvelles
 *    personnes contactées » ;
 * 4. **`localStorage` est lu sans filet.** L'accès **lève** en navigation
 *    privée et quand les données de site sont bloquées. Un bloc qui tombe pour
 *    cela serait inutilisable là où il sert le plus — sur un téléphone.
 *
 * Même famille que `pilotage-source`, `reply-stop-source` et `lemlist-source`.
 */

const ROOT = path.join(__dirname, "..");

/**
 * **Le code sans ses commentaires.**
 *
 * Même fonction que `pilotage-source.test.ts`, et pour une raison que ce
 * fichier a payée en l'écrivant : les commentaires de ce projet *nomment* ce
 * qu'ils interdisent — « écrire les deux doublerait le message », « un
 * `z.number().max(20)` rendrait Invalid input ». Une garde qui lit les
 * commentaires accuse donc le code d'exactement ce qu'il explique éviter, et
 * cinq de ces tests sont tombés comme ça au premier passage.
 */
function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const read = (file: string) => strip(readFileSync(path.join(ROOT, file), "utf8"));
/** Le fichier entier, commentaires compris — pour les assertions de présence. */
const readAll = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const domain = read("lib/domain/manual-count.ts");
const writer = read("lib/api/manual-events.ts");
const route = read("app/api/outreach/manual/route.ts");
const block = read("components/pilotage/manual-counter.tsx");
const pilotage = read("lib/domain/pilotage.ts");

/* ----------------------------------------------- un message, un seul compte - */

describe("un message n'est jamais compté deux fois", () => {
  /**
   * **Le préalable du jalon, en garde.** La table de correspondance et la
   * fonction qui compte sont deux fichiers ; ce test les met face à face, donc
   * élargir l'une sans regarder l'autre le fait tomber.
   */
  it("`manualDone` de lemlist n'est pas un type de « messages envoyés »", () => {
    const mapped = LEMLIST_MAPPING["manualDone"];
    expect(mapped, "manualDone n'a plus de décision écrite").toBeDefined();
    expect(mapped?.type).toBe("other");
    expect(SENT_TYPES).not.toContain(mapped?.type);
  });

  it("toute la famille `*Done` de tâche reste hors de « messages envoyés »", () => {
    for (const rawType of [
      "manualDone",
      "emailsDone",
      "linkedinDone",
      "whatsappDone",
      "smsDone",
      "aircallDone",
      "apiDone",
    ]) {
      expect(SENT_TYPES, rawType).not.toContain(LEMLIST_MAPPING[rawType]?.type);
    }
  });

  /**
   * Le compteur écrit **dans le journal et nulle part ailleurs**. Une
   * interaction consignée produit déjà son propre événement par
   * `eventForActivity` : écrire les deux doublerait le message.
   */
  it("le compteur n'écrit aucune interaction ni aucune tâche", () => {
    for (const [name, source] of [
      ["écrivain", writer],
      ["route", route],
    ] as const) {
      expect(source, `${name} consigne une interaction`).not.toContain("logActivity");
      expect(source, `${name} écrit une interaction`).not.toContain("prisma.activity.create");
      expect(source, `${name} crée une tâche`).not.toContain("prisma.task.create");
    }
  });

  /** Un seul écrivain d'événements, celui du jalon 109. */
  it("passe par recordOutreachEvent, et pose source « manual »", () => {
    expect(writer).toContain("recordOutreachEvent(");
    expect(writer).toContain('source: "manual"');
    expect(writer).toContain("externalId: manualCountKey(");
    // Jamais un `create` direct : il contournerait la contrainte d'unicité qui
    // rend un rejeu inoffensif.
    expect(writer).not.toContain("prisma.outreachEvent.create(");
  });
});

/* ------------------------------------------- une ligne sans fiche n'est personne */

describe("une ligne sans fiche ne devient jamais quelqu'un", () => {
  /**
   * Le filtre vit à **un seul endroit**. C'est ce qui empêche une fonction
   * d'oublier la règle : tout ce qui compte des gens passe par `contactsOf`.
   */
  it("le filtre est dans contactsOf, et les trois autres lectures le gardent", () => {
    expect(pilotage).toMatch(/function contactsOf[\s\S]{0,400}row\.contactId === null/);
    // `firstTouch`, `firstRowPerContact` et `qualifiedAt` lisent `contactId`
    // directement : chacune doit garder le nul.
    const guards = pilotage.match(/row\.contactId === null/g) ?? [];
    expect(guards.length, "une lecture de contactId ne garde plus le nul").toBeGreaterThanOrEqual(4);
  });

  it("la liste d'un chiffre rend une ligne pour elle", () => {
    const list = read("app/(crm)/pilotage/liste/page.tsx");
    // La page distingue la ligne sans fiche et ne lui met pas de lien : il n'y
    // a pas de fiche à ouvrir.
    expect(list).toContain("data-no-contact");
    expect(list).toMatch(/row\.contactId === null/);
    // Le libellé, lui, est posé par le service — un seul endroit le décide.
    expect(pilotage).toContain('export const NO_CONTACT_LABEL = "Sans contact"');
    expect(read("lib/api/outreach-events.ts")).toContain("NO_CONTACT_LABEL");
  });

  /** L'origine se lit dans la liste : trois chemins écrivent des messages. */
  it("la liste nomme l'origine de chaque ligne", () => {
    const list = read("app/(crm)/pilotage/liste/page.tsx");
    expect(list).toContain("sourceLabel(row.source)");
    expect(pilotage).toContain("export const SOURCE_LABELS");
  });
});

/* ----------------------------------------------------------- le bloc ------- */

describe("le bloc tient sur un téléphone", () => {
  /**
   * L'accès à `localStorage` **lève** en navigation privée : il ne rend pas
   * `null`. Un bloc qui tombe pour cela serait inutilisable sur le seul
   * appareil depuis lequel on s'en sert vraiment.
   */
  it("n'accède à localStorage que sous try/catch", () => {
    const accesses = block.match(/window\.localStorage/g) ?? [];
    expect(accesses.length).toBeGreaterThan(0);
    // Chaque accès vit dans une fonction dédiée, et les deux sont gardées.
    expect(block).toMatch(/function readOwner\(\)[\s\S]{0,260}catch/);
    expect(block).toMatch(/function writeOwner\([\s\S]{0,260}catch/);
    // Aucun accès direct ailleurs : sinon la garde ne couvre pas tout.
    expect(accesses).toHaveLength(2);
  });

  /**
   * Le propriétaire est lu **après le montage**. Le serveur ne connaît pas
   * `localStorage` : l'y lire ferait diverger les deux rendus, ce qui est la
   * cause des avertissements d'hydratation.
   */
  it("lit le propriétaire dans un effet, pas au rendu", () => {
    expect(block).toMatch(/useEffect\(\(\) => \{[\s\S]{0,200}readOwner\(\)/);
  });

  it("propose les cinq canaux, chacun avec sa cible tactile", () => {
    for (const channel of MANUAL_CHANNELS) {
      expect(block, channel).toContain(`data-manual-add={channel}`);
    }
    expect(MANUAL_CHANNELS).toHaveLength(5);
    // 44 px de cible tactile, règle du jalon 46. `min-h-11` vaut 44 px.
    expect(block).toMatch(/data-manual-add[\s\S]{0,400}min-h-11/);
    // Une colonne sous 420 px : pas de défilement horizontal à 390 px.
    expect(block).toContain("grid-cols-1");
    expect(block).toContain("min-[420px]:grid-cols-2");
  });

  /** La seule chose qui ne se devine pas est écrite sous le bloc. */
  it("dit ce que le contact change", () => {
    const inputs = readAll("components/pilotage/manual-counter-inputs.tsx");
    expect(inputs).toContain("data-manual-note");
    expect(inputs).toMatch(/nouvelles personnes contactées[\s\S]{0,240}messages envoyés/);
  });

  /**
   * Un écran de mesure n'additionne pas : la garde du jalon 109 l'interdit, et
   * le total vient donc du domaine.
   */
  it("n'additionne rien lui-même", () => {
    expect(block).toContain("tallyTotal(today)");
    expect(block).not.toMatch(/\.reduce\s*\(/);
    expect(domain).toContain("export function tallyTotal");
  });
});

/* ------------------------------------------------------- les deux bornes --- */

describe("les bornes sont lues par le domaine", () => {
  /**
   * Un `z.number().max(20)` rendrait « Invalid input », qui n'apprend rien et
   * n'indique aucun geste. Le refus doit nommer la borne franchie.
   */
  it("la route appelle le domaine plutôt que de borner elle-même", () => {
    expect(route).toContain("readQuantity(");
    expect(route).toContain("readEntryDate(");
    expect(route).not.toMatch(/z\.number\(\)[^;]*\.max\(/);
  });

  it("les cinq canaux comptent tous comme des messages envoyés", () => {
    for (const channel of MANUAL_CHANNELS) {
      expect(SENT_TYPES, channel).toContain(MANUAL_SHAPES[channel].type);
    }
  });
});
