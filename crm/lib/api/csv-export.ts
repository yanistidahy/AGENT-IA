import { toCsv } from "../domain/csv";
import { ACTIVITY_LABELS } from "../domain/types";
import { groupLabel } from "../domain/contact-group";
import { resolveDisplayStatus } from "../domain/contact-status";
import {
  EXPORT_HEADERS,
  contactMeans,
  formatDayFr,
  recordLink,
  stepLabel,
  yesNo,
} from "../domain/contact-export";
import { extraOf, type ContactExportExtra } from "./contact-export";
import type { CompanyRecord } from "./companies";
import type { ContactRecord } from "./contacts";

/**
 * Exports CSV.
 *
 * Les quinze premières colonnes de contact sont exactement les alias reconnus à
 * l'import : un export réimporté repasse sans retouche. **Les dérivées suivent**
 * (jalon 108) et l'import les ignore : voir `lib/domain/contact-export.ts` pour
 * l'écart entre les deux blocs, et pourquoi le mélanger aurait cassé la
 * promesse sans rien dire.
 */

export interface ContactsCsvContext {
  /** L'origine servie, pour la colonne « Lien vers la fiche ». */
  readonly origin: string;
  readonly extras: ReadonlyMap<string, ContactExportExtra>;
}

export function contactsToCsv(
  contacts: readonly ContactRecord[],
  context: ContactsCsvContext,
): string {
  const rows: string[][] = [[...EXPORT_HEADERS]];

  for (const contact of contacts) {
    const extra = extraOf(context.extras, contact.id);
    /*
      **Le statut vient de la fonction qui décide de celui de l'écran.** Un
      libellé recomposé ici aurait fini par contredire la colonne Statut de
      `/contacts` — c'est l'écart que le jalon 27 a mesuré sur 110 fiches, et la
      garde `status-single-source` ferme le chemin par lequel il est arrivé.
    */
    const status = resolveDisplayStatus(contact);
    rows.push([
      contact.firstName,
      contact.lastName,
      contact.title,
      contact.dep,
      contact.email,
      contact.phone,
      contact.linkedin,
      contact.lifecycle,
      contact.source,
      contact.owner,
      contact.company?.name ?? "",
      contact.website,
      formatDayFr(contact.lastContact),
      formatDayFr(contact.nextReminder),
      contact.notes,
      contact.instagram,
      groupLabel(contact.contactGroup, contact.groupSetBy),
      status.label,
      // Le vocabulaire des canaux est celui de la chronologie des fiches : un
      // second jeu de libellés ferait lire « DM » ici et « Instagram » là.
      contact.lastChannel === null ? "" : ACTIVITY_LABELS[contact.lastChannel],
      extra.campaign,
      stepLabel(extra.lastStep, extra.totalSteps),
      yesNo(extra.replied),
      yesNo(extra.hot),
      contactMeans(contact),
      recordLink(context.origin, contact.id),
    ]);
  }

  return toCsv(rows);
}

export function companiesToCsv(companies: readonly CompanyRecord[]): string {
  const rows: string[][] = [
    [
      "Société",
      "Domaine",
      "Taille",
      "Secteur",
      "Localisation",
      "Contacts",
      "Affaires en cours",
      "CA signé",
      "Description",
    ],
  ];

  for (const company of companies) {
    rows.push([
      company.name,
      company.domain,
      company.size,
      company.industry,
      company.loc,
      String(company.contacts.length),
      String(company.openValue),
      String(company.wonValue),
      company.desc,
    ]);
  }

  return toCsv(rows);
}

/**
 * Réponse de téléchargement.
 *
 * Le BOM UTF-8 en tête n'est pas décoratif : sans lui, Excel lit le fichier en
 * ANSI et affiche « SociÃ©tÃ© ». Les accents sont la règle ici, pas l'exception.
 */
export function csvResponse(body: string, filename: string): Response {
  return new Response(`\uFEFF${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
