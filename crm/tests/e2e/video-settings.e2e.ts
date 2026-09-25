import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright-core";
import { prisma } from "../../lib/db";
import { BASE_URL, chromiumPath, openBrowser, reachable, signIn, type Session } from "./browser";

/**
 * Le panneau de la vidéo, **cliqué**.
 *
 * Un panneau qui rend correctement et ne fait rien est le défaut du jalon 60,
 * et il ne se voit pas à la lecture : ici, la question qui compte est de savoir
 * si l'aperçu de la vignette est **réellement à l'écran** après enregistrement.
 * Il passe par un chemin relatif précisément parce que l'adresse publique n'est
 * pas toujours connue (défaut trouvé au jalon 62 sur le logo), et c'est le genre
 * de chose qu'une lecture de code ne tranche pas.
 *
 * `reachable()` plutôt que `isVisible()`, comme depuis le jalon 60 : le second
 * rend `true` pour un élément rogné par un ancêtre.
 */

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.WORKSPACE_PASSWORD;
const skip = chromiumPath() === null || PASSWORD === undefined;

describe.skipIf(skip)("la vidéo de démonstration, dans les réglages", () => {
  let browser: Browser;
  let session: Session;

  beforeAll(async () => {
    // On part de l'état d'une installation qui n'a rien réglé : c'est celui où
    // se trouve la production, et la leçon du jalon 83 est de ne pas partir de
    // l'état qu'on sait produire.
    await prisma.mailVideo.deleteMany({ where: { id: "singleton" } });
    browser = await openBrowser();
    session = await signIn(browser, PASSWORD as string);
  }, 60_000);

  afterAll(async () => {
    await prisma.mailVideo.deleteMany({ where: { id: "singleton" } });
    await browser?.close();
    await prisma.$disconnect();
  });

  it("dit ce qui part, et que ce n'est jamais une pièce jointe", async () => {
    await session.page.goto(`${BASE_URL}/reglages`, { waitUntil: "domcontentloaded" });
    const panel = session.page.locator("section", { hasText: "Vidéo de démonstration" }).first();
    await panel.scrollIntoViewIfNeeded();
    expect(await reachable(panel)).toBe(true);

    const text = (await panel.innerText()).replace(/\s+/g, " ");
    expect(text).toContain("{video}");
    expect(text).toContain("jamais en pièce jointe");
    // La règle du repli, dite avant d'écrire quoi que ce soit.
    expect(text).toContain("la phrase qui porte la balise disparaît");
  });

  it("annonce, pour une adresse collée, que le clic quitte notre domaine", async () => {
    const panel = session.page.locator("section", { hasText: "Vidéo de démonstration" }).first();

    // La voie « chez un hébergeur » est le défaut : on renseigne l'adresse et le
    // libellé, puis on enregistre.
    await panel.locator('input[type="url"]').fill("https://vimeo.com/999888777");
    await panel
      .locator('input[type="text"]')
      .fill("Voir la démonstration en vidéo");

    const save = panel.getByRole("button", { name: /Enregistrer la vidéo/ });
    await save.scrollIntoViewIfNeeded();
    expect(await reachable(save)).toBe(true);
    await save.click();
    await panel.getByText("Enregistrée.").waitFor({ timeout: 15_000 });

    const text = (await panel.innerText()).replace(/\s+/g, " ");
    // La seule différence entre les deux voies qui ait une conséquence pour le
    // destinataire — donc la seule qui mérite d'être à l'écran.
    expect(text).toContain("Le clic va chez l'hébergeur");
    expect(text).toContain("vimeo.com/999888777");
    // La vignette a été engendrée faute d'image fournie, et l'écran ne prétend
    // pas montrer une trame du film.
    expect(text).toContain("engendrée, pas une image du film");

    // L'aperçu est **à l'écran**, servi par un chemin relatif.
    const preview = panel.locator('img[src^="/api/video/"]');
    await preview.scrollIntoViewIfNeeded();
    expect(await reachable(preview)).toBe(true);

    const stored = await prisma.mailVideo.findUnique({ where: { id: "singleton" } });
    expect(stored?.kind).toBe("hosted");
    expect(stored?.url).toBe("https://vimeo.com/999888777");
    expect(stored?.posterGenerated).toBe(true);
  }, 60_000);

  it("le retrait ramène l'écran à son état vide", async () => {
    const panel = session.page.locator("section", { hasText: "Vidéo de démonstration" }).first();
    const remove = panel.getByRole("button", { name: /Retirer la vidéo/ });
    await remove.scrollIntoViewIfNeeded();
    await remove.click();

    await panel.locator('img[src^="/api/video/"]').waitFor({ state: "detached", timeout: 15_000 });
    expect(await prisma.mailVideo.findUnique({ where: { id: "singleton" } })).toBeNull();
    expect(session.errors).toEqual([]);
  }, 60_000);
});
