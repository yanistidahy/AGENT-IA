import { describeUptime, type DeployInfo } from "@/lib/deploy-info";

/**
 * **Quel code sert cet écran, et depuis quand.**
 *
 * Ce bloc existe pour une raison précise, payée deux fois : entre « la fusion
 * n'est pas déployée » et « la fusion est déployée et quelque chose ne s'affiche
 * pas », l'écran est **exactement le même**. Les deux se diagnostiquent en
 * comparant un commit et une heure — encore faut-il pouvoir les lire sans
 * ouvrir un tableau de bord tiers.
 *
 * Il ne rend que des faits lus dans l'environnement du processus : aucun d'eux
 * n'est déduit, et rien n'est affiché quand la variable est absente. Un « — »
 * ici veut dire « Railway ne l'a pas injectée », ce qui est une information en
 * soi : hors Railway, il n'y a pas de déploiement à identifier.
 *
 * Composant **serveur** : ces valeurs viennent de `process.env`, qui n'existe
 * pas dans le navigateur. Les faire traverser un composant client n'apporterait
 * rien et ferait voyager l'identité du déploiement dans la charge utile RSC.
 */
export function DeployCard({ deploy, now }: { readonly deploy: DeployInfo; readonly now: Date }) {
  const rows: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
    { label: "Commit", value: deploy.commitFull ?? "—" },
    { label: "Branche", value: deploy.branch ?? "—" },
    { label: "Service", value: deploy.service ?? "—" },
    { label: "Environnement", value: deploy.environment ?? "—" },
    { label: "Déploiement", value: deploy.deploymentId ?? "—" },
    {
      label: "Démarré",
      value: `${deploy.startedAt.toLocaleString("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      })} — ${describeUptime(deploy.startedAt, now)}`,
    },
  ];

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="mb-3 text-[12px] text-muted">
        Comparez ce commit à celui de la tête de <code className="font-mono">main</code>. S'ils
        diffèrent, le déploiement est en retard — un déploiement en échec laisse le précédent
        en ligne, sans que rien d'autre ne le signale. S'ils sont identiques, le code que vous
        regardez est bien celui que vous avez fusionné, et un écran inattendu est un défaut.
      </p>

      <dl className="grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-[max-content_1fr]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted">{row.label}</dt>
            <dd className="font-mono text-[12px] break-all">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
