import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { homePathForRole } from "@/lib/roles";

// Fallback only — proxy.ts already redirects "/" before this ever renders.
export default async function RootPage() {
  const session = await auth();
  redirect(session?.user ? homePathForRole(session.user.role) : "/login");
}
