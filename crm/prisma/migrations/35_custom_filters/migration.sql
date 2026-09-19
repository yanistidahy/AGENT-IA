-- Jalon 79 : les listes nommées deviennent des « filtres personnalisés », dans
-- /contacts même.
--
-- Les deux tables du jalon 77 sont **supprimées avec leurs données**, sur
-- décision explicite du propriétaire du produit : rien à reprendre, on repart
-- propre. Le concept ne change pas — un groupe nommé, constitué à la main, qui
-- ne bouge que quand quelqu'un le change — seule sa place dans le produit
-- change, et avec elle son vocabulaire.

DROP TABLE IF EXISTS "contact_list_members";
DROP TABLE IF EXISTS "contact_lists";

CREATE TABLE "custom_filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nameKey" TEXT,

    CONSTRAINT "custom_filters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_filters_nameKey_idx" ON "custom_filters"("nameKey");

CREATE TABLE "custom_filter_members" (
    "id" TEXT NOT NULL,
    "filterId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_filter_members_pkey" PRIMARY KEY ("id")
);

-- L'unicité est une contrainte de base, pas une vérification applicative :
-- ajouter deux fois la même fiche à un filtre devient impossible.
CREATE UNIQUE INDEX "custom_filter_members_filterId_contactId_key"
    ON "custom_filter_members"("filterId", "contactId");
CREATE INDEX "custom_filter_members_contactId_idx" ON "custom_filter_members"("contactId");

ALTER TABLE "custom_filter_members"
    ADD CONSTRAINT "custom_filter_members_filterId_fkey"
    FOREIGN KEY ("filterId") REFERENCES "custom_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "custom_filter_members"
    ADD CONSTRAINT "custom_filter_members_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
