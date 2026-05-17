# Frontend API Guide

This guide is for frontend code agents building the Dairy mobile app. The API is a Bun + Hono JSON API with JWT bearer auth, role-based access, and a Swagger/OpenAPI source at `/openapi.json`.

## Runtime URLs

- Local API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- Health check: `GET /health`

Use the deployed API base URL in production. All paths below are relative to the base URL.

## Response Format

Most JSON endpoints return a success envelope:

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
};
```

Errors use this envelope:

```ts
type ApiError = {
  success: false;
  error: string;
  details?: unknown;
};
```

`GET /invoices/:id/pdf` is the exception. It returns `application/pdf` bytes, not a JSON envelope.

Common status codes:

- `400`: invalid body/query, business rule failure, or no data for invoice generation.
- `401`: missing, invalid, or expired bearer token.
- `403`: role/access denied.
- `404`: route or resource not found.
- `409`: overlapping invoice date range.
- `500`: server error.

## Auth

Send protected requests with:

```txt
Authorization: Bearer <jwt>
Content-Type: application/json
```

JWT payloads are issued by `POST /auth/login` and expire after 30 days. Store the token securely on the client, for example in SecureStore or AsyncStorage depending on app requirements.

Roles:

- `ADMIN`: can manage products, customers, entries, invoices, payments, and reports.
- `CUSTOMER`: can read their own entries, invoices, payments, profile, update own location, and change own password.

Seeded local admin:

```txt
phone: 9999999999
password: password123
```

## Shared Validation Rules

- `id`: positive integer.
- `phone`: 10 to 15 digits.
- `date`: `YYYY-MM-DD`.
- `month`: `YYYY-MM`.
- `status`: customer `ACTIVE | INACTIVE`; invoice `UNPAID | PARTIAL | PAID | VOID`.
- `session`: `MORNING | EVENING`.
- `unit`: `LITER | ML | KG | GRAM | PIECE`.
- `paymentMethod`: `CASH | UPI | BANK_TRANSFER | CARD | OTHER`.
- Query booleans are strings: `includeInactive=true` or `includeInactive=false`.

## Suggested TypeScript Client

```ts
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; error: string; details?: unknown };

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...init } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || !payload.success) {
    const error = payload as ApiFailure;
    throw new ApiRequestError(error.error || "Request failed", response.status, error.details);
  }

  return payload.data;
}
```

For PDFs, call `fetch` directly and read `response.blob()` or `response.arrayBuffer()`.

## Data Types

```ts
export type UserRole = "ADMIN" | "CUSTOMER";
export type CustomerStatus = "ACTIVE" | "INACTIVE";
export type ProductUnit = "LITER" | "ML" | "KG" | "GRAM" | "PIECE";
export type EntrySession = "MORNING" | "EVENING";
export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "VOID";
export type PaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CARD" | "OTHER";

export type AuthUser = {
  id: number;
  name: string;
  phone: string;
  role: UserRole;
  customerId: number | null;
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  googleLocation: string | null;
  googlePlaceId: string | null;
  googleFormattedAddress: string | null;
  googleMapsUrl: string | null;
  status: CustomerStatus;
  createdAt: string;
};

export type Product = {
  id: number;
  name: string;
  price: number;
  unit: ProductUnit;
  isActive: boolean;
  createdAt: string;
};

export type Entry = {
  id: number;
  customerId: number;
  productId: number;
  quantity: number;
  session: EntrySession;
  entryDate: string;
  price: number;
  createdAt: string;
};

export type EntryListItem = Entry & {
  customerName: string;
  productName: string;
  amount: number;
};

export type InvoiceListItem = {
  id: number;
  customerId: number;
  customerName: string;
  invoiceNumber: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: InvoiceStatus;
  pdfUrl: string | null;
  createdAt: string;
};

export type InvoiceDetail = {
  id: number;
  invoiceNumber: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: InvoiceStatus;
  pdfUrl: string | null;
  createdAt: string;
  customer: {
    id: number;
    name: string;
    phone: string;
    address: string | null;
  };
  items: Array<{
    id: number;
    productId: number;
    productName: string;
    unit: ProductUnit;
    quantity: number;
    price: number;
    amount: number;
  }>;
  payments: Payment[];
};

