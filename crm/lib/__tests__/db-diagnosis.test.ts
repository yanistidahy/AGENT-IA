import { describe, expect, it } from "vitest";
import { diagnose, errorCode } from "../db-diagnosis";

/**
 * Les erreurs simulées ici reproduisent les formes réellement observées avec
 * Prisma 6 : `code` sur les erreurs de requête, `errorCode` déclaré mais laissé
 * à `undefined` sur les erreurs d'initialisation, et le code présent seulement
 * dans le message — voire absent partout.
 */

function initializationError(message: string): Error {
  const error = new Error(message);
  error.name = "PrismaClientInitializationError";
  return Object.assign(error, { errorCode: undefined, clientVersion: "6.19.3" });
}

function requestError(code: string, message: string): Error {
  const error = new Error(message);
  error.name = "PrismaClientKnownRequestError";
  return Object.assign(error, { code, clientVersion: "6.19.3" });
}

describe("errorCode", () => {
  it("lit le code porté par une erreur de requête", () => {
    expect(errorCode(requestError("P2021", "The table does not exist"))).toBe("P2021");
  });

  it("extrait le code du message quand il y figure", () => {
    expect(errorCode(initializationError("Error: P1001: Can't reach database"))).toBe(
      "P1001",
    );
  });

  it("retombe sur le texte quand le code n'est nulle part — cas réel de P1001", () => {
    const message =
      "\nInvalid `p.stage.count()` invocation\n\nCan't reach database server at `db.railway.internal:5432`\n";
    expect(errorCode(initializationError(message))).toBe("P1001");
  });

  it("reconnaît un échec d'authentification sans code", () => {
    expect(errorCode(initializationError("Authentication failed against database"))).toBe(
      "P1000",
    );
  });

  it("ignore un `errorCode` déclaré mais indéfini plutôt que de le renvoyer", () => {
    const error = initializationError("panne réseau indéterminée");
    expect(Object.getOwnPropertyNames(error)).toContain("errorCode");
    expect(errorCode(error)).toBeNull();
  });

  it("ne casse pas sur ce qui n'est pas une erreur", () => {
    expect(errorCode(null)).toBeNull();
    expect(errorCode("boom")).toBeNull();
    expect(errorCode(undefined)).toBeNull();
  });
});

describe("diagnose", () => {
  it("distingue base injoignable et schéma absent — deux corrections opposées", () => {
    const unreachable = diagnose(
      initializationError("Can't reach database server at `db.railway.internal:5432`"),
    );
    const missingTables = diagnose(
      requestError("P2021", "The table `public.stages` does not exist"),
    );

    expect(unreachable.reason).toBe("Serveur PostgreSQL injoignable");
    expect(missingTables.reason).toBe("Tables absentes — migrations non appliquées");
    expect(unreachable.reason).not.toBe(missingTables.reason);
  });

  it("nomme l'authentification refusée", () => {
    expect(diagnose(requestError("P1000", "auth")).reason).toBe(
      "Authentification refusée par PostgreSQL",
    );
  });

  it("donne toujours un indice, même sur une erreur non reconnue", () => {
    const diagnosis = diagnose(new Error("quelque chose d'inattendu"));
    expect(diagnosis.reason).toBe("Error");
    expect(diagnosis.hint.length).toBeGreaterThan(0);
  });

  it("ne recopie jamais le message brut, qui contient l'hôte de la base", () => {
    const diagnosis = diagnose(
      initializationError(
        "Can't reach database server at `postgres.railway.internal:5432`",
      ),
    );
    expect(diagnosis.reason).not.toContain("railway.internal");
    expect(diagnosis.hint).not.toContain("railway.internal");
  });
});
