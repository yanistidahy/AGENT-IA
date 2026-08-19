-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "objectifAppelsSemaine" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "objectifEmailsSemaine" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "relanceApresLinkedin" INTEGER NOT NULL DEFAULT 4;