export type Payment = {
  id: number;
  invoiceId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string | null;
  createdAt: string;
};

export type PaymentListItem = Payment & {
  invoiceNumber: string;
  customerId: number;
  customerName: string;
};
```

## Endpoint Matrix

| Method | Path | Auth | Roles | Returns |
|---|---|---|---|---|
| `GET` | `/health` | No | Public | `{ status: "ok" }` |
| `POST` | `/auth/login` | No | Public | `LoginResponse` |
| `GET` | `/auth/me` | Yes | Admin, Customer | `{ user, customer? }` |
| `POST` | `/auth/logout` | Yes | Admin, Customer | `{ message }` |
| `POST` | `/auth/change-password` | Yes | Admin, Customer | `{ message }` |
| `GET` | `/products` | Yes | Admin, Customer | `Product[]` |
| `POST` | `/products` | Yes | Admin | `Product` |
| `PUT` | `/products/:id` | Yes | Admin | `Product` |
| `DELETE` | `/products/:id` | Yes | Admin | deactivated `Product` |
| `GET` | `/customers` | Yes | Admin | `Customer[]` |
| `POST` | `/customers` | Yes | Admin | `Customer` |
| `PUT` | `/customers/:id` | Yes | Admin | `Customer` |
| `PUT` | `/customers/:id/password` | Yes | Admin | `{ message }` |
| `PUT` | `/customers/me/location` | Yes | Customer | `Customer` |
| `DELETE` | `/customers/:id` | Yes | Admin | inactive `Customer` |
| `GET` | `/entries` | Yes | Admin, Customer | `EntryListItem[]` |
| `POST` | `/entries` | Yes | Admin | `Entry` |
| `PUT` | `/entries/:id` | Yes | Admin | `Entry` |
| `DELETE` | `/entries/:id` | Yes | Admin | deleted `Entry` |
| `GET` | `/invoices` | Yes | Admin, Customer | `InvoiceListItem[]` |
| `POST` | `/invoices/generate` | Yes | Admin | `InvoiceDetail` |
| `GET` | `/invoices/:id` | Yes | Admin, Customer owner | `InvoiceDetail` |
| `GET` | `/invoices/:id/pdf` | Yes | Admin, Customer owner | PDF bytes |
| `GET` | `/payments` | Yes | Admin, Customer | `PaymentListItem[]` |
| `POST` | `/payments` | Yes | Admin | `{ payment, invoice }` |
| `GET` | `/reports/daily-sales` | Yes | Admin | daily sales report |
| `GET` | `/reports/monthly-sales` | Yes | Admin | monthly sales report |
| `GET` | `/reports/customer-summary` | Yes | Admin | customer summary report |

Customer reads are automatically scoped:

- `GET /entries` ignores any requested `customerId` and returns only the logged-in customer's entries.
- `GET /invoices` returns only the logged-in customer's invoices.
- `GET /payments` returns only payments for the logged-in customer's invoices.
- `GET /invoices/:id` and `/pdf` return `403` if the invoice belongs to another customer.

## Auth Endpoints

### `POST /auth/login`

Request:

```ts
type LoginRequest = {
  phone: string;
  password: string;
};
```

Response:

```ts
type LoginResponse = {
  token: string;
  user: AuthUser;
  customer?: Customer;
};
```

Customer logins include `customer`. Admin logins do not.

### `GET /auth/me`

Returns the same profile object as login, without a token:

```ts
type MeResponse = {
  user: AuthUser;
  customer?: Customer;
};
```

### `POST /auth/change-password`

Request:

```ts
type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};
```

Both passwords must be at least 6 characters, and `newPassword` must differ from `currentPassword`.

### `POST /auth/logout`

Server-side logout is stateless. The frontend should delete the stored token after success.

## Products

### `GET /products`

Query:

```ts
type ProductQuery = {
  search?: string;
  includeInactive?: "true" | "false";
};
```

By default, inactive products are excluded.

### `POST /products`

Request:

```ts
type ProductCreate = {
  name: string;
  price: number;
  unit: ProductUnit;
  isActive?: boolean;
};
```

### `PUT /products/:id`

Request: any non-empty partial of `ProductCreate`.

### `DELETE /products/:id`

This deactivates the product by setting `isActive` to `false`; it does not permanently remove it.

## Customers

### `GET /customers`

Query:

```ts
type CustomerQuery = {
  search?: string;
  status?: CustomerStatus;
  includeInactive?: "true" | "false";
};
```

By default, inactive customers are excluded.

### `POST /customers`

Request:

```ts
type CustomerCreate = {
  name: string;
  phone: string;
  password?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  googleLocation?: string;
  googlePlaceId?: string;
  googleFormattedAddress?: string;
  googleMapsUrl?: string;
  status?: CustomerStatus;
};
```

If `password` is provided, the backend creates a linked `CUSTOMER` user account for login.

### `PUT /customers/:id`

Request: any non-empty partial of `CustomerCreate`. If `password` is included, the linked customer user's password is updated or created.

### `PUT /customers/:id/password`

Admin-only password reset.

```ts
type CustomerPasswordUpdate = {
  password: string;
};
```

### `PUT /customers/me/location`

Customer-only. Request must include at least one location field:

```ts
type CustomerLocationUpdate = {
  address?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  googleLocation?: string;
  googlePlaceId?: string;
  googleFormattedAddress?: string;
  googleMapsUrl?: string;
};
```

### `DELETE /customers/:id`

This marks the customer `INACTIVE`; it does not permanently remove the customer.

## Entries

### `GET /entries`

Query:

```ts
type EntryQuery = {
  customerId?: number;
  productId?: number;
  session?: EntrySession;
  startDate?: string;
  endDate?: string;
};
```

Admin can filter by customer. Customer users always receive only their own rows.

### `POST /entries`

Request:

```ts
type EntryCreate = {
  customerId: number;
  productId: number;
  quantity: number;
  session: EntrySession;
  entryDate: string;
  price?: number;
};
```

If `price` is omitted, the backend uses the active product's current price.

### `PUT /entries/:id`

Request: any non-empty partial of `EntryCreate`. If `productId` changes and `price` is omitted, the price is reset to the new product's current price.

### `DELETE /entries/:id`

Deletes the entry permanently.

## Invoices

### `GET /invoices`

Query:

```ts
type InvoiceQuery = {
  customerId?: number;
  status?: InvoiceStatus;
  startDate?: string;
  endDate?: string;
};
```

Customer users always receive only their own invoices.

### `POST /invoices/preview`

Request uses `InvoiceGenerate`. It validates customer, date range, overlapping invoices, and available delivery entries, then returns grouped invoice items and totals without writing an invoice.

### `POST /invoices/generate`

Request:

```ts
type InvoiceGenerate = {
  customerId: number;
  startDate: string;
  endDate: string;
};
```

The backend:

- rejects overlapping non-void invoices with `409`.
- rejects ranges with no delivery entries with `400`.
- groups invoice items by product and price.
- creates `pdfUrl` after invoice creation.

### `GET /invoices/:id`

Returns `InvoiceDetail`.

### `GET /invoices/:id/pdf`

Returns PDF bytes:

```ts
const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/pdf`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!response.ok) throw new Error("Unable to load invoice PDF");
const pdfBlob = await response.blob();
```

