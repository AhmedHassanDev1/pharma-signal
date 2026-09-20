# Pharma Signal Platform

Enterprise data ingestion, schema profiling, and monitoring platform.

## Architecture & Code Organization

The platform is organized as a **Monorepo** with strict domain and deployment boundaries:

```text
pharma-signal/
├── apps/
│   ├── backend/        # NestJS REST API, Prisma ORM, DB repositories, business logic
│   └── frontend/       # Next.js 14 App Router management dashboard & viewer
│
├── packages/
│   ├── contracts/      # Shared API & Domain interfaces, DTOs, enums, RFC 7807 problem details
│   ├── validation/     # Shared Zod validation schemas
│   └── config/         # Non-sensitive constants & API version definitions (NO SECRETS)
│
├── docker/             # Local PostgreSQL Docker Compose configuration
├── scripts/            # Development verification and automation scripts
├── package.json        # Monorepo workspaces definition and root commands
└── README.md
```

## Shared Packages vs Boundaries

| Layer | Location | Responsibilities | What Must NOT Be Here |
|---|---|---|---|
| **Contracts** | `packages/contracts` | TypeScript interfaces, DTO contracts, Enums, RFC 7807 types | Business logic, DB models, runtime secrets |
| **Validation** | `packages/validation` | Reusable Zod schemas for request/response validation | Database queries, server-only dependencies |
| **Config** | `packages/config` | Non-sensitive constants, API paths (`/api/v1`), pagination defaults | Database credentials, API tokens, encryption keys |
| **Backend** | `apps/backend` | NestJS application, Prisma ORM, auth guards, ingestion engine | UI components, frontend state |
| **Frontend** | `apps/frontend` | Next.js/React dashboard, visual explorer, client state | Server secrets, database drivers |
| **Desktop Agent** | *External* | Client-side discovery, schema extraction, and sync agent | Merged into this monorepo |

## Deployment Boundaries

A **Monorepo is a code-organization decision, not a deployment topology**. Each component is independently built and deployed:

- **Frontend**: Deployed independently to Vercel or any modern frontend host.
- **Backend**: Deployed independently to a VPS or Cloud container environment.
- **PostgreSQL**: Managed or independent database server.
- **Desktop Agent**: Distributed and run on customer premise machines, communicating exclusively via the HTTPS `/api/v1` API.

---

## Getting Started from Scratch

### Prerequisites
- **Node.js**: >= 20.0.0 (`node -v`)
- **npm**: >= 10.0.0 (`npm -v`)
- **Docker Desktop**: Running with WSL2 or Hyper-V backend (`docker version`)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the environment template to create your local `.env` file:
```bash
# Windows PowerShell:
Copy-Item .env.example .env
Copy-Item .env.example apps/backend/.env

# Linux / macOS:
cp .env.example .env
cp .env.example apps/backend/.env
```

### 3. Start PostgreSQL Database
```bash
npm run db:up
```
*Starts PostgreSQL 16 on `127.0.0.1:5432` with healthcheck enabled.*

### 4. Run Database Migrations
```bash
npm run db:migrate
```
*Applies all Prisma migrations to initialize the schema (`organizations`, `branches`, `devices`, `data_sources`).*

### 5. Seed Development Data (Optional)
```bash
npm run db:seed
```
*Inserts sample development records: 1 Organization (`Ahmed Pharma Group`), 2 Branches, 1 Device, and 1 DataSource.*

### 6. Start Applications

In separate terminal windows:

```bash
# Terminal 1: Start Backend (NestJS with hot reload)
npm run dev:backend
# API available at: http://localhost:3000/api/v1
# Health check at:  http://localhost:3000/api/v1/health

# Terminal 2: Start Frontend (Next.js dashboard)
npm run dev:frontend
# Dashboard available at: http://localhost:3001
```

### 7. Run Local Verification / Smoke Test
```bash
npm run verify:local
```
*Automated check verifying:*
1. PostgreSQL container connectivity on `127.0.0.1:5432`
2. Database query execution via Prisma
3. Backend live HTTP health endpoint (`/api/v1/health`)

---

## Root Commands Reference

| Command | Description |
|---|---|
| `npm run build` | Builds all packages and applications in dependency order |
| `npm run typecheck` | Runs TypeScript typecheck (`tsc --noEmit`) across all workspaces |
| `npm test` | Runs unit and integration test suites across backend and frontend |
| `npm run db:up` | Starts local PostgreSQL container via Docker Compose |
| `npm run db:down` | Stops local PostgreSQL container |
| `npm run db:reset` | Wipes PostgreSQL volume and starts a fresh container |
| `npm run db:migrate` | Deploys Prisma migrations to the database |
| `npm run db:seed` | Seeds database with development records |
| `npm run dev:backend` | Starts NestJS backend in development mode with watch |
| `npm run dev:frontend` | Starts Next.js frontend in development mode on port 3001 |
| `npm run verify:local` | Runs automated smoke check verifying DB and backend health |

---

## Current Project Status

- **M1 — Foundation & Monorepo**: Complete (Monorepo setup, NestJS scaffolding, Next.js frontend shell, PostgreSQL + Prisma database layer, and local development DX).
- **M2 — Backend Core & Device Enrollment**: Next milestone (Device enrollment token lifecycle, authentication guards, and enrollment endpoints).
- *Note: Business endpoints beyond `/api/v1/health` (such as enrollment, data source registration, and sync) are scheduled for implementation in upcoming milestones.*
