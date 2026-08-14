import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { code: "WEBDEV", name: "Web Development" },
  { code: "SEO", name: "SEO" },
  { code: "SOCIAL", name: "Social Media" },
  { code: "BRAND", name: "Branding" },
  { code: "PM", name: "Project Management" },
];

const EMPLOYEES: Record<string, string[]> = {
  WEBDEV: ["Rahul Kumar", "Anjali Menon", "Niyas Ahmed", "Fathima Rasheed"],
  SEO: ["Vikram Rao", "Sneha Pillai"],
  SOCIAL: ["Arjun Nair", "Divya Krishnan"],
  BRAND: ["Kiran Das", "Meera Suresh"],
  PM: ["Sanjay Varma", "Priya Balan"],
};

function emailFor(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@company.com`;
}

async function main() {
  const password = await bcrypt.hash("ChangeMe123!", 10);

  const departments = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const d = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
    departments.set(dept.code, d.id);
  }

  for (const [code, names] of Object.entries(EMPLOYEES)) {
    const departmentId = departments.get(code)!;
    for (const name of names) {
      await prisma.employee.upsert({
        where: { email: emailFor(name) },
        update: {},
        create: { name, email: emailFor(name), departmentId },
      });
    }
  }

  // One Department Head per department, one HR user, one Admin.
  for (const dept of DEPARTMENTS) {
    const email = `head.${dept.code.toLowerCase()}@company.com`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `${dept.name} Head`,
        passwordHash: password,
        role: "DEPARTMENT_HEAD",
        departmentId: departments.get(dept.code)!,
        mustChangePassword: true,
      },
    });
  }

  await prisma.user.upsert({
    where: { email: "hr@company.com" },
    update: {},
    create: { email: "hr@company.com", name: "HR Team", passwordHash: password, role: "HR", mustChangePassword: true },
  });

  await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: { email: "admin@company.com", name: "System Admin", passwordHash: password, role: "ADMIN", mustChangePassword: true },
  });

  console.log("Seed complete.");
  console.log("All accounts share the password: ChangeMe123!");
  console.log("Department Heads: head.webdev@company.com, head.seo@company.com, head.social@company.com, head.brand@company.com, head.pm@company.com");
  console.log("HR: hr@company.com");
  console.log("Admin: admin@company.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
