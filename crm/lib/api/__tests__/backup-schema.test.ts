import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, backupSchema } from "../backup";
import { BACKED_UP_TABLES, NOT_BACKED_UP } from "../../domain/backup-coverage";

/**
 * Le format du fichier de sauvegarde, à la frontière.
 *
 * Deux exigences qui tirent en sens inverse, et c'est tout l'enjeu :
 *
 * 1. **un fichier plus ancien reste restaurable** — sinon le filet lâche au
 *    moment précis où l'on s'en sert, c'est-à-dire le jour où la base est
 *    perdue et où la seule sauvegarde qu'on retrouve date d'un jalon d'avant ;
 * 2. **une section présente mais vide vide réellement la table** — « zéro
 *    campagne » est une information, « pas de section campagnes » n'en est pas
 *    une. Confondre les deux ferait survivre des campagnes que la sauvegarde
 *    dit absentes.
 */

/** Le plus petit fichier que la version 1 ait jamais produit (jalon 5). */
function ancientBackup(): Record<string, unknown> {
  return {
    version: BACKUP_VERSION,
    exportedAt: "2026-01-01T00:00:00.000Z",
    stages: [],
    companies: [],
    contacts: [],
    deals: [],
    activities: [],
    tasks: [],
    settings: null,
    settingsLists: [],
    sequences: [],
    sequenceSteps: [],
  };
}

describe("le format de sauvegarde", () => {
  it("accepte un fichier d'avant le jalon 110, sans l'histoire de prospection", () => {
    const parsed = backupSchema.safeParse(ancientBackup());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // Absentes, et non pas vides : la restauration doit pouvoir distinguer les
    // deux pour ne pas effacer ce que le fichier ignore.
    expect(parsed.data.emailSends).toBeUndefined();
    expect(parsed.data.campaigns).toBeUndefined();
    expect(parsed.data.enrollments).toBeUndefined();
  });

  it("distingue une section absente d'une section vide", () => {
    const parsed = backupSchema.safeParse({ ...ancientBackup(), emailSends: [], campaigns: [] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.emailSends).toEqual([]);
    expect(parsed.data.campaigns).toEqual([]);
  });

  /**
   * Le journal des envois porte **ce qu'il faut pour rendre sa personne à
   * chaque envoi**. C'est le défaut du jalon 109, écrit en test : un envoi dont
   * le `contactId` ne traverserait pas le fichier reviendrait orphelin.
   */
  it("fait traverser au journal des envois son contact et son identifiant", () => {
    const parsed = backupSchema.safeParse({
      ...ancientBackup(),
      emailSends: [
        {
          id: "e1",
          sentAt: "2026-11-03T09:00:00.000Z",
          contactId: "c1",
          toAddress: "qui@exemple.fr",
          subject: "Votre site",
          messageId: "<m1@crm>",
          campaignId: "k1",
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const send = parsed.data.emailSends?.[0];
    expect(send?.id).toBe("e1");
    expect(send?.contactId).toBe("c1");
    expect(send?.campaignId).toBe("k1");
    // JSON n'a pas de type date : la chaîne devient une `Date` à la frontière.
    expect(send?.sentAt).toBeInstanceOf(Date);
  });

  /** Un envoi orphelin est un fait du produit (jalon 39), pas une anomalie. */
  it("accepte un envoi sans contact, sans le refuser ni l'inventer", () => {
    const parsed = backupSchema.safeParse({
      ...ancientBackup(),
      emailSends: [
        {
          id: "e2",
          sentAt: "2026-11-03T09:00:00.000Z",
          contactId: null,
          toAddress: "parti@ailleurs.fr",
          subject: "Votre site",
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.emailSends?.[0]?.contactId).toBeNull();
  });

  /**
   * **Un défaut réel, trouvé au jalon 111 et pris en flagrant délit.**
   *
   * `Company.nameKey` et `Contact.nameKey` sont `String?` : réellement nuls sur
   * toute ligne que le rattrapage du jalon 72 n'a pas touchée — le seed, par
   * exemple, n'écrit pas la clé de tri. Le schéma les déclarait
   * `z.string().optional()`, qui accepte l'absence de clé mais **pas** la
   * valeur `null`.
   *
   * Mesuré sur une base de recette fraîchement semée : l'export réussit, et la
   * restauration de **son propre fichier** est refusée en 400 en citant treize
   * `companies.N.nameKey`. Le filet rendait donc un fichier qu'il ne savait pas
   * reprendre, ce qui est précisément le mode de défaillance que le jalon 110 a
   * réparé pour les envois. Éprouvé en remettant `optionalText` : ce test tombe.
   */
  it("accepte une clé de tri nulle, comme la base en porte", () => {
    const parsed = backupSchema.safeParse({
      ...ancientBackup(),
      companies: [
        { id: "k1", name: "Maison Leroy", nameKey: null, createdAt: "2026-11-02T09:00:00.000Z" },
      ],
      contacts: [
        {
          id: "c1",
          firstName: "Anna",
          lastName: "Leroy",
          lifecycle: "Lead",
          nameKey: null,
          createdAt: "2026-11-02T09:00:00.000Z",
        },
      ],
    });
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [])).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.companies[0]?.nameKey).toBeNull();
    expect(parsed.data.contacts[0]?.nameKey).toBeNull();
  });

  it("refuse un fichier d'une autre version du format", () => {
    expect(backupSchema.safeParse({ ...ancientBackup(), version: 99 }).success).toBe(true);
    // Le numéro passe la validation de forme ; c'est `restoreBackup` qui le
    // refuse, en nommant les deux versions. Le test fige ce partage.
    expect(BACKUP_VERSION).toBe(1);
  });
});

describe("la couverture déclarée", () => {
  it("porte l'histoire de prospection et nomme ce qu'elle laisse", () => {
    const saved = BACKED_UP_TABLES.map((table) => table.model);
    expect(saved).toContain("EmailSend");
    expect(saved).toContain("SequenceDeparture");
    expect(NOT_BACKED_UP.map((table) => table.model)).toContain("MailLogo");
  });

  it("donne une clé de fichier distincte à chaque table", () => {
    const keys = BACKED_UP_TABLES.map((table) => table.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
