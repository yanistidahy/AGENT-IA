import type { OpenAudit } from "@/lib/api/open-audit";

/**
 * Les chargements de pixel, tels quels.
 *
 * **Un taux d'ouverture ne se discute pas sans ses lignes.** Ce panneau existe
 * pour la question « les 87 % sont-ils réels ? » : il montre combien de
 * chargements ont eu lieu, à quelle distance de l'envoi, combien ont été
 * écartés et pourquoi, et surtout **combien d'envois ne peuvent pas être
 * audités du tout** parce qu'ils datent d'avant le tri.
 *
 * Composant serveur : rien de tout cela n'a besoin du navigateur, et le
 * détail ne traverse donc jamais la frontière client.
 */

const KIND_LABELS: Record<string, string> = {
  counted: "Comptés",
  burst: "Rafales écartées",
  delivery: "Chargements à la livraison écartés",
};

function delay(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86_400)} j`;
}

export function OpenAuditPanel({ audit }: { readonly audit: OpenAudit }) {
  const total = audit.byKind.counted + audit.byKind.burst + audit.byKind.delivery;

  return (
    <div className="rounded-card border border-line bg-paper p-4">
      <h3 className="font-display text-[13.5px] font-semibold text-ink">
        Ce que valent les ouvertures
      </h3>
      <p className="mt-1 text-[12px] text-muted">
        Sur {audit.windowDays} jours : {audit.tracked} envoi
        {audit.tracked > 1 ? "s" : ""} suivi{audit.tracked > 1 ? "s" : ""}, {total} chargement
        {total > 1 ? "s" : ""} du pixel enregistré{total > 1 ? "s" : ""} ligne à ligne. Aucune
        adresse IP, aucun agent utilisateur : un chargement, c'est un envoi et un instant.
      </p>

      {audit.unclassified > 0 && (
        <p className="mt-2 rounded-card bg-gold-l px-3 py-2 text-[12px] text-[#9A6410]">
          <b className="font-semibold">
            {audit.unclassified} envoi{audit.unclassified > 1 ? "s" : ""} ne peu
            {audit.unclassified > 1 ? "vent" : "t"} pas être audité
            {audit.unclassified > 1 ? "s" : ""}.
          </b>{" "}
          {audit.unclassified > 1 ? "Leurs compteurs sont non nuls" : "Son compteur est non nul"}{" "}
          mais aucun chargement n'y est détaillé : {audit.unclassified > 1 ? "ils sont" : "il est"}{" "}
          antérieur{audit.unclassified > 1 ? "s" : ""} au tri. Ce chiffre n'est ni confirmé, ni
          infirmé — il ne doit pas être lu comme les autres.
        </p>
      )}

      <div className="mt-3 grid gap-2 @xl:grid-cols-3">
        {(["counted", "burst", "delivery"] as const).map((kind) => (
          <div key={kind} className="rounded-card border border-line-2 bg-surface-2 px-3 py-2">
            <div className="font-display text-[18px] font-semibold text-ink">
              {audit.byKind[kind]}
            </div>
            <div className="text-[11.5px] text-muted">{KIND_LABELS[kind]}</div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11.5px] text-muted">
        {audit.noiseRate === null
          ? "Aucun chargement classé : rien à écarter, rien à confirmer."
          : `${Math.round(audit.noiseRate * 100)} % des chargements classés ont été écartés.`}{" "}
        Est écarté ce qui arrive moins de {audit.deliveryWindowSeconds} s après l'envoi — un
        relais ou un antivirus, pas une lecture — et ce qui suit un chargement précédent de moins
        de {audit.burstWindowSeconds} s, c'est-à-dire le même client qui recharge l'image.
      </p>

      <div className="mt-3">
        <h4 className="font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase">
          Délai entre l'envoi et le chargement
        </h4>
        <ul className="mt-1 space-y-1">
          {audit.delays.map((bucket) => (
            <li key={bucket.label} className="flex items-center gap-2 text-[11.5px]">
              <span className="w-[110px] shrink-0 text-muted">{bucket.label}</span>
              <span
                className="h-[8px] rounded-full bg-brand"
                style={{ width: `${total === 0 ? 0 : Math.round((bucket.count / total) * 220)}px` }}
              />
              <span className="text-muted">{bucket.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {audit.rows.length > 0 && (
        <div className="mt-3 max-h-[32vh] overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Quand", "Après l'envoi", "Verdict", "Message"].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="border-b border-line px-2 py-1 text-left font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((row, index) => (
                <tr key={`${row.at.toISOString()}-${index}`}>
                  <td className="border-b border-line-2 px-2 py-1 text-[11px] text-muted">
                    {row.at.toLocaleString("fr-FR")}
                  </td>
                  <td className="border-b border-line-2 px-2 py-1 text-[11px] text-muted">
                    {delay(row.delaySeconds)}
                  </td>
                  <td className="border-b border-line-2 px-2 py-1 text-[11px] text-muted">
                    {KIND_LABELS[row.kind] ?? row.kind}
                  </td>
                  <td className="max-w-[26ch] truncate border-b border-line-2 px-2 py-1 text-[11px] text-muted">
                    {row.contactName} · {row.subject}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
