/**
 * The scoring tree: who ends up visible to someone who scores people.
 *
 * Each edge is "this employee is scored by that login". A scorer's own
 * employee record is found through the addresses it is known by (the
 * mailing address, and the People login email when different), so a person
 * whose two addresses differ still sits in the right place in the tree.
 */
export interface TreeEdge {
  employeeId: string;
  /** Every address this employee can be identified by (lower-cased). */
  employeeEmails: string[];
  /** The login email of whoever scores them (lower-cased). */
  scorerEmail: string;
}

/**
 * Everyone reachable from `rootIds` by following "scores" links downward,
 * including the roots themselves. Safe against cycles.
 */
export function subtreeOf(rootIds: string[], edges: TreeEdge[]): Set<string> {
  const childrenByScorerEmail = new Map<string, string[]>();
  const emailsByEmployee = new Map<string, string[]>();
  for (const e of edges) {
    childrenByScorerEmail.set(e.scorerEmail, [...(childrenByScorerEmail.get(e.scorerEmail) ?? []), e.employeeId]);
    emailsByEmployee.set(e.employeeId, e.employeeEmails);
  }

  const seen = new Set<string>();
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const email of emailsByEmployee.get(id) ?? []) {
      queue.push(...(childrenByScorerEmail.get(email) ?? []));
    }
  }
  return seen;
}
