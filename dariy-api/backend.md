# Dairy Management App — Separate Development Plans

# Part 1 — Backend Development Plan

# 1. Backend Overview

The backend will power:
- Authentication
- Customer management
- Product management
- Daily delivery entries
- Invoice generation
- Payment tracking
- Reports

The backend will be lightweight, fast, and optimized for small-scale business operations.

---

# 2. Backend Tech Stack

| Purpose | Technology |
|---|---|
| Runtime | Bun |
| Framework | Hono |
| Database | Turso (SQLite) |
| ORM | Drizzle ORM |
| Validation | Zod |
| Authentication | JWT |
| Password Hashing | bcrypt |
| PDF Generation | Puppeteer |
| Hosting | Vercel |

---

# 3. Backend Folder Structure

```txt
src/
 ├── db/
 ├── schema/
 ├── routes/
 ├── middleware/
 ├── validators/
 ├── services/
 ├── utils/
 ├── lib/
 └── index.ts
```

---

# 4. Database Planning

# Tables

## users

```txt
id
name
phone
password
role
created_at
```

---

## customers

```txt
id
name
phone
address
status
created_at
```

---

## products

```txt
id
name
price
unit
is_active
created_at
```

Example Products:

| Product | Default Price | Unit Type |
|---|---|---|
| Milk | ₹60 | Liter |
| Curd | ₹80 | KG |
| Paneer | ₹350 | KG |
| Ghee | ₹650 | Liter |
| Buttermilk | ₹40 | Liter |

Suggested Unit Types:
- Liter
- ML
- KG
- Gram
- Piece

---

## daily_entries

```txt
id
customer_id
product_id
quantity
session
entry_date
price
created_at
```

Session Types:
- MORNING
- EVENING

---

## invoices

```txt
id
customer_id
invoice_number
start_date
end_date
total_amount
paid_amount
pending_amount
status
pdf_url
created_at
```

---

## invoice_items

```txt
id
invoice_id
product_id
quantity
price
amount
```

---

## payments

```txt
id
invoice_id
amount
payment_date
payment_method
notes
created_at
```

---

# 5. Authentication System

# Login Flow

1. User enters phone & password
2. API validates credentials
3. JWT token generated
4. Token returned to app
5. Protected routes use JWT middleware

---

# 6. API Planning

# Authentication APIs

```txt
POST /auth/login
GET  /auth/me
POST /auth/logout
```

---

# Product APIs

```txt
GET    /products
POST   /products
PUT    /products/:id
DELETE /products/:id
```

---

# Customer APIs

```txt
GET    /customers
POST   /customers
PUT    /customers/:id
DELETE /customers/:id
```

---

# Daily Entry APIs

```txt
GET    /entries
POST   /entries
PUT    /entries/:id
DELETE /entries/:id
```

---

# Invoice APIs

```txt
GET  /invoices
POST /invoices/generate
GET  /invoices/:id
GET  /invoices/:id/pdf
```

---

# Payment APIs

```txt
GET  /payments
POST /payments
```

---

# Report APIs

```txt
GET /reports/daily-sales
GET /reports/monthly-sales
GET /reports/customer-summary
```

---

# 7. Backend Middleware

Required Middleware:
- JWT Authentication
- Role Authorization
- Error Handling
- Request Validation
- Logging

---

# 8. Invoice PDF Flow

# Invoice Generation Process

1. User selects date range
2. Backend calculates totals
3. Invoice created in DB
4. Puppeteer generates PDF
5. PDF URL returned

---

# 9. Validation Rules

Use Zod for validation.

Examples:
- Phone validation
- Required product name
- Quantity > 0
- Valid date range
- Payment amount validation

---

# 10. Backend Security

Security Features:
- JWT authentication
- Password hashing
- Protected routes
- Role-based access
- Request validation

---

# 11. Backend Deployment

# Backend Hosting

Deploy on:
- Vercel

---

# Database Hosting

Use:
- Turso SQLite

---

# 12. Backend Development Phases

# Phase 1

Setup:
- Hono
- Bun
- Drizzle
- Turso
- Authentication

Estimated:
2–3 days

---

# Phase 2

Core APIs:
- Customers
- Products
- Entries
- Payments
- Invoices

Estimated:
5–7 days

---

# Phase 3

Reports & PDF:
- Reports
- Invoice PDFs
- Search/filtering
- Optimization

Estimated:
3–4 days

---

# 13. Final Backend Recommendation

Final Backend Stack:
- Hono
- Bun
- Drizzle ORM
- Turso SQLite
- Vercel

This setup is:
- Lightweight
- Fast
- Cheap
- Easy to maintain
- Perfect for your scale
