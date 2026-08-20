import { requireReviewAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReviewForm } from "@/components/review/review-form";
import { getScopeOrganizations } from "@/services/review/scope";

export default async function ReviewPage() {
  const { departmentId, isAdmin } = await requireReviewAccess();

  // A Department Head only ever sees their own department's employees. An
  // Admin has no department, so they pick organization then department and
  // the employee list follows — still re-validated server-side on submit.
  const [employees, organizations] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true, ...(departmentId ? { departmentId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, departmentId: true, organizationId: true, designation: true },
    }),
    isAdmin ? getScopeOrganizations() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <h1 className="text-page-title">New Review</h1>
      <p className="text-page-subtitle mt-1">
        {isAdmin
          ? "Submit monthly feedback for any employee."
          : "Submit monthly feedback for an employee in your department."}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Performance feedback</CardTitle>
          <CardDescription>Select an employee, pick a template, and describe their performance.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewForm employees={employees} organizations={organizations} />
        </CardContent>
      </Card>
    </div>
  );
}
