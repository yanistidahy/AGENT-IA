-- Jalon 77 : des listes de contacts nommées, constituées à la main.
--
-- Aucune donnée existante n'est touchée : deux tables neuves, et une relation
-- depuis `contacts` portée par la table de jointure. Rejouable sur une base
-- déjà migrée comme sur une base neuve.

CREATE TABLE "contact_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nameKey" TEXT,

    CONSTRAINT "contact_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_lists_nameKey_idx" ON "contact_lists"("nameKey");

CREATE TABLE "contact_list_members" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_list_members_pkey" PRIMARY KEY ("id")
);

-- L'unicité est une contrainte de base, pas une vérification applicative :
-- ajouter deux fois la même fiche à une liste devient impossible.
CREATE UNIQUE INDEX "contact_list_members_listId_contactId_key"
    ON "contact_list_members"("listId", "contactId");
CREATE INDEX "contact_list_members_contactId_idx" ON "contact_list_members"("contactId");

ALTER TABLE "contact_list_members"
    ADD CONSTRAINT "contact_list_members_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "contact_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_list_members"
    ADD CONSTRAINT "contact_list_members_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
