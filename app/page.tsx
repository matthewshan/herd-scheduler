import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();

  // Prove the DB wire end-to-end: touch the placeholder model. The full
  // schema and real screens land in later phases.
  let dbStatus = "unknown";
  try {
    await prisma.healthCheck.count();
    dbStatus = "connected";
  } catch {
    dbStatus = "unreachable";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Herd Scheduler</h1>
        <p className="text-sm text-gray-500">
          Scaffold is up. Real screens arrive in later phases.
        </p>
      </header>

      <section className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
        <p className="text-sm">
          Database: <span className="font-medium">{dbStatus}</span>
        </p>
        {session?.user ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">
              Signed in as{" "}
              <span className="font-medium">
                {session.user.name ?? session.user.email}
              </span>
            </p>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-black px-3 py-2 text-sm text-white"
            >
              Continue with Google
            </button>
          </form>
        )}
      </section>

      <footer className="text-xs text-gray-400">
        <Link href="/api/auth/signin">Auth.js sign-in route</Link>
      </footer>
    </main>
  );
}
