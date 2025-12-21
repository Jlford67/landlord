Here’s a detailed **`docs/agent_instructions.md`** you can copy straight into your repo. It’s written for your current Next.js + Prisma landlord app and for how you like to work on Windows with this project.

You can paste everything below into `docs/agent_instructions.md`.

---

```md
# Agent Instructions for Landlord Web Application

## Purpose

This document defines how any AI agent (including ChatGPT, Codex, or other coding assistants) should work on the **Landlord Web Application** project.

The goal is to build a full-featured personal landlord management system that supports:
- Properties
- Tenants
- Leases
- Ledger / transactions
- Income and expense tracking
- Reporting
- Simple, clean UI for daily use

This project is actively developed and should be treated as production-quality code.

---

## Project Overview

**Project Name:** landlord  
**Type:** Full-stack web application  
**Primary Use:** Personal landlord software  
**Platform:** Windows 11  
**Root Path:**
```

C:\Users\jlfor\Documents\WebApplication\landlord

````

**Tech Stack:**
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite (dev) / future DB possible
- Node.js / npm

---

## Key Goals

1. Replace spreadsheets and portals with a single system.
2. Track properties, tenants, leases, and financials.
3. Be simple, fast, and easy to extend.
4. Prefer server components and server actions.
5. Avoid unnecessary complexity.
6. All code must be copy/paste ready and tested.

---

## Development Workflow

### Start Dev Server
From project root:

```powershell
Remove-Item -Recurse -Force .\.next -ErrorAction SilentlyContinue
npm run dev
````

Server runs at:

```
http://localhost:3000
```

### Prisma

```powershell
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

---

## Folder Structure

```
landlord/
├── docs/
│   └── agent_instructions.md   <-- this file
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── properties/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── leases/
│   │   │       └── ledger/
│   │   ├── tenants/
│   │   │   ├── page.tsx
│   │   │   └── new/
│   │   ├── api/
│   ├── components/
│   ├── lib/
│   │   ├── db.ts
│   │   └── auth.ts
│   └── styles/
├── .env
├── package.json
└── README.md
```

Agents must respect this structure and extend it logically.

---

## Coding Standards

### General

* Use TypeScript everywhere.
* Prefer async/await.
* Keep components simple and readable.
* Avoid giant files. Split when needed.
* No unused code.
* No placeholders left behind.

### React / Next.js

* Use Server Components by default.
* Only use `"use client"` when required.
* Prefer server actions over API routes.
* Follow App Router conventions.

### Styling

* Tailwind CSS only.
* Keep UI consistent across pages.
* Use simple, clean layouts.
* Tables should be readable and aligned.

### Naming

* Clear, descriptive names.
* Files and folders should match routes.
* Prisma models: PascalCase.
* Fields: camelCase.

---

## Database Rules

* All schema changes go in `prisma/schema.prisma`.
* Use migrations, never manual DB edits.
* Keep relations explicit.
* Avoid nullable fields unless necessary.
* Always show updated models when changed.

---

## Core Features (Must Support)

Agents should understand and preserve these:

### Properties

* List properties
* Add new property
* View property detail
* Link tenants and leases

### Tenants

* List tenants
* Add tenant
* Associate with property via lease

### Leases

* Start/end dates
* Rent amount
* Active vs past
* Linked to tenant + property

### Ledger

* Track:

  * Rent income
  * Housing payments
  * Expenses
* Show by property
* Totals and monthly grouping

### Navigation

* Clear navigation between:

  * Properties
  * Tenants
  * Property detail pages
  * Ledger pages

---

## How Agents Should Work

When asked to add or change features, agents must:

1. Identify exact files and paths to change.
2. Explain what each change does.
3. Output full updated files ready to paste.
4. Never say “existing code here”.
5. Avoid partial snippets unless asked.
6. Match current project patterns.

If unsure about existing code:

* Ask the user to paste the file.
* Do not guess.

---

## Error Handling

* Fix build errors immediately.
* Do not introduce breaking changes.
* If an approach causes regressions, revert and rethink.
* Respect user feedback if a solution is unwanted.

---

## UI Expectations

* Pages should share a consistent look.
* Headers and tables must be clear.
* Buttons should be obvious.
* Similar pages (like Properties and Tenants) should look alike.

---

## Performance

* Avoid unnecessary client rendering.
* Keep queries efficient.
* Avoid loading more data than needed.

---

## Git Practices

* Keep commits focused.
* Do not include:

  * node_modules
  * .next
  * .env
* Use `.gitignore`.

---

## When Generating Code

Always:

* Include full file contents.
* Include import statements.
* Verify TypeScript types.
* Ensure code compiles.

Never:

* Output pseudo-code.
* Leave TODOs unless requested.
* Assume files exist without confirming.

---

## When Unsure

If instructions or project state are unclear:

* Ask before proceeding.
* Do not waste time on wrong assumptions.

---

## Long-Term Vision

This app may later include:

* Reports (monthly, yearly)
* Export to CSV/Excel
* Dashboard summaries
* User accounts
* Document uploads

Agents should design with future expansion in mind.

---

## Final Rule

This project values:

* Accuracy over speed
* Simplicity over cleverness
* Practical features over experiments

Always optimize for a working landlord system that saves time and reduces errors.

```

