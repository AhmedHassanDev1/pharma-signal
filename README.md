# Pharma Signal Platform

Enterprise data ingestion, schema profiling, and monitoring platform.

## Architecture & Code Organization

The platform is organized as a **Monorepo** with strict domain and deployment boundaries:

```text
pharma-signal/
├── apps/
│   ├── backend/        # NestJS REST API, DB repositories, business logic
│   └── frontend/       # Next.js / React management dashboard & viewer
│
├── packages/
│   ├── contracts/      # Shared API & Domain interfaces, DTOs, enums, RFC 7807 problem details
│   ├── validation/     # Shared Zod validation schemas
│   └── config/         # Non-sensitive constants & API version definitions (NO SECRETS)
│
├── docker/             # Local development and container orchestration
├── package.json        # Monorepo workspaces definition
└── README.md
```

## Shared Packages vs Boundaries

| Layer | Location | Responsibilities | What Must NOT Be Here |
|---|---|---|---|
| **Contracts** | `packages/contracts` | TypeScript interfaces, DTO contracts, Enums, RFC 7807 types | Business logic, DB models, runtime secrets |
| **Validation** | `packages/validation` | Reusable Zod schemas for request/response validation | Database queries, server-only dependencies |
| **Config** | `packages/config` | Non-sensitive constants, API paths (`/api/v1`), pagination defaults | Database credentials, API tokens, encryption keys |
| **Backend** | `apps/backend` | NestJS application, database ORM/Prisma, auth guards, ingestion engine | UI components, frontend state |
| **Frontend** | `apps/frontend` | Next.js/React dashboard, visual explorer, client state | Server secrets, database drivers |
| **Desktop Agent** | *External* | Client-side discovery, schema extraction, and sync agent | Merged into this monorepo |

## Deployment Boundaries

A **Monorepo is a code-organization decision, not a deployment topology**. Each component is independently built and deployed:

- **Frontend**: Deployed independently to Vercel or any modern frontend host.
- **Backend**: Deployed independently to a VPS or Cloud container environment.
- **PostgreSQL**: Managed or independent database server.
- **Desktop Agent**: Distributed and run on customer premise machines, communicating exclusively via the HTTPS `/api/v1` API.

## Getting Started

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose (for local database services)

### Installation & Build

```bash
# Install all dependencies across workspaces
npm install

# Build all packages and applications
npm run build

# Typecheck all packages and applications
npm run typecheck
```
