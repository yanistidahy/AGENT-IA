"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraîchit « Départs du jour » tant qu'une composition tourne.
 *
 * **Sans lui, « la file se remplit à mesure » serait un vœu** : la page est
 * rendue par le serveur, donc elle ne montre que l'état du chargement. On
 * ouvrirait la file pendant la composition, on y verrait un brouillon, et il
 * faudrait deviner qu'il faut recharger — exactement le genre de silence que ce
 * jalon supprime.
 *
 * Trois secondes : assez rare pour ne peser sur rien, assez fréquent pour que
 * les lignes apparaissent au rythme où elles sont écrites (un appel au modèle
 * par personne, quelques secondes chacun).
 *
 * **Il s'arrête tout seul** dès qu'aucun travail ne tourne : un rafraîchissement
 * perpétuel ferait clignoter une page qu'on est en train de lire, et rendrait
 * la validation en lot désagréable.
 */
export function CompositionRefresh({ running }: { readonly running: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [running, router]);

  return null;
}
