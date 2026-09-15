# Krishna CRM — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS frontend for the Krishna CRM platform.

---

## Stack

| Layer        | Technology                    |
|-------------|--------------------------------|
| Framework   | Next.js 14 (App Router)        |
| Language    | TypeScript                     |
| Styling     | Tailwind CSS (custom design system) |
| Data fetching | TanStack React Query          |
| State       | Zustand (auth store)           |
| Charts      | Recharts                       |
| Icons       | Lucide React                   |
| Notifications | react-hot-toast              |

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              ← Root layout + providers
│   ├── page.tsx                ← Redirects to /dashboard
│   ├── providers.tsx           ← React Query provider
│   ├── auth/
│   │   ├── layout.tsx           ← Centered auth layout
│   │   └── login/page.tsx
│   ├── dashboard/page.tsx      ← KPIs + charts
│   ├── orders/
│   │   ├── page.tsx             ← Orders list (filters, pagination)
│   │   ├── new/page.tsx         ← Create order
│   │   └── [id]/page.tsx        ← Order detail (status, flow stage, activity log)
│   ├── customers/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx        ← Customer detail (orders, follow-ups, WhatsApp opt-in)
│   ├── follow-ups/page.tsx     ← Follow-up management
│   ├── tasks/page.tsx          ← Kanban task board
│   ├── csv-import/page.tsx     ← Marketplace CSV upload + progress
│   ├── reports/page.tsx        ← Sales/team reports + CSV export
│   └── ceo-view/page.tsx       ← Executive pulse dashboard
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx         ← Auth guard + sidebar layout wrapper
│   │   ├── Sidebar.tsx          ← Role-based navigation
│   │   └── Topbar.tsx
│   └── ui/index.tsx            ← Button, Input, Select, Modal, Badge, KpiCard, etc.
├── hooks/
│   └── useApi.ts               ← All React Query hooks (orders, customers, etc.)
├── lib/
│   ├── api.ts                  ← Axios instance + auto token refresh
│   ├── auth.ts                 ← Zustand auth store
│   └── utils.ts                ← Formatters, status colour maps, constants
├── types/index.ts              ← All shared TypeScript types
└── styles/globals.css          ← Design tokens (navy/amber/teal theme)
```

---

## Quick Start

### 1. Configure environment

```bash
cp .env.local.example .env.local   # if not present, create with:
# NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 2. Install & run

```bash
npm install
npm run dev      # http://localhost:3000
```

### 3. Production build

```bash
npm run build
npm start
```

---

## Design System

Matches the Krishna CRM brand:

| Token   | Hex       | Usage                          |
|---------|-----------|---------------------------------|
| Navy    | `#0F1C2E` | Sidebar, headings                |
| Amber   | `#E8A020` | Primary actions, active states   |
| Teal    | `#1A8F7A` | Success/positive status           |
| Surface | `#F5F7FA` | Page background                  |

All tokens are defined in `tailwind.config.js` and `styles/globals.css`.

---

## Authentication Flow

1. `POST /api/auth/login` → access token stored in `localStorage`, refresh token in httpOnly cookie.
2. Axios interceptor (`lib/api.ts`) attaches `Authorization: Bearer <token>` to every request.
3. On `401`, the interceptor automatically calls `/api/auth/refresh` and retries the original request.
4. `AppShell` component redirects unauthenticated users to `/auth/login`.

---

## Role-Based Navigation

The sidebar (`components/layout/Sidebar.tsx`) shows/hides items based on `user.role`:

| Page        | Visible to                          |
|-------------|--------------------------------------|
| Dashboard   | All roles                            |
| Orders      | All roles                            |
| Customers   | All roles                            |
| Follow-Ups  | All roles                            |
| Tasks       | All roles                            |
| CSV Import  | admin, manager, sales                |
| Reports     | admin, manager, ceo                  |
| CEO View    | admin, ceo                           |

---

## Order Processing Flow (Mindmap)

The order detail page (`app/orders/[id]/page.tsx`) exposes two independent controls:

1. **Status** — fulfilment lifecycle (pending → confirmed → processing → dispatched → delivered, with cancelled/returned/refunded branches). Enforced server-side via a state machine; invalid transitions are rejected with a clear error.
2. **Flow Stage** — mirrors the 7-step SOW mindmap (ask_images → match_* → processing → delivery_confirmed → installation → feedback_pending → completed).

Every change is logged to the Activity tab via `order_activities`.

---

## Default Login Credentials

| Role  | Email                          | Password      |
|-------|--------------------------------|---------------|
| Admin | admin@krishnacrm.com           | Admin@123456  |
| Manager| manager@krishnacrm.com        | Manager@123456|
| Sales | sales@krishnacrm.com           | Sales@123456  |

---

## Production Checklist

- [ ] Set `NEXT_PUBLIC_API_URL` to the production API domain
- [ ] Run `npm run build` and verify all 15 routes compile
- [ ] Serve via `npm start` behind NGINX (see backend `nginx.conf`)
- [ ] Confirm CORS `FRONTEND_URL` in backend `.env` matches this domain
