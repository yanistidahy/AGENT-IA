import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests des gestionnaires de route.
 *
 * La couche service est simulée : ce qui est vérifié ici, c'est le contrat HTTP
 * — codes de statut, forme des erreurs, absence de fuite. Les règles métier
 * (pondération, transitions d'étape) sont couvertes dans `lib/domain` et ne sont
 * pas retestées.
 */

const listDeals = vi.fn();
const createDeal = vi.fn();
const getDeal = vi.fn();
const updateDeal = vi.fn();
const moveDealStage = vi.fn();

vi.mock("@/lib/api/deals", () => ({
  listDeals: (...args: unknown[]) => listDeals(...args),
  createDeal: (...args: unknown[]) => createDeal(...args),
  getDeal: (...args: unknown[]) => getDeal(...args),
  updateDeal: (...args: unknown[]) => updateDeal(...args),
  moveDealStage: (...args: unknown[]) => moveDealStage(...args),
  DEAL_STATUS_FILTERS: [],
}));

const { GET, POST } = await import("../route");
const { GET: GET_ONE, PATCH } = await import("../[id]/route");
const { POST: MOVE } = await import("../[id]/move-stage/route");

const FAKE_DEAL = { id: "d1", name: "Test", amount: 1000 };

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/deals", () => {
  it("transmet les filtres validés au service", async () => {
    listDeals.mockResolvedValue([FAKE_DEAL]);
    const request = new Request("http://x/api/deals?status=won&owner=Yanis");

    // NextRequest accepte une Request standard en entrée.
    const { NextRequest } = await import("next/server");
    const response = await GET(new NextRequest(request));

    expect(response.status).toBe(200);
    expect(listDeals).toHaveBeenCalledWith({ status: "won", owner: "Yanis" });
    await expect(response.json()).resolves.toEqual({ deals: [FAKE_DEAL], total: 1 });
  });

  it("refuse un filtre de statut inconnu avec le détail du champ", async () => {
    const { NextRequest } = await import("next/server");
    const response = await GET(new NextRequest(new Request("http://x/api/deals?status=nope")));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(Object.keys(body.error.fields)).toContain("status");
    expect(listDeals).not.toHaveBeenCalled();
  });
});

describe("POST /api/deals", () => {
  it("crée l'affaire et répond 201", async () => {
    createDeal.mockResolvedValue(FAKE_DEAL);
    const { NextRequest } = await import("next/server");
    const response = await POST(
      new NextRequest(
        post("http://x/api/deals", {
          name: "Nouvelle",
          amount: 1000,
          stageId: "s1",
          owner: "Yanis",
        }),
      ),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ deal: FAKE_DEAL });
  });

  it("renvoie 400 et les erreurs par champ sur une charge invalide", async () => {
    const { NextRequest } = await import("next/server");
    const response = await POST(
      new NextRequest(post("http://x/api/deals", { name: "", amount: -5 })),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.fields.name).toBeDefined();
    expect(body.error.fields.amount).toBeDefined();
    expect(createDeal).not.toHaveBeenCalled();
  });

  it("renvoie 400 sur un corps JSON illisible, pas 500", async () => {
    const { NextRequest } = await import("next/server");
    const response = await POST(new NextRequest(post("http://x/api/deals", "{cassé")));
    expect(response.status).toBe(400);
  });

  it("ne laisse jamais fuiter une trace d'exécution", async () => {
    createDeal.mockRejectedValue(
      new Error("Can't reach database server at postgres.railway.internal:5432"),
    );
    const { NextRequest } = await import("next/server");
    const response = await POST(
      new NextRequest(
        post("http://x/api/deals", {
          name: "X",
          amount: 1,
          stageId: "s1",
          owner: "Yanis",
        }),
      ),
    );

    expect(response.status).toBe(500);
    const raw = JSON.stringify(await response.json());
    expect(raw).not.toContain("railway.internal");
    expect(raw).not.toContain("Error:");
  });
});

describe("GET et PATCH /api/deals/[id]", () => {
  it("répond 404 quand l'affaire n'existe pas", async () => {
    getDeal.mockResolvedValue(null);
    const response = await GET_ONE(new Request("http://x"), params("absente"));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });

  it("met à jour et renvoie l'affaire", async () => {
    updateDeal.mockResolvedValue(FAKE_DEAL);
    const request = new Request("http://x", {
      method: "PATCH",
      body: JSON.stringify({ amount: 4200 }),
    });
    const response = await PATCH(request, params("d1"));

    expect(response.status).toBe(200);
    expect(updateDeal).toHaveBeenCalledWith("d1", { amount: 4200 });
  });

  it("refuse une mise à jour vide", async () => {
    const request = new Request("http://x", { method: "PATCH", body: "{}" });
    const response = await PATCH(request, params("d1"));

    expect(response.status).toBe(400);
    expect(updateDeal).not.toHaveBeenCalled();
  });
});

describe("POST /api/deals/[id]/move-stage", () => {
  it("déplace l'affaire", async () => {
    moveDealStage.mockResolvedValue({ ok: true, deal: FAKE_DEAL });
    const response = await MOVE(post("http://x", { stageId: "s6" }), params("d1"));

    expect(response.status).toBe(200);
    expect(moveDealStage).toHaveBeenCalledWith("d1", "s6");
  });

  it("distingue affaire introuvable et étape introuvable", async () => {
    moveDealStage.mockResolvedValue({ ok: false, reason: "stage_not_found" });
    const response = await MOVE(post("http://x", { stageId: "fantome" }), params("d1"));

    expect(response.status).toBe(404);
    expect((await response.json()).error.message).toBe("Étape introuvable.");
  });

  it("exige une étape cible", async () => {
    const response = await MOVE(post("http://x", {}), params("d1"));
    expect(response.status).toBe(400);
    expect(moveDealStage).not.toHaveBeenCalled();
  });
});
