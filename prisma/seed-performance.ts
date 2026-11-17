/**
 * Loads the scorecards HACA already runs on, transcribed from HR's sheets
 * and role-clarity documents (Academic Excellence, Mentors, Team SHO).
 *
 * Nothing here is invented: every KRA, KPI and weight is a row from a sheet
 * (each role's KPI weights add up to 100). The Quality Lead is loaded with
 * its role definition only — its RCD lists targets but no weights, so its
 * scorecard is built in the app once those weights are decided.
 *
 * It creates no people, assignments or scores. Safe to re-run: a template
 * that already exists by name is left untouched, so edits made in the app
 * are never overwritten.
 *
 *   npx tsx prisma/seed-performance.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Kpi = [name: string, points: number];
type Kra = [name: string, kpis: Kpi[]];
type Risk = [category: string, name: string, description?: string];

interface TemplateSeed {
  name: string;
  roleDefinition?: string;
  responsibilities?: string[];
  effectiveFrom?: string; // YYYY-MM; omit for details-only templates
  kras?: Kra[];
  risks?: Risk[];
}

const TEMPLATES: TemplateSeed[] = [
  {
    name: "Academic Lead",
    roleDefinition:
      "The Academic Lead plays a pivotal role in managing and executing the academic vision of the organization. The role ensures that all programs maintain academic excellence while staying industry relevant.",
    responsibilities: [
      "Academic planning & delivery",
      "Faculty & SHO coordination",
      "Student engagement support",
      "Quality assurance",
      "Operation coordination",
    ],
    effectiveFrom: "2026-08",
    kras: [
      ["Curriculum Excellence", [["Syllabus Completion Rate", 5], ["Curriculum Revision Completion", 5], ["Academic Calendar Adherence", 5]]],
      [
        "Teaching Quality & Mentor Excellence",
        [["Student Teaching Satisfaction Score", 6], ["Mentor Punctuality", 4], ["Assignment Evaluation TAT", 3], ["Mentor Performance Score", 3], ["Mentor Coordination Effectiveness", 4]],
      ],
      ["Student Performance & Success", [["Placement Rate", 7], ["NPS", 8], ["Portfolio Completion Rate", 5], ["Drop Out Rate", 5]]],
      ["Feedback & Continuous Improvement", [["Feedback Collection Rate", 3], ["Feedback Action Closure Rate", 4], ["Improvement Implementation Rate", 3]]],
      [
        "Academic Governance & Coordination",
        [["Weekly Academic Review Meeting Completion", 5], ["Cross-Department Coordination Effectiveness", 5], ["Academic Audit Completion", 5], ["Dashboard & Report Accuracy", 5]],
      ],
      ["Innovation & Academic Leadership", [["Academic Initiatives Implemented", 4], ["Process Improvements", 3], ["Faculty Development Activities", 3]]],
    ],
    risks: [
      ["Academic Quality Risk", "Syllabus & Assessment Delay", "Failure to complete syllabus, delayed assessments, or delayed evaluation beyond agreed timeline"],
      ["Student Success Risk", "Academic Escalations & Student Complaints", "Unresolved academic complaints, repeated mentor complaints, or escalations reaching management"],
      ["Academic Governance & Compliance", "Audit & Process Non-Compliance", "Missed academic reviews, audit failures, inaccurate reports, or non-adherence to academic SOPs"],
    ],
  },
  {
    name: "Mentor",
    roleDefinition:
      "A Mentor delivers quality training, guides students individually, manages academic support tasks, supervises project work, takes part in community initiatives, integrates modern AI tools, and actively updates the curriculum to align with domain-specific advancements and AI-enabled innovation.",
    responsibilities: [
      "Deliver subject-specific sessions with clarity and industry relevance",
      "Provide regular mentorship, doubt support, and student performance tracking",
      "Assist in academic planning, evaluation, attendance, and internal assessments",
      "Guide students in project selection, execution, deployment, and demos",
      "Support or lead webinars, tech talks, onboarding sessions, or coding competitions",
      "Use AI tools to enhance teaching and automate repetitive tasks",
      "Benchmark industry trends and contribute to regular syllabus revisions",
    ],
    effectiveFrom: "2026-06",
    kras: [
      ["Student Training & Delivery", [["On-time Session Delivery", 10], ["Syllabus Completion Rate", 10], ["Lesson Preparation Quality", 5]]],
      [
        "Student Learning Effectiveness",
        [["Assignment Completion Rate", 5], ["Assessment Performance", 10], ["Practical Project Completion", 10], ["Doubt Resolution Effectiveness", 5]],
      ],
      ["Student Engagement & Retention", [["Student Retention Rate", 5], ["Student Satisfaction Score", 5]]],
      ["Placement Readiness Support", [["Portfolio/Project Readiness", 5], ["Placement Participation Rate", 5]]],
      [
        "Ownership & Collaboration",
        [["Student Issue Resolution", 5], ["Team Collaboration", 5], ["Problem Solving Ability", 5], ["Knowledge Sharing & Upskilling", 5]],
      ],
      ["Academic Operations & Compliance", [["Weekly Report Submission", 5]]],
    ],
    risks: [
      ["Academic Quality & Errors", "Student Complaints", "Number of escalated student complaints"],
      ["Academic Quality & Errors", "Session Cancellation", "Unplanned class cancellations"],
      ["Academic Quality & Errors", "Syllabus Delay", "Delay affecting batch completion timelines"],
      ["Student Retention", "Batch Dropout Rate", "Students leaving the program due to mentor-related issues"],
      ["Discipline", "Professional Behavior", "Professional conduct with students and team"],
      ["Discipline", "Attendance & Reporting Violations", "Missing reports, attendance updates, or approvals"],
      ["Discipline", "Policy Violations", "Non-compliance with institute policies"],
      ["Compliance", "Delayed/Missing Weekly Reports", "Failure to submit weekly reports on time or submission with inaccurate/incomplete data"],
    ],
  },
  {
    name: "SHO",
    roleDefinition:
      "The Student Happiness Officer is the first point of contact for students and manages daily batch operations, student experience, discipline, coordination and issue management, keeping classes running smoothly between students, trainers and management.",
    responsibilities: [
      "Batch management: attendance tracking, punctuality, classroom discipline",
      "Student support & experience: first escalation point, follow-ups on attendance and performance",
      "Academic coordination with trainers: syllabus progress, assessments on time",
      "Documentation & reporting: daily tracker, issue log, batch data",
      "Discipline & policy enforcement",
      "Communication & escalation of serious academic or behavioural issues",
    ],
    effectiveFrom: "2026-06",
    kras: [
      ["Student Engagement & Retention", [["Attendance Monitoring", 15], ["Retention Rate", 5]]],
      ["Student Satisfaction & Support", [["Feedback / NPS", 5], ["Issue Resolution", 5]]],
      ["Student Progress & Career Readiness", [["Assessment Tracking", 5], ["Portfolio Follow-up", 5], ["Student Placement Support", 5]]],
      ["Communication & Coordination", [["Response Time", 5], ["Class Coordination", 5], ["Internal Coordination", 5]]],
      ["Process Compliance & Reporting", [["Report Accuracy", 10], ["SOP Adherence", 10]]],
      ["Innovation & Ownership", [["Suggestions & Innovation", 10], ["Initiative & Accountability", 10]]],
    ],
    risks: [
      ["Student Management Errors", "Student complaint escalation", "Student complaint escalation, missed critical follow-up, incorrect information provided to students"],
      ["Operational Errors", "Operational errors", "Report inaccuracies, class coordination mistakes, missed updates, SOP violations"],
      ["Professional Conduct Errors", "Professional conduct", "Unprofessional behavior, policy violations, repeated negligence, non-responsiveness"],
    ],
  },
  {
    name: "SEM",
    roleDefinition: "Student Experience Manager for offline centres: oversees batch health, the SHO team and school operations.",
    effectiveFrom: "2026-06",
    kras: [
      [
        "Academic Operations & Student Success",
        [["Batch Health Monitoring", 10], ["Student Satisfaction / NPS", 5], ["Academic Issue Resolution", 5], ["Placement & Portfolio Tracking", 5]],
      ],
      [
        "Team Management & Execution",
        [["Team Performance Monitoring", 7], ["Task Delegation & Follow-up", 4], ["Team Discipline & Accountability", 3], ["Team Coordination", 8]],
      ],
      [
        "Communication & Coordination",
        [["Interdepartmental Coordination", 5], ["Trainer & Student Communication", 5], ["Response Time & Escalation Handling", 5]],
      ],
      [
        "Operational Excellence",
        [["Report Accuracy & Timeliness", 5], ["SOP Compliance Monitoring", 5], ["Event / Activity Coordination", 2], ["School Operational Stability", 1]],
      ],
      [
        "Leadership & Strategic Contribution",
        [["Leadership Capability", 10], ["Decision Making & Problem Solving", 7], ["Strategic Thinking & Innovation", 5], ["Ownership & Change Management", 3]],
      ],
    ],
    risks: [
      ["Major Student or Academic Escalation Due to Negligence", "Failure to follow up", "Failure to follow up on critical student issues, retention risks, academic concerns, or complaints resulting in escalation"],
      ["Operational & Leadership Non-Compliance", "Repeated non-compliance", "Repeated report inaccuracies, SOP violations, failure to manage team deliverables, missed critical updates, or negligence"],
    ],
  },
  {
    name: "Internship Coordinator",
    effectiveFrom: "2026-06",
    kras: [
      ["Intern Engagement & Retention", [["Internship Attendance Monitoring", 10], ["Internship Retention Rate", 10]]],
      ["Intern Support & Satisfaction", [["Feedback", 10], ["Issue Resolution", 10], ["Query Handling Effectiveness", 5]]],
      ["Intern Progress & Career Readiness", [["Task Completion Tracking", 5], ["Portfolio Follow-up", 5], ["Internship Performance Tracking", 5]]],
      ["Coordination & Communication", [["Response Time", 10], ["Mentor & Agency Coordination", 10], ["Students Punctuality Keeping", 5]]],
      ["Process Compliance & Reporting", [["Report Accuracy", 5], ["SOP Adherence", 3], ["Tracker Maintenance", 3]]],
      ["Innovation & Ownership", [["Suggestions & Innovation", 2], ["Initiative & Accountability", 2]]],
    ],
    risks: [
      ["Student Management Errors", "Student management errors"],
      ["Operational Errors", "Operational errors"],
      ["Professional Conduct Errors", "Professional conduct errors"],
    ],
  },
  {
    name: "Quality Lead – Student Experience",
    roleDefinition:
      "Ensures consistent, high-quality learning delivery and student experience across all programs and batches. Governs the performance of the Student Experience team (SHOs and SEMs), monitors trainer effectiveness, evaluates session quality, and tracks student engagement and satisfaction metrics.",
    responsibilities: [
      "Student Experience Team Leadership",
      "Academic Session Quality Monitoring",
      "Trainer Performance Evaluation",
      "Student Learning & Engagement Monitoring",
      "Escalation Management",
      "Academic Process Auditing",
      "Reporting & Quality Insights",
    ],
  },
];

async function main() {
  for (const t of TEMPLATES) {
    const existing = await prisma.perfTemplate.findUnique({ where: { name: t.name } });
    if (existing) {
      console.log(`skip   ${t.name} (already exists)`);
      continue;
    }

    const total = (t.kras ?? []).reduce((s, [, kpis]) => s + kpis.reduce((p, [, pts]) => p + pts, 0), 0);
    if (t.kras && total !== 100) throw new Error(`${t.name}: KPI weights add up to ${total}, expected 100`);

    await prisma.perfTemplate.create({
      data: {
        name: t.name,
        roleDefinition: t.roleDefinition ?? null,
        responsibilities: t.responsibilities?.join("\n") ?? null,
        ...(t.kras && t.effectiveFrom
          ? {
              versions: {
                create: {
                  effectiveFrom: new Date(`${t.effectiveFrom}-01T00:00:00Z`),
                  kras: {
                    create: t.kras.map(([name, kpis], ki) => ({
                      name,
                      sortOrder: ki,
                      kpis: { create: kpis.map(([kpiName, maxPoints], pi) => ({ name: kpiName, maxPoints, sortOrder: pi })) },
                    })),
                  },
                  risks: {
                    create: (t.risks ?? []).map(([category, name, description], i) => ({ category, name, description: description ?? null, sortOrder: i })),
                  },
                },
              },
            }
          : {}),
      },
    });
    console.log(`create ${t.name}${t.kras ? ` (${total} pts)` : " (details only)"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
