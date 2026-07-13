# One-Person Company Workflow

Paperclip can bootstrap a solo-operated AI software company from the `solo_software_company` template. The template keeps Paperclip as the control plane: companies, agents, goals, projects, issues, approvals, costs, and activity remain visible to the human board.

## What The Template Creates

Creating a company with `templateId: "solo_software_company"` creates:

- A company-level goal for the solo software company.
- One default project: `AI software delivery system`.
- Five Hermes-first AI employees:
  - CEO
  - Product Manager
  - Tech Lead
  - Full-stack Engineer
  - QA/Ops
- Six startup tasks covering the 7-day plan, PRD, technical workflow, environment checklist, QA/deploy checklist, and governance approval.
- One linked board approval for the default Task -> Approval -> Execute operating policy.

## Daily Operating Loop

Use the dashboard cockpit to run the company:

1. Review pending approvals and blocked startup tasks.
2. Start the CEO loop from the solo company cockpit.
3. Let CEO/PM/Tech Lead refine scope and delegate work.
4. Let Engineer and QA/Ops return implementation and validation evidence.
5. Close or revise tasks only when the evidence is inspectable.

## Governed Actions

The template requires board approval before AI employees execute governed work:

- Production deploys.
- Purchases or paid-service changes.
- Credential or secret changes.
- Broad deletes or destructive migrations.
- Public communications.
- Hiring or terminating agents.

An employee must create or update an issue, create and link a board approval, wait for approval, execute only the approved scope, and return evidence before closure.

## API Surfaces

- Create a company with the template through `POST /api/companies` using `templateId: "solo_software_company"` and `operatingMode: "solo_software_company"`.
- Read the solo cockpit model from `GET /api/companies/:companyId/solo-dashboard`.
- Start the CEO loop from the dashboard button, which invokes the CEO agent with `intent: "solo_company_operating_loop"`.
- Manually add matching employees from `/agents/new?preset=solo_engineer`, `/agents/new?preset=solo_pm`, `/agents/new?preset=solo_tech_lead`, `/agents/new?preset=solo_qa_ops`, or `/agents/new?preset=solo_ceo`. These presets select Hermes, enable heartbeat, attach the managed AGENTS.md bundle, and stamp the employee metadata used by the solo cockpit.

## Verification

Focused checks for this workflow:

```sh
pnpm exec vitest run packages/shared/src/validators/company.test.ts server/src/__tests__/company-templates.test.ts ui/src/components/OnboardingWizard.solo-template.test.tsx ui/src/pages/Dashboard.solo-template.test.tsx
pnpm exec vitest run ui/src/lib/solo-new-agent-presets.test.ts ui/src/lib/new-agent-hire-payload.test.ts
pnpm --filter @paperclipai/shared typecheck
pnpm --filter @paperclipai/server typecheck
pnpm --filter @paperclipai/ui typecheck
```

Manual smoke:

```sh
pnpm dev:once
curl http://localhost:3100/api/health
```

Then create a `1-person software company` from onboarding and confirm the cockpit shows five employees, startup tasks, pending approvals, and the CEO loop action.
