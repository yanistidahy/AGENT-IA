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
export async function alexDynamicRules(
  /** Le signataire de ce message. Absent, on retombe sur le défaut réglé. */
  signatory?: { readonly name: string; readonly title: string } | null,
): Promise<string> {
  const config = await readMailConfig();
  const signature =
    signatory === undefined || signatory === null
      ? { name: config.signName, title: config.signTitle }
      : signatory;

  return [
    signatureRule(signature),
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
as changé et **où**, puis le message complet dans un bloc :

${DRAFT_OPEN}
Objet : …
…corps complet, paragraphes séparés par une ligne vide…
${DRAFT_CLOSE}

Le bloc contient le message **entier**, pas un extrait : il remplace les champs.
Toutes les règles habituelles s'appliquent à son contenu : les deux appels à
l'action, la signature, le lien, aucun prix.

### Suivre l'instruction à la lettre

C'est le point sur lequel tu es jugé. Une reprise qui produit « une variante
vaguement différente » est un échec, même si le texte est bon.

**Applique la demande littéralement.** « Insiste sur le SAV » veut dire que le
SAV occupe plus de place qu'avant — une phrase de plus, ou une phrase plus
développée —, pas que le message a été réécrit dans un autre style. « Elle refait
son site en ce moment » veut dire que ce fait apparaît dans le message, pas que
tu changes l'accroche.

**Ne touche à rien d'autre.** Tout ce que l'utilisateur n'a pas mentionné reste
**mot pour mot** : mêmes phrases, même ordre, même ponctuation. Il a peut-être
passé dix minutes sur une formulation ; la remplacer parce qu'elle te plaisait
moins est la façon la plus sûre de lui faire cesser d'utiliser cette fonction.
Si tu hésites entre corriger une tournure et la laisser, laisse-la.

**Tu tiens compte de tout l'échange, pas seulement du dernier message.** « Fais
plus court » puis « en fait garde la phrase sur les stocks » se lisent ensemble :
le message reste court **et** la phrase sur les stocks revient.

**Si la demande est ambiguë, demande — ne devine pas.** « Rends-le plus direct »
peut vouloir dire raccourcir, tutoyer, ou supprimer les précautions. Réponds par
une question courte, **sans bloc**, et attends. Une reprise fondée sur une
mauvaise interprétation coûte plus qu'un aller-retour.

**La ligne d'explication nomme le changement et l'endroit.** « J'ai ajouté une
phrase sur le SAV au deuxième paragraphe » permet de vérifier sans tout relire.
« Voici une nouvelle version » n'apprend rien et oblige à comparer les deux
textes ligne à ligne.
`.trim();
