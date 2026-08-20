import { describe, expect, it } from "vitest";
import { describeImapError, imapMissingFields, pickSentMailbox } from "../imap";
import { toCrlf } from "../mail";
import { withTrackingPixel, toHtml } from "@/lib/domain/email-format";

/**
 * **Le dossier « Envoyés » se trouve par son drapeau, pas par son nom.**
 *
 * Il s'appelle « Sent », « Envoyés », « Sent Items », « INBOX.Sent » ou
 * « [Gmail]/Messages envoyés » selon le serveur, la langue du compte et le
 * séparateur de hiérarchie. Une liste de noms probables marche jusqu'au jour où
 * le compte change de langue — et ce jour-là, chaque message part sans copie
 * sans que rien ne le signale.
 */

const BOXES = [
  { path: "INBOX" },
  { path: "Envoyés", specialUse: "\\Sent" },
  { path: "Corbeille", specialUse: "\\Trash" },
];

describe("trouver le dossier des envoyés", () => {
  it("suit le drapeau special-use, quel que soit le nom", () => {
    expect(pickSentMailbox(BOXES, "")).toEqual({ path: "Envoyés", bySpecialUse: true });
    // Le nom de repli ne l'emporte jamais sur le drapeau : le serveur sait
    // mieux que le réglage.
    expect(pickSentMailbox(BOXES, "INBOX")).toEqual({ path: "Envoyés", bySpecialUse: true });
  });

  it("retombe sur le nom réglé quand aucun drapeau n'est posé", () => {
    const flat = [{ path: "INBOX" }, { path: "INBOX.Sent" }];
    expect(pickSentMailbox(flat, "INBOX.Sent")).toEqual({
      path: "INBOX.Sent",
      bySpecialUse: false,
    });
    // Casse indifférente : se tromper de casse dans un réglage ne doit pas
    // coûter la copie de tous les messages.
    expect(pickSentMailbox(flat, "inbox.sent")?.path).toBe("INBOX.Sent");
  });

  it("**ne devine jamais** quand ni drapeau ni nom ne correspondent", () => {
    // Déposer un message dans un dossier choisi au hasard serait pire que ne
    // pas le déposer : on le croirait rangé.
    expect(pickSentMailbox([{ path: "INBOX" }], "")).toBeNull();
    expect(pickSentMailbox([{ path: "INBOX" }], "Sent")).toBeNull();
  });
});

describe("l'erreur IMAP dit quoi faire", () => {
  it("distingue les causes, et cite la réponse du serveur", () => {
    const auth = describeImapError({
      code: "AUTHENTICATIONFAILED",
      responseText: "Authentication failed.",
    });
    expect(auth).toContain("Authentification IMAP refusée");
    expect(auth).toContain("Authentication failed.");

    expect(describeImapError({ code: "ENOTFOUND" })).toContain("Hôte IMAP introuvable");
    expect(describeImapError({ code: "ECONNREFUSED" })).toContain("Connexion IMAP refusée");
    expect(describeImapError({ serverResponseCode: "TRYCREATE" })).toContain("n'existe pas");
  });

  it("ne prétend rien savoir d'une erreur qu'elle ne reconnaît pas", () => {
    expect(describeImapError({ message: "boom" })).toContain("a refusé la copie");
    expect(describeImapError(null)).toContain("sans détail");
  });
});

describe("ce qui manque est nommé, jamais deviné", () => {
  const mail = { user: "", fromName: "", from: "", host: "", port: 587, encryption: "starttls" as const, signName: "", signTitle: "", demoLabel: "", demoUrl: "" };

  it("réclame l'hôte, l'identifiant du SMTP et le secret", () => {
    const missing = imapMissingFields({ host: "", port: 993, encryption: "tls", sentMailbox: "", enabled: true }, mail, false);
    expect(missing).toContain("l'hôte IMAP");
    expect(missing.some((item) => item.includes("celui du SMTP"))).toBe(true);
    expect(missing.some((item) => item.includes("SMTP_PASSWORD"))).toBe(true);
  });

  it("ne réclame rien quand tout est là", () => {
    expect(
      imapMissingFields(
        { host: "imap.ionos.fr", port: 993, encryption: "tls", sentMailbox: "", enabled: true },
        { ...mail, user: "yanis@aura.fr" },
        true,
      ),
    ).toEqual([]);
  });
});

/**
 * Le pixel est une décision d'envoi, pas une décision de mise en forme.
 *
 * La règle du jalon 32 — le corps ne porte ni image ni pixel — tient toujours :
 * `toHtml()` seul reste exactement ce qu'un humain aurait tapé.
 */
