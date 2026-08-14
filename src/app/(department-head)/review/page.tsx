import { requireDepartmentHead } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ReviewForm } from "@/components/review/review-form";

export default async function ReviewPage() {
  const { departmentId } = await requireDepartmentHead();

  const employees = await prisma.employee.findMany({
    where: { departmentId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="mx-auto max-w-xl animate-fade-up">
      <h1 className="text-page-title">Performance Review</h1>
      <p className="text-page-subtitle mt-1">Submit monthly feedback for an employee in your department.</p>

      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle>New feedback</CardTitle>
          <CardDescription>Select an employee, pick a template, and describe their performance.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewForm employees={employees} />
        </CardContent>
      </Card>
    </div>
  );
}
