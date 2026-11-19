import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * **Un seul sélecteur de contact, un seul ordre.**
 *
 * La garde est statique parce que les deux rechutes visées le sont :
 *
 * 1. **un `<select>` de contacts qui revient.** Il compile, il rend, il
 *    fonctionne — et il affiche cent soixante-quinze lignes dans l'ordre d'un
 *    champ qu'il ne montre pas. Aucun type ne s'en plaint, et à l'écran cela
 *    ressemble à « la liste n'est pas triée », pas à un défaut ;
 * 2. **un second tri.** `contactOptions()` classe sur le prénom ; un appelant
 *    qui ajoute son `orderBy: { nameKey }` ou son `.sort()` « pour être sûr »
 *    reclasse sur le nom de famille, et deux écrans se contredisent alors sur
 *    les mêmes fiches. C'est le défaut que le jalon 116 a trouvé en trois
 *    exemplaires, chacun écrit de bonne foi.
 *
 * Les commentaires sont retirés avant examen : ce projet documente ce qu'il
 * s'interdit, et une garde naïve attraperait sa propre documentation.
 */

const ROOT = path.join(__dirname, "..");

function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const read = (file: string) => strip(readFileSync(path.join(ROOT, file), "utf8"));

function filesIn(relative: string): string[] {
  const dir = path.join(ROOT, relative);
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__") continue;
    const next = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) out.push(...filesIn(next));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(next);
  }
  return out;
}

const SOURCES = ["lib", "app", "components"].flatMap((root) => filesIn(root));

/** Le composant commun, et la fonction qui décide de l'ordre. */
const PICKER = "components/contacts/contact-picker.tsx";
const RULE = "lib/domain/contact-picker.ts";

/**
 * L'inventaire du jalon 116 : les quatre endroits où l'on choisit un contact.
 *
 * La liste est **positive**, et c'est ce qui donne du sens à l'interdiction du
 * `<select>` : sans elle, remplacer un sélecteur par un champ texte inerte
 * passerait la garde. Un cinquième sélecteur ajouté demain ne sera pas couvert
 * par ce test — mais il sera couvert par l'interdiction du `<select>`, et par
 * la revue qui verra cette liste ne pas grandir.
 */
const PICKERS: ReadonlyArray<readonly [string, string]> = [
  ["l'affaire (création, édition, tiroir)", "components/deals/deal-form.tsx"],
  ["la tâche", "components/tasks/task-full-form.tsx"],
  ["le compteur manuel du pilotage", "components/pilotage/manual-counter-inputs.tsx"],
  ["l'aperçu d'une étape manuelle", "components/settings/manual-step-editor.tsx"],
];

/** Un `<select>` … `</select>` complet, balises comprises. */
const SELECT_BLOCK = /<select[\s\S]*?<\/select>/g;

/**
 * Ce qui trahit une liste de contacts dans un menu déroulant.
 *
 * On regarde le **contenu** du bloc, pas le fichier : `deal-form.tsx` porte
 * quatre `<select>` légitimes — étape, propriétaire, offre — dans le même
 * fichier que le choix du contact.
 *
 * Le motif cherche la **source** des options, pas le mot « contact » : une
 * première version attrapait le choix du propriétaire de `contact-form.tsx`,
 * dont le `defaultValue` lit `contact?.owner`. Un menu déroulant qui mentionne
 * une fiche n'en liste pas pour autant.
 */
