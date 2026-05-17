# Dairy API

Bun + Hono backend for the dairy management app plan in `backend.md`.

## Local Setup

1. Install dependencies:

```sh
bun install
```

2. Create `.env` from `.env.example`:

```sh
cp .env.example .env
```

For local development, keep:

```sh
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=
JWT_SECRET=replace-with-a-long-random-secret
PORT=3000
```

This creates a local SQLite database file named `local.db`.

3. Create the local database tables and seed admin/default products:

```sh
bun run db:setup:local
```

That command runs `drizzle-kit push --force` and then `src/db/seed.ts`.

Default local admin:

```txt
phone: 9999999999
password: password123
```

4. Start the API:

```sh
bun run dev
```

The local API runs at `http://localhost:3000`.

## Database Commands

Push schema changes:

```sh
bun run db:push
```

For non-interactive shells:

```sh
bun run db:push:force
```

Seed admin and default products:

```sh
bun run db:seed
```

Open Drizzle Studio:

```sh
bun run db:studio
```

## Swagger

After starting the API:

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- Frontend API guide: [`docs/frontend-api.md`](docs/frontend-api.md)

To test protected routes in Swagger:

1. Call `POST /auth/login`.
2. Copy the returned JWT token.
3. Click **Authorize** in Swagger UI.
4. Paste the token into the bearer auth field.

## Login

Admins and customers both use the same login endpoint:

```txt
POST /auth/login
```

Admin login uses the seeded admin user:

```json
{
  "phone": "9999999999",
  "password": "password123"
}
```

Customer login works after an admin creates or updates a customer with a `password`:

```json
{
  "name": "Ravi Kumar",
  "phone": "8888888888",
  "password": "customer123",
  "address": "Main road",
  "latitude": 25.5941,
  "longitude": 85.1376,
  "locationLabel": "Home",
  "googleLocation": "Patna, Bihar, India",
  "googlePlaceId": "ChIJL_P_CXMEDTkRw0ZdG-0GVvw",
  "googleFormattedAddress": "Patna, Bihar, India",
  "googleMapsUrl": "https://www.google.com/maps/place/?q=place_id:ChIJL_P_CXMEDTkRw0ZdG-0GVvw"
}
```

The login response includes `user.role`. Customer logins also include `user.customerId` and a `customer` profile.

Customers can change their own password after login:

```txt
POST /auth/change-password
Authorization: Bearer <token>
```

```json
{
  "currentPassword": "customer123",
  "newPassword": "newCustomer123"
}
```

Admins can reset a customer password:

```txt
PUT /customers/:id/password
Authorization: Bearer <admin-token>
```

```json
{
  "password": "newCustomer123"
}
```

Customers can update their own location:

```txt
PUT /customers/me/location
Authorization: Bearer <customer-token>
```

```json
{
  "address": "Main road",
  "latitude": 25.5941,
  "longitude": 85.1376,
  "locationLabel": "Home",
  "googleLocation": "Patna, Bihar, India",
  "googlePlaceId": "ChIJL_P_CXMEDTkRw0ZdG-0GVvw",
  "googleFormattedAddress": "Patna, Bihar, India",
  "googleMapsUrl": "https://www.google.com/maps/place/?q=place_id:ChIJL_P_CXMEDTkRw0ZdG-0GVvw"
}
```

## Main Routes

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/change-password`
- `GET|POST|PUT|DELETE /products`
- `GET|POST|PUT|DELETE /customers`
- `PUT /customers/:id/password`
- `PUT /customers/me/location`
- `GET|POST|PUT|DELETE /entries`
- `GET /invoices`
- `POST /invoices/preview`
- `POST /invoices/generate`
- `GET /invoices/:id`
- `POST /invoices/:id/void`
- `GET /invoices/:id/pdf`
- `GET|POST /payments`
- `GET /reports/dashboard`
- `GET /reports/daily-sales`
- `GET /reports/monthly-sales`
- `GET /reports/customer-summary`
- `GET /reports/customer-ledger`
