import { escapeHtml, formatAmount, type SubscriptionStatus } from "@/lib/domain/subscriptions";
import type { PublicView } from "@/lib/api/subscriptions";

/**
 * La page que voit le client qui ouvre son lien.
 *
 * Écrite en HTML direct plutôt qu'en composant : elle est servie par une route
 * publique, hors de la coquille du CRM (pas de rail, pas de session), et ne doit
 * tirer aucun JavaScript. Toute valeur venue de la base passe par `escapeHtml` —
 * le nom d'une société vient d'un import de tableur.
 */

type Notice = "none" | "returned" | "error";

function shell(title: string, body: string, refreshSeconds?: number): string {
  const refresh =
    refreshSeconds === undefined ? "" : `<meta http-equiv="refresh" content="${refreshSeconds}">`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
${refresh}
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px;
         background: #F5F6FA; color: #0D1220; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { width: 100%; max-width: 440px; background: #fff; border: 1px solid #DEE0EA; border-radius: 16px; padding: 32px 28px; }
  h1 { margin: 0 0 4px; font-size: 22px; line-height: 1.25; }
  p { margin: 12px 0 0; }
  .muted { color: #6B7192; font-size: 14px; }
  .price { margin: 20px 0 4px; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; }
  .price small { font-size: 16px; font-weight: 500; color: #6B7192; }
  ul { margin: 16px 0 0; padding-left: 20px; color: #161C2E; font-size: 15px; }
  li + li { margin-top: 6px; }
  button { margin-top: 24px; width: 100%; padding: 14px 18px; border: 0; border-radius: 10px;
           background: #4B3FE4; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  button:hover { background: #3A2FC7; }
  button:focus-visible { outline: 3px solid #A9A2F5; outline-offset: 2px; }
  .note { margin-top: 16px; padding: 12px 14px; border-radius: 10px; background: #EFEDFF; color: #3A2FC7; font-size: 14px; }
  .error { background: #FDECEC; color: #9B1C1C; }
  .ok { background: #DFF3EF; color: #0B7A68; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>`;
}

function amountLine(view: PublicView): string {
  return `<div class="price">${escapeHtml(formatAmount(view.amountCents))} <small>/ mois</small></div>`;
}

export function renderPayablePage(view: PublicView, token: string, notice: Notice): string {
  const message =
    notice === "error"
      ? `<div class="note error" role="alert">Le paiement n'a pas pu démarrer. Réessayez dans un instant.</div>`
      : notice === "returned"
        ? `<div class="note" role="status">Votre paiement n'a pas été finalisé. Vous pouvez reprendre ci-dessous.</div>`
        : "";
  return shell(
    "Votre abonnement",
    `<h1>${escapeHtml(view.label)}</h1>
<p class="muted">Pour ${escapeHtml(view.companyName)}</p>
${amountLine(view)}
<ul>
  <li>Le premier mois est réglé maintenant.</li>
  <li>Le prélèvement se renouvelle ensuite chaque mois, automatiquement.</li>
  <li>Vous pouvez demander l'arrêt à tout moment.</li>
</ul>
${message}
<form method="post" action="/api/abonnement/${escapeHtml(token)}">
  <button type="submit">Payer et activer l'abonnement</button>
</form>
<p class="muted">Paiement sécurisé par Mollie. Aucune donnée bancaire ne transite par nos serveurs.</p>`,
  );
}

/** Le paiement est parti, la confirmation de Mollie n'est pas encore arrivée. */
export function renderConfirmingPage(view: PublicView): string {
  return shell(
    "Confirmation en cours",
    `<h1>Confirmation en cours…</h1>
<p>Nous attendons la confirmation de votre paiement pour ${escapeHtml(view.companyName)}. Cette page se met à jour toute seule.</p>
<p class="muted">Si rien ne change au bout de quelques minutes, votre paiement n'a peut-être pas abouti : vous pouvez rouvrir ce lien.</p>`,
    5,
  );
}

export function renderActivePage(view: PublicView): string {
  return shell(
    "Abonnement actif",
    `<h1>Merci, c'est activé</h1>
<div class="note ok" role="status">L'abonnement de ${escapeHtml(view.companyName)} est actif.</div>
${amountLine(view)}
<p class="muted">Le prochain prélèvement aura lieu dans un mois. Vous pouvez fermer cette page.</p>`,
  );
}

function closedMessage(status: SubscriptionStatus): string {
  return status === "canceled"
    ? "Ce lien n'est plus valable. Si vous pensez que c'est une erreur, contactez la personne qui vous l'a envoyé."
    : "Cet abonnement est déjà en cours.";
}

export function renderClosedPage(status: SubscriptionStatus): string {
  return shell("Lien indisponible", `<h1>Lien indisponible</h1><p>${escapeHtml(closedMessage(status))}</p>`);
}

export function renderUnknownPage(): string {
  return shell(
    "Lien introuvable",
    `<h1>Lien introuvable</h1><p>Ce lien n'existe pas ou n'est plus valable.</p>`,
  );
}
