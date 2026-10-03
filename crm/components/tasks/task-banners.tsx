import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { bannerText, type TaskBanners as Counts } from "@/lib/domain/task-tabs";

/**
 * **Ce qui n'est pas une tâche, en une ligne chacun.**
 *
 * Trois onglets du jalon 92 deviennent trois bandeaux : les départs prêts à
 * partir, les réponses à traiter, les prospects chauds. Chacun **mène là où le
 * travail se fait** plutôt que de le reproduire ici — la file des départs, le
 * journal des réponses, le vivier filtré. Valider un brouillon à deux endroits
 * différents ferait deux jeux de garde-fous, et c'est toujours le second qui
 * oublie la fiche passée en « Perdu » (jalons 85, 92).
 *
 * **Un bandeau à zéro ne s'affiche pas.** Une ligne « 0 mail prêt à partir »
 * permanente est du bruit, et l'on cesse alors de lire celle qui compte
 * (jalon 62). La décision est prise dans le domaine, pas ici : `bannerText()`
 * rend `null`, et c'est aussi ce qui la rend testable sans navigateur.
 *
 * Composant **serveur** : trois liens et trois nombres n'ont aucun état, donc
 * aucun JavaScript n'a à partir pour eux.
 */
export function TaskBanners({ counts }: { readonly counts: Counts }) {
  const text = bannerText(counts);
  if (text.sends === null && text.replies === null && text.hot === null) return null;

  return (
    <div className="mb-4 grid gap-2">
      {text.sends !== null && (
        <Banner
          mark="sends"
          tone="brand"
          icon="arrow"
          label={text.sends}
          href="/departs"
          action="Départs du jour"
        />
      )}
      {text.replies !== null && (
        <Banner
          mark="replies"
          tone="gold"
          icon="mail"
          label={text.replies}
          /*
            Le journal des envois, filtré sur ceux qui ont reçu une réponse : la
            lecture existante du jalon 39, pas une seconde liste.
          */
          href="/emails?etat=repondu"
          action="Voir les réponses"
        />
      )}
      {text.hot !== null && (
        <Banner
          mark="hot"
          tone="win"
          icon="deal"
          label={text.hot}
          /*
            **Le même compte et la même liste** : `readHotProspects()` sert le
            nombre affiché ici et la clause de `/contacts?chauds=1`. Un lien qui
            annoncerait vingt prospects et en ouvrirait dix-huit ferait cesser de
            croire les deux (jalon 49).
          */
          href="/contacts?chauds=1&lifecycle=all"
          action="Voir"
        />
      )}
    </div>
  );
}

const TONES = {
  brand: "border-brand bg-brand-l text-brand-d",
  gold: "border-gold bg-gold-l text-ink",
  win: "border-win bg-win-l text-win-d",
} as const;

function Banner({
  mark,
  tone,
  icon,
  label,
  href,
  action,
}: {
  readonly mark: string;
  readonly tone: keyof typeof TONES;
  readonly icon: "arrow" | "mail" | "deal";
  readonly label: string;
  readonly href: string;
  readonly action: string;
}) {
  return (
    <div
      data-banner={mark}
      className={`flex flex-wrap items-center gap-2.5 rounded-card border px-3.5 py-2.5 text-[13px] font-semibold ${TONES[tone]}`}
    >
      <Icon name={icon} size={15} />
      <span>{label}</span>
      <Link
        href={href}
        className="ml-auto inline-flex min-h-[44px] items-center gap-1 rounded-control border border-current/30 bg-surface/70 px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-surface lg:min-h-0"
      >
        {action}
        <Icon name="arrow" size={13} />
      </Link>
    </div>
  );
}
