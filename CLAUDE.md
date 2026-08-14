@AGENTS.md

# OneView Review

## Master Product Plan & Development Context

## 1. Product Identity

**Product:** OneView Review

**Product family:**

* OneView Projects
* OneView People
* OneView Finance
* OneView Review

OneView Review is a lightweight internal platform for managing the company's employee performance-feedback collection and distribution process.

It is **not an HRMS**.

It is **not an employee appraisal system**.

It is a focused workflow automation product that replaces a repetitive email-based process.

### Core purpose

> Department Heads submit employee performance feedback through a simple form. HR reviews and confirms the submissions, then sends the appropriate predefined email template to employees in bulk.

The core workflow is:

**Collect → Review → Confirm → Send**

---

# 2. The Problem

Currently, performance reports and employee feedback are handled manually through email.

The general process is:

```text
Department Head
      ↓
Sends performance information to HR
      ↓
HR receives the information
      ↓
HR prepares individual employee emails
      ↓
HR manually sends emails
      ↓
HR tracks who has submitted / who is pending
```

This becomes extremely time-consuming when there are many employees.

HR has to manually manage:

* Employee information
* Email addresses
* Feedback
* Email preparation
* Email sending
* Submission tracking
* Pending employees
* Department completion status

The main problem is not that the process is complicated.

The problem is that it is **repetitive**.

OneView Review should remove that repetitive work.

---

# 3. The New Process

The new workflow should be:

```text
Department Head

Select Employee
       ↓
Employee Email Automatically Loaded
       ↓
Select Template A / B / C
       ↓
Enter Performance Feedback
       ↓
Submit
```

Then:

```text
HR

Select Department
       ↓
View Employee Submission Status
       ↓
Review Feedback
       ↓
Confirm
       ↓
Send All Confirmed Emails
```

The system automatically generates the final employee email.

---

# 4. Important Clarification: A / B / C

A, B, and C are **NOT employee performance grades**.

They are **email template types**.

There are three predefined email templates:

```text
Template A
Template B
Template C
```

The Department Head selects which template applies to the employee.

The Department Head does NOT write the entire email.

They only provide the employee-specific performance feedback.

Therefore:

```text
Employee
+
Template A/B/C
+
Department Head Feedback
        ↓
Final Email
```

The template provides the standard email content.

The feedback entered by the Department Head is inserted into the appropriate section of that template.

---

# 5. Existing Employee Data

The system already has employee information.

At minimum:

```text
Employee
Employee Email
Department
Department Head
```

Do not ask Department Heads to manually enter employee information.

The employee selection must use the existing employee data.

When a Department Head selects an employee:

```text
Employee: Rahul Kumar

Email: rahul@company.com
```

The email should automatically populate.

The Department Head only needs to provide:

1. Employee
2. Template A/B/C
3. Feedback

---

# 6. User Roles

There are two primary user roles.

## Department Head

Responsible for submitting employee performance feedback.

Can:

* See employees in their department
* Select an employee
* Automatically retrieve employee email
* Select A/B/C
* Enter feedback
* Submit feedback
* View their submitted forms/status

Cannot:

* See employees from other departments
* Confirm submissions
* Send employee emails
* Manage templates
* Modify employee master data

---

## HR

Responsible for reviewing, confirming, and distributing feedback.

Can:

* View all departments
* Filter by department
* View employees
* View submission status
* Review feedback
* Preview generated emails
* Confirm submissions
* Send confirmed emails
* Send emails in bulk
* View sending history

---

# 7. Department Head Experience

The Department Head interface should be extremely simple.

## Main page

### Performance Review

Show:

```text
Employee
[ Select Employee ▼ ]

Email
[ Automatically populated ]

Template
[ A ] [ B ] [ C ]

Performance Feedback
[____________________________________]
[____________________________________]
[____________________________________]

[ Submit Feedback ]
```

There should not be unnecessary fields.

---

# 8. Employee Dropdown

The employee dropdown should only show employees belonging to the logged-in Department Head's department.

Example:

Department Head:

**Web Development**

Employees:

```text
Rahul Kumar
Anjali
Niyas
Fathima
```

The Department Head must not be able to select employees from:

* SEO
* Social Media
* Branding
* Finance
* Other departments

The backend must enforce this restriction.

Do not rely only on frontend filtering for permissions.

---

# 9. Automatic Employee Information

When the Department Head selects:

**Rahul Kumar**

the system automatically retrieves:

```text
Employee Name: Rahul Kumar
Email: rahul@company.com
Department: Web Development
```