const CONTACT_IN_SELECT =
  /contacts\s*\.map|contactTitle\(|pickerLabel\(|contactOptions|ContactPickerOption/;

describe("le sélecteur de contact est unique", () => {
  it("aucun `<select>` ne liste des contacts", () => {
    const offenders: string[] = [];
    for (const file of SOURCES) {
      if (file === PICKER) continue;
      for (const block of read(file).match(SELECT_BLOCK) ?? []) {
        if (CONTACT_IN_SELECT.test(block)) {
          offenders.push(`${file} — ${block.split("\n")[0]?.trim() ?? ""}…`);
        }
      }
    }
    expect(
      offenders,
      `Un menu déroulant de contacts est revenu. Utilisez <ContactPicker> (${PICKER}) :\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("la garde reconnaît le menu déroulant qu'elle remplace", () => {
    // Le code réellement supprimé du formulaire d'affaire. Sans ce cas, une
    // expression régulière devenue fausse rendrait le test vert pour toujours.
    const removed = `
      <select className={INPUT} value={form.contactId} onChange={(e) => set("contactId", e.target.value)}>
        <option value="">—</option>
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>{contactTitle(contact)}</option>
        ))}
      </select>`;
    const blocks = removed.match(SELECT_BLOCK) ?? [];
    expect(blocks).toHaveLength(1);
    expect(CONTACT_IN_SELECT.test(blocks[0] ?? "")).toBe(true);
  });

  it("elle laisse passer les menus déroulants qui ne listent pas de contacts", () => {
    const innocents = [
      `
      <select value={form.owner} onChange={(e) => set("owner", e.target.value)}>
        {owners.map((owner) => (<option key={owner}>{owner}</option>))}
      </select>`,
      // Le vrai faux positif de la première version : il nomme une fiche, il
      // n'en liste pas.
      `
      <select name="owner" defaultValue={contact?.owner ?? ""} className={CONTROL}>
        <option value="">Non attribué</option>
        {owners.map((owner) => (<option key={owner}>{owner}</option>))}
      </select>`,
    ];
    for (const innocent of innocents) {
      const blocks = innocent.match(SELECT_BLOCK) ?? [];
      expect(blocks).toHaveLength(1);
      expect(CONTACT_IN_SELECT.test(blocks[0] ?? ""), innocent).toBe(false);
    }
  });

  it("les quatre sélecteurs de l'inventaire passent par le composant commun", () => {
    // `[\s/>]` est là pour qu'un `<ContactPickerAutreChose>` ne passe pas pour
    // le composant commun : la garde a été éprouvée là-dessus.
    const missing = PICKERS.filter(([, file]) => !/<ContactPicker[\s/>]/.test(read(file))).map(
      ([what, file]) => `${what} (${file})`,
    );
    expect(missing, `Ces sélecteurs ne passent plus par ContactPicker :\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("seul le composant commun monte un `Combobox` sans création pour des contacts", () => {
    // Un `Combobox` recopié avec `allowCreate={false}` serait un second
    // sélecteur : même apparence, et libre de retrier ou de relibeller.
    const offenders = SOURCES.filter(
      (file) => file !== PICKER && /allowCreate=\{false\}/.test(read(file)),
    );
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

/**
 * Un tri **de contacts**, et non un tri *sur un nombre de* contacts.
 *
 * Éprouvé : une première version attrapait `b.contacts - a.contacts` dans
 * `prospecting.ts` et `role-angles.ts`, où « contacts » est un compte de lignes
 * et le tri un classement par volume. On exige donc que la collection
 * elle-même soit le sujet du tri.
 */
const CONTACT_SORT =
  /contactOptions|ContactPickerOption|pickerLabel|compareContacts|contacts[\])]?\s*\.sort\(|\.sort\(\s*contacts|byName\(\s*contacts/;

describe("l'ordre des contacts se décide à un seul endroit", () => {
  it("aucun fichier ne retrie une liste d'options de contacts", () => {
    const offenders: string[] = [];
    for (const file of SOURCES) {
      if (file === RULE) continue;
      for (const [index, line] of read(file).split("\n").entries()) {
        const sorts = /\.sort\(|\bbyName\(|localeCompare\(/.test(line);
        if (sorts && CONTACT_SORT.test(line)) offenders.push(`${file}:${index + 1} — ${line.trim()}`);
      }
    }
    expect(
      offenders,
      `L'ordre vient de contactOptions() (${RULE}) et de nulle part ailleurs :\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("aucun sélecteur n'est alimenté par une requête qui ordonne les contacts", () => {
    /*
      `listContactOptions()` lit la table **sans `orderBy`** : le tri est celui
      du prénom, décidé en mémoire. Un `orderBy` ajouté ici serait un ordre
      concurrent — et comme il porterait sur `lastName` ou `nameKey`, il
      ramènerait exactement le défaut du départ.
    */
    const source = read("lib/api/contact-options.ts");
    expect(source).toContain("prisma.contact.findMany");
    expect(source).toContain("contactOptions(");
    expect(source).not.toContain("orderBy");
  });

  it("elle reconnaît un tri de contacts et laisse passer un tri par volume", () => {
    for (const guilty of [
      "const ordered = [...contacts].sort((a, b) => a.label.localeCompare(b.label));",
      "const ordered = contacts.sort(byLastName);",
      "const ordered = byName(contacts, (c) => c.lastName);",
      "return contactOptions(rows).sort(somethingElse);",
    ]) {
      expect(CONTACT_SORT.test(guilty), guilty).toBe(true);
    }
    for (const innocent of [
      ".sort((a, b) => b.qualified - a.qualified || b.contacts - a.contacts);",
      'return out.sort((a, b) => b.contacts - a.contacts || a.title.localeCompare(b.title, "fr"));',
    ]) {
      expect(CONTACT_SORT.test(innocent), innocent).toBe(false);
    }
  });

  it("la règle est la seule à comparer deux noms en français", () => {
    const rule = read(RULE);
    expect(rule).toContain('localeCompare(b, "fr", { sensitivity: "base" })');
  });
});
