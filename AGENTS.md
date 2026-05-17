# AGENTS.md

# Backend Project Overview

Backend built using:

* Hono
* Bun
* TypeScript
* PostgreSQL
* Drizzle ORM
* Zod

Production-focused API server handling:

* products
* orders
* invoices
* payments
* unit conversions

---

# Backend Rules

* Keep controllers thin.
* Business logic belongs in services.
* Database queries belong in repositories/services.
* Validate all input data.
* Avoid duplicated logic.

---

# API Rules

* Maintain consistent response structure.
* Preserve backward compatibility.
* Return meaningful error messages.
* Validate request payloads using Zod.
* Never trust frontend input.

---

# Database Rules

* Prefer additive migrations.
* Never remove columns without confirmation.
* Avoid N+1 queries.
* Use transactions where required.
* Optimize joins/select queries.

---

# Unit Conversion Rules

Supported groups:

## Weight

* mg
* gm
* kg

## Volume

* ml
* liter

## Count

* unit
* dozen

Requirements:

* Every product must have a default/base unit.
* Conversion allowed only inside same group.
* Prevent invalid conversions.
* Auto-calculate pricing based on converted quantity.
* Maintain precision in calculations.

Examples:

* 1 kg = 1000 gm
* 1 liter = 1000 ml
* 1 dozen = 12 unit

---

# Payment Rules

Supported statuses:

* Pending
* Partial Paid
* Paid

Requirements:

* Prevent overpayment.
* Track paid amount.
* Track due amount.
* Update invoice totals correctly.
* Maintain financial consistency.

---

# Performance Rules

* Avoid unnecessary queries.
* Use indexes where needed.
* Select only required fields.
* Avoid loading large relations unnecessarily.

---

# Before Coding

Always:

1. Analyze related services/routes.
2. Check existing schema patterns.
3. Verify migration impact.
4. Identify reusable utilities.

---

# After Coding

Verify:

* TypeScript passes
* No lint errors
* No broken migrations
* APIs remain compatible
* Edge cases handled
* Financial calculations correct

---

# Forbidden

* Do not move business logic into controllers.
* Do not bypass validation.
* Do not hardcode business rules.
* Do not rewrite unrelated APIs.
* Do not introduce breaking schema changes.
