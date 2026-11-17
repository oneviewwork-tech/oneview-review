/**
 * Working out how Review's people should change to follow ONEVIEW People.
 *
 * The rules, as HR set them:
 *  - Someone active in People is active in Review; everyone else is inactive.
 *  - A person newly added in People appears in Review.
 *  - Only the organizations in `scope` are followed (HACA and Haris & Co. for
 *    now); anything else in People is ignored.
 *
 * A Review person is tied to their People record by id once linked. Before
 * that they are found by email, then by an exact, unambiguous name within
 * their organization. A looser (partial) name match is never made here:
 * silently linking or duplicating the wrong person is worse than a person
 * waiting for a human to link them.
 *
 * This is pure: it decides, and the caller writes.
 */
export interface PeopleRow {
  id: string;
  name: string;
  officialEmail: string;
  loginEmail: string | null;
  orgCode: string;
  department: string | null;
  departmentCode: string | null;
  designation: string | null;
  manager: string | null;
  active: boolean;
}

export interface ReviewPerson {
  id: string;
  name: string;
  email: string;
  peopleEmail: string | null;
  peopleEmployeeId: string | null;
  orgCode: string;
  departmentName: string;
  designation: string | null;
  reportingManagerName: string | null;
  isActive: boolean;
}

export interface ReviewDepartment {
  id: string;
  name: string;
  code: string;
  orgCode: string;
}

export interface EmployeeChange {
  id: string;
  name: string;
  data: {
    peopleEmployeeId?: string;
    peopleEmail?: string | null;
    designation?: string;
    reportingManagerName?: string;
    isActive?: boolean;
  };
  /** Human-readable summary of what changes. */
  what: string[];
  /** Leave the holding department for the one People now gives them. */
  moveToDepartmentKey?: string;
}

export interface SyncPlan {
  update: EmployeeChange[];
  activate: string[];
  deactivate: { id: string; name: string; why: string }[];
  create: { person: PeopleRow; departmentKey: string }[];
  newDepartments: { key: string; orgCode: string; name: string; code: string }[];
  skipped: string[];
}

/** Department names that mean the same thing in both systems. */
const DEPARTMENT_ALIASES: Record<string, string> = {
  web: "web development",
  hr: "human resources",
  "human resources": "hr",
};

export const norm = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const deptKey = (orgCode: string, name: string) => `${orgCode}|${norm(name)}`;

/** Where People staff with no department yet are held, so every active person is in Review. */
export const UNASSIGNED = { name: "Unassigned", code: "UNASSIGNED" } as const;

