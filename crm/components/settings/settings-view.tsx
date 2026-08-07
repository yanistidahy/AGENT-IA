"use client";

import { useRouter } from "next/navigation";
import { SequenceEditor, type SequenceEditable } from "./sequence-editor";

/**
 * Réglages — jalon 4 : les séquences.
 *
 * Les étapes du pipeline, les listes éditables, les seuils d'alerte et la
 * sauvegarde JSON arrivent au jalon 5. L'écran le dit plutôt que d'afficher des
 * sections vides.
 */
export function SettingsView({ sequences }: { sequences: readonly SequenceEditable[] }) {
  const router = useRouter();

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Réglages</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {sequences.length} séquences · lancez-les depuis la fiche d'un contact, d'une
          société ou d'une affaire
        </p>
      </header>

      <h2 className="mb-2.5 font-display text-sm font-semibold">Séquences</h2>
      <div className="grid gap-3">
        {sequences.map((sequence) => (
          <SequenceEditor
            key={sequence.id}
            sequence={sequence}
            onSaved={() => router.refresh()}
          />
        ))}
      </div>

      <p className="mt-6 rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Étapes du pipeline, listes éditables (propriétaires, offres, sources), seuils
        d'alerte et sauvegarde JSON arrivent au jalon 5.
      </p>
    </div>
  );
}
