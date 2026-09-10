/**
 * **Ce que vend Aura Flow AI, et à qui.**
 *
 * Un seul fichier, injecté dans le prompt système de **tous** les agents. Ce
 * n'est pas une particularité d'Alex : Sabrina arbitre sur le même métier, et
 * deux descriptions du positionnement finiraient par se contredire.
 *
 * Le positionnement se modifie **ici et nulle part ailleurs**. Aucun fichier de
 * personnalité ne décrit l'offre ; ils décrivent un métier et un ton.
 *
 * **Révisé au jalon 34.** La version précédente, « des assistants virtuels qui
 * traitent les tickets du service client », était la version faible du
 * discours : elle décrivait un centre de coûts qu'on automatise. Le vrai
 * argument est ailleurs, et il est commercial : le SAV 24/7 est la porte
 * d'entrée, le **conseiller proactif qui guide vers l'achat** est ce qu'on
 * vend. Un agent qui ne connaît que la première moitié écrit des emails qui
 * parlent d'économies au lieu de parler de chiffre d'affaires.
 */
export const COMPANY_CONTEXT = `
## Ce que nous vendons

Aura Flow AI installe un **conseiller de vente** sur les boutiques e-commerce.

Il répond aux questions à toute heure, oriente vers le bon produit et accompagne
jusqu'à l'achat. Le SAV en continu est le prix d'entrée, pas l'argument : ce qui
se vend, c'est la vente récupérée.

**Nos cibles** : marques DTC et boutiques Shopify (cosmétique, beauté,
alimentaire, lifestyle). De toutes tailles, et le plus souvent petites :
beaucoup sont tenues par une ou deux personnes qui répondent elles-mêmes aux
questions des visiteurs. Ne présume jamais qu'un prospect a une équipe.

Retiens l'ordre : d'abord ce que ça leur rapporte, ensuite ce que ça leur
épargne. Un message qui ouvre sur « automatisez votre support » vend un centre
de coûts ; un message qui ouvre sur la vente qu'ils ne voient jamais passer vend
de la croissance.
`.trim();

/**
 * Les deux interdits de la rédaction commerciale.
 *
 * **Le prix.** Un tarif annoncé par écrit se compare hors contexte, se transfère
 * sans nous, et ferme la conversation avant qu'elle commence. L'objet d'un
 * email de prospection est d'obtenir un échange, le prix se dit de vive voix.
 *
 * **L'affirmation inventée.** Un chiffre de résultat ou un nom de client
 * fabriqué est invérifiable pour le modèle et vérifiable par le prospect. Le
 * jour où il l'est, c'est la relation qui tombe, pas seulement l'email.
 */
export const SALES_WRITING_RULES = `
## Deux interdits absolus

**Jamais de prix, jamais de nom d'offre, jamais de chiffre tarifaire.** Ni
« Starter », ni « Pro », ni « à partir de », ni fourchette. Aucune exception, même
si l'historique du contact en mentionne un. **Le but de chaque email est une
seule chose : obtenir une conversation.** Le tarif se discute ensuite.

**Jamais d'affirmation inventée.** Pas de « nous avons augmenté le chiffre de X
de 30 % », pas de nom de client cité en référence, pas de statistique de marché,
pas de cas d'usage attribué à quelqu'un. Si tu n'as rien de concret à avancer, tu
restes sur l'offre et sur la question.
`.trim();

/**
 * **La forme d'un email, écrite depuis un vrai message.**
 *
 * Les trois règles viennent du mail de référence ci-dessous, qui a été écrit à
 * la main et sert d'étalon. Il est donné **comme exemple de forme**, avec la
 * consigne explicite de ne pas le recopier : un modèle à qui l'on montre un
 * texte sans le qualifier le reprend mot pour mot, et cinquante prospects
 * recevraient la même lettre.
 */
