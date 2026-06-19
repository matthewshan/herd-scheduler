import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignInScreen } from "../SignInScreen";

export const metadata = {
  title: "Sign in — Herd Scheduler",
};

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return <SignInScreen />;
}
