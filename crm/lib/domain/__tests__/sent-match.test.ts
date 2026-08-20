import { describe, expect, it } from "vitest";
import {
  matchSentMessage,
  normalizeAddress,
  planBackfill,
  type SendLike,
  type SentHeaderLike,
} from "../sent-match";

const at = (iso: string) => new Date(iso);

const SENDS: SendLike[] = [
  {
    id: "s1",
    toAddress: "caroline@miye.care",
    sentAt: at("2026-08-17T10:33:22Z"),
    messageId: "<b58ba737-b4c6-c1a8-3bda-dd2f97989d06@auraflowai.fr>",
    subject: "Une démonstration préparée pour MiYé",
  },
  {
    id: "s2",
    toAddress: "hugo@cuure.com",
    sentAt: at("2026-08-18T09:00:00Z"),
    messageId: "<1787200000000.abcd1234@auraflowai.fr>",
    subject: "Cuure",
  },
];

const header = (over: Partial<SentHeaderLike> = {}): SentHeaderLike => ({
  messageId: "<1787142802796.rpp6m071@auraflowai.fr>",
  to: "Caroline Lanson <caroline@miye.care>",
  date: at("2026-08-17T10:33:22Z"),
  ...over,
});

describe("l'adresse est réduite à ce qui l'identifie", () => {
  it("retire le nom affiché et la casse", () => {
    expect(normalizeAddress("Caroline Lanson <Caroline@Miye.Care>")).toBe("caroline@miye.care");
    expect(normalizeAddress("  caroline@miye.care ")).toBe("caroline@miye.care");
  });
});

describe("rapprocher un message d'« Envoyés » de sa ligne d'envoi", () => {
  it("rapproche sur le destinataire et l'instant", () => {
    const outcome = matchSentMessage(header(), SENDS);
    expect(outcome).toEqual({
      kind: "matched",
      sendId: "s1",
      from: "<b58ba737-b4c6-c1a8-3bda-dd2f97989d06@auraflowai.fr>",
      to: "<1787142802796.rpp6m071@auraflowai.fr>",
    });
  });

  it("tolère quelques secondes d'écart entre l'en-tête et `sentAt`", () => {
    const outcome = matchSentMessage(header({ date: at("2026-08-17T10:34:20Z") }), SENDS);
    expect(outcome.kind).toBe("matched");
  });

  it("refuse au-delà de la tolérance", () => {
    // Deux heures plus tard, ce n'est plus le même message.
    expect(matchSentMessage(header({ date: at("2026-08-17T12:33:22Z") }), SENDS).kind).toBe(
      "unknown",
    );
  });

  it("ne réécrit pas un identifiant déjà correct", () => {
    const already = header({ messageId: SENDS[1]!.messageId, to: "hugo@cuure.com" });
    expect(matchSentMessage(already, SENDS)).toEqual({ kind: "already", sendId: "s2" });
  });

  it("un message écrit à la main depuis la boîte n'est rattaché à rien", () => {
    expect(matchSentMessage(header({ to: "inconnu@ailleurs.fr" }), SENDS).kind).toBe("unknown");
  });

  it("des en-têtes incomplets sont signalés, pas devinés", () => {
    expect(matchSentMessage(header({ messageId: "" }), SENDS).kind).toBe("ambiguous");
    expect(matchSentMessage(header({ date: null }), SENDS).kind).toBe("ambiguous");
  });

  it("**deux envois candidats ne se départagent pas**", () => {
    // Écrire un mauvais Message-ID attribuerait une réponse à la mauvaise
    // personne : c'est pire que de ne rien écrire.
    const twins: SendLike[] = [
      { ...SENDS[0]!, id: "a" },
      { ...SENDS[0]!, id: "b", messageId: "<autre@auraflowai.fr>" },
    ];
    const outcome = matchSentMessage(header(), twins);
    expect(outcome.kind).toBe("ambiguous");
    if (outcome.kind === "ambiguous") expect(outcome.candidates).toBe(2);
  });
});

describe("le plan d'ensemble", () => {
  it("compte les corrections, les déjà-corrects et les inconnus", () => {
    const plan = planBackfill(
      [
        header(),
        header({ messageId: SENDS[1]!.messageId, to: "hugo@cuure.com", date: at("2026-08-18T09:00:00Z") }),
        header({ to: "quelquun@ailleurs.fr" }),
      ],
      SENDS,
    );

    expect(plan.fixes).toHaveLength(1);
    expect(plan.fixes[0]?.sendId).toBe("s1");
    expect(plan.fixes[0]?.real).toBe("<1787142802796.rpp6m071@auraflowai.fr>");
    expect(plan.already).toBe(1);
    expect(plan.unknown).toBe(1);
    expect(plan.ambiguous).toEqual([]);
  });

  it("**un envoi revendiqué par deux messages sort du plan**", () => {
    // Sans cette règle, le résultat dépendrait de l'ordre de lecture du dossier.
    const plan = planBackfill([header(), header({ messageId: "<autre.9999@auraflowai.fr>" })], SENDS);
    expect(plan.fixes).toEqual([]);
    expect(plan.ambiguous).toHaveLength(1);
    expect(plan.ambiguous[0]).toContain("revendiquent le même envoi");
  });

  it("rejouer le plan appliqué ne propose plus rien", () => {
    // Idempotence : après correction, le même dossier ne produit que des
    // « déjà correct ».
    const corrected: SendLike[] = [
      { ...SENDS[0]!, messageId: "<1787142802796.rpp6m071@auraflowai.fr>" },
      SENDS[1]!,
    ];
    const plan = planBackfill([header()], corrected);
    expect(plan.fixes).toEqual([]);
    expect(plan.already).toBe(1);
  });
});
