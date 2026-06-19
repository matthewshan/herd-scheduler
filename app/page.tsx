import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canCreatePolls, isOwnerEmail } from "@/lib/access";
import { listPollsForCreator, listPollsJoined } from "@/lib/polls";
import { CreatorHome } from "./CreatorHome";
import { GuestHome } from "./GuestHome";
import { SignInScreen } from "./SignInScreen";

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

// Home (Phase 8 + 12). Signed-out visitors get the guest landing — the polls
// they've opened on this device — instead of a forced redirect. Signed-in users
// get their tabbed home: polls they created ("Your polls") and polls they voted
// in elsewhere ("Joined"); a non-creator sees the Joined list on its own.
export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    // A guest with looked-at polls sees that list; one with none falls back to
    // the sign-in screen (decided client-side from localStorage by GuestHome).
    return <GuestHome signInScreen={<SignInScreen />} />;
  }

  const isOwner = user.isOwner || isOwnerEmail(user.email);
  const mayCreate = await canCreatePolls(user.email);

  const [created, joined] = await Promise.all([
    mayCreate ? listPollsForCreator(user.id) : Promise.resolve([]),
    listPollsJoined(user.id),
  ]);
  const ownerName = mayCreate ? "the host" : await ownerFirstName();

  return (
    <CreatorHome
      firstName={firstName(user.name ?? null, user.email)}
      isOwner={isOwner}
      mayCreate={mayCreate}
      ownerName={ownerName}
      created={created}
      joined={joined}
    />
  );
}
