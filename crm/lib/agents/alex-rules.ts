import "server-only";
import { demoRule, signatureRule } from "./prompts/company";
import { readMailConfig } from "@/lib/api/mail";
import { DRAFT_CLOSE, DRAFT_OPEN } from "@/lib/domain/draft-protocol";

/**
 * Les consignes d'Alex qui dépendent des réglages.
 *
 * Elles vivent ici plutôt que dans `registry.ts` parce qu'elles se **lisent en
 * base** : signature du signataire, libellé et adresse du lien. Les figer dans
 * un fichier de prompt aurait recréé le défaut du jalon 33 — une valeur écrite
 * en dur qui contredit l'écran le jour où on la change.
 *
 * Deux appelants, et c'est la raison d'être du module : la rédaction en un coup
 * (`email-draft.ts`) et la conversation (`runtime/loop.ts`). Deux copies
 * auraient divergé, et la divergence se serait vue chez un prospect.
 */
export async function alexDynamicRules(): Promise<string> {
  const config = await readMailConfig();
  return [
    signatureRule({ name: config.signName, title: config.signTitle }),
    demoRule({ label: config.demoLabel, url: config.demoUrl }),
  ].join("\n\n");
}

/**
 * Comment Alex rend un brouillon **au milieu d'une conversation**.
 *
 * Ajouté au prompt de tous ses fils. Le coût est de quelques lignes ; le gain
 * est qu'on ne dépend pas d'une consigne posée dans le premier message, qui
 * s'éloigne à mesure que le fil s'allonge.
 *
 * **L'absence de bloc est un signal, pas un oubli** : c'est ce qui permet de lui
 * demander « qu'est-ce qu'on sait d'elle ? » sans que les champs bougent.
 */
export const DRAFT_PROTOCOL = `
## Quand on te parle d'un brouillon en cours

L'utilisateur peut t'écrire depuis le panneau de rédaction. Son message porte
alors le brouillon **dans son état actuel** — retouches à la main comprises —
puis sa demande. Deux cas, et un seul les distingue :

**Il te demande une question** (« qu'est-ce qu'on sait d'elle ? », « pourquoi
cette accroche ? », « propose-moi deux angles »). Tu réponds normalement, en
texte. **Tu n'émets aucun bloc**, et les champs ne bougent pas. Utilise tes
outils de lecture pour aller chercher l'historique, la société, les affaires.

**Il te demande de modifier le message** (« fais plus court », « insiste sur le
SAV », « elle refait son site »). Tu écris **d'abord une ligne** disant ce que tu
as changé et pourquoi, puis le message complet dans un bloc :

${DRAFT_OPEN}
Objet : …
…corps complet, paragraphes séparés par une ligne vide…
${DRAFT_CLOSE}

Le bloc contient le message **entier**, pas un extrait : il remplace les champs.
Pars du brouillon qu'on vient de te donner et ne change que ce que la demande
implique — le reste est conservé mot pour mot, y compris les phrases réécrites à
la main. Toutes les règles habituelles s'appliquent au contenu du bloc :
signature, lien, aucun prix.
`.trim();
