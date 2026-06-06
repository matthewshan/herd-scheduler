// Owner bootstrap (spec §5, Phase 4). Idempotent — safe to run on every deploy.
// Seeds OWNER_EMAIL onto the AllowedCreator list and flags the User row as owner
// if it already exists. (A fresh owner who hasn't signed in yet has no User row;
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

  const updated = await prisma.user.updateMany({
    where: { email },
    data: { isOwner: true },
  });

  console.log(
    `[seed] owner ${email} allowlisted; isOwner set on ${updated.count} existing user row(s).`,
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
