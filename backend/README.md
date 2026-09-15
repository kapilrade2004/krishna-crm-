# Krishna CRM — Backend API

Node.js / Express / MySQL backend for the Krishna CRM Order Processing platform.

---

## Stack

| Layer        | Technology                        |
|-------------|-----------------------------------|
| Runtime     | Node.js ≥ 18                      |
| Framework   | Express.js 4                      |
| ORM         | Sequelize 6 (MySQL2 driver)       |
| Database    | MySQL 8.x                         |
| Auth        | JWT (access + refresh tokens)     |
| Cache       | Redis (config ready, disabled)    |
| Files       | Multer (CSV / images)             |
| WhatsApp    | Meta Cloud API v19                |
| Logging     | Winston + DailyRotateFile         |

---

## Project Structure

```
backend/
├── migrations/
│   └── 001_initial_schema.sql   ← Run this first
├── src/
│   ├── config/
│   │   ├── database.js          ← Sequelize connection
│   │   ├── logger.js            ← Winston logger
│   │   ├── cache.js             ← Redis abstraction (no-op until enabled)
│   │   ├── migrate.js           ← Migration runner
│   │   └── seed.js              ← Seed default users
│   ├── models/
│   │   ├── User.js
│   │   ├── Customer.js
│   │   ├── Order.js
│   │   ├── Operations.js        ← OrderActivity, FollowUp, Task, CsvImportBatch, WhatsAppLog
│   │   └── index.js             ← Associations
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── customerController.js
│   │   ├── orderController.js
│   │   ├── followUpController.js
│   │   ├── taskController.js
│   │   ├── csvController.js
│   │   └── dashboardController.js
│   ├── services/
│   │   ├── csvService.js        ← Marketplace CSV parsing engine
│   │   └── whatsappService.js   ← Meta Cloud API integration
│   ├── middleware/
│   │   ├── auth.js              ← JWT protect + RBAC authorize
│   │   └── upload.js            ← Multer for CSV / images
│   ├── routes/
│   │   ├── auth.js
│   │   ├── customers.js
│   │   ├── orders.js
│   │   ├── followUps.js
│   │   ├── tasks.js
│   │   ├── csv.js
│   │   ├── dashboard.js
│   │   └── whatsapp.js
│   ├── utils/
│   │   ├── errors.js            ← AppError class + global handler
│   │   └── response.js          ← sendSuccess / sendPaginated helpers
│   └── server.js                ← Express app entry point
├── uploads/                     ← Auto-created at startup
├── logs/                        ← Auto-created at startup (production)
├── .env.example
└── package.json
```

---

## Quick Start

### 1. Create MySQL database

```sql
CREATE DATABASE krishna_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DB_HOST, DB_USER, DB_PASSWORD, JWT_SECRET
```

### 3. Run database migration

```bash
# Option A — SQL file (recommended for production)
mysql -u root -p krishna_crm < migrations/001_initial_schema.sql

# Option B — Migration runner (reads .env)
npm run migrate
```

### 4. Install dependencies & seed

```bash
npm install
npm run seed          # Creates admin / ceo / sales users
```

### 5. Start

```bash
npm run dev           # Development (nodemon)
npm start             # Production
```

Server starts on **port 5000** by default.

---

## API Endpoints

### Auth
| Method | Path                        | Access        |
|--------|-----------------------------|---------------|
| POST   | /api/auth/login             | Public        |
| POST   | /api/auth/refresh           | Public        |
| POST   | /api/auth/logout            | Protected     |
| GET    | /api/auth/me                | Protected     |
| PATCH  | /api/auth/me                | Protected     |
| PATCH  | /api/auth/change-password   | Protected     |
| POST   | /api/auth/users             | Admin         |
| GET    | /api/auth/users             | Admin/Manager |
| PATCH  | /api/auth/users/:id         | Admin         |

### Customers
| Method | Path                        | Notes                        |
|--------|-----------------------------|------------------------------|
| GET    | /api/customers              | ?q= ?status= ?source= ?page= |
| POST   | /api/customers              |                              |
| GET    | /api/customers/:id          | Includes orders + follow-ups |
| PATCH  | /api/customers/:id          |                              |
| DELETE | /api/customers/:id          | Soft delete                  |
| GET    | /api/customers/:id/orders   |                              |

### Orders
| Method | Path                        | Notes                             |
|--------|-----------------------------|-----------------------------------|
| GET    | /api/orders                 | ?status= ?marketplace= ?q= ?page= |
| POST   | /api/orders                 |                                   |
| GET    | /api/orders/:id             | Includes activity log + WA logs   |
| PATCH  | /api/orders/:id             |                                   |
| PATCH  | /api/orders/:id/status      | Triggers WhatsApp notifications   |
| PATCH  | /api/orders/:id/flow-stage  | Order processing flow (mindmap)   |
| DELETE | /api/orders/:id             | Admin/Manager only                |
| GET    | /api/orders/:id/activities  |                                   |

