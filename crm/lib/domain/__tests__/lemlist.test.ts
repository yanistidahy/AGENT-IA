import { describe, expect, it } from "vitest";
import {
  LEMLIST_ACTIVITY_TYPES,
  LEMLIST_MAPPING,
  LEMLIST_WEBHOOK_ONLY_EVENTS,
  activeLemlistCampaign,
  companyDomainOf,
  isMappedLemlistType,
  mapLemlistType,
  normaliseEmail,
  normaliseLinkedin,
  ownerFromLemlist,
  readLemlistActivity,
  type LemlistTouch,
} from "../lemlist";
import { OUTREACH_CHANNELS, OUTREACH_TYPES } from "../outreach";
import {
  conditionChosen,
  emailOpened,
  emailReplied,
  emailSent,
  entityUnsubscribed,
  futureType,
  linkedinInviteAccepted,
  linkedinOutsideCampaign,
  withoutDate,
  withoutId,
} from "../../api/__tests__/lemlist-payloads";

/**
 * **La table de correspondance, éprouvée sur ce que lemlist publie.**
 *
 * Pur, sans base et sans réseau. Ce que ces tests établissent : la table est
 * **complète** sur le vocabulaire documenté, elle ne produit que des valeurs du
 * vocabulaire du jalon 109, et la lecture d'une charge utile tient les deux cas
 * que la documentation signale comme différents — une activité de campagne et
 * une activité hors campagne.
 */

