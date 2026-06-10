/*
  Warnings:

  - A unique constraint covering the columns `[pollId,guestKey]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Participant_pollId_guestName_key";

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "guestKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Participant_pollId_guestKey_key" ON "Participant"("pollId", "guestKey");