The email should be displayed as read-only.

The Department Head should not manually type or edit the employee email.

---

# 10. Template Selection

The Department Head chooses:

```text
A
B
C
```

Use clear UI controls such as radio buttons, segmented controls, or cards.

Example:

```text
Email Template

[ A ]    [ B ]    [ C ]
```

Only one template can be selected.

The selected template determines which email structure will later be sent to the employee.

---

# 11. Feedback Field

There is only one unique content field from the Department Head:

### Performance Feedback

This is where the Department Head writes the employee-specific feedback.

Example:

> Rahul has consistently completed his assigned development tasks on time and has demonstrated strong ownership. He should continue improving documentation and communication.

The system should not require the Department Head to write the complete email.

---

# 12. Submission

When the Department Head clicks:

**Submit Feedback**

the system creates a submission record.

Example:

```text
Employee: Rahul Kumar
Email: rahul@company.com
Department: Web Development
Template: B
Feedback: Rahul has consistently...
Status: Submitted
Submitted By: John
Submitted At: 14 Aug 2026
```

The submission should then appear in the HR dashboard.

---

# 13. Submission Lifecycle

Keep the workflow simple.

Recommended statuses:

```text
PENDING
   ↓
SUBMITTED
   ↓
CONFIRMED
   ↓
SENT
```

Optional:

```text
NEEDS_REVISION
```

Only introduce the revision state if HR needs to return feedback to the Department Head.

The primary workflow is:

**Submitted → Confirmed → Sent**

---

# 14. HR Dashboard

The HR dashboard is the main operational screen.

It should answer three questions immediately:

1. How many employees have submitted feedback?
2. How many are still pending?
3. How many emails are ready to send?

Example:

```text
Performance Review
August 2026

Total Employees       48
Submitted             42
Pending                 6
Confirmed               35
Emails Sent             35
```

These are operational counters, not complex analytics.

---

# 15. Department Filter

HR should be able to select a department.

Example:

```text
Department
[ All Departments ▼ ]
```

Options:

* All Departments
* Web Development
* SEO
* Social Media
* Branding
* Project Management

When HR selects a department, the employee list updates accordingly.

---

# 16. Department Progress

The HR dashboard should show department-level completion.

Example:

```text
Department Progress

Web Development      12 / 12
SEO                   8 / 10
Social Media         10 / 10
Branding              6 / 8
Project Management    7 / 8
```

This lets HR immediately identify departments with pending submissions.

---

# 17. HR Employee List

Example:

| Employee    | Department | Template | Submission | Confirmation | Email |
| ----------- | ---------- | -------- | ---------- | ------------ | ----- |
| Rahul Kumar | Web Dev    | A        | Submitted  | Pending      | —     |
| Anjali      | Web Dev    | B        | Confirmed  | Confirmed    | Sent  |
| Niyas       | Web Dev    | C        | Pending    | —            | —     |

The list should clearly distinguish:

* Pending submission
* Submitted
* Confirmed
* Sent

Use appropriate status indicators.

---

# 18. HR Review Screen

HR should be able to open a submission.

Example:

```text
Employee
Rahul Kumar

Department
Web Development

Email
rahul@company.com

Template
B

Performance Feedback

Rahul has consistently completed...
```

Below this, show:

### Generated Email Preview

The system should render the actual email that will be sent.

HR should be able to verify that:

* Employee is correct
* Email is correct
* Template is correct
* Feedback is correct
* Final email looks correct

Then:

**[ Confirm ]**

---

# 19. Confirmation

When HR clicks:

**Confirm**

the submission becomes:

```text
CONFIRMED
```

It becomes eligible for sending.

Confirmation should be recorded with:

```text
Confirmed By
Confirmed At
```

---

# 20. Bulk Email Sending

This is one of the most important features.

HR should NOT have to send every employee email individually.

After confirming the submissions, HR should have:

**[ Send All Confirmed ]**

For example:

```text
Confirmed: 35

[ Send All Confirmed ]
```

The system sends all confirmed employee emails through Resend.

After successful sending:

```text
Emails Sent: 35
```

Each submission becomes:

```text
SENT
```

---

# 21. Email Generation

The system should have a proper template engine.

Example:

```text
Template B

Dear {{employee_name}},

[Standard Template B content]

Performance Feedback:

{{feedback}}

[Remaining Template B content]

Regards,
HR Team
```

Available variables can include:

```text
{{employee_name}}
{{employee_email}}
{{department}}
{{feedback}}
```

The system should dynamically replace the variables.

Do not duplicate email-generation logic throughout the application.

