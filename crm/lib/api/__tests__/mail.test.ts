import { describe, expect, it } from "vitest";
import { describeSmtpError, messageId, missingFields, PASSWORD_ENV } from "../mail";

/**
 * Ce que le panneau de messagerie doit savoir dire.
 *
 * Le fond est la leçon du jalon 16 : une erreur qui ne nomme pas sa cause coûte
 * un aller-retour de débogage entier. Un « échec de l'envoi » laisse chercher
 * entre le port, le mode de chiffrement, l'identifiant et le mot de passe ;
 * « 535 authentication failed » désigne le coupable en une ligne.
 */
const CONFIG = {
  host: "smtp.ionos.fr",
  port: 587,
  encryption: "starttls" as const,
  user: "yanis@exemple.fr",
  from: "yanis@exemple.fr",
  fromName: "Yanis",
};

describe("ce qui manque pour envoyer", () => {
  it("ne réclame rien quand tout est là", () => {
    expect(missingFields(CONFIG, true)).toEqual([]);
  });

  it("nomme le mot de passe par sa variable d'environnement", () => {
    // Le nom de la variable est la seule information actionnable : le mot de
    // passe ne se règle pas dans l'application, il se pose sur le service.
    expect(missingFields(CONFIG, false)).toEqual([`le mot de passe (variable ${PASSWORD_ENV})`]);
  });

  it("nomme chaque champ absent, pas seulement le premier", () => {
    const empty = { ...CONFIG, host: "", user: "", from: "" };
    expect(missingFields(empty, false)).toEqual([
      "l'hôte SMTP",
      "l'identifiant",
      "l'adresse d'expédition",
      `le mot de passe (variable ${PASSWORD_ENV})`,
    ]);
  });
});

describe("traduction des refus SMTP", () => {
  it("distingue un refus d'authentification", () => {
    const message = describeSmtpError({
      code: "EAUTH",
      responseCode: 535,
      response: "535 5.7.8 Error: authentication failed",
    });
    expect(message).toContain("identifiant ou mot de passe incorrect");
    // La réponse brute du serveur est reprise : c'est elle qu'on retrouve dans
    // la documentation du fournisseur.
    expect(message).toContain("535 5.7.8");
    expect(message).toContain("EAUTH");
  });

  it("distingue une connexion impossible d'un délai dépassé", () => {
    expect(describeSmtpError({ code: "ECONNECTION" })).toContain("l'hôte, le port");
    expect(describeSmtpError({ code: "ETIMEDOUT" })).toContain("n'a pas répondu à temps");
  });

  it("distingue un expéditeur refusé", () => {
    expect(describeSmtpError({ responseCode: 550, response: "550 sender rejected" })).toContain(
      "l'expéditeur doit être une adresse de votre compte",
    );
  });

  it("reste lisible sur une erreur inconnue", () => {
    expect(describeSmtpError(null)).toBe("Échec de l'envoi, sans détail.");
    expect(describeSmtpError({ message: "boom" })).toContain("boom");
  });
});

describe("identifiant de message", () => {
  it("prend le domaine de l'expéditeur", () => {
    // Un Message-ID dont le domaine ne correspond pas à l'expéditeur est un
    // signal négatif pour les filtres. Celui de nodemailer porterait le nom
    // d'hôte de la machine — sur Railway, un identifiant de conteneur.
    const id = messageId("yanis@auraflow.fr", new Date("2026-08-17T10:00:00Z"), "abc123");
    expect(id).toBe("<1786960800000.abc123@auraflow.fr>");
    expect(id.endsWith("@auraflow.fr>")).toBe(true);
  });

  it("ne casse pas sur une adresse malformée", () => {
    expect(messageId("sans-arobase", new Date(0), "x")).toBe("<0.x@localhost>");
  });
});
