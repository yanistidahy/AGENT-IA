/**
 * **Une relance n'est pas un premier message renvoyé.**
 *
 * Le défaut que ce fichier corrige était le plus coûteux de la séquence : les
 * brouillons d'étape 2 étaient quasi identiques à ceux d'étape 1. Alex ne
 * savait pas qu'il écrivait une relance, et il ne savait pas ce qui avait déjà
 * été dit, alors il refaisait le même travail, avec les mêmes arguments, dans
 * le même ordre. Un prospect qui reçoit deux fois le même argumentaire ne lit
 * pas une relance : il lit un publipostage, et il classe l'expéditeur.
 *
 * Trois leviers, et aucun ne suffit seul :
 *
 * 1. **le message déjà envoyé, en entier**, lu dans `email_sends`, jamais
 *    reconstruit. Un résumé de ce qu'on croit avoir écrit laisserait passer
 *    exactement les phrases qu'on veut éviter ;
 * 2. **des interdits dits comme des interdits.** Une omission se lit comme une
 *    absence d'information ; une ligne qui dit « non » se lit comme une règle.
 *    C'est la construction du DM (jalon 48) et de l'équipe (jalon 57), et elle
 *    a fait ses preuves ;
 * 3. **un but propre à chaque étape**, et une longueur qui décroît. Une relance
 *    plus longue que le premier message est une faute de raisonnement autant
 *    que de forme.
 */

/** Trois étapes au plus, et chacune a sa raison d'être. */
export const STEP_PURPOSE: Record<number, string> = {
  1: "le premier contact, l'argumentaire complet",
  2: "une relance courte, deux ou trois lignes",
  3: "la dernière, brève et polie",
};

/**
 * Le plafond de longueur, en mots, par étape.
 *
 * Ce sont des plafonds, pas des cibles : un message plus court est toujours
 * recevable. L'invariant qui compte est la décroissance, et il est dit à part.
 */
export const STEP_MAX_WORDS: Record<number, number> = { 1: 130, 2: 80, 3: 55 };

/**
 * Ce qu'Alex lit quand il écrit une relance.
 *
 * `previous` est le corps **exact** du message précédent. Il est donné en bloc
 * et suivi de l'interdiction de le reprendre : montrer un texte sans le
 * qualifier apprend à le recopier, c'est la leçon du mail de référence.
 */
export function followUpRules(step: number, previous: { sentOn: string; body: string } | null): string {
  if (step <= 1) {
    return `
## L'étape que tu écris

C'est l'**étape 1** d'une séquence : ${STEP_PURPOSE[1]}. C'est le seul message
où l'argumentaire se déroule en entier. ${STEP_MAX_WORDS[1]} mots au maximum.
`.trim();
  }

  const purpose =
    step === 2
      ? `
**Ce que fait une étape 2** : elle revient sur le premier message **sans le
répéter**, ajoute **un** angle neuf ou **un** détail concret sur leur marque, et
pose **une** question facile. Une seule. Pas de second appel à l'action, pas de
lien de réservation : la réservation était la porte de sortie du premier
message, la reproposer transforme une relance en relance de relance.
`.trim()
      : `
**Ce que fait une étape 3** : elle dit que c'est le dernier message, laisse la
porte ouverte, et n'exerce aucune pression. **Aucune question** : relancer une
troisième fois avec une question, c'est reprendre la pression qu'on prétend
relâcher. Pas de nouvel argument non plus, le moment n'est plus à convaincre.
`.trim();

  const already =
    previous === null
      ? `
**Le message précédent n'a pas pu être relu.** Écris donc une relance qui ne
suppose rien de ce qui a été dit : reste sur un détail concret de leur boutique
et sur ta question, sans faire référence au contenu d'un message que tu ne
connais pas.
`.trim()
      : `
## Ce qui a déjà été envoyé à cette personne, le ${previous.sentOn}

Voici le message **exact**, tel qu'il est parti :

---
${previous.body.trim()}
---

**Tu ne réécris ni ses phrases, ni ses tournures, ni son plan.** Ce texte t'est
donné pour savoir ce qu'il ne faut pas refaire, jamais comme matière à recycler.
`.trim();

  return `
## L'étape que tu écris

C'est l'**étape ${step}** d'une séquence : ${STEP_PURPOSE[step] ?? "une relance"}.
${STEP_MAX_WORDS[step] ?? 80} mots au maximum, et **plus court que le message
précédent** : une relance plus longue que le premier message est une faute.

${purpose}

${already}

## Interdits propres à une relance

**N'ouvre jamais sur le fait des 69 %.** Il a servi au premier message, il a
fait son travail, et le répéter est le signe le plus reconnaissable d'un envoi
automatique.

**Ne redécris pas le conseiller de vente dans les mêmes termes.** La personne
sait déjà ce que nous faisons, on le lui a écrit. Si tu dois y revenir, une
incise suffit.

**Ne reprends pas la phrase de démonstration mot pour mot.** Tu peux y renvoyer
(« la démonstration dont je vous parlais »), mais la phrase qui l'annonçait a
déjà été lue.

**N'ouvre pas sur le message précédent, ni sur le temps écoulé.** « Je reviens
vers vous », « sans réponse de votre part », « je me permets de vous relancer »
parlent de ton agenda. La première phrase parle d'eux, comme au premier message.

**Tu observes leur site, tu ne prêtes rien à leurs visiteurs.** Ce que la
recherche a lu sur leurs pages est un fait que tu peux écrire : « il y a
plusieurs formats sur votre page de recharges » se vérifie en un clic. Ce qui se
passe dans leur trafic ne l'est pas : « la question du format revient à chaque
visite », « vos visiteurs hésitent », « beaucoup repartent sans acheter » sont
des affirmations sur des gens que nous n'avons jamais observés, et le prospect
sait que nous ne pouvons pas le savoir. Écris donc ce que la page montre, et
laisse l'hésitation à l'état de possibilité : « c'est typiquement le genre de
choix sur lequel on hésite ».
`.trim();
}

/**
 * Les deux exemples de forme, approuvés à la main.
 *
 * Donnés avec la même mise en garde que le mail de référence : **imiter la
 * structure, jamais reprendre les phrases**. Sans cette qualification, un
 * modèle recopie, et cinquante prospects reçoivent la même relance.
 */
export const FOLLOW_UP_EXAMPLES = `
## Exemples de forme, à imiter, jamais à recopier

**Étape 2.** Elle ouvre sur un fait visible de leur boutique, renvoie au premier
message d'une incise, et pose une seule question. Rien sur le temps écoulé,
aucun lien de réservation.

---
Objet : Une démonstration préparée pour Linaé

Bonjour Stéphanie,

Il y a plusieurs formats sur votre page de recharges. C'est typiquement le genre
de choix sur lequel on hésite, et qui se tranche en deux phrases quand quelqu'un
est là pour répondre.

C'est exactement ce que montre la démonstration dont je vous parlais.

Vous voulez que je vous envoie le lien ?

À bientôt,
---

**Étape 3.** Deux paragraphes, la porte ouverte, aucune question.

---
Objet : Une démonstration préparée pour Linaé

Bonjour Stéphanie,

C'est mon dernier message, je ne vais pas encombrer votre boîte davantage.

La démonstration reste de côté si le sujet revient sur votre table, dans un mois
ou dans six. Un mot suffira.

Bonne continuation,
---

**L'objet ne change pas d'une étape à l'autre, et ne prend pas « Re: ».** Les
messageries regroupent par objet et par participants, donc la relance se range
sous le premier message toute seule. Un « Re: » sur un message qui n'est pas une
réponse est un faux signal de conversation.
`.trim();