Keep templates centralized.

---

# 22. Resend Integration

Use **Resend** as the email delivery service.

The application should:

1. Generate the final email
2. Send it through Resend
3. Capture the result
4. Store the email/send information
5. Update the submission status

Recommended information to store:

```text
Email Status
Sent At
Resend Message ID
Error Message
```

If sending fails, the submission should not be incorrectly marked as SENT.

---

# 23. Duplicate Email Protection

This is important.

A confirmed submission should be sendable through:

**Send All Confirmed**

but once successfully sent, it should not be included again.

Example:

```text
CONFIRMED → eligible for Send All
SENT → excluded from Send All
```

If HR intentionally wants to send the email again, provide an explicit:

**Resend**

action.

Do not accidentally send duplicate employee emails.

---

# 24. Data Model

A simple conceptual model:

```text
Department
    │
    ├── Department Head
    │
    └── Employees
            │
            └── Feedback Submissions
                    │
                    ├── Template
                    ├── Feedback
                    ├── Status
                    └── Email History
```

Templates:

```text
Email Template
├── A
├── B
└── C
```

---

# 25. Feedback Submission Data

Each submission should contain at least:

```text
id
employee_id
employee_name
employee_email
department_id
department_name
department_head_id
department_head_name
template_type
feedback
status
submitted_at
confirmed_by
confirmed_at
sent_at
resend_message_id
```

Prefer relationships to existing employee/department records rather than duplicating data unnecessarily.

Historical information may still be stored where required for audit/history.

---

# 26. Permissions

Security must be enforced at the backend.

### Department Head

Can access:

```text
Their Department
    ↓
Their Employees
    ↓
Their Submissions
```

Cannot access other departments.

### HR

Can access:

```text
All Departments
    ↓
All Employees
    ↓
All Submissions
```

### Admin

If required, can manage:

* Employees
* Departments
* Department Heads
* Templates
* System settings

Do not build an extensive admin system unless necessary.

---

# 27. Suggested Navigation

## Department Head

```text
OneView Review

Review
My Submissions
```

Keep this extremely small.

## HR

```text
OneView Review

Overview
Submissions
Email History
```

Again, avoid unnecessary navigation.

---

# 28. UI Design Direction

OneView Review should visually belong to the same product family as:

* OneView Projects
* OneView People
* OneView Finance

It should feel like a professional internal business product.

Design principles:

* Clean
* Minimal
* Modern
* Professional
* Information-dense where useful
* Clear hierarchy
* Fast interaction
* Desktop-first but responsive
* Consistent OneView visual language

Avoid making it look like a generic AI dashboard.

Do not add:

* AI chatbots
* AI-generated feedback
* Decorative analytics
* Excessive charts
* Large hero sections
* Unnecessary animations
* Complex HR terminology

This is a workflow product.

---

# 29. Important UX Principle

The Department Head should be able to complete a submission in seconds.

Ideal flow:

```text
Select employee
        ↓
Select A/B/C
        ↓
Enter feedback
        ↓
Submit
```

HR should be able to process an entire department quickly:

```text
Select department
        ↓
Review pending submissions
        ↓
Confirm
        ↓
Send All Confirmed
```

The interface should make the next action obvious.

---

# 30. V1 Scope

## Required

* Authentication
* Department Head role
* HR role
* Employee data
* Department relationships
* Department-based employee filtering
* Employee dropdown
* Automatic email population
* A/B/C template selection
* Feedback input
* Submission
* Submission status
* HR dashboard
* Department filter
* Employee submission list
* Feedback review
* Email preview
* Confirmation
* Bulk sending
* Resend integration
* Email history
* Basic audit timestamps
* Duplicate-send protection

## Out of Scope

Do NOT build:

* Payroll
* Attendance
* Leave management
* Recruitment
* Full HRMS
* Employee appraisal scoring
* KPI management
* Goal management
* AI-generated feedback
* AI chatbot
* Complex performance analytics
* Employee self-service portal
* Compensation management

Keep V1 focused.

---

# 31. End-to-End Example

Assume:

```text
Department:
Web Development

Department Head:
John

Employee:
Rahul Kumar

Email:
rahul@company.com
```

John logs into OneView Review.

He sees his department employees.

He selects:

**Rahul Kumar**

The system automatically fills:

```text
Email:
rahul@company.com
```

John selects:

**Template B**

He enters:

> Rahul has consistently delivered assigned development work on time and has demonstrated strong ownership. He should continue improving documentation and communication.

John clicks:

**Submit Feedback**

