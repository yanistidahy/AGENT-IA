/**
 * Doublure de `server-only` pour les tests.
 *
 * Le vrai paquet lève à l'import dès qu'il est chargé hors d'un composant
 * serveur, ce qui rend intestable tout module marqué « serveur uniquement ».
 * La garde réelle n'est pas affaiblie pour autant : elle s'applique au build
 * Next, et `no-key-in-bundle.test.ts` vérifie la sortie de build — c'est-à-dire
 * le résultat, pas l'intention.
 */
export {};