### Follow-Ups
| Method | Path              | Notes                                  |
|--------|-------------------|----------------------------------------|
| GET    | /api/follow-ups   | ?status= ?overdue=true ?today=true     |
| POST   | /api/follow-ups   |                                        |
| GET    | /api/follow-ups/:id |                                      |
| PATCH  | /api/follow-ups/:id | Rescheduling auto-creates next follow-up |
| DELETE | /api/follow-ups/:id |                                      |

### Tasks
| Method | Path              | Notes                        |
|--------|-------------------|------------------------------|
| GET    | /api/tasks/dashboard | Kanban counts by status   |
| GET    | /api/tasks        | ?status= ?priority= ?overdue= |
| POST   | /api/tasks        |                              |
| GET    | /api/tasks/:id    |                              |
| PATCH  | /api/tasks/:id    |                              |
| DELETE | /api/tasks/:id    |                              |

### CSV Import
| Method | Path                  | Notes                           |
|--------|-----------------------|---------------------------------|
| POST   | /api/csv/upload       | multipart/form-data, field: file |
| GET    | /api/csv/batches      |                                 |
| GET    | /api/csv/batches/:id  | Processing status + error log   |

### Dashboard
| Method | Path               | Notes                |
|--------|--------------------|----------------------|
| GET    | /api/dashboard/kpis | All KPIs + charts   |
| GET    | /api/dashboard/ceo  | CEO pulse view       |

### Shipping & Tracking
| Method | Path                              | Access          | Notes                                       |
|--------|-----------------------------------|-----------------|---------------------------------------------|
| GET    | /api/shipping/dashboard           | All             | Pending dispatch, in-transit, delivered today, by partner |
| GET    | /api/shipping/partners            | All             | List shipping partners (?is_active=true)    |
| POST   | /api/shipping/partners            | Admin/Manager   | Create shipping partner                     |
| GET    | /api/shipping/partners/:id        | All             | Partner detail + serviceability entries     |
| PATCH  | /api/shipping/partners/:id        | Admin/Manager   | Update partner                              |
| DELETE | /api/shipping/partners/:id        | Admin/Manager   | Deactivates if in use, else deletes         |
| GET    | /api/shipping/serviceability      | All             | ?pincode= — check TAT/serviceability for a pincode |
| GET    | /api/shipping/serviceability/list | Admin/Manager   | Paginated management list                   |
| POST   | /api/shipping/serviceability      | Admin/Manager   | Add pincode TAT entry                       |
| POST   | /api/shipping/serviceability/bulk | Admin/Manager   | Bulk upload (JSON array, max 1000)          |
| PATCH  | /api/shipping/serviceability/:id  | Admin/Manager   | Update entry                                |
| DELETE | /api/shipping/serviceability/:id  | Admin/Manager   | Delete entry                                |
| PATCH  | /api/orders/:id/shipping          | All             | Update tracking/partner/pincode/ETA — auto-dispatches + sends WhatsApp if `mark_dispatched: true` |

### WhatsApp
| Method | Path                   | Notes                  |
|--------|------------------------|------------------------|
| GET    | /api/whatsapp/webhook  | Meta verification      |
| POST   | /api/whatsapp/webhook  | Incoming messages      |

### Health
| Method | Path     |
|--------|----------|
| GET    | /health  |

---

## Default Credentials (change immediately)

| Role  | Email                          | Password      |
|-------|--------------------------------|---------------|
| Admin | admin@krishnacrm.com           | Admin@123456  |
| Manager| manager@krishnacrm.com        | Manager@123456|
| Sales | sales@krishnacrm.com           | Sales@123456  |

---

## Order Processing Flow

Mirrors the mindmap exactly via `flow_stage` on every order:

```
ask_images → match_pending → match_confirmed / match_alternate / match_reorder / match_cancelled
           → processing → delivery_confirmed → installation → feedback_pending → completed
```

Use `PATCH /api/orders/:id/flow-stage` to move an order through stages.

---

## CSV Marketplace Formats

The CSV service auto-maps columns for:
- **Amazon** — `order-id`, `purchase-date`, `product-name`, `recipient-name`, etc.
- **Flipkart** — `Order ID`, `Order Date`, `Product Name`, etc.
- **IndiaMart** — `Inquiry No`, `Buyer Name`, `Mobile`, etc.
- **Other** — generic `order_id`, `customer_name`, `phone` columns

Duplicate orders (same `marketplace_order_id` + `marketplace`) are skipped automatically.

---

## Redis (future activation)

When credentials are available:
1. Install: `npm install ioredis`
2. Set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` in `.env`
3. Uncomment the Redis client block in `src/config/cache.js`

All callers use `cache.wrap()` / `cache.get()` / `cache.del()` — no changes elsewhere needed.

---

## Production Checklist

- [ ] Change all default passwords
- [ ] Set a strong `JWT_SECRET` (32+ random chars)
- [ ] Set `NODE_ENV=production`
- [ ] Point `FRONTEND_URL` to your actual domain
- [ ] Configure `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN`
- [ ] Set up SSL (NGINX config provided in `nginx.conf`)
- [ ] Enable Redis and set credentials
- [ ] Set up automated MySQL backups
