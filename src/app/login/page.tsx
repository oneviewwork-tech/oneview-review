import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  const { passwordChanged } = await searchParams;

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-brand-foreground">
            O
          </div>
          <h1 className="text-page-title">
            ONEVIEW <span className="font-semibold text-muted-foreground">Review</span>
          </h1>
          <p className="text-page-subtitle mt-1">Sign in to manage performance feedback.</p>
        </div>

        {passwordChanged && (
          <p role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-success/20 bg-success-subtle px-3 py-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Password updated. Sign in with your new password.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the email and password given to you by your admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
