# AgentPay

**The practice system under test for the [RizTech Academy](https://www.riztechacademy.com/learn) QA &
Test Automation course.**

AgentPay is a small but realistic **mobile-money agent platform**: field agents take deposits, withdrawals
and payments on behalf of customers, and an operations team watches the transactions through a web console.
It exists so you can practise real QA work — manual testing, API testing, and automation with Playwright —
against software that behaves like the systems you will actually test on the job.

It is deliberately buildable and runnable on any machine with Node.js, with **no database to install**: the
API keeps its data in memory and reseeds to the same deterministic baseline on every start, so every test
run sees exactly the same data.

## What is in here

| Part | Path | What it is |
|------|------|------------|
| **API** | `apps/api` | A Fastify + TypeScript JSON API — auth, agents, transactions (with filtering, sorting, pagination), idempotent payments, role-based access, and a dashboard summary. |
| **Web console** | `apps/web` | A React operational dashboard — login, a transactions table with filters/sort/pagination, a "new transaction" form, and summary cards. |
| **API tests** | `apps/api/src/app.test.ts` | Vitest tests exercising the API directly (the api-automation module). |
| **End-to-end tests** | `apps/web/tests` | Playwright tests driving the whole stack through the browser (the web-automation module). |

## Running it

```bash
npm install            # installs all workspaces
npm run dev:api        # API on http://localhost:4000
npm run dev:web        # web console on http://localhost:5173 (in a second terminal)
```

Open http://localhost:5173 and sign in with one of the seeded accounts.

### Seeded accounts

| Email | Password | Role | Sees |
|-------|----------|------|------|
| `admin@agentpay.test` | `admin123` | admin | all agents and transactions |
| `asha@agentpay.test` | `operator123` | operator | only agent 1's data |
| `ravi@agentpay.test` | `operator123` | operator | only agent 2's data |

These are test credentials for a local practice app — nothing here is a real account.

## Running the tests

```bash
npm run test:api       # API tests (Vitest)
npm run test:e2e       # end-to-end tests (Playwright) — starts both servers for you
```

The Playwright config starts the API and the web console automatically and reseeds the API before each test,
so the suite is self-contained and deterministic.

## The API, briefly

All routes except `POST /auth/login` need an `Authorization: Bearer <token>` header.

| Method & path | What it does |
|---------------|--------------|
| `POST /auth/login` | Log in, returns a token and the user. |
| `GET /agents`, `GET /agents/:id` | List / read agents (scoped by role). |
| `GET /transactions` | List with `status`, `agentId`, `from`, `to`, `sort`, `order`, `page`, `limit`. |
| `GET /transactions/:id` | Read one (404 if missing, 403 if out of an operator's scope). |
| `POST /transactions` | Create one; validated; honours an `Idempotency-Key` header. |
| `GET /dashboard/summary` | Counts by status and total settled value. |

Deliberate testing hooks worth exploring: **role scoping** (an operator cannot read another agent's
transaction by changing the id — a 403, not a 404), **idempotency** (the same `Idempotency-Key` never
creates a duplicate), **validation** (amount, phone format, limits), and **suspended agents** (409).

## A note for learners

This is a teaching codebase, kept small on purpose. It is not production software: the auth secret is fixed,
the data is in memory, and some things are simplified. Your job is to test it — find where it is strict,
where it is lenient, and where a real system would need more. The course walks you through exactly that.
