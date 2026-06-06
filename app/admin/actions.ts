"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { isOwnerEmail, logAction, normalizeEmail } from "@/lib/access";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(formData: FormData): string | null {
  const raw = formData.get("email");
  if (typeof raw !== "string") return null;
  const email = normalizeEmail(raw);
  return EMAIL_RE.test(email) ? email : null;
}

export async function addCreator(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const email = readEmail(formData);
  if (!email) return;

  await prisma.allowedCreator.upsert({
    where: { email },
    create: { email, addedBy: owner.email },
    update: {},
  });
  await logAction({
    action: "creator.add",
    actorUserId: owner.id,
    actorEmail: owner.email,
    targetType: "email",
    targetId: email,
  });
  revalidatePath("/admin");
}

export async function removeCreator(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const email = readEmail(formData);
  if (!email) return;
  // Never strip the owner's own creator rights.
  if (isOwnerEmail(email)) return;

  await prisma.allowedCreator.deleteMany({ where: { email } });
  await logAction({
    action: "creator.remove",
    actorUserId: owner.id,
    actorEmail: owner.email,
    targetType: "email",
    targetId: email,
  });
  revalidatePath("/admin");
}

export async function blockEmail(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const email = readEmail(formData);
  if (!email) return;
  // The owner can never be locked out.
  if (isOwnerEmail(email)) return;

  const reasonRaw = formData.get("reason");
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim() : null;

  await prisma.blockedEmail.upsert({
    where: { email },
    create: { email, reason, blockedBy: owner.email },
    update: { reason },
  });
  await logAction({
    action: "email.block",
    actorUserId: owner.id,
    actorEmail: owner.email,
    targetType: "email",
    targetId: email,
    metadata: reason ? { reason } : undefined,
  });
  revalidatePath("/admin");
}

export async function unblockEmail(formData: FormData): Promise<void> {
  const owner = await requireOwner();
  const email = readEmail(formData);
  if (!email) return;

  await prisma.blockedEmail.deleteMany({ where: { email } });
  await logAction({
    action: "email.unblock",
    actorUserId: owner.id,
    actorEmail: owner.email,
    targetType: "email",
    targetId: email,
  });
  revalidatePath("/admin");
}
