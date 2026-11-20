// Owner bootstrap (spec §5, Phase 4). Idempotent — safe to run on every deploy.
// Seeds OWNER_EMAIL onto the AllowedCreator list and syncs the informational
// isOwner mirror (set on the owner's row, cleared on any former owner's).
// (A fresh owner who hasn't signed in yet has no User row;
// the sign-in event in auth.ts sets isOwner on first login, so order doesn't
// matter.)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ownerRaw = process.env.OWNER_EMAIL;
  if (!ownerRaw) {
    console.log("[seed] OWNER_EMAIL not set — nothing to seed.");
    return;
  }
  const email = ownerRaw.trim().toLowerCase();

  await prisma.allowedCreator.upsert({
    where: { email },
    create: { email, addedBy: "system:seed" },
    update: {},
  });

  // isOwner is an informational mirror of OWNER_EMAIL (authorization reads
  // OWNER_EMAIL directly), so keep it exact: set it on the owner's row and clear
  // it on any former owner's row left over from a previous OWNER_EMAIL.
  const ownerMatch = { email: { equals: email, mode: "insensitive" as const } };
  const updated = await prisma.user.updateMany({
    where: ownerMatch,
    data: { isOwner: true },
  });
  const cleared = await prisma.user.updateMany({
    where: { isOwner: true, NOT: ownerMatch },
    data: { isOwner: false },
  });

  console.log(
    `[seed] owner ${email} allowlisted; isOwner set on ${updated.count} existing user row(s), cleared on ${cleared.count} former owner row(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
