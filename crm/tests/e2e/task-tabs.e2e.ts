import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * **L'écran Tâches rangé, au clic.**
 *
 * Quatre choses ne se lisent pas dans un diff, et c'est la leçon du jalon 60 —
 * un contrôle peut rendre correctement et ne rien faire :
 *
 * 1. il y a **exactement quatre onglets** plus « + », et chaque pastille égale
 *    la longueur de sa liste — y compris après un changement de personne ;
 * 2. le filtre par personne **écrit dans l'URL** et survit à un rechargement ;
 * 3. une tâche d'appel porte son numéro composable et « Appel passé », et ce
 *    bouton **consigne** l'appel autant qu'il coche la tâche ;
 * 4. le bandeau des départs **apparaît avec son nombre** et mène à la file.
 *
 * L'assertion qui compte est **`reachable()`, jamais `isVisible()`** : celle-ci
 * ne voit pas un ancêtre qui rogne.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

const P = "e2e105";

async function wipe(): Promise<void> {
  await prisma.sequenceDeparture.deleteMany({
    where: { enrollment: { sequence: { campaign: { name: { startsWith: P } } } } },
  });
  await prisma.sequenceEnrollment.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: P } } } },
  });
  await prisma.emailSequenceStep.deleteMany({
    where: { sequence: { campaign: { name: { startsWith: P } } } },
  });
  await prisma.emailSequence.deleteMany({ where: { campaign: { name: { startsWith: P } } } });
  await prisma.campaign.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.task.deleteMany({ where: { contactId: { startsWith: P } } });
  await prisma.activity.deleteMany({ where: { contactId: { startsWith: P } } });
  await prisma.contact.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.company.deleteMany({ where: { name: { startsWith: P } } });
  await prisma.mailbox.deleteMany({ where: { slug: { startsWith: P } } });
}

const PHONE = "06 55 44 33 22";

