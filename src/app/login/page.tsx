import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">OneView</p>
          <h1 className="text-page-title mt-1">Review</h1>
          <p className="text-page-subtitle mt-1">Sign in to manage performance feedback.</p>
        </div>
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