export function planSync(input: {
  people: PeopleRow[];
  review: ReviewPerson[];
  departments: ReviewDepartment[];
  scope: string[];
}): SyncPlan {
  const inScope = new Set(input.scope);
  const people = input.people.filter((p) => inScope.has(p.orgCode));
  const review = input.review.filter((r) => inScope.has(r.orgCode));

  // Find each Review person's People record.
  const byId = new Map(people.map((p) => [p.id, p]));
  const claimed = new Set<string>(); // People ids already taken
  const link = new Map<string, PeopleRow>(); // review id -> people row

  const claim = (r: ReviewPerson, p: PeopleRow | undefined) => {
    if (!p || claimed.has(p.id) || p.orgCode !== r.orgCode) return false;
    claimed.add(p.id);
    link.set(r.id, p);
    return true;
  };

  // 1. Already linked.
  for (const r of review) if (r.peopleEmployeeId) claim(r, byId.get(r.peopleEmployeeId));

  // 2. By email, either address on either side.
  const peopleByEmail = new Map<string, PeopleRow[]>();
  for (const p of people) {
    for (const e of [p.officialEmail, p.loginEmail]) {
      if (!e) continue;
      const k = e.toLowerCase();
      peopleByEmail.set(k, [...(peopleByEmail.get(k) ?? []), p]);
    }
  }
  for (const r of review) {
    if (link.has(r.id)) continue;
    const candidates = [r.email, r.peopleEmail].filter((e): e is string => !!e).flatMap((e) => peopleByEmail.get(e.toLowerCase()) ?? []);
    const unique = [...new Map(candidates.map((c) => [c.id, c])).values()].filter((c) => !claimed.has(c.id));
    if (unique.length === 1) claim(r, unique[0]);
  }

  // 3. By exact name, only when exactly one person on each side has it.
  const unlinkedReview = review.filter((r) => !link.has(r.id));
  const unclaimedPeople = people.filter((p) => !claimed.has(p.id));
  for (const r of unlinkedReview) {
    const sameName = unclaimedPeople.filter((p) => !claimed.has(p.id) && p.orgCode === r.orgCode && norm(p.name) === norm(r.name));
    const sameNameReview = unlinkedReview.filter((x) => x.orgCode === r.orgCode && norm(x.name) === norm(r.name));
    if (sameName.length === 1 && sameNameReview.length === 1) claim(r, sameName[0]);
  }

  const plan: SyncPlan = { update: [], activate: [], deactivate: [], create: [], newDepartments: [], skipped: [] };

  // Existing people: follow People.
  const pending: { r: ReviewPerson; p: PeopleRow; change: EmployeeChange }[] = [];
  for (const r of review) {
    const p = link.get(r.id);
    if (!p) {
      if (r.isActive) plan.deactivate.push({ id: r.id, name: r.name, why: "not in ONEVIEW People" });
      continue;
    }
    const data: EmployeeChange["data"] = {};
    const what: string[] = [];
    if (r.peopleEmployeeId !== p.id) {
      data.peopleEmployeeId = p.id;
      what.push("linked to People");
    }
    const login = p.loginEmail?.toLowerCase();
    const wantPeopleEmail = login && login !== r.email.toLowerCase() ? login : null;
    if ((r.peopleEmail?.toLowerCase() ?? null) !== wantPeopleEmail && (wantPeopleEmail || r.peopleEmail)) {
      data.peopleEmail = wantPeopleEmail;
      what.push("login email");
    }
    if (p.designation && p.designation !== r.designation) {
      data.designation = p.designation;
      what.push("designation");
    }
    if (p.manager && p.manager !== r.reportingManagerName) {
      data.reportingManagerName = p.manager;
      what.push("manager");
    }
    if (r.isActive !== p.active) {
      data.isActive = p.active;
      what.push(p.active ? "reactivated" : "deactivated (inactive in People)");
      if (p.active) plan.activate.push(r.id);
      else plan.deactivate.push({ id: r.id, name: r.name, why: "inactive in ONEVIEW People" });
    }
    if (what.length || (norm(r.departmentName) === norm(UNASSIGNED.name) && p.department)) pending.push({ r, p, change: { id: r.id, name: r.name, data, what } });
  }

  // New people: in People, active, and nobody in Review is them.
  const takenEmails = new Set(review.flatMap((r) => [r.email, r.peopleEmail]).filter((e): e is string => !!e).map((e) => e.toLowerCase()));
  const deptByKey = new Map<string, ReviewDepartment>();
  for (const d of input.departments) deptByKey.set(deptKey(d.orgCode, d.name), d);
  const codesTaken = new Set(input.departments.map((d) => `${d.orgCode}|${d.code.toLowerCase()}`));
  const newDepts = new Map<string, SyncPlan["newDepartments"][number]>();

  const resolveDept = (orgCode: string, name: string): string => {
    const direct = deptKey(orgCode, name);
    if (deptByKey.has(direct) || newDepts.has(direct)) return direct;
    const alias = DEPARTMENT_ALIASES[norm(name)];
    if (alias && deptByKey.has(deptKey(orgCode, alias))) return deptKey(orgCode, alias);
    const reverse = Object.entries(DEPARTMENT_ALIASES).find(([, v]) => v === norm(name))?.[0];
    if (reverse && deptByKey.has(deptKey(orgCode, reverse))) return deptKey(orgCode, reverse);
    return "";
  };

  // Adds a department People uses that Review does not have yet ("" if its code would clash).
  const ensureDept = (orgCode: string, name: string, deptCode: string | null): string => {
    const found = resolveDept(orgCode, name);
    if (found) return found;
    const key = deptKey(orgCode, name);
    const code = (deptCode ?? name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!code || codesTaken.has(`${orgCode}|${code.toLowerCase()}`)) return "";
    codesTaken.add(`${orgCode}|${code.toLowerCase()}`);
    newDepts.set(key, { key, orgCode, name: name.trim(), code });
    return key;
  };

  // Someone held in Unassigned moves once People gives them a department.
  // Anyone else keeps the department HR placed them in (Review's own structure).
  for (const { r, p, change } of pending) {
    if (norm(r.departmentName) === norm(UNASSIGNED.name) && p.department) {
      const key = ensureDept(p.orgCode, p.department, p.departmentCode);
      if (key) {
        change.moveToDepartmentKey = key;
        change.what.push(`department: ${p.department.trim()}`);
      }
    }
    if (change.what.length) plan.update.push(change);
  }

  for (const p of people) {
    if (claimed.has(p.id) || !p.active) continue;
    if (takenEmails.has(p.officialEmail.toLowerCase())) {
      plan.skipped.push(`${p.name} <${p.officialEmail}>: that email already belongs to someone in Review; link them by hand`);
      continue;
    }
    const key = p.department ? ensureDept(p.orgCode, p.department, p.departmentCode) : ensureDept(p.orgCode, UNASSIGNED.name, UNASSIGNED.code);
    if (!key) {
      plan.skipped.push(`${p.name}: department “${p.department ?? UNASSIGNED.name}” would clash with an existing department code`);
      continue;
    }
    takenEmails.add(p.officialEmail.toLowerCase());
    plan.create.push({ person: p, departmentKey: key });
  }
  plan.newDepartments = [...newDepts.values()];
  return plan;
}