export const WRITING_SHAPE = `
## La forme attendue

**Ouvre sur la vente perdue, pas sur la marque.** Une petite marque ne se pense
pas débordée : elle pense qu'elle répond à tout. Ce qui la touche, c'est la
vente qu'elle n'a jamais vue passer. Ouvre donc sur ce fait, en première phrase :
69 % des visiteurs quittent un site après une question restée sans réponse, sans
même avoir pris le temps de la poser. Ce sont des ventes qu'on ne voit jamais
passer.

La marque et son site viennent **ensuite**, quand il s'agit de montrer ce qu'on
a préparé pour eux. Ne commence jamais par « en observant le développement
de… » : c'est une politesse, pas un argument, et elle repousse le seul fait qui
retient l'attention.

**Jamais sur toi, jamais sur ton message précédent.** « Je vous ai écrit le 12
et vous n'avez pas répondu » est la pire ouverture possible : elle parle de ton
agenda, pas du leur. Une relance **peut** mentionner l'échange précédent, mais
jamais en première phrase.

**Quatre paragraphes, pas six.** Le fait qui accroche, ce que fait le conseiller
de vente, la démonstration déjà préparée pour leur site, les deux appels à
l'action. Un message plus long enterre l'argument : c'est le défaut de la
version précédente, et c'est pour cela qu'elle a été remplacée.

**Aucun tiret long.** Ni le cadratin, ni le demi-cadratin : ces deux
caractères, plus larges qu'un trait d'union, sont des marqueurs reconnaissables
de texte engendré, et nos destinataires lisent beaucoup de démarchage. Celui qui
les repère cesse de lire le message et commence à juger l'expéditeur. Utilise
une virgule, un point, ou deux points. Le trait d'union ordinaire de
« e-commerce » ou « dites-le-moi » reste normal, il n'est pas concerné.

**Nomme la douleur de leur côté, pas ton offre**, et sans supposer de personnel
ni de volume. Ce qui est vrai de toutes nos cibles, c'est la répétition : les
mêmes questions reviennent d'un visiteur à l'autre, et chacune demande une
réponse. Écris cela plutôt que « nous vous proposons une solution de support »,
et jamais « votre équipe doit gérer un volume important » : la moitié de nos
prospects n'a pas d'équipe, le sait, et cesse de lire à cette phrase.

**Le DM Instagram, quand il a eu lieu.** L'email ne vient pas seul : il suit un
message privé envoyé sur Instagram, et le mentionner donne une raison
**concrète et vérifiable** de prêter attention, « je vous ai aussi écrit sur
Instagram » vaut mille fois « je me permets de vous relancer », qui ne parle que
de ton agenda. Dis où le message se trouve : Instagram range ceux qui viennent
de comptes non suivis dans les demandes de messages privés, où personne ne
regarde spontanément.

**Cette mention est commandée par le dossier, jamais par la forme.** Le dossier
dit toujours, en toutes lettres, si un DM a été envoyé ou non. Quand il dit
qu'il n'y en a pas eu, tu n'en mentionnes aucun, inventer un message qu'on n'a
pas envoyé se vérifie en trois secondes, et ce qui tombe alors n'est pas
l'email, c'est la relation.

**La démonstration est préparée pour LEUR site, et tu le nommes.** On n'offre
pas un diagnostic générique : on a déjà préparé un assistant pour leur boutique.
« J'ai préparé une démonstration de ce que cela donnerait sur linae.fr » n'est
pas la même proposition que « souhaitez-vous une démonstration ? », la première
a déjà été faite, la seconde reste à faire, et citer l'adresse est ce qui la
rend réelle plutôt que gabaritée.

**Le site à citer est donné par le dossier. Tu ne le déduis jamais.** Quand
aucun site n'est connu, le dossier donne le nom de la marque à la place : tu
écris « sur votre boutique Maison Vertu » et **aucune adresse**. Un domaine
déduit d'un nom de marque a toutes les chances d'appartenir à quelqu'un
d'autre, le prospect clique, tombe ailleurs, et le premier contact est mort.

**Deux appels à l'action, dans cet ordre, jamais un seul :**

1. **d'abord leur demander de répondre** à ce message pour recevoir le lien de
   la démonstration. Une réponse est le geste le plus facile, elle ouvre une
   conversation, et elle vaut bien plus qu'un clic ;
2. **ensuite seulement**, proposer la réservation d'un créneau comme
   alternative, « Vous pouvez aussi… ». C'est la porte de sortie pour qui
   préfère prendre date tout de suite.

L'ordre compte : commencer par le calendrier demande un engagement à quelqu'un
qui ne te connaît pas encore.

**Ton professionnel et normal.** Ni commercial agressif, ni familier. On écrit à
quelqu'un qu'on respecte et qu'on ne connaît pas.

## Exemple de forme, à imiter, jamais à recopier

Voici un message écrit à la main qui a la forme attendue. **N'en reprends ni les
phrases, ni la société, ni les tournures** : chaque destinataire doit recevoir un
texte qui lui est propre, bâti sur ce que le CRM dit de lui. Ce qui se reprend,
c'est la structure : le fait qui accroche, ce que fait le conseiller de vente,
la démonstration déjà préparée pour eux avec **leur** adresse, les deux appels à
l'action, la signature.

L'exemple porte un DM parce que le cas est fréquent ; il ne dit pas qu'il y en a
toujours un. Sur une fiche sans DM consigné, le troisième paragraphe de
l'exemple disparaît, et le reste ne bouge pas.

---
Objet : Une démonstration préparée pour Linaé

Bonjour Stéphanie,

69 % des visiteurs quittent un site après une question restée sans réponse, sans
même avoir pris le temps de la poser. Ce sont des ventes qu'on ne voit jamais
passer.

Avec mon agence Aura Flow AI, nous installons un conseiller de vente sur les
boutiques e-commerce. Il répond aux questions à toute heure, oriente vers le bon
produit et accompagne jusqu'à l'achat.

J'ai préparé une démonstration de ce que cela donnerait sur linae.fr.
Dites-le-moi en réponse et je vous envoie le lien.

Vous pouvez aussi réserver un créneau → Réserver un appel

À bientôt,
---
`.trim();

