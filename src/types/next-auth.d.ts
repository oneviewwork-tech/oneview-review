import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: UserRole;
    departmentId?: string | null;
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      departmentId: string | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    departmentId?: string | null;
    mustChangePassword?: boolean;
  }
}
