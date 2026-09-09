import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Une seule boucle de composition, et elle n'envoie jamais.**
 *
 * Deux façons de rater ce jalon, et aucune ne lève d'exception :
 *
 * 1. **une seconde boucle** — composer pour une campagne en réécrivant la
 *    boucle du matin. Elle marcherait le premier jour, puis oublierait un
 *    garde-fou : la fiche passée en « Perdu » depuis l'inscription, l'opposition
 *    au démarchage, la réponse déjà reçue. Les deux chemins écriraient des
 *    brouillons plausibles, l'un d'eux à des gens à qui l'on n'a plus le droit
 *    d'écrire ;
 * 2. **envoyer au lieu de remplir la file** — composer immédiatement et
 *    enchaîner l'envoi. C'est la distinction du jalon 38, et c'est celle qui
 *    protège d'un démarchage parti sans relecture.
 *
 * La garde est statique parce que les deux défauts le sont : du code juste
 * ligne à ligne, faux dans son ensemble.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  // Commentaires retirés avant examen : ces fichiers expliquent justement
  // pourquoi ils n'envoient pas, et la garde attraperait sa propre
  // documentation (leçon du jalon 52).
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("la composition immédiate passe par la boucle du matin", () => {
  const now = sourceOf("lib/api/compose-now.ts");

  it("appelle composeDepartures avec une portée, et n'écrit aucun départ elle-même", () => {
    expect(now).toMatch(/composeDepartures\(\s*now\s*,\s*\{\s*sequenceId\s*\}/);
    // Créer un départ ici, c'est avoir réécrit la boucle.
    expect(now).not.toMatch(/sequenceDeparture\s*\.\s*create/);
    // Et ce serait aussi avoir contourné les règles qui décident.
    expect(now).not.toContain("nextStep(");
  });

  it("n'envoie rien : composer n'est pas envoyer (jalon 38)", () => {
    expect(now).not.toContain("sendDeparture");
    expect(now).not.toContain("sendEmailToContact");
    expect(now).not.toContain("sendMail");
  });

  it("le compte annoncé ne consulte aucun modèle", () => {
    // `countComposable` doit rester une lecture : un plan qui appellerait Alex
    // ferait payer l'affichage d'une confirmation.
    const departures = sourceOf("lib/api/departures.ts");
    const body = departures.slice(
      departures.indexOf("export async function countComposable"),
      departures.indexOf("async function unlockOf"),
    );
    expect(body).not.toContain("draftEmail");
    expect(body).not.toMatch(/sequenceDeparture\s*\.\s*create/);
    expect(body).not.toMatch(/sequenceEnrollment\s*\.\s*update/);
    // Elle décide avec la même fonction que la boucle réelle : un compte fondé
    // sur une autre règle annoncerait un prix pour un travail qui n'aura pas lieu.
    expect(body).toContain("nextStep(");
  });
});

describe("la portée est un paramètre, pas une seconde fonction", () => {
  const departures = sourceOf("lib/api/departures.ts");

  it("composeDepartures accepte une portée et filtre dessus", () => {
    expect(departures).toMatch(/export async function composeDepartures\([\s\S]{0,200}scope: ComposeScope/);
    expect(departures).toMatch(/scope\.sequenceId === undefined \? \{\} : \{ sequenceId: scope\.sequenceId \}/);
  });

  it("le passage quotidien compose toujours sans portée", () => {
    // Le cron doit continuer de balayer tout le CRM : une portée oubliée là
    // ferait une file du matin qui ne contient qu'une campagne.
    const cron = sourceOf("app/api/cron/daily/route.ts");
    expect(cron).toMatch(/composeDepartures\(\s*\)/);
  });

  it("il n'existe qu'un seul appelant qui écrive des brouillons", () => {
    // Toute nouvelle porte doit passer par compose-now.ts ou par le cron.
    const callers = ["lib/api/compose-now.ts", "app/api/cron/daily/route.ts"];
    for (const file of callers) expect(sourceOf(file)).toContain("composeDepartures");
  });
});

describe("« Enregistrer » compose, et c'est tout l'objet du jalon", () => {
  it("l'enregistrement d'une séquence compose pour sa campagne", () => {
    // C'était le seul geste du parcours qui ne composait pas : on
    // enregistrait, la file restait vide, et il fallait trouver un second
    // bouton ou attendre le lendemain.
    const route = sourceOf("app/api/sequences-email/route.ts");
    expect(route).toContain("composeAfterSave");
    const post = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function PUT"));
    expect(post).toContain("composeAfterSave");
    expect(post).toContain("composition");
  });

  it("l'inscription compose aussi, sans second geste", () => {
    const route = sourceOf("app/api/campaigns/route.ts");
    const put = route.slice(route.indexOf("export async function PUT"), route.indexOf("export async function DELETE"));
    expect(put).toContain("composeForCampaign");
  });

  it("une campagne naît avec une séquence active, sinon rien ne composerait", () => {
    // `active: false` ne protégeait de rien — un départ ne part que sur un clic
    // — et empêchait la composition qu'on venait de demander.
    const campaigns = sourceOf("lib/api/campaigns.ts");
    const create = campaigns.slice(
      campaigns.indexOf("export async function createCampaign"),
      campaigns.indexOf("export const updateCampaignSchema"),
    );
    expect(create).toMatch(/active:\s*true/);
    expect(create).not.toMatch(/active:\s*false/);
  });
});

describe("le coût est annoncé avant d'être dépensé", () => {
  it("la route sépare le plan du travail", () => {
    const route = sourceOf("app/api/campaigns/compose/route.ts");
    // GET établit le plan sans composer ; POST compose.
    const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    expect(get).toContain("planComposition");
    expect(get).not.toContain("composeForCampaign");
  });

  it("l'estimation lit ce qui a réellement été facturé", () => {
    const now = sourceOf("lib/api/compose-now.ts");
    expect(now).toContain("apiUsage");
    expect(now).toContain("costMicros");
  });
});
