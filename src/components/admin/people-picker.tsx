"use client";

import { useRef, useState } from "react";
import { Search, UserCheck, X } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { Input } from "@/components/ui/input";
import { searchPeople } from "@/actions/people.actions";
import type { PeopleAccount } from "@/services/people/directory";

/**
 * Find someone in ONEVIEW People and pick them. Review never creates people —
 * it only grants a role to an account People already has — so there is
 * nothing to type except part of a name or email.
 */
export function PeoplePicker({
  picked,
  onPick,
}: {
  picked: PeopleAccount | null;
  onPick: (account: PeopleAccount | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PeopleAccount[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow earlier search landing after a newer one.
  const latest = useRef(0);

  function onChange(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const mine = ++latest.current;
      setBusy(true);
      try {
        const found = await searchPeople(value);
        if (mine === latest.current) {
          setResults(found);
          setSearched(true);
        }
      } finally {
        if (mine === latest.current) setBusy(false);
      }
    }, 250);
  }

  if (picked) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted p-3">
        <Avatar name={picked.name} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{picked.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {picked.email}
            {picked.designation ? ` · ${picked.designation}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPick(null)}
          aria-label="Choose someone else"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-ui hover:bg-card hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search People by name or email…"
          className="pl-9"
          autoFocus
          aria-label="Search ONEVIEW People"
        />
      </div>
      {busy && <p className="mt-2 text-xs text-muted-foreground">Searching…</p>}
      {!busy && searched && results.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No one found. They may already be in Review, or not have an active People account.
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-2 max-h-56 divide-y divide-border overflow-auto rounded-lg border border-border">
          {results.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                onClick={() => onPick(a)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-ui hover:bg-accent"
              >
                <Avatar name={a.name} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {a.email} · {[a.designation, a.orgCode, a.peopleRole].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <UserCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
