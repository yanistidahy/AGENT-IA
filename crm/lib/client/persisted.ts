"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Petits états qui survivent au rechargement.
 *
 * Un bloc replié qui se rouvre à chaque visite est un réglage qu'on refait
 * indéfiniment. Le stockage local suffit : c'est une préférence d'affichage,
 * propre au poste, sans valeur pour un autre appareil et sans intérêt pour la
 * base.
 *
 * **La valeur initiale est toujours celle du serveur.** Lire `localStorage` au
 * premier rendu produirait un HTML différent de celui rendu côté serveur, et
 * React signalerait une divergence d'hydratation. On lit donc après le montage,
 * dans un effet, et l'état stocké s'applique au second rendu.
 */
const PREFIX = "auraflow.";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    // Navigation privée, stockage plein, cookies bloqués : la préférence est
    // perdue, l'écran fonctionne. Jamais d'exception pour un pli de bloc.
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    /* voir `read` : une préférence non conservée n'est pas une panne. */
  }
}

/** Booléen conservé — l'état d'un bloc repliable, typiquement. */
export function usePersistedFlag(
  key: string,
  fallback: boolean,
): readonly [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    const stored = read(key);
    if (stored === "1" || stored === "0") setValue(stored === "1");
  }, [key]);

  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      write(key, next ? "1" : "0");
    },
    [key],
  );

  return [value, update];
}

/**
 * Ensemble de clés conservé — les sociétés repliées dans la file.
 *
 * Renvoie un `Set` en lecture seule : l'appelant bascule une clé, il ne mute
 * jamais la collection, sinon React ne verrait pas le changement.
 */
export function usePersistedSet(
  key: string,
): readonly [ReadonlySet<string>, (member: string) => void] {
  const [value, setValue] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const stored = read(key);
    if (stored === null) return;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setValue(new Set(parsed.filter((item): item is string => typeof item === "string")));
      }
    } catch {
      /* Valeur corrompue : on repart d'un ensemble vide plutôt que d'échouer. */
    }
  }, [key]);

  const toggle = useCallback(
    (member: string) => {
      setValue((current) => {
        const next = new Set(current);
        if (next.has(member)) next.delete(member);
        else next.add(member);
        write(key, JSON.stringify([...next]));
        return next;
      });
    },
    [key],
  );

  return [value, toggle];
}

/**
 * Valeur textuelle conservée — l'accusé de réception d'un bandeau, par exemple.
 *
 * `null` tant que le stockage n'a pas été lu, ce qui permet à l'appelant de
 * distinguer « pas encore lu » de « rien de stocké » et d'éviter un
 * clignotement au montage.
 */
export function usePersistedValue(
  key: string,
): readonly [string | null, boolean, (next: string) => void] {
  const [value, setValue] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setValue(read(key));
    setLoaded(true);
  }, [key]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      write(key, next);
    },
    [key],
  );

  return [value, loaded, update];
}
