import { requireCreator } from "@/lib/auth";
import { CreateForm } from "./CreateForm";

export const metadata = {
  title: "New poll — Herd Scheduler",
};

export default async function CreatePage() {
  // Creator-gated chokepoint: redirects unauthenticated users to sign-in and
  // non-creators home before any of the form renders.
  await requireCreator();

  // A *provisional* "today" so SSR and hydration render the same calendar. The
  // server's clock is typically UTC (the image sets no TZ), so this can be a day
  // ahead of the host's local date; CreateForm re-anchors on the browser's local
  // date right after mount (store `syncToday`).
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
