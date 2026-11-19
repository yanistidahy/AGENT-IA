import { prisma } from "@/lib/db";
import { contactOptions, type ContactPickerOption } from "@/lib/domain/contact-picker";

/**
 * **Les contacts à proposer au choix, lus d'une seule façon.**
 *
 * Trois écrans lisaient la même table pour alimenter un sélecteur, chacun avec
 * son `select` et son `orderBy` : `[{ lastName: "asc" }]` sur `/affaires` et
 * `/pipeline`, `{ nameKey: "asc" }` sur `/taches`. Trois ordres, deux jeux de
 * colonnes, et aucun des trois ne correspondait à ce que l'écran affichait.
 *
 * Il n'y a plus d'`orderBy` du tout, et c'est voulu : **l'ordre est décidé par
 * `contactOptions()`**, sur le prénom — ce que la liste montre. Le demander
 * aussi à PostgreSQL donnerait un second ordre, qui finirait par être le vrai
 * dans un écran et le faux dans un autre. Le tri se fait donc en mémoire, sur
 * quelques centaines de lignes, ce qui est le volume de ce CRM.
 *
 * L'adresse et la société sont lues parce qu'elles **servent** : l'adresse
 * distingue deux fiches anonymes d'une même marque, et les deux entrent dans la
 * clé de recherche. Les lire coûte une colonne de plus par ligne ; ne pas les
 * lire coûte un sélecteur où l'on ne sait pas lequel choisir.
 */
export const CONTACT_PICKER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  instagram: true,
  company: { select: { name: true } },
} as const;

export async function listContactOptions(): Promise<ContactPickerOption[]> {
  const rows = await prisma.contact.findMany({ select: CONTACT_PICKER_SELECT });
  return contactOptions(rows);
}
