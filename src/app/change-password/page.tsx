import { KeyRound } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await requireUser();

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
            <KeyRound className="h-5 w-5 text-brand-foreground" />
          </div>
          <h1 className="text-page-title">
            {user.mustChangePassword ? "Set a new password" : "Change password"}
          </h1>
          <p className="text-page-subtitle mt-1">
            {user.mustChangePassword
              ? "Choose your own password before continuing."
              : "Update the password you use to sign in."}
          </p>
        </div>
        <Card className="glass-panel shadow-lg">
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Use at least 8 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
