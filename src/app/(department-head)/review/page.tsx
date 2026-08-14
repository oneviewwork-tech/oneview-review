import { requireReviewAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReviewForm } from "@/components/review/review-form";

export default async function ReviewPage() {
  const { departmentId, isAdmin } = await requireReviewAccess();

  // A Department Head only ever sees their own department's employees. An
  // Admin has no department, so they pick one first and the employee list
  // follows that choice (still re-validated server-side on submit).
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true, ...(departmentId ? { departmentId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, departmentId: true },
    }),
    isAdmin
      ? prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
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
          <ReviewForm employees={employees} departments={departments} />
        </CardContent>
      </Card>
    </div>
  );
}
