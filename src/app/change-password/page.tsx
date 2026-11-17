import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { homePathForRole } from "@/lib/roles";

// Passwords are ONEVIEW People's: this app signs people in with their People
// email and password and stores none of its own, so there is nothing to
// change here. The page remains so old links and the header key icon land
// somewhere that explains it. PEOPLE_APP_URL is optional and only adds a link.
export default async function ChangePasswordPage() {
  const user = await requireUser();
  const peopleUrl = process.env.PEOPLE_APP_URL;

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand">
            <KeyRound className="h-5 w-5 text-brand-foreground" />
          </div>
          <h1 className="text-page-title">Change password</h1>
          <p className="text-page-subtitle mt-1">Your password is managed in ONEVIEW People.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>One account, two apps</CardTitle>
            <CardDescription>
              You sign in here with the same email and password as ONEVIEW People. Change it there and it applies here
              too.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {peopleUrl && (
              <a href={peopleUrl} target="_blank" rel="noreferrer" className={buttonVariants()}>
                Open ONEVIEW People
              </a>
            )}
            <Link href={homePathForRole(user.role)} className={buttonVariants({ variant: "outline" })}>
              Back to ONEVIEW Review
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