describe("la table de correspondance", () => {
  /**
   * **Le test qui compte.** Un type documenté sans décision écrite tomberait
   * dans le seau `other` sans que personne l'ait voulu, et la mesure
   * perdrait un canal entier en silence. Ici l'absence est un échec, pas un
   * repli.
   */
  it("décide de chacun des 113 types d'activité publiés", () => {
    const missing = LEMLIST_ACTIVITY_TYPES.filter((type) => LEMLIST_MAPPING[type] === undefined);
    expect(missing).toEqual([]);
    expect(LEMLIST_ACTIVITY_TYPES).toHaveLength(113);
  });

  it("décide aussi des événements que seul le webhook sert", () => {
    const missing = LEMLIST_WEBHOOK_ONLY_EVENTS.filter(
      (type) => LEMLIST_MAPPING[type] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it("ne produit que du vocabulaire du jalon 109", () => {
    for (const [type, mapping] of Object.entries(LEMLIST_MAPPING)) {
      expect(OUTREACH_TYPES, `${type} rend un type inconnu`).toContain(mapping.type);
      expect(OUTREACH_CHANNELS, `${type} rend un canal inconnu`).toContain(mapping.channel);
      // Une ligne sans explication est une ligne qu'on ne peut pas contester.
      expect(mapping.detail.length, `${type} n'explique rien`).toBeGreaterThan(3);
    }
  });

  /**
   * La définition lemlist de « envoyé », reprise telle quelle dans les
   * statistiques de campagne. La recopier plutôt que de la juger est ce qui
   * empêche d'inventer un second compte de messages envoyés.
   */
  it("compte comme envoyé exactement ce que lemlist compte comme envoyé", () => {
    const sent = Object.entries(LEMLIST_MAPPING)
      .filter(([, mapping]) => mapping.type === "message_sent")
      .map(([type]) => type)
      .sort();
    expect(sent).toEqual(
      [
        "aircallEnded",
        "emailsSent",
        "linkedinInMailSent",
        "linkedinSent",
        "linkedinVoiceNoteDone",
        "smsSent",
        "whatsappMessageSent",
        "whatsappVoiceNoteSent",
      ].sort(),
    );
  });

  /**
   * Les quatre refus de double compte, écrits en test. Chacun a une raison
   * nommée dans le module ; ici on fige la conséquence.
   */
  it("refuse de compter deux fois le même fait", () => {
    // Une tâche achevée n'est pas un envoi : l'envoi porte son propre type.
    for (const done of ["emailsDone", "linkedinDone", "whatsappDone", "smsDone", "manualDone", "aircallDone"]) {
      expect(LEMLIST_MAPPING[done]?.type, done).toBe("other");
    }
    // Un email parti hors lemlist peut être celui que le CRM a envoyé.
    expect(LEMLIST_MAPPING["emailsExternalSent"]?.type).toBe("other");
    // Un échec d'envoi n'est pas un rebond.
    expect(LEMLIST_MAPPING["emailsBounced"]?.type).toBe("bounce");
    for (const failed of ["emailsFailed", "linkedinSendFailed", "smsFailed", "whatsappMessageFailed"]) {
      expect(LEMLIST_MAPPING[failed]?.type, failed).toBe("other");
    }
    // Un classement n'est pas une réponse.
    for (const flag of ["emailsInterested", "linkedinNotInterested", "manualInterested"]) {
      expect(LEMLIST_MAPPING[flag]?.type, flag).toBe("other");
    }
  });

  it("importe les ouvertures et les clics sans en faire des envois ni des réponses", () => {
    expect(LEMLIST_MAPPING["emailsOpened"]?.type).toBe("message_opened");
    expect(LEMLIST_MAPPING["linkedinOpened"]?.type).toBe("message_opened");
    expect(LEMLIST_MAPPING["emailsClicked"]?.type).toBe("link_clicked");
  });

  it("range les six réponses de lemlist en réponses, sans catégorie", () => {
    for (const replied of [
      "emailsReplied",
      "linkedinReplied",
      "linkedinVoiceNoteReplied",
      "whatsappReplied",
      "whatsappVoiceNoteReplied",
      "smsReplied",
    ]) {
      expect(LEMLIST_MAPPING[replied]?.type, replied).toBe("reply_received");
    }
  });

  it("garde un type inconnu sous son vrai nom plutôt que de le jeter", () => {
    const mapping = mapLemlistType("telepathyDone");
    expect(mapping.type).toBe("other");
    expect(mapping.detail).toContain("telepathyDone");
    expect(isMappedLemlistType("telepathyDone")).toBe(false);
    expect(isMappedLemlistType("emailsSent")).toBe(true);
  });
});

describe("la normalisation du rapprochement", () => {
  it("coupe et minuscule une adresse", () => {
    expect(normaliseEmail("  Anna.Leroy@Maison-Leroy.FR ")).toBe("anna.leroy@maison-leroy.fr");
  });

  /**
   * Sans cette réduction, le second rapprochement du jalon — « puis par URL
   * LinkedIn » — échouerait sur une barre oblique finale ou un `www.`.
   */
  it("ramène quatre écritures d'un profil LinkedIn à la même clé", () => {
    const expected = "linkedin.com/in/anna-leroy";
    expect(normaliseLinkedin("https://www.linkedin.com/in/anna-leroy/")).toBe(expected);
    expect(normaliseLinkedin("http://linkedin.com/in/anna-leroy")).toBe(expected);
    expect(normaliseLinkedin("LinkedIn.com/in/Anna-Leroy//")).toBe(expected);
    expect(normaliseLinkedin("https://www.linkedin.com/in/anna-leroy?utm=x")).toBe(expected);
    expect(normaliseLinkedin("   ")).toBe("");
  });

  /**
   * **Le garde-fou qui compte.** Rapprocher sur `gmail.com` rangerait tous les
   * indépendants du portefeuille dans une société nommée Gmail.
   */
  it("refuse un domaine de messagerie publique comme domaine de société", () => {
    expect(companyDomainOf("", "anna@maison-leroy.fr")).toBe("maison-leroy.fr");
    expect(companyDomainOf("maison-leroy.fr", "")).toBe("maison-leroy.fr");
    expect(companyDomainOf("https://www.maison-leroy.fr/", "")).toBe("maison-leroy.fr");
    expect(companyDomainOf("", "anna@gmail.com")).toBe("");
    expect(companyDomainOf("", "anna@orange.fr")).toBe("");
    expect(companyDomainOf("", "")).toBe("");
  });

  it("traduit le nom lemlist d'un expéditeur dans le vocabulaire du CRM", () => {
    const owners = ["Yanis", "Mohamed"];
    expect(ownerFromLemlist("YANIS TIDAHY", owners)).toBe("Yanis");
    expect(ownerFromLemlist("Mohamed Ben Salem", owners)).toBe("Mohamed");
    // Sans correspondance, le champ reste vide : un propriétaire inventé
    // apparaîtrait dans le filtre comme une troisième personne.
    expect(ownerFromLemlist("Jean Dupont", owners)).toBe("");
    expect(ownerFromLemlist("", owners)).toBe("");
  });
});

describe("la lecture d'une charge utile enregistrée", () => {
  it("lit une activité de campagne entièrement", () => {
    const activity = readLemlistActivity(emailSent);
    expect(activity).not.toBeNull();
    expect(activity?.externalId).toBe("act_PbKqTGpQqSlPcoOZ5");
    expect(activity?.rawType).toBe("emailsSent");
    // L'adresse arrive en casse mixte dans `leadEmail` : on rapproche sur la
    // forme coupée et minuscule, pas sur celle que la source a écrite.
    expect(activity?.email).toBe("anna.leroy@maison-leroy.fr");
    expect(activity?.linkedinUrl).toBe("linkedin.com/in/anna-leroy");
    expect(activity?.companyName).toBe("Maison Leroy");
    expect(activity?.companyDomain).toBe("maison-leroy.fr");
    expect(activity?.jobTitle).toBe("Fondatrice");
    expect(activity?.campaignId).toBe("cam_bSn8EORHQxbWPjHvu");
    expect(activity?.sendUserName).toBe("YANIS TIDAHY");
    expect(activity?.occurredAt.toISOString()).toBe("2026-11-02T09:12:04.318Z");
  });

  /**
   * **Le cas que la documentation signale, et celui qui casse une lecture
   * écrite trop vite** : une activité née d'une fiche ou de la boîte, pas d'une
   * étape de campagne, n'a **aucune** clé `lead*`.
   */
  it("lit une activité hors campagne, qui ne porte aucune clé lead*", () => {
    const activity = readLemlistActivity(linkedinOutsideCampaign);
    expect(activity?.email).toBe("claire.mercier@studio-mercier.com");
    expect(activity?.firstName).toBe("Claire");
    expect(activity?.lastName).toBe("Mercier");
    expect(activity?.campaignId).toBe("");
    expect(activity?.campaignName).toBe("");
  });

  it("lit l'URL LinkedIn depuis les variables du lead quand elle n'est que là", () => {
    const activity = readLemlistActivity(linkedinInviteAccepted);
    expect(activity?.email).toBe("");
    expect(activity?.linkedinUrl).toBe("linkedin.com/in/pierre-vasseur");
    expect(activity?.companyDomain).toBe("atelier-vasseur.fr");
  });

  /**
   * Poser un événement à la date du jour parce que la source n'en donnait pas
   * déplacerait un fait d'hier dans la semaine en cours, et fausserait la
   * mesure en silence. On refuse la ligne plutôt que d'inventer son instant.
   */
  it("refuse une charge utile sans identifiant ou sans date", () => {
    expect(readLemlistActivity(withoutId)).toBeNull();
    expect(readLemlistActivity(withoutDate)).toBeNull();
    expect(readLemlistActivity(null)).toBeNull();
    expect(readLemlistActivity("act_x")).toBeNull();
    expect(readLemlistActivity([])).toBeNull();
    expect(readLemlistActivity({ _id: "act_x", type: "emailsSent", createdAt: "pas une date" })).toBeNull();
  });

  it("traduit chacune des charges utiles enregistrées", () => {
    const seen = [emailSent, emailOpened, emailReplied, linkedinInviteAccepted, entityUnsubscribed]
      .map((raw) => readLemlistActivity(raw))
      .map((activity) => (activity === null ? "illisible" : mapLemlistType(activity.rawType).type));
    expect(seen).toEqual([
      "message_sent",
      "message_opened",
      "reply_received",
      "linkedin_invite_accepted",
      "unsubscribed",
    ]);
  });

  it("range en autre activité un type documenté sans correspondance et un type futur", () => {
    for (const raw of [conditionChosen, futureType]) {
      const activity = readLemlistActivity(raw);
      expect(activity).not.toBeNull();
      expect(mapLemlistType(activity!.rawType).type).toBe("other");
    }
  });
});

describe("« actif dans une campagne lemlist »", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const touch = (type: LemlistTouch["type"], iso: string, campaignName = "Shopify"): LemlistTouch => ({
    type,
    occurredAt: new Date(iso),
    campaignName,
  });

  it("nomme la campagne quand un envoi récent n'a pas eu de suite", () => {
    expect(activeLemlistCampaign([touch("message_sent", "2026-11-04T09:00:00Z")], now)).toBe("Shopify");
  });

  /** lemlist arrête sa séquence sur ces trois faits : la nôtre peut reprendre. */
  it("rend la main dès qu'une réponse, une désinscription ou un rebond est arrivé", () => {
    for (const stop of ["reply_received", "unsubscribed", "bounce"] as const) {
      const touches = [
        touch("message_sent", "2026-11-04T09:00:00Z"),
        touch(stop, "2026-11-05T09:00:00Z"),
      ];
      expect(activeLemlistCampaign(touches, now), stop).toBeNull();
    }
  });

  it("ne gèle pas le portefeuille pour toujours", () => {
    expect(activeLemlistCampaign([touch("message_sent", "2026-08-01T09:00:00Z")], now)).toBeNull();
  });

  it("ne retient rien quand lemlist n'a jamais rien envoyé à cette personne", () => {
    expect(activeLemlistCampaign([], now)).toBeNull();
    // Une ouverture n'est pas un envoi : elle ne rend pas quelqu'un « actif ».
    expect(activeLemlistCampaign([touch("message_opened", "2026-11-05T09:00:00Z")], now)).toBeNull();
  });

  it("compte une invitation LinkedIn comme un envoi", () => {
    expect(
      activeLemlistCampaign([touch("linkedin_invite_sent", "2026-11-05T09:00:00Z", "Artisans")], now),
    ).toBe("Artisans");
  });

  it("dit « une campagne lemlist » plutôt que rien quand le nom manque", () => {
    expect(activeLemlistCampaign([touch("message_sent", "2026-11-05T09:00:00Z", "")], now)).toBe(
      "une campagne lemlist",
    );
  });
});
