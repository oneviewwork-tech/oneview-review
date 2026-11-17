/**
 * Matching a person in Review to the same person in ONEVIEW People.
 *
 * Email is tried first by the caller; this is the fallback when the emails
 * differ but the names are the same. It is deliberately cautious, because
 * linking the wrong person would hand one human's performance data to
 * another: a match is only ever returned when exactly one candidate fits.
 */

export function nameTokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export type NameMatch<T> =
  | { kind: "exact"; match: T }
  /** One side's words are all contained in the other's ("Rashid" ~ "Mohammed Rashid A"). Needs a human to confirm. */
  | { kind: "partial"; match: T }
  | { kind: "ambiguous"; matches: T[] }
  | { kind: "none" };

const sortedKey = (tokens: string[]) => [...tokens].sort().join(" ");

export function matchByName<T extends { name: string }>(name: string, candidates: T[]): NameMatch<T> {
  const wanted = nameTokens(name);
  if (wanted.length === 0) return { kind: "none" };

  const exact = candidates.filter((c) => sortedKey(nameTokens(c.name)) === sortedKey(wanted));
  if (exact.length === 1) return { kind: "exact", match: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", matches: exact };

  const contains = (outer: string[], inner: string[]) => inner.every((t) => outer.includes(t));
  const partial = candidates.filter((c) => {
    const theirs = nameTokens(c.name);
    return theirs.length > 0 && (contains(theirs, wanted) || contains(wanted, theirs));
  });
  if (partial.length === 1) return { kind: "partial", match: partial[0] };
  if (partial.length > 1) return { kind: "ambiguous", matches: partial };
  return { kind: "none" };
}
