import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REMOVED } from "@/lib/domain/campaign-members";
import { describeEdited, describeScope } from "@/components/campaigns/compose-action";

/**
 * **Retirer quelqu'un d'une campagne le retire vraiment, et n'efface rien
 * d'autre.**
 *
 * Trois défauts possibles, aucun ne lève d'exception :
 *
 * 1. **confondre « retiré » et « arrêté »** — la ligne reste affichée, la fiche
 *    reste comptée comme inscrite, et la réinscrire devient impossible : le
 *    retrait est alors un aller sans retour ;
 * 2. **laisser le départ en attente dans la file** — la personne sort de la
 *    campagne le matin et reçoit son message l'après-midi ;
 * 3. **supprimer l'inscription, ou pire, toucher à la fiche** — retirer
 *    quelqu'un d'une campagne ne réécrit pas le passé : les messages déjà
 *    partis restent dans `/emails` et sur sa fiche.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("« retiré » est un état à part, pas un synonyme d'« arrêté »", () => {
  it("le mot vit dans le domaine, une seule fois", () => {
    expect(REMOVED).toBe("removed");
    // Trois couches le comparent — liste, inscription, retrait — et aucune ne
    // doit écrire la chaîne elle-même.
    for (const file of ["lib/api/campaigns.ts", "lib/api/email-sequences.ts"]) {
      const source = sourceOf(file);
      expect(source).toContain("REMOVED");
      expect(source).not.toMatch(/status:\s*"removed"/);
    }
  });

  it("le retrait écarte le départ en attente et garde l'inscription", () => {
    const campaigns = sourceOf("lib/api/campaigns.ts");
    const remove = campaigns.slice(
      campaigns.indexOf("export async function removeMember"),
      campaigns.indexOf("export async function enrolledContactIds"),
    );
    expect(remove).toContain("REMOVED");
    expect(remove).toMatch(/sequenceDeparture\s*\.\s*updateMany/);
    expect(remove).toMatch(/status:\s*"pending"/);
    // L'inscription est arrêtée, jamais supprimée : la supprimer sortirait la
    // personne du dénominateur de l'entonnoir.
    expect(remove).not.toMatch(/sequenceEnrollment\s*\.\s*delete/);
    // Et rien de la fiche ne bouge.
    expect(remove).not.toMatch(/prisma\s*\.\s*contact/);
    expect(remove).not.toMatch(/prisma\s*\.\s*activity/);
    expect(remove).not.toMatch(/prisma\s*\.\s*emailSend/);
  });

  it("une fiche retirée sort de la liste et redevient inscriptible", () => {
    const campaigns = sourceOf("lib/api/campaigns.ts");
    // La liste des inscrits et la liste des « déjà inscrits » de /contacts
    // filtrent toutes deux le retrait — sinon l'un des deux écrans mentirait.
    expect(campaigns.match(/status:\s*\{\s*not:\s*REMOVED\s*\}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("réinscrire réactive plutôt que de créer un doublon", () => {
    const sequences = sourceOf("lib/api/email-sequences.ts");
    const enroll = sequences.slice(sequences.indexOf("export async function enroll"));
    // Une inscription existante non retirée compte pour « déjà inscrite » ;
    // une retirée repart à zéro, sur la même ligne (la contrainte d'unicité
    // interdit d'en créer une seconde).
    expect(enroll).toMatch(/existing !== null && existing\.status !== REMOVED/);
    expect(enroll).toMatch(/status:\s*"active"/);
    expect(enroll).toMatch(/lastStep:\s*0/);
  });
});

describe("« Écrire les mails » dit ce qu'il va écrire, et ce qu'il va remplacer", () => {
  it("les contacts neufs et les brouillons réécrits sont annoncés séparément", () => {
    expect(describeScope({ fresh: 3, rewritten: 0 })).toBe(
      "3 contacts qui n'ont encore rien reçu",
    );
    expect(describeScope({ fresh: 0, rewritten: 1 })).toBe(
      "1 brouillon en attente, réécrit avec les consignes du jour",
    );
    expect(describeScope({ fresh: 1, rewritten: 2 })).toContain(" · ");
  });

  it("le nombre de retouches à la main est nommé, jamais suggéré", () => {
    // « certains brouillons seront remplacés » ne se décide pas : on ne sait
    // pas s'il s'agit d'un texte ou de douze.
    expect(describeEdited(0)).toBeNull();
    expect(describeEdited(1)).toContain("1 brouillon");
    expect(describeEdited(4)).toContain("4 brouillons");
  });

  it("la réécriture ne touche qu'un brouillon en attente", () => {
    const departures = sourceOf("lib/api/departures.ts");
    // Un départ déjà envoyé n'est jamais recomposé : on ne réécrit pas un
    // message qui est parti.
    expect(departures).toMatch(/scope\.rewritePending[\s\S]{0,80}status === "pending"/);
  });
});