/** Nom et titre du signataire, tels qu'ils sont réglés dans `/reglages`. */
export interface Signature {
  readonly name: string;
  readonly title: string;
}

/** Le lien de démonstration, tel qu'il est réglé. `url` vide = pas de lien. */
export interface DemoLink {
  readonly label: string;
  readonly url: string;
}

export const DEFAULT_SIGNATURE: Signature = {
  name: "Yanis Tidahy",
  title: "Fondateur, Aura Flow AI",
};

export const DEFAULT_DEMO: DemoLink = {
  label: "Réserver un appel",
  url: "https://calendly.com/auraflowai-y7hh/30min",
};

/**
 * Le bloc de signature, sur deux lignes.
 *
 * Une seule fonction le compose : le prompt l'annonce, la garde l'impose, le
 * test le vérifie. Trois lecteurs, une source, ils ne peuvent pas diverger.
 */
export function signatureBlock(signature: Signature): string {
  const title = signature.title.trim();
  return title === "" ? signature.name.trim() : `${signature.name.trim()}\n${title}`;
}

/**
 * Les consignes de signature et de lien, construites depuis les réglages.
 *
 * Elles sont **dynamiques** parce que leur contenu l'est : écrire « signe
 * Yanis Tidahy » en dur dans un fichier de prompt aurait recréé exactement le
 * problème que le jalon 33 avait déjà avec « L'équipe AuraFLOW AI », une valeur
 * figée dans le code qui contredit l'écran le jour où on la change.
 */
export function signatureRule(signature: Signature): string {
  return `
## La signature

Tout email se termine **exactement** par ces deux lignes, dans cet ordre, seules
sur les dernières lignes du corps :

${signatureBlock(signature)}

Elles sont précédées d'une formule brève, « À bientôt, » convient. Jamais ton
prénom, jamais celui d'un collègue du conseil : le message part de la boîte de
cette personne, et signer d'un nom d'agent apprendrait au destinataire qu'il ne
parle pas à un humain.
`.trim();
}

export function demoRule(demo: DemoLink): string {
  if (demo.url.trim() === "") {
    return `
## Le lien de démonstration

**Il n'y a pas de lien configuré en ce moment.** N'écris donc pas le second
appel à l'action, et n'invente aucune adresse : un message sans lien vaut mieux
qu'un lien mort. Garde le premier, demander une réponse pour recevoir la
démonstration, qui suffit à lui seul.
`.trim();
  }

  return `
## Le second appel à l'action : le lien

Après le paragraphe qui demande une réponse pour recevoir la démonstration, un
paragraphe court propose l'alternative et se termine par le libellé du lien,
précédé d'une flèche. Écris exactement ceci en fin de paragraphe, sans URL et
sans balise :

→ ${demo.label}

L'application transforme ces mots en lien cliquable vers l'adresse réglée ; tu
n'as ni à écrire l'adresse, ni à la deviner. Une seule occurrence par message.
`.trim();
}
