# React Native CLI Dairy Management App — Codex Development Plan

## 1. Project Overview

A mobile-only Dairy Management application built using React Native CLI.

The application contains:

- Admin Panel
- Customer Panel

inside a single mobile application.

The system is optimized for:

- Small-scale dairy businesses
- Single admin usage
- Around 100 customers
- Lightweight operations
- Fast mobile-first workflows

---

# 2. Recommended Tech Stack

| Purpose | Technology |
|---|---|
| Mobile Framework | React Native CLI |
| Language | TypeScript |
| Navigation | React Navigation |
| State Management | Zustand |
| API Client | Axios |
| API Caching | TanStack Query |
| Forms | React Hook Form |
| Validation | Zod |
| Local Storage | react-native-mmkv |
| Styling | NativeWind + Tailwind |
| Lists | FlashList |
| Icons | Lucide React Native |
| Date Handling | Day.js |
| Bottom Sheets | @gorhom/bottom-sheet |
| Animations | react-native-reanimated |
| Toasts | react-native-toast-message |
| PDF Handling | react-native-pdf |
| File Sharing | react-native-share |
| File Download | react-native-fs |
| Environment Variables | react-native-config |

---

# 3. Why React Native CLI

React Native CLI is preferred because:

- Better native control
- Smaller production build size
- Easier PDF support
- Better performance
- Easier future offline support
- Better file handling
- Better native integrations
- More scalable long-term

Best suited for:

- Business applications
- Invoice systems
- PDF sharing
- Local storage heavy workflows

---

# 4. Project Structure

```txt
src/
 ├── screens/
 │    ├── auth/
 │    ├── admin/
 │    └── customer/
 │
 ├── components/
 │
 ├── navigation/
 │
 ├── services/
 │
 ├── api/
 │
 ├── store/
 │
 ├── hooks/
 │
 ├── validations/
 │
 ├── constants/
 │
 ├── utils/
 │
 ├── theme/
 │
 ├── types/
 │
 ├── assets/
 │
 └── config/
```

---

# 5. Authentication Flow

## Login Process

1. User enters phone number and password
2. App calls authentication API
3. JWT token stored in MMKV storage
4. User profile fetched
5. Role-based navigation activated

Roles:

- ADMIN
- CUSTOMER

---

# 6. Navigation Structure

## Root Navigation

```txt
Root Stack
 ├── Splash
 ├── Auth Stack
 └── App Stack
```

---

## Authentication Stack

Screens:

- Splash Screen
- Login Screen

---

## Admin Bottom Tabs

Tabs:

- Dashboard
- Customers
- Products
- Entries
- Invoices
- Reports

---

## Customer Bottom Tabs

Tabs:

- Deliveries
- Invoices
- Payments
- Profile

---

# 7. Admin Modules

## Dashboard

Features:

- Total customers
- Daily sales
- Monthly revenue
- Pending payments
- Recent activity
- Quick actions

---

## Customer Management

Features:

- Add customer
- Edit customer
- Delete customer
- Search customer
- Active/inactive customer status

---

## Product Management

Features:

- Add product
- Edit product
- Delete product
- Update pricing
- Unit type management

Supported Units:

- Liter
- KG
- Packet
- Piece

---

## Daily Entry Management

Features:

- Morning entries
- Evening entries
- Product selection
- Quantity input
- Date filtering
- Repeat previous entries

---

## Invoice Management

Features:

- Generate invoice
- View invoice
- Share PDF
- Download invoice
- Payment tracking
- Outstanding balance tracking

---

## Reports Module

Features:

- Daily sales report
- Monthly sales report
- Product analytics
- Customer purchase history
- Revenue summary

---

# 8. Customer Modules

## Delivery History

Features:

- Delivery tracking
- Product-wise history
- Morning/evening entries
- Date filtering

---

## Customer Invoice Module

Features:

- Invoice history
- PDF download
- Payment summary
- Pending dues

---

## Payments Screen

Features:

- Payment history
- Pending amount
- Last payment date

---

## Profile Screen

Features:

- Update profile
- Change password
- Address update

---

# 9. State Management

Use Zustand for:

