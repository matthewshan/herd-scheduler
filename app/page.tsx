import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canCreatePolls, isOwnerEmail } from "@/lib/access";
import { listPollsForCreator } from "@/lib/polls";
import { CreatorHome, type CreatorHomeVariant } from "./CreatorHome";

// First name only — the voice addresses people by first name (design guide).
function firstName(name: string | null, email: string): string {
  if (name?.trim()) {
    return name.trim().split(/\s+/)[0];
  }
  return email.split("@")[0];
}

// Resolve the owner's first name for the non-creator "ask {owner}" copy. Falls
// back to a neutral noun when the owner hasn't signed in yet (no User row/name).
async function ownerFirstName(): Promise<string> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    return "the host";
  }
  const owner = await prisma.user.findFirst({
    where: { email: { equals: ownerEmail, mode: "insensitive" } },
    select: { name: true },
  });
  return owner?.name?.trim() ? firstName(owner.name, ownerEmail) : "the host";
}

// Creator home (Phase 7.5): the signed-in host's landing screen — the polls they
// created, newest first. Replaces the Phase 1 scaffold. Signed-out visitors are
// sent to sign-in.
export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/signin");
  }

  const isOwner = user.isOwner || isOwnerEmail(user.email);
  const mayCreate = await canCreatePolls(user.email);

  let variant: CreatorHomeVariant;
  let polls = [] as Awaited<ReturnType<typeof listPollsForCreator>>;
  let ownerName = "the host";

  if (!mayCreate) {
    variant = "noncreator";
    ownerName = await ownerFirstName();
  } else {
    polls = await listPollsForCreator(user.id);
    variant = polls.length === 0 ? "empty" : "list";
  }

  return (
    <CreatorHome
      firstName={firstName(user.name ?? null, user.email)}
      isOwner={isOwner}
      variant={variant}
      ownerName={ownerName}
      polls={polls}
    />
  );
}
