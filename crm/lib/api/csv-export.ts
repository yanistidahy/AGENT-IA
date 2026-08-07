import { toCsv } from "../domain/csv";
import type { CompanyRecord } from "./companies";
import type { ContactRecord } from "./contacts";

/**
 * Exports CSV.
 *
 * Les en-têtes sont exactement les alias reconnus à l'import : un export
 * réimporté doit repasser sans retouche. C'est la seule garantie qui rend
 * l'export utile au-delà de l'archivage.
 */

function formatDay(date: Date | null): string {
  if (date === null) return "";
  return date.toISOString().slice(0, 10);
}

export function contactsToCsv(contacts: readonly ContactRecord[]): string {
  const rows: string[][] = [
    [
      "Prénom",
      "Nom",
      "Fonction",
      "Département",
      "Email",
      "Téléphone",
      "LinkedIn",
      "Cycle de vie",
      "Source",
      "Propriétaire",
      "Société",
      "Dernier contact",
      "Prochaine relance",
      "Notes",
    ],
  ];

  for (const contact of contacts) {
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
      formatDay(contact.lastContact),
      formatDay(contact.nextReminder),
      contact.notes,
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
