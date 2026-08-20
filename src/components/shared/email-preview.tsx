import { cn } from "@/lib/utils";

export interface EmailPreviewProps {
  to?: string;
  cc?: { address: string; note?: string } | null;
  subject: string;
  /** Pre-rendered HTML body from `renderEmail`. */
  html: string;
  className?: string;
  /** Shown instead of the body when there is nothing to preview yet. */
  placeholder?: string;
}

/**
 * The email as the employee will receive it, laid out like a mail client:
 * envelope fields first, then the body on its own sheet.
 *
 * Shared by the compose form and HR's review screen so the two can never
 * drift — what the Department Head previews while writing is the same
 * rendering HR approves before sending.
 */
export function EmailPreview({ to, cc, subject, html, className, placeholder }: EmailPreviewProps) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <dl className="space-y-1.5 border-b border-border-subtle bg-surface-sunken px-4 py-3 text-sm">
        {to !== undefined && (
          <Field label="To">
            <span className="font-medium text-foreground">{to || <Muted>Select an employee</Muted>}</span>
          </Field>
        )}
        {cc !== undefined && (
          <Field label="Cc">
            {cc ? (
              <span className="text-foreground">
                {cc.address}
                {cc.note && <span className="text-metadata"> · {cc.note}</span>}
              </span>
            ) : (
              <Muted>No copy</Muted>
            )}
          </Field>
        )}
        <Field label="Subject">
          <span className="font-medium text-foreground">{subject || <Muted>Pick a template</Muted>}</span>
        </Field>
      </dl>

      {html ? (
        <div
          className="break-words px-5 py-4 text-sm leading-relaxed text-foreground [&>p]:mb-3.5 [&>p:last-child]:mb-0"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          {placeholder ?? "The email will appear here."}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 text-metadata">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
