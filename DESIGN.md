# Paperclip Design System

## 1. Atmosphere & Identity

Paperclip feels like a dense operator console for running AI-agent companies: calm, work-focused, and inspectable. The signature is a monochrome control-plane surface with small status color accents, crisp borders, compact dashboards, and agent identity capsules used only where identity needs to stand out.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Page background |
| Surface/card | `--card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Cards and panels |
| Surface/muted | `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary panels and subtle fills |
| Text/primary | `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Primary text |
| Text/muted | `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Captions and secondary text |
| Border/default | `--border` | `oklch(0.922 0 0)` | `oklch(0.269 0 0)` | Cards, dividers, inputs |
| Action/primary | `--primary` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Primary buttons and links |
| Action/accent | `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Hover and selected states |
| Status/destructive | `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.637 0.237 25.331)` | Errors and destructive actions |
| Status/task | `--status-task-*` | existing task status palette | existing task status palette | Task status chips and icons |
| Brand/agent | `--agent-*` | brand capsule stops | brand capsule stops | Agent capsule identity only |

### Rules

- Prefer neutral surfaces and borders; status hues communicate state, not decoration.
- Use `--primary` for action emphasis and links.
- Task and agent status colors must use the existing `--status-*` variables.
- Raw hex values are allowed only for brand-fixed capsule stops and documented status tokens.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Page title | `text-2xl` to `text-3xl` | 600-700 | tight | 0 | Dashboard and detail titles |
| Section title | `text-lg` to `text-xl` | 600 | normal | 0 | Major panels |
| Panel title | `text-sm` | 600 | normal | optional uppercase tracking | Card headers and labels |
| Body | `text-sm` to `text-base` | 400 | normal | 0 | Primary UI copy |
| Caption | `text-xs` | 400-600 | normal | optional uppercase tracking | Metadata, counts, status labels |
| Mono/value | `tabular-nums` where numeric | 500-700 | normal | 0 | Metrics, counters, costs |

### Font Stack

- Primary: system UI via Tailwind defaults.
- Mono: Tailwind mono stack for identifiers and code-like values.

### Rules

- Operational surfaces stay compact; avoid hero-scale text inside dashboards.
- Body text should not drop below `text-xs`, and dense panels should favor `text-sm`.
- Use `tabular-nums` for counters and cost values.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a 4px base through Tailwind spacing utilities.

| Token | Tailwind | Usage |
|-------|----------|-------|
| Compact | `gap-2`, `p-2` | Tight rows and inline controls |
| Standard | `gap-3`, `p-3`, `px-3 py-2` | Buttons, list items, compact cards |
| Panel | `gap-4`, `p-4` | Dashboard panels and forms |
| Comfortable | `gap-5`, `p-5` | Feature panels and grouped summaries |
| Section | `space-y-6` | Page-level vertical rhythm |

### Grid

- Use responsive CSS grids with explicit breakpoints (`md`, `lg`, `xl`) for dashboards.
- Dashboard panels should remain scan-friendly on mobile; prefer single-column stacks before multi-column layouts.
- Fixed-format controls use stable padding and icon sizes to avoid layout shift.

### Rules

- Cards and panels should use `rounded-lg`, `rounded-xl`, or existing component radii; avoid decorative oversized radii.
- Avoid nested decorative cards; nested cards are acceptable only for repeated list items inside a tool panel.

## 5. Components

### Dashboard Panel

- **Structure**: bordered surface with heading, compact metadata, and scan-friendly content.
- **Variants**: neutral, warning, destructive.
- **Spacing**: `p-4` default, `gap-3` internal rhythm.
- **States**: links/buttons use hover/focus states through `hover:bg-accent` and standard focus rings.
- **Accessibility**: headings describe panel purpose; controls are native buttons or links.
- **Motion**: limited to existing hover transitions and loading spinners.

### Status Badge

- **Structure**: small inline badge or icon plus text.
- **Variants**: agent status, issue status, approval state.
- **Spacing**: compact inline gap, no layout-changing hover.
- **Accessibility**: status text remains visible; color is secondary.
- **Motion**: none.

### Operator Action Button

- **Structure**: native button with Lucide icon and concise label.
- **Variants**: primary, bordered secondary, destructive.
- **Spacing**: `px-3 py-2`, icon `h-4 w-4`.
- **States**: hover, disabled, loading.
- **Accessibility**: disabled state must also communicate why in nearby text when necessary.
- **Motion**: loading spinner only.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 100-150ms | ease-out | Hover and active states |
| Standard | 200ms | ease-in-out | Accordions, tabs, lightweight panels |

### Rules

- Animate only `transform`, `opacity`, or existing spinner rotation.
- Every interactive element must be keyboard reachable and have hover/focus/disabled states.
- Do not add motion that competes with operational scanning.

## 7. Depth & Surface

### Strategy

Paperclip uses mixed border and tonal-shift depth:

| Level | Treatment | Usage |
|-------|-----------|-------|
| Page | `bg-background` | Main shell |
| Panel | `border bg-card` or `border bg-background/70` | Dashboard and detail panels |
| Emphasis | subtle tinted border/fill | Warning, approval, or destructive states |
| Overlay | existing popover/modal components | Menus, dialogs, popovers |

Shadows should remain subtle and functional; use borders first.