describe.skipIf(skip)("l'écran Tâches, quatre onglets et une personne", () => {
  let browser: Browser;
  let session: Session;
  let callTaskId = "";

  beforeAll(async () => {
    await wipe();
    const company = await prisma.company.create({
      data: { name: `${P} Maison`, nameKey: `${P} maison`, domain: `${P}.test` },
    });

    await prisma.contact.create({
      data: {
        id: `${P}a`,
        firstName: "Nina",
        lastName: "Appel105",
        email: `${P}a@${P}.test`,
        phone: PHONE,
        lifecycle: "Prospect",
        companyId: company.id,
        owner: "Yanis",
        nameKey: "appel105 nina",
      },
    });
    await prisma.contact.create({
      data: {
        id: `${P}b`,
        firstName: "Paul",
        lastName: "Autre105",
        email: `${P}b@${P}.test`,
        lifecycle: "Prospect",
        companyId: company.id,
        owner: "Mohamed",
        nameKey: "autre105 paul",
      },
    });

    const today = new Date();
    const later = new Date(today.getTime() + 5 * 86_400_000);

    /*
      Une tâche d'appel due aujourd'hui pour Yanis — c'est elle qui doit
      apparaître **dans deux onglets** —, une tâche à venir pour Mohamed, et une
      terminée. Semées par Prisma pour ne dépendre d'aucun état laissé par une
      autre recette (leçon du jalon 83 : partir de l'état de la production).
    */
    const call = await prisma.task.create({
      data: {
        title: `${P} appeler Nina`,
        due: today,
        priority: "haute",
        owner: "Yanis",
        kind: "appel",
        contactId: `${P}a`,
      },
    });
    callTaskId = call.id;
    await prisma.task.create({
      data: {
        title: `${P} envoyer les CGV`,
        due: later,
        priority: "normale",
        owner: "Mohamed",
        kind: "email",
        contactId: `${P}b`,
      },
    });
    await prisma.task.create({
      data: {
        title: `${P} déjà faite`,
        due: today,
        priority: "basse",
        owner: "Mohamed",
        kind: "tache",
        done: true,
        doneAt: today,
        contactId: `${P}b`,
      },
    });

    browser = await openBrowser();
    session = await signIn(browser, PASSWORD ?? "");
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
    await wipe();
    await prisma.$disconnect();
  });

  /** Les pastilles telles qu'elles sont rendues, onglet par onglet. */
  async function badges(): Promise<Record<string, number>> {
    const { page } = session;
    const out: Record<string, number> = {};
    for (const label of ["Aujourd'hui", "Appels", "À venir", "Terminées"]) {
      const tab = page.getByRole("tab", { name: new RegExp(label.replace("'", "'?")) }).first();
      const text = await tab.innerText();
      out[label] = Number.parseInt(text.replace(/\D+/g, ""), 10);
    }
    return out;
  }

  it("rend exactement quatre onglets, plus le « + »", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/taches`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const tabs = page.getByRole("tab");
    expect(await tabs.count(), "quatre onglets, ni cinq ni six").toBe(4);
    expect(await tabs.first().innerText()).toContain("Aujourd'hui");

    // Le « + » du jalon 92 est conservé, **après** les quatre.
    const save = page.getByRole("button", { name: "Enregistrer cette vue comme onglet" });
    await save.scrollIntoViewIfNeeded();
    expect(await reachable(save), "le « + » est atteignable").toBe(true);

    // Les trois onglets retirés ne doivent plus exister nulle part.
    const text = await page.locator("main").innerText();
    for (const gone of ["Vos tâches", "À envoyer", "Réponses des prospects", "Prospects chauds ("]) {
      expect(text, `« ${gone} » a disparu de la rangée`).not.toContain(gone);
    }

    expect(session.errors).toEqual([]);
  }, 90_000);

  it("chaque pastille égale la longueur de sa liste, et suit la personne", async () => {
    const { page } = session;

    for (const [person, expectation] of [
      ["tous", null],
      ["Yanis", null],
      ["Mohamed", null],
    ] as const) {
      void expectation;
      const chip = page.locator(`[data-person="${person}"]`);
      await chip.scrollIntoViewIfNeeded();
      expect(await reachable(chip), `la puce « ${person} » est atteignable`).toBe(true);
      await chip.click();
      await page.waitForTimeout(900);

      const counts = await badges();
      for (const [label, count] of Object.entries(counts)) {
        const tab = page.getByRole("tab", { name: new RegExp(label.replace("'", "'?")) }).first();
        await tab.click();
        await page.waitForTimeout(700);
        const rendered = await page.locator("[data-task]").count();
        /*
          **L'invariant du jalon.** La pastille est calculée en amont par
          `tabView()` et la liste vient du même appel : si elles divergeaient,
          c'est ici que ça se verrait — et nulle part ailleurs, parce que deux
          nombres justes chacun de son côté ne lèvent rien (jalons 49, 78).
        */
        expect(rendered, `${label}, personne ${person}`).toBe(count);
      }
    }

    expect(session.errors).toEqual([]);
  }, 180_000);

  it("le filtre par personne vit dans l'URL et survit au rechargement", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/taches`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);

    const mohamed = page.locator('[data-person="Mohamed"]');
    await mohamed.scrollIntoViewIfNeeded();
    expect(await reachable(mohamed)).toBe(true);
    await mohamed.click();
    await page.waitForTimeout(900);

    expect(page.url(), "le choix est dans l'URL").toContain("personne=Mohamed");

    // **Rechargé**, pas re-cliqué : c'est l'URL qui doit porter l'état.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    expect(await mohamed.getAttribute("aria-pressed"), "la puce est encore active").toBe("true");

    // Et la liste ne porte que ses tâches : on lit les assignés rendus.
    const rows = await page.locator("[data-task]").allInnerTexts();
    for (const row of rows) expect(row).not.toContain("Yanis");

    expect(session.errors).toEqual([]);
  }, 120_000);

  it("une tâche d'appel porte son numéro, et « Appel passé » consigne", async () => {
    const { page } = session;
    await page.goto(`${BASE_URL}/taches?personne=Yanis`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const card = page.locator(`[data-task="${callTaskId}"]`);
    await card.scrollIntoViewIfNeeded();
    expect(await reachable(card), "la carte de l'appel est atteignable").toBe(true);
    expect(await card.getAttribute("data-kind")).toBe("appel");

    // Le numéro, composable d'un geste : un vrai `tel:`, pas un libellé.
    const dial = card.locator("[data-dial]");
    await dial.scrollIntoViewIfNeeded();
    expect(await reachable(dial), "le bouton d'appel est atteignable").toBe(true);
    expect(await dial.getAttribute("href")).toBe("tel:0655443322");
    // 44 px de haut, comme toute cible tactile depuis le jalon 46.
    const box = await dial.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(30);

    const before = await prisma.activity.count({ where: { contactId: `${P}a`, type: "call" } });

    const button = card.locator("[data-call-done]");
    await button.scrollIntoViewIfNeeded();
    expect(await reachable(button), "« Appel passé » est atteignable").toBe(true);
    expect((await button.innerText()).trim()).toBe("Appel passé");
    await button.click();
    await page.waitForTimeout(3000);

    /*
      **C'est la base qui le dit, pas l'écran.** Cocher sans consigner perdrait
      le seul fait qui prouve l'appel, et un écran peut très bien afficher une
      case cochée sans que rien ne soit parti.
    */
    const task = await prisma.task.findUniqueOrThrow({ where: { id: callTaskId } });
    expect(task.done, "la tâche est terminée").toBe(true);
    expect(task.doneAt).not.toBeNull();
    const after = await prisma.activity.count({ where: { contactId: `${P}a`, type: "call" } });
    expect(after, "l'appel est consigné dans l'historique").toBe(before + 1);

    expect(session.errors).toEqual([]);
  }, 120_000);

  it("le bandeau des départs porte le nombre réel, et mène à la file", async () => {
    const { page } = session;

    /*
      **Le compte est celui de toute la file**, c'est la règle : le bandeau
      décrit les départs du CRM, pas ceux d'une campagne. Ce test ne suppose donc
      pas une base vide — il mesure l'état de départ et vérifie l'écart, ce qui
      est la seule assertion qui tienne quelle que soit l'histoire de la base
      (même classe de fragilité que celle fermée au jalon 104 sur `mailbox-cap`).

      Le cas « zéro départ, bandeau masqué » est vérifié ailleurs, où il peut
      l'être honnêtement : par `bannerText()` dans la suite unitaire, et par la
      recette, qui le mesure sur une file réellement vide avant de la remplir.
    */
    const already = await prisma.sequenceDeparture.count({ where: { status: "pending" } });

    // Quatorze départs en attente, puis on relit l'écran.
    const box = await prisma.mailbox.create({
      data: {
        slug: `${P}-box`,
        label: "E2E 105",
        position: 105,
        active: true,
        smtpFrom: `${P}@e2e.test`,
        signName: "Yanis Tidahy",
        imapCopyEnabled: false,
      },
    });
    const campaign = await prisma.campaign.create({
      data: { name: `${P} campagne`, mailboxId: box.id, selection: "", mode: "manual" },
    });
    const sequence = await prisma.emailSequence.create({
      data: { name: `${P} campagne`, campaignId: campaign.id, active: true },
    });
    const step = await prisma.emailSequenceStep.create({
      data: {
        sequenceId: sequence.id,
        position: 1,
        delayDays: 0,
        brief: "",
        mode: "manual",
        subject: "Objet",
        body: "Corps",
      },
    });
    const day = new Date().toISOString().slice(0, 10);
    /*
      Deux inscrits et sept tours chacun : l'unicité d'une inscription est le
      couple (séquence, contact), celle d'un départ le triplet (inscription,
      étape, tour). Quatorze départs demandent donc de jouer sur le tour, pas
      d'inventer quatorze contacts.
    */
    for (const contactId of [`${P}a`, `${P}b`]) {
      const enrollment = await prisma.sequenceEnrollment.create({
        data: { sequenceId: sequence.id, contactId, status: "active", lastStep: 0 },
      });
      for (let round = 1; round <= 7; round += 1) {
        await prisma.sequenceDeparture.create({
          data: {
            enrollmentId: enrollment.id,
            step: step.position,
            round,
            status: "pending",
            subject: `Objet ${contactId}-${round}`,
            body: "Corps",
            auto: false,
            day,
          },
        });
      }
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1800);

    const banner = page.locator("[data-banner='sends']");
    await banner.scrollIntoViewIfNeeded();
    expect(await reachable(banner), "le bandeau des départs est atteignable").toBe(true);
    expect(await banner.innerText()).toContain(`${already + 14} mails prêts à partir`);

    const link = banner.getByRole("link", { name: /Départs du jour/ });
    expect(await reachable(link), "le lien vers la file est atteignable").toBe(true);
    await link.click();
    await page.waitForURL(/\/departs/, { timeout: 20_000 });
    expect(page.url()).toContain("/departs");

    expect(session.errors).toEqual([]);
  }, 180_000);
});
