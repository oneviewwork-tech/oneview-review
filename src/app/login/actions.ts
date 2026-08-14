"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function authenticate(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Same message regardless of which failure case applies — see auth.ts.
      return "Invalid email or password.";
    }
    throw error;
  }
}