The HR dashboard now shows:

```text
Rahul Kumar
Web Development
Template B
Submitted
Pending Confirmation
```

HR opens the submission.

HR reviews the generated email.

HR clicks:

**Confirm**

The status becomes:

```text
CONFIRMED
```

Suppose HR has 20 confirmed submissions.

HR clicks:

**Send All Confirmed**

The system generates the appropriate email for every employee using the selected A/B/C template and unique feedback.

Resend sends the emails.

The system updates each successful submission:

```text
SENT
```

The entire process is complete.

---

# 32. The Core Product Transformation

### Before OneView Review

```text
Department Head
        ↓
Email HR
        ↓
HR manually processes information
        ↓
HR prepares individual emails
        ↓
HR sends emails one by one
        ↓
HR manually tracks everything
```

### After OneView Review

```text
Department Head
        ↓
Select Employee
        ↓
Select A/B/C
        ↓
Enter Feedback
        ↓
Submit
        ↓
HR Reviews
        ↓
Confirm
        ↓
Send All Confirmed
        ↓
Resend
        ↓
Employees Receive Email
```

---

# 33. Product Philosophy

OneView Review should solve **one problem extremely well**.

Do not turn it into a large HR platform.

The product's value is:

> **Remove repetitive HR work from the performance-feedback process.**

The entire product can be understood through four actions:

## Collect → Review → Confirm → Send

Every screen, database decision, API, and UI component should support this workflow.

---

# 34. Instructions for Claude Before Development

Before writing code:

1. Understand this product specification completely.
2. Do not assume A/B/C are performance grades.
3. A/B/C are email template types.
4. Feedback is entered by the Department Head.
5. Employee information already exists in the system.
6. Department Heads only access employees in their department.
7. Employee email is automatically populated.
8. HR reviews submissions.
9. HR confirms submissions.
10. HR can send all confirmed emails through Resend.
11. Prevent accidental duplicate sending.
12. Keep the product lightweight.
13. Do not add unrelated HR features.
14. Design the data model and workflow before generating UI/code.
15. Keep the architecture modular so the product can later integrate with the other OneView products.

Do not begin by generating random pages.

First establish:

```text
Architecture
↓
Data Model
↓
Roles & Permissions
↓
Workflow
↓
API Design
↓
Email Template System
↓
UI Structure
↓
Implementation
```

The final result should feel like a natural fourth product in the OneView ecosystem:

**OneView Projects · OneView People · OneView Finance · OneView Review**

---

# 35. Implementation Notes (current build)

Status as of the initial build session (2026-08-14):

* Stack: Next.js 16 (App Router, TS, Turbopack) + Prisma 6 + PostgreSQL (Neon) + NextAuth v5 (Credentials/JWT) + Tailwind v4 + hand-rolled UI primitives in `src/components/ui/` — mirrors the sibling OneView People/Finance apps' conventions for consistency across the family.
* Roles implemented as `UserRole`: `DEPARTMENT_HEAD`, `HR`, `ADMIN` (§26 — Admin kept minimal, no template-management UI since templates are centralized in code, not DB rows).
* A/B/C templates are hardcoded content in `src/domain/email/templates.ts` (verbatim copy provided by HR) — only `{{feedback}}` varies per submission; `{{employee_name}}`/`{{month_name}}`/`{{year}}` are filled in automatically. Rendering in `src/domain/email/render.ts`.
* The review month (`reviewPeriod`) is derived automatically from `submittedAt` (first-of-month), NOT a form field — keeps the Department Head form exactly to §7's minimal mockup (Employee / Email / Template / Feedback only).
* Backend department-scoping enforced in `src/lib/rbac.ts` (`requireDepartmentHead`, `requireOwnsEmployee`) — never just a filtered dropdown (§8).
* Resend integration in `src/services/email/resend.ts`; bulk + confirm + resend actions in `src/actions/hr.actions.ts`. A failed send never marks a submission SENT (§22); `AuditEvent` (append-only) doubles as the Email History source, avoiding a separate EmailLog table.
* No sidebar — top header nav only, per the sibling OneView Finance project's own lesson (see its memory: a sidebar over-complicates an app with this few destinations). See §27's nav lists.
* Brand accent: violet (`oklch(... 293)`) — distinct from People's green and Finance's blue within the same design-token architecture (`globals.css`).
* Seed data (`prisma/seed.ts`) creates the 5 departments from §15's own example, demo employees, one Department Head user per department, one HR user, one Admin user — all sharing password `ChangeMe123!` (must-change-password on first login).