- Authentication state
- User session
- Dashboard statistics
- Product cache
- Customer cache
- Invoice cache
- Filters
- Future offline sync queue

---

# 10. API Architecture

## Services Structure

```txt
services/
 ├── auth.service.ts
 ├── customer.service.ts
 ├── product.service.ts
 ├── entry.service.ts
 ├── invoice.service.ts
 ├── payment.service.ts
 └── report.service.ts
```

---

## Axios Client Features

- JWT interceptor
- Auto logout on 401
- Centralized error handling
- Timeout handling
- Retry support

---

# 11. Form Handling

Use:

- React Hook Form
- Zod validation

Forms:

- Login
- Add customer
- Add product
- Daily entries
- Invoice payments

---

# 12. UI/UX Guidelines

Design Goals:

- Clean layouts
- Fast data entry
- Large buttons
- Minimal navigation depth
- Mobile-first design

Recommended Components:

- Bottom tabs
- Floating action buttons
- Search bars
- Card layouts
- Skeleton loaders
- Sticky headers

---

# 13. Performance Optimization

Use:

- FlashList
- React.memo
- Lazy screen loading
- API caching
- MMKV storage
- Batched API requests

Future:

- Pagination
- Offline-first support

---

# 14. Offline Capability (Future Scope)

Possible upgrades:

- Store pending entries locally
- Sync when internet reconnects

Useful for:

- Rural delivery locations
- Weak internet environments

Future Recommended Tools:

- SQLite
- WatermelonDB
- Realm

---

# 15. Security Planning

Security Features:

- Secure token storage
- Protected routes
- Role-based access
- HTTPS APIs only
- Logout on token expiry

---

# 16. Environment Management

Environment Files:

```txt
.env.development
.env.staging
.env.production
```

Example:

```env
API_URL=https://api.example.com
```

---

# 17. Invoice & PDF Planning

Recommended Approach:

- Generate PDF from backend
- App downloads and shares PDF

Benefits:

- Lightweight app
- Faster rendering
- Easier maintenance

Invoice Features:

- PDF preview
- Share on WhatsApp
- Download locally

---

# 18. Notification Planning

Current Scope:

- No push notifications
- No SMS integration
- No cron reminders

Possible Future:

- Local reminder notifications

---

# 19. Android Build Setup

Recommended:

- Android-first development
- Minimum Android version: Android 8+

Build Types:

- Debug
- Staging
- Production

Build Commands:

```bash
cd android
./gradlew assembleRelease
```

Play Store Bundle:

```bash
./gradlew bundleRelease
```

---

# 20. Play Store Deployment Checklist

Required:

- App icon
- Splash screen
- Privacy policy
- Signed AAB
- Production API URL
- App screenshots

---

# 21. Recommended Backend Stack

Recommended Backend:

- Hono
- Bun Runtime
- Drizzle ORM
- PostgreSQL or SQLite

Why:

- Lightweight
- Fast APIs
- Type-safe
- Easy deployment
- Great TypeScript support

---

# 22. Suggested Development Timeline

## Phase 1 — Project Setup

Tasks:

- React Native CLI setup
- Navigation setup
- Authentication flow
- API integration
- Base UI setup

Estimated Time:

3–4 days

---

## Phase 2 — Core Features

Tasks:

- Customers
- Products
- Daily entries
- Invoices
- Payments

Estimated Time:

7–12 days

---

## Phase 3 — Reports & Optimization

Tasks:

- Dashboard
- Reports
- PDF sharing
- Performance optimization
- UI polishing

Estimated Time:

4–6 days

---

# 23. Final Recommended Stack

| Layer | Technology |
|---|---|
| Mobile | React Native CLI |
| Language | TypeScript |
| State | Zustand |
| API | Axios + React Query |
| Storage | MMKV |
| Forms | React Hook Form |
| Validation | Zod |
| UI | NativeWind |
| Lists | FlashList |

---

# 24. Final Recommendation

This architecture is:

- Lightweight
- Fast
- Production-ready
- Easy to maintain
- Excellent for admin-heavy workflows
- Ideal for small-scale dairy management businesses
- Scalable for future growth

