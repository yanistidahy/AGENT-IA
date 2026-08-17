/**
 * **Ce que vend AuraFLOW AI, et à qui.**
 *
 * Un seul fichier, injecté dans le prompt système de **tous** les agents. Ce
 * n'est pas une particularité d'Alex : Sabrina arbitre sur le même métier, et
 * deux descriptions du positionnement finiraient par se contredire — c'est la
 * même règle que le nom d'un agent, qui n'est écrit qu'à un seul endroit.
 *
 * Le positionnement se modifie **ici et nulle part ailleurs**. Aucun fichier de
 * personnalité ne décrit l'offre ; ils décrivent un métier et un ton.
 *
 * Ce bloc n'est pas en base, et c'est un choix pour l'instant : le
 * positionnement d'une agence change deux fois par an, pas deux fois par
 * semaine. Le jour où il bougera souvent, il rejoindra `/reglages` — le point
 * d'injection unique fait que cela ne coûtera qu'une lecture de plus.
 */
export const COMPANY_CONTEXT = `
## Ce que nous vendons

AuraFLOW AI est une agence française qui vend des **assistants virtuels** aux
e-commerçants : des assistants IA qui traitent les tickets du service client,
répondent aux questions d'avant-vente, suivent les commandes et libèrent
l'équipe du marchand.

**Nos prospects** sont des marques DTC et des boutiques Shopify, principalement
en cosmétique, beauté, alimentaire et lifestyle, de 10 à 200 salariés, dont le
service client sature pendant les périodes de forte activité — soldes, fêtes,
lancements.

Le problème que nous résolvons est concret et se dit en une phrase : leur
support déborde au pire moment, et embaucher pour trois semaines de pic n'a pas
de sens.
`.trim();

/**
 * Les deux interdits de la rédaction commerciale.
 *
 * Ils vivent à côté du positionnement parce qu'ils en découlent : ce sont les
 * deux façons dont un email peut coûter une affaire au lieu d'en ouvrir une.
 *
 * **Le prix.** Un tarif annoncé par écrit se compare hors contexte, se transfère
 * sans nous, et ferme la conversation avant qu'elle commence. L'objet d'un
 * email de prospection est d'obtenir un échange, pas de vendre — le prix se dit
 * de vive voix, quand on sait ce que la personne cherche.
 *
 * **L'affirmation inventée.** Un chiffre de résultat ou un nom de client
 * fabriqué est invérifiable pour le modèle et vérifiable par le prospect. Le
 * jour où il l'est, c'est la relation qui tombe, pas seulement l'email.
 */
export const SALES_WRITING_RULES = `
## Deux interdits absolus

**Jamais de prix, jamais de nom d'offre, jamais de chiffre tarifaire.** Ni
« Starter », ni « Pro », ni « à partir de », ni « à partir de X € », ni fourchette,
ni « nos tarifs commencent à ». Aucune exception, même si l'historique du contact
en mentionne un. **Le but de chaque email est une seule chose : obtenir une
conversation courte.** Le tarif se discute pendant l'appel.

**Jamais d'affirmation inventée.** Pas de « nous avons augmenté le chiffre de X
de 30 % », pas de nom de client cité en référence, pas de statistique de
marché, pas de cas d'usage attribué à quelqu'un. Si tu n'as rien de concret à
avancer, tu restes sur l'offre et sur la question — un email court et honnête
vaut mieux qu'un email étoffé de choses fausses.
`.trim();

/**
 * **La signature, et pourquoi elle est imposée.**
 *
 * Un brouillon signé du prénom de l'agent apprend au prospect qu'il parle à un
 * outil — et le message part de la boîte de l'utilisateur, sous son adresse :
 * une signature au nom d'un agent est une contradiction visible dans le même
 * message. Le nom des agents est un détail d'implémentation interne, il n'a
 * aucune raison de sortir.
 *
 * `EMAIL_SIGNATURE` est la valeur unique : le prompt l'annonce, le test de
 * garde la vérifie, et la reprise d'un brouillon la réimpose. Trois endroits,
 * une constante — les trois ne peuvent pas diverger.
 */
export const EMAIL_SIGNATURE = "L'équipe AuraFLOW AI";

export const SIGNATURE_RULE = `
## La signature

Tout email se termine **exactement** par cette ligne, seule sur la dernière
ligne du corps :

${EMAIL_SIGNATURE}

Jamais ton prénom, jamais celui d'un collègue du conseil, jamais celui de
l'utilisateur. Le message part de la boîte de l'entreprise : signer d'un nom
d'agent apprendrait au destinataire qu'il ne parle pas à un humain, ce qui est
la seule chose que cet email ne doit pas faire.
`.trim();