describe("le pixel de suivi", () => {
  const body = "Bonjour,\n\nUne question.";

  it("n'est jamais posé par la mise en forme du corps", () => {
    expect(toHtml(body)).not.toContain("<img");
  });

  it("s'insère juste avant la fin du corps, invisible", () => {
    const html = withTrackingPixel(toHtml(body), "https://crm.test/api/t/abc");
    expect(html).toContain('<img src="https://crm.test/api/t/abc"');
    expect(html).toContain('width="1"');
    expect(html).toContain('alt=""');
    expect(html).toContain("display:none");
    // En fin de corps : un client qui tronque un message long coupe par la fin,
    // donc un pixel en tête serait chargé même sur un message jamais déroulé.
    expect(html.indexOf("<img")).toBeGreaterThan(html.indexOf("<p>"));
    expect(html.endsWith("</body></html>")).toBe(true);
  });

  it("**ne pose rien** quand le suivi est coupé", () => {
    // Ni image, ni jeton : un pixel posé mais non compté coûterait la
    // délivrabilité sans rien rapporter.
    expect(withTrackingPixel(toHtml(body), "")).toBe(toHtml(body));
    expect(withTrackingPixel(toHtml(body), "   ")).not.toContain("<img");
  });
});

/**
 * **Les octets déposés sont ceux qui sont partis.**
 *
 * Défaut trouvé à la vérification, invisible à la lecture : `MailComposer`
 * rend un corps quoted-printable aux fins de ligne LF nues, tandis que le
 * transport SMTP les convertit en CRLF sur le fil. Sept octets d'écart sur un
 * message de sept lignes — et c'est la version LF qu'on déposait dans
 * « Envoyés ». La RFC 3501 exige le CRLF dans un `APPEND` : un serveur strict
 * refuse, un serveur tolérant accepte et le client affiche un pavé.
 */
describe("le MIME déposé est conforme et identique à l'envoi", () => {
  it("convertit les LF nus en CRLF", () => {
    const raw = Buffer.from("Subject: x\r\n\r\nligne 1\nligne 2\n", "latin1");
    const fixed = toCrlf(raw).toString("latin1");
    expect(fixed).toBe("Subject: x\r\n\r\nligne 1\r\nligne 2\r\n");
  });

  it("ne double jamais un CRLF déjà correct", () => {
    // Appliquer deux fois la normalisation ne doit rien changer, sinon chaque
    // passage ajouterait une ligne vide entre chaque ligne du message.
    const raw = Buffer.from("a\r\nb\r\n", "latin1");
    expect(toCrlf(toCrlf(raw)).toString("latin1")).toBe("a\r\nb\r\n");
  });

  it("préserve les octets UTF-8 déjà encodés", () => {
    const raw = Buffer.from("Subject: =?UTF-8?B?w6k=?=\r\n\r\né\n", "utf8");
    expect(toCrlf(raw).toString("utf8")).toContain("é");
  });
});

/**
 * **La copie archivée ne porte pas le pixel — et c'est un changement assumé.**
 *
 * Jusqu'au jalon 43, les octets déposés dans « Envoyés » étaient exactement ceux
 * qui étaient partis, pixel compris. Conséquence mesurée : ouvrir son propre
 * dossier « Envoyés », ou laisser un client de messagerie le pré-charger,
 * comptait comme une ouverture du prospect — la première cause d'un taux
 * d'ouverture à 87 %.
 *
 * Ce que l'identité octet pour octet servait — rattacher la réponse au bon fil —
 * ne tient pas aux octets mais aux en-têtes : `Message-ID`, `Date`, `From`,
 * `To`, `Subject`. Ils sont conservés, la copie étant composée à partir du
 * **même objet** message, seule l'image invisible retirée. Recomposer un
 * message « équivalent » à la main produirait un autre identifiant, et c'est
 * précisément la leçon du jalon 37 qu'on ne défait pas ici.
 */
describe("le pixel ne survit pas à l'archivage", () => {
  const body = "Bonjour,\n\nUne question.";
  const plain = toHtml(body);
  const tracked = withTrackingPixel(plain, "https://crm.test/api/t/abc");

  it("le HTML archivé est exactement celui qu'un humain aurait tapé", () => {
    // La copie repart de `toHtml()`, pas d'une suppression de sous-chaîne :
    // découper l'image après coup laisserait un jour un fragment derrière.
    expect(plain).not.toContain("<img");
    expect(tracked).toContain("<img");
    expect(tracked.startsWith(plain.slice(0, plain.indexOf("</body>")))).toBe(true);
  });

  it("sans suivi, il n'y a rien à retirer et les deux versions coïncident", () => {
    expect(withTrackingPixel(plain, "")).toBe(plain);
  });
});
