import { requireCreator } from "@/lib/auth";
import { CreateForm } from "./CreateForm";

export const metadata = {
  title: "New poll — Herd Scheduler",
};

export default async function CreatePage() {
  // Creator-gated chokepoint: redirects unauthenticated users to sign-in and
  // non-creators home before any of the form renders.
  await requireCreator();

  // Open the calendar on the current month, computed server-side so the client
  // form hydrates against a stable value (no new Date() drift).
  const now = new Date();

  return (
    <div className="flex min-h-screen flex-col">
      <CreateForm
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth()}
        initialDay={now.getDate()}
      />
    </div>
  );
}
