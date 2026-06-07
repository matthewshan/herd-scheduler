import Link from "next/link";
import { redirect } from "next/navigation";
import { Cat } from "lucide-react";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui";

export const metadata = {
  title: "Sign in — Herd Scheduler",
};

// Google's "G" — lucide has no brand logo, so inline the multi-color mark.
function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[390px] flex-col items-center justify-center gap-2 px-7 text-center">
      <div
        className="mb-2 flex h-16 w-16 items-center justify-center rounded-[20px] bg-brand-tint text-brand"
        role="img"
        aria-label="Herd Scheduler"
      >
        <Cat size={34} />
      </div>
      <h1 className="ds-display text-[26px]">Herd Scheduler</h1>
      <p className="ds-body mt-1 text-[15px] text-fg2">
        Find a night the whole herd can make — no group-chat chaos.
      </p>

      <div className="mt-4 w-full">
        <form action={signInWithGoogle}>
          <Button type="submit" variant="ghost" block>
            <GoogleG size={20} />
            Continue with Google
          </Button>
        </form>
        <Link
          href="/"
          className="mt-5 inline-flex w-full justify-center font-body text-[14px] font-medium text-brand hover:underline"
        >
          Just voting? Continue as guest
        </Link>
      </div>
    </main>
  );
}