### `POST /invoices/:id/void`

Admin-only. Marks an invoice as `VOID`, sets its pending amount to `0`, and removes it from dashboard/report totals.

## Payments

### `GET /payments`

Query:

```ts
type PaymentQuery = {
  invoiceId?: number;
  customerId?: number;
  startDate?: string;
  endDate?: string;
};
```

Customer users always receive only payments for their own invoices.

### `POST /payments`

Request:

```ts
type PaymentCreate = {
  invoiceId: number;
  amount: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
};
```

Defaults:

- `paymentDate`: today's date on the server.
- `paymentMethod`: `CASH`.

The payment amount cannot exceed the invoice pending amount. After creation, the invoice `paidAmount`, `pendingAmount`, and `status` are recalculated.

Response:

```ts
type PaymentCreateResponse = {
  payment: Payment;
  invoice: {
    id: number;
    customerId: number;
    invoiceNumber: string;
    startDate: string;
    endDate: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    status: InvoiceStatus;
    pdfUrl: string | null;
    createdAt: string;
  };
};
```

## Reports

Report summary/dashboard endpoints are admin-only. `GET /reports/customer-ledger` is also available to customer users, scoped to their linked customer profile.

### `GET /reports/dashboard`

Query:

```ts
type DashboardQuery = {
  date?: string;
  month?: string;
  customerId?: number;
};
```

