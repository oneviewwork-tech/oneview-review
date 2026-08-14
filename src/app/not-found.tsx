import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="animate-fade-up w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle">
          <FileQuestion className="h-5 w-5 text-brand" />
        </div>
        <h1 className="text-page-title mt-4">Page not found</h1>
        <p className="text-page-subtitle mt-1">
          This page does not exist, or you do not have access to it.
        </p>
        <Link href="/" className={`${buttonVariants()} mt-5`}>
          Go back
        </Link>
      </div>
    </div>
  );
}
