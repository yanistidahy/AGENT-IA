"use client";

/**
 * Les deux bandeaux du tiroir contact.
 *
 * Sortis pour tenir la limite de 250 lignes. Ils partagent une règle : un
 * avertissement qui annonce ce qu'une suppression conserve vaut mieux qu'une
 * confirmation qui ne dit rien.
 */
/* Les deux bandeaux du tiroir : l'avertissement de suppression, et l'échec. */
export function Notices({ confirming, error }: { confirming: boolean; error: string | null }) {
  return (
    <>
      {confirming && (
        <p className="mb-4 rounded-control border border-[#F0C9C2] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          Les affaires et interactions liées seront conservées, mais détachées. Les tâches de ce
          contact seront supprimées. Cliquez à nouveau sur « Supprimer » pour confirmer.
        </p>
      )}
      {error !== null && (
        <p className="mb-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
    </>
  );
}
