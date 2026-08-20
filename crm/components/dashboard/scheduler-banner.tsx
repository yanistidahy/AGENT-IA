import Link from "next/link";
import type { SchedulerHealth } from "@/lib/api/scheduler-health";
import type { LimitNotice } from "@/lib/api/send-rate";
import type { InboxHealth } from "@/lib/api/inbox-health";

/**
 * Deux bandeaux que rien d'autre ne dirait.
 *
 * **Le planificateur muet.** Un cron qui cesse de se déclencher ne produit
 * aucune erreur, aucune ligne de journal, aucun changement à l'écran : il
 * produit du silence, et le silence ressemble à « tout va bien ». Avec des
 * séquences en cours, c'est le pire des états — on croit ses relances parties
 * alors que rien ne bouge depuis trois jours.
 *
 * **La limite opposée par la boîte d'envoi.** Un plafond abaissé par le serveur
 * change ce que la journée peut faire ; le laisser dans un journal serveur
 * reviendrait à ne pas le dire.
 *
 * Ni l'un ni l'autre n'est acquittable, et pour la même raison que le bandeau
 * de budget du jalon 36 : ce ne sont pas des incidents dont on peut décider
 * qu'ils attendront demain, ce sont des états qui faussent ce qu'on croit être
 * en train de faire.
 */
export function SchedulerBanner({ health }: { readonly health: SchedulerHealth }) {
  return (
    <p className="mb-4 rounded-control border border-[#F5D5CF] bg-pulse-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#B2311F]">
      <strong>
        {health.hours === null
          ? "Le passage quotidien n'a jamais été enregistré."
          : `Le passage quotidien n'a pas eu lieu depuis ${health.hours} heures.`}
      </strong>{" "}
      {health.hours === null
        ? "Les séquences ne composeront aucun départ, les sauvegardes ne partiront pas, et rien d'autre ne le signalera. Vérifiez que le workflow GitHub est actif et que ses deux secrets sont posés."
        : "Aucun départ de séquence n'a donc été composé, et aucune sauvegarde n'a été prise. Vérifiez l'onglet Actions du dépôt."}{" "}
      <Link className="font-semibold underline" href="/reglages">
        Réglages
      </Link>
      .
    </p>
  );
}

export function SendLimitBanner({ notice }: { readonly notice: LimitNotice }) {
  return (
    <p className="mb-4 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#9A6410]">
      <strong>Votre boîte d'envoi a opposé une limite de débit.</strong> {notice.text}{" "}
      <Link className="font-semibold underline" href="/reglages">
        Réglages → Messagerie
      </Link>{" "}
      pour relever le plafond une fois la cause comprise.
    </p>
  );
}

/**
 * Le relevé des réponses, muet.
 *
 * **Pire que pas de détection du tout.** Sans relevé, on sait qu'il faut ouvrir
 * sa boîte ; avec un relevé en panne, on croit le CRM à jour et on relance
 * quelqu'un qui a répondu il y a trois jours — sous le nom d'une vraie
 * personne, à un vrai prospect. Le seuil est à deux heures pour un passage
 * tous les quarts d'heure : huit passages manqués.
 */
export function InboxBanner({ health }: { readonly health: InboxHealth }) {
  return (
    <p className="mb-4 rounded-control border border-[#F5D5CF] bg-pulse-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#B2311F]">
      <strong>
        {health.hours === null
          ? "Le relevé des réponses n'a jamais eu lieu."
          : `Le relevé des réponses n'a pas eu lieu depuis ${health.hours} heures.`}
      </strong>{" "}
      Les réponses arrivées depuis ne sont pas dans le CRM, et les séquences en cours
      continuent de partir sur des gens qui ont peut-être répondu.{" "}
      {health.hours === null
        ? "Vérifiez que le workflow GitHub est actif et que ses deux secrets sont posés."
        : "Vérifiez l'onglet Actions du dépôt, ou relevez à la main."}{" "}
      <Link className="font-semibold underline" href="/reglages">
        Réglages → Messagerie
      </Link>
      .
    </p>
  );
}

/**
 * Le relevé est allumé, des messages sont partis, et il ne peut pas tourner.
 *
 * **C'est le bandeau qui manquait en production.** La configuration IMAP avait
 * été effacée par une restauration ; le relevé s'arrêtait sur « non
 * configuré », donc sans erreur, donc muet — et une réponse de prospect est
 * restée invisible pendant des jours. Un ton ambre plutôt que rouge : rien
 * n'est cassé, il manque un réglage, et le geste est court.
 */
export function InboxUnconfiguredBanner() {
  return (
    <p className="mb-4 rounded-control border border-[#F0DFB8] bg-gold-l px-3.5 py-3 text-[12.5px] leading-relaxed text-[#9A6410]">
      <strong>La détection des réponses est activée mais ne peut pas tourner.</strong> Des
      messages sont partis depuis ce CRM, et la configuration IMAP est incomplète — hôte,
      identifiant ou mot de passe. Aucune réponse ne sera détectée tant que ce sera le cas.{" "}
      <Link className="font-semibold underline" href="/reglages">
        Réglages → Messagerie
      </Link>{" "}
      pour la compléter, ou coupez le relevé si c'est délibéré.
    </p>
  );
}

/**
 * Des réponses ont été rapprochées, et **aucune n'a pu être consignée**.
 *
 * Le pire état du produit : le relevé fonctionne, le prospect a répondu, le
 * CRM le sait — et l'écran d'une fiche n'en montre rien. C'est ce que le jalon
 * 44 laissait passer en silence, avec un compteur qui annonçait pourtant
 * « 1 réponse ».
 *
 * **Rouge, pas ambre** : contrairement à une configuration incomplète, il ne
 * manque pas un réglage — une information commerciale est arrivée et se perd.
 * Le geste est nommé, et il est à un clic.
 */
export function UnlinkedRepliesBanner({
  count,
  addresses,
}: {
  readonly count: number;
  readonly addresses: readonly string[];
}) {
  return (
    <p className="mb-4 rounded-control border border-[#EFC4C4] bg-[#FBE3E3] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#A32C2C]">
      <strong>
        {count} réponse{count > 1 ? "s" : ""} rapprochée{count > 1 ? "s" : ""} mais non
        consignée{count > 1 ? "s" : ""}.
      </strong>{" "}
      L&apos;envoi auquel {count > 1 ? "elles répondent n'est" : "elle répond n'est"} rattaché à
      aucune fiche — rien n&apos;a donc été écrit sur personne, et aucune séquence ne s&apos;est
      arrêtée.
      {addresses.length > 0 && (
        <>
          {" "}
          Destinataire{addresses.length > 1 ? "s" : ""} :{" "}
          <b className="font-semibold">{addresses.slice(0, 4).join(", ")}</b>
          {addresses.length > 4 ? ` et ${addresses.length - 4} autre(s)` : ""}.
        </>
      )}{" "}
      <Link className="font-semibold underline" href="/reglages">
        Réglages → Messagerie → « Rattraper les identifiants »
      </Link>{" "}
      rattache ces envois par adresse ; le relevé suivant consigne alors les réponses.
    </p>
  );
}