Returns active customer count, daily/monthly delivery revenue, non-void invoice totals, payment received amount, invoice status counts, payment aging buckets, and recent entries/invoices/payments.

### `GET /reports/daily-sales`

Query:

```ts
type DailySalesQuery = {
  date?: string;
};
```

If `date` is omitted, the server uses today's date.

Response:

```ts
type DailySalesReport = {
  date: string;
  products: Array<{
    productId: number;
    productName: string;
    quantity: number;
    amount: number;
  }>;
  totals: {
    totalAmount: number;
    entryCount: number;
    customerCount: number;
  };
};
```

### `GET /reports/monthly-sales`

Query:

```ts
type MonthlySalesQuery = {
  month: string;
};
```

Response:

```ts
type MonthlySalesReport = {
  month: string;
  startDate: string;
  endDate: string;
  days: Array<{
    date: string;
    amount: number;
    quantity: number;
    entryCount: number;
  }>;
  totalAmount: number;
};
```

### `GET /reports/customer-summary`

Query:

```ts
type CustomerSummaryQuery = {
  customerId?: number;
};
```

Response:

```ts
type CustomerSummaryReport = Array<{
  customer: Customer;
  deliveredQuantity: number;
  deliveredAmount: number;
  invoiceTotal: number;
  paidAmount: number;
  pendingAmount: number;
}>;
```

### `GET /reports/customer-ledger`

Query:

```ts
type CustomerLedgerQuery = {
  customerId?: number;
  startDate?: string;
  endDate?: string;
};
```

If dates are omitted, the server uses the current month. Admin requests must provide `customerId`; customer users are always scoped to their linked customer profile. The response includes purchase `totalAmount`, `billedAmount`, `unbilledAmount`, non-void invoice summary totals, product totals, and each entry with an `isBilled` flag.

## Frontend Screen Mapping

- Login screen: `POST /auth/login`, then branch on `data.user.role`.
- Admin dashboard: `GET /reports/dashboard`.
- Customer list/edit: `/customers`.
- Product list/edit: `/products`.
- Daily entries: `/entries`, plus `/customers` and `/products` for pickers.
- Invoice list/detail: `/invoices`, `/invoices/preview`, `/invoices/generate`, `/invoices/:id`, `/invoices/:id/pdf`, `/invoices/:id/void`.
- Payment tracking: `/payments`, `POST /payments`.
- Customer delivery history: `GET /reports/customer-ledger`.
- Customer invoices: `GET /invoices`, `GET /invoices/:id/pdf`.
- Customer profile/location: `GET /auth/me`, `PUT /customers/me/location`, `POST /auth/change-password`.

## Implementation Notes For Agents

- Always unwrap `data` before updating UI state.
- Treat `error` as the user-facing message, with `details` reserved for form field diagnostics.
- Build query strings with `URLSearchParams`; omit undefined values.
- Use positive numbers for ids, quantity, price, and amount. Latitude must be between `-90` and `90`; longitude must be between `-180` and `180`.
- Refresh invoice details after creating a payment because invoice totals/status change.
- Deactivate customer/product flows should update list cache locally or refetch with the default filters.
- Prefer the live OpenAPI document for generated clients, but keep the role and scoping notes from this file in generated service wrappers.
