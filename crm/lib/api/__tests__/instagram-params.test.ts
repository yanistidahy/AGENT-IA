import { describe, expect, it } from "vitest";

import { listContactsQuerySchema } from "../contact-schemas";
import {
  INSTAGRAM_PRESETS,
  activePreset,
  presetParams,
} from "../../domain/instagram-filter";

/**
 * La puce écrit dans l'URL, le schéma la relit : ce sont deux fichiers, donc
 * deux occasions de ne pas s'accorder.
 *
 * Le défaut a eu lieu : la puce écrivait `compte`, le schéma lisait `account`.
 * Rien ne l'a signalé — un paramètre inconnu est **ignoré** par Zod, la liste
 * revenait entière, et la puce s'allumait quand même. Une puce active au-dessus
 * d'une liste non filtrée est exactement l'écran qui ment du jalon 31, en pire :
 * ici c'est la file de travail du matin qui affiche tout le portefeuille.
 *
 * D'où ce test, qui ne relit pas les noms mais fait **le tour complet** :
 * préréglage → paramètres → schéma → préréglage retrouvé.
 */
describe("les paramètres de la puce Instagram sont ceux que le schéma relit", () => {
  for (const preset of INSTAGRAM_PRESETS) {
    it(`« ${preset.label} » survit à l'aller-retour URL`, () => {
      const params = presetParams(preset);
      const parsed = listContactsQuerySchema.parse(
        Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== null),
        ),
      );

      // Ce que le schéma a retenu doit désigner le même préréglage, sans quoi
      // la puce s'allumerait sur un filtre que la requête n'applique pas.
      expect(parsed.account).toBe(preset.account);
      expect(parsed.dm).toBe(preset.dm);
      expect(activePreset(parsed.account, parsed.dm)?.key).toBe(preset.key);
    });
  }

  it("« Toutes les fiches » n'active aucun axe", () => {
    const params = presetParams(null);
    expect(params.account).toBeNull();
    expect(params.dm).toBeNull();
    expect(activePreset(undefined, undefined)).toBeNull();
  });

  it("choisir un état Instagram retire les puces de relance", () => {
    // Deux questions distinctes : choisir l'une ne doit pas laisser l'autre
    // active sans qu'on l'ait voulu.
    for (const preset of [null, ...INSTAGRAM_PRESETS]) {
      const params = presetParams(preset);
      expect(params.followUp).toBeNull();
      expect(params.incomplete).toBeNull();
    }
  });

  it("un état inconnu est refusé plutôt qu'ignoré", () => {
    expect(() =>
      listContactsQuerySchema.parse({ account: "peut-être" }),
    ).toThrow();
    expect(() => listContactsQuerySchema.parse({ dm: "bientôt" })).toThrow();
  });
});
