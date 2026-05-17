const bearerSecurity = [{ bearerAuth: [] }];

const jsonContent = (schema: unknown) => ({
  "application/json": {
    schema,
  },
});

const dataEnvelope = (schema: unknown) => ({
  type: "object",
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", example: true },
    data: schema,
  },
});

const successResponse = (schema: unknown, description = "Success") => ({
  description,
  content: jsonContent(dataEnvelope(schema)),
});

const errorResponse = {
  description: "Error",
  content: jsonContent({
    type: "object",
    required: ["success", "error"],
    properties: {
      success: { type: "boolean", example: false },
      error: { type: "string" },
      details: {},
    },
  }),
};

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
};

const authHeaderResponses = {
  400: errorResponse,
  401: errorResponse,
  403: errorResponse,
  404: errorResponse,
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Dairy API",
    version: "0.1.0",
    description: "Backend API for dairy customer, product, delivery, invoice, payment, and report workflows.",
  },
  servers: [
    {
      url: "/",
      description: "Current server",
    },
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Products" },
    { name: "Customers" },
    { name: "Entries" },
    { name: "Invoices" },
    { name: "Payments" },
    { name: "Reports" },
  ],
  security: bearerSecurity,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      AuthUser: {
        type: "object",
        required: ["id", "name", "phone", "role"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Admin" },
          phone: { type: "string", example: "9999999999" },
          role: { type: "string", enum: ["ADMIN", "CUSTOMER"], example: "ADMIN" },
          customerId: { type: "integer", nullable: true, example: null },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["phone", "password"],
        properties: {
          phone: { type: "string", example: "9999999999" },
          password: { type: "string", example: "password123" },
        },
      },
      LoginResponse: {
        type: "object",
        required: ["token", "user"],
        properties: {
          token: { type: "string" },
          user: { $ref: "#/components/schemas/AuthUser" },
          customer: { $ref: "#/components/schemas/Customer" },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", minLength: 6, example: "customer123" },
          newPassword: { type: "string", minLength: 6, example: "newCustomer123" },
        },
      },
      Product: {
        type: "object",
        required: ["id", "name", "price", "unit", "isActive", "createdAt"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Milk" },
          price: { type: "number", example: 60 },
          unit: { type: "string", enum: ["LITER", "ML", "KG", "GRAM", "PIECE"], example: "LITER" },
          isActive: { type: "boolean", example: true },
          createdAt: { type: "string", example: "2026-05-16 09:54:19" },
        },
      },
      ProductCreate: {
        type: "object",
        required: ["name", "price", "unit"],
        properties: {
          name: { type: "string", example: "Milk" },
          price: { type: "number", minimum: 0, exclusiveMinimum: true, example: 60 },
          unit: { type: "string", enum: ["LITER", "ML", "KG", "GRAM", "PIECE"], example: "LITER" },
          isActive: { type: "boolean", example: true },
        },
      },
      Customer: {
        type: "object",
        required: ["id", "name", "phone", "status", "createdAt"],
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Ravi Kumar" },
          phone: { type: "string", example: "8888888888" },
          address: { type: "string", nullable: true, example: "Main road" },
          latitude: { type: "number", nullable: true, example: 25.5941 },
          longitude: { type: "number", nullable: true, example: 85.1376 },
          locationLabel: { type: "string", nullable: true, example: "Home" },
          googleLocation: { type: "string", nullable: true, example: "Patna, Bihar, India" },
          googlePlaceId: { type: "string", nullable: true, example: "ChIJL_P_CXMEDTkRw0ZdG-0GVvw" },
          googleFormattedAddress: {
            type: "string",
            nullable: true,
            example: "Patna, Bihar, India",
          },
          googleMapsUrl: {
            type: "string",
            nullable: true,
            example: "https://www.google.com/maps/place/?q=place_id:ChIJL_P_CXMEDTkRw0ZdG-0GVvw",
          },
          status: { type: "string", enum: ["ACTIVE", "INACTIVE"], example: "ACTIVE" },
          createdAt: { type: "string", example: "2026-05-16 09:54:19" },
        },
      },
      CustomerCreate: {
        type: "object",
        required: ["name", "phone"],
        properties: {
          name: { type: "string", example: "Ravi Kumar" },
          phone: { type: "string", example: "8888888888" },
          password: { type: "string", minLength: 6, example: "customer123" },
          address: { type: "string", example: "Main road" },
          latitude: { type: "number", minimum: -90, maximum: 90, example: 25.5941 },
          longitude: { type: "number", minimum: -180, maximum: 180, example: 85.1376 },
          locationLabel: { type: "string", example: "Home" },
          googleLocation: { type: "string", example: "Patna, Bihar, India" },
          googlePlaceId: { type: "string", example: "ChIJL_P_CXMEDTkRw0ZdG-0GVvw" },
          googleFormattedAddress: { type: "string", example: "Patna, Bihar, India" },
          googleMapsUrl: {
            type: "string",
            example: "https://www.google.com/maps/place/?q=place_id:ChIJL_P_CXMEDTkRw0ZdG-0GVvw",
          },
          status: { type: "string", enum: ["ACTIVE", "INACTIVE"], example: "ACTIVE" },
        },
      },
      CustomerLocationUpdate: {
        type: "object",
        properties: {
          address: { type: "string", example: "Main road" },
          latitude: { type: "number", minimum: -90, maximum: 90, example: 25.5941 },
          longitude: { type: "number", minimum: -180, maximum: 180, example: 85.1376 },
          locationLabel: { type: "string", example: "Home" },
          googleLocation: { type: "string", example: "Patna, Bihar, India" },
          googlePlaceId: { type: "string", example: "ChIJL_P_CXMEDTkRw0ZdG-0GVvw" },
          googleFormattedAddress: { type: "string", example: "Patna, Bihar, India" },
          googleMapsUrl: {
            type: "string",
            example: "https://www.google.com/maps/place/?q=place_id:ChIJL_P_CXMEDTkRw0ZdG-0GVvw",
          },
        },
      },
      CustomerPasswordUpdate: {
        type: "object",
        required: ["password"],
        properties: {
          password: { type: "string", minLength: 6, example: "newCustomer123" },
        },
      },
      Entry: {
        type: "object",
        required: ["id", "customerId", "productId", "quantity", "session", "entryDate", "price", "createdAt"],
        properties: {
          id: { type: "integer", example: 1 },
          customerId: { type: "integer", example: 1 },
          productId: { type: "integer", example: 1 },
          quantity: { type: "number", example: 2 },
          session: { type: "string", enum: ["MORNING", "EVENING"], example: "MORNING" },
          entryDate: { type: "string", format: "date", example: "2026-05-16" },
          price: { type: "number", example: 60 },
          createdAt: { type: "string", example: "2026-05-16 09:54:19" },
        },
      },
      EntryCreate: {
        type: "object",
        required: ["customerId", "productId", "quantity", "session", "entryDate"],
        properties: {
          customerId: { type: "integer", example: 1 },
          productId: { type: "integer", example: 1 },
          quantity: { type: "number", minimum: 0, exclusiveMinimum: true, example: 2 },
          session: { type: "string", enum: ["MORNING", "EVENING"], example: "MORNING" },
          entryDate: { type: "string", format: "date", example: "2026-05-16" },
          price: { type: "number", example: 60 },
        },
      },
      Invoice: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          invoiceNumber: { type: "string", example: "INV-20260516100148-C1" },
          startDate: { type: "string", format: "date", example: "2026-05-01" },
          endDate: { type: "string", format: "date", example: "2026-05-31" },
          totalAmount: { type: "number", example: 1200 },
          paidAmount: { type: "number", example: 500 },
          pendingAmount: { type: "number", example: 700 },
          status: { type: "string", enum: ["UNPAID", "PARTIAL", "PAID", "VOID"], example: "PARTIAL" },
          pdfUrl: { type: "string", nullable: true, example: "http://localhost:3000/invoices/1/pdf" },
          customer: { $ref: "#/components/schemas/Customer" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/InvoiceItem" },
          },
          payments: {
            type: "array",
            items: { $ref: "#/components/schemas/Payment" },
          },
        },
      },
      InvoiceItem: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          productId: { type: "integer", example: 1 },
          productName: { type: "string", example: "Milk" },
          unit: { type: "string", example: "LITER" },
          quantity: { type: "number", example: 20 },
          price: { type: "number", example: 60 },
          amount: { type: "number", example: 1200 },
        },
      },
      InvoiceGenerate: {
        type: "object",
        required: ["customerId", "startDate", "endDate"],
        properties: {
          customerId: { type: "integer", example: 1 },
          startDate: { type: "string", format: "date", example: "2026-05-01" },
          endDate: { type: "string", format: "date", example: "2026-05-31" },
        },
      },
      InvoicePreview: {
        type: "object",
        properties: {
          startDate: { type: "string", format: "date", example: "2026-05-01" },
          endDate: { type: "string", format: "date", example: "2026-05-31" },
          totalAmount: { type: "number", example: 1200 },
          pendingAmount: { type: "number", example: 1200 },
          customer: { $ref: "#/components/schemas/Customer" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/InvoiceItem" },
          },
        },
      },
      DashboardReport: {
        type: "object",
        properties: {
          date: { type: "string", format: "date", example: "2026-05-16" },
          month: { type: "string", example: "2026-05" },
          customerId: { type: "integer", nullable: true, example: null },
          totalCustomers: { type: "number", example: 12 },
          dailySales: { type: "number", example: 1500 },
          monthlyRevenue: { type: "number", example: 45000 },
          pendingPayments: { type: "number", example: 7000 },
          invoiceTotal: { type: "number", example: 52000 },
          paidAmount: { type: "number", example: 45000 },
          paymentReceived: { type: "number", example: 18000 },
          invoiceStatusCounts: { type: "object" },
          paymentAging: { type: "array", items: { type: "object" } },
          recentEntries: { type: "array", items: { $ref: "#/components/schemas/Entry" } },
          recentInvoices: { type: "array", items: { $ref: "#/components/schemas/Invoice" } },
          recentPayments: { type: "array", items: { $ref: "#/components/schemas/Payment" } },
        },
      },
      CustomerLedger: {
        type: "object",
        properties: {
          customer: { $ref: "#/components/schemas/Customer" },
          startDate: { type: "string", format: "date", example: "2026-05-01" },
          endDate: { type: "string", format: "date", example: "2026-05-31" },
          entries: { type: "array", items: { $ref: "#/components/schemas/Entry" } },
          productTotals: { type: "array", items: { type: "object" } },
          totalAmount: { type: "number", example: 1200 },
          billedAmount: { type: "number", example: 800 },
          unbilledAmount: { type: "number", example: 400 },
          invoiceSummary: { type: "object" },
          invoices: { type: "array", items: { $ref: "#/components/schemas/Invoice" } },
        },
      },
      Payment: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          invoiceId: { type: "integer", example: 1 },
          amount: { type: "number", example: 500 },
          paymentDate: { type: "string", format: "date", example: "2026-05-16" },
          paymentMethod: {
            type: "string",
            enum: ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"],
            example: "UPI",
          },
          notes: { type: "string", nullable: true },
          createdAt: { type: "string", example: "2026-05-16 09:54:19" },
        },
      },
      PaymentCreate: {
        type: "object",
        required: ["invoiceId", "amount"],
        properties: {
          invoiceId: { type: "integer", example: 1 },
          amount: { type: "number", minimum: 0, exclusiveMinimum: true, example: 500 },
          paymentDate: { type: "string", format: "date", example: "2026-05-16" },
          paymentMethod: {
            type: "string",
            enum: ["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"],
            example: "UPI",
          },
          notes: { type: "string", example: "May partial payment" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        security: [],
        summary: "Health check",
        responses: {
          200: successResponse({
            type: "object",
            properties: { status: { type: "string", example: "ok" } },
          }),
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Login with phone and password",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/LoginRequest" }),
        },
        responses: {
          200: successResponse({ $ref: "#/components/schemas/LoginResponse" }),
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        responses: {
          200: successResponse({ $ref: "#/components/schemas/AuthUser" }),
          401: errorResponse,
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout current user",
        responses: {
          200: successResponse({
            type: "object",
            properties: { message: { type: "string", example: "Logged out" } },
          }),
          401: errorResponse,
        },
      },
    },
    "/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change password for the logged-in user",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/ChangePasswordRequest" }),
        },
        responses: {
          200: successResponse({
            type: "object",
            properties: { message: { type: "string", example: "Password changed successfully" } },
          }),
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    "/products": {
      get: {
        tags: ["Products"],
        summary: "List products",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "includeInactive", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          200: successResponse({ type: "array", items: { $ref: "#/components/schemas/Product" } }),
          ...authHeaderResponses,
        },
      },
      post: {
        tags: ["Products"],
        summary: "Create product",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/ProductCreate" }),
        },
        responses: {
          201: successResponse({ $ref: "#/components/schemas/Product" }, "Created"),
          ...authHeaderResponses,
        },
      },
    },
    "/products/{id}": {
      put: {
        tags: ["Products"],
        summary: "Update product",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/ProductCreate" }),
        },
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Product" }),
          ...authHeaderResponses,
        },
      },
      delete: {
        tags: ["Products"],
        summary: "Deactivate product",
        parameters: [idParam],
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Product" }),
          ...authHeaderResponses,
        },
      },
    },
    "/customers": {
      get: {
        tags: ["Customers"],
        summary: "List customers",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "INACTIVE"] } },
          { name: "includeInactive", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          200: successResponse({ type: "array", items: { $ref: "#/components/schemas/Customer" } }),
          ...authHeaderResponses,
        },
      },
      post: {
        tags: ["Customers"],
        summary: "Create customer",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/CustomerCreate" }),
        },
        responses: {
          201: successResponse({ $ref: "#/components/schemas/Customer" }, "Created"),
          ...authHeaderResponses,
        },
      },
    },
    "/customers/{id}": {
      put: {
        tags: ["Customers"],
        summary: "Update customer",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/CustomerCreate" }),
        },
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Customer" }),
          ...authHeaderResponses,
        },
      },
      delete: {
        tags: ["Customers"],
        summary: "Deactivate customer",
        parameters: [idParam],
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Customer" }),
          ...authHeaderResponses,
        },
      },
    },
    "/customers/{id}/password": {
      put: {
        tags: ["Customers"],
        summary: "Reset customer password as admin",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/CustomerPasswordUpdate" }),
        },
        responses: {
          200: successResponse({
            type: "object",
            properties: { message: { type: "string", example: "Customer password updated successfully" } },
          }),
          ...authHeaderResponses,
        },
      },
    },
    "/customers/me/location": {
      put: {
        tags: ["Customers"],
        summary: "Update logged-in customer's own location",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/CustomerLocationUpdate" }),
        },
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Customer" }),
          ...authHeaderResponses,
        },
      },
    },
    "/entries": {
      get: {
        tags: ["Entries"],
        summary: "List daily entries",
        parameters: [
          { name: "customerId", in: "query", schema: { type: "integer" } },
          { name: "productId", in: "query", schema: { type: "integer" } },
          { name: "session", in: "query", schema: { type: "string", enum: ["MORNING", "EVENING"] } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          200: successResponse({ type: "array", items: { $ref: "#/components/schemas/Entry" } }),
          ...authHeaderResponses,
        },
      },
      post: {
        tags: ["Entries"],
        summary: "Create daily entry",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/EntryCreate" }),
        },
        responses: {
          201: successResponse({ $ref: "#/components/schemas/Entry" }, "Created"),
          ...authHeaderResponses,
        },
      },
    },
    "/entries/{id}": {
      put: {
        tags: ["Entries"],
        summary: "Update daily entry",
        parameters: [idParam],
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/EntryCreate" }),
        },
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Entry" }),
          ...authHeaderResponses,
        },
      },
      delete: {
        tags: ["Entries"],
        summary: "Delete daily entry",
        parameters: [idParam],
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Entry" }),
          ...authHeaderResponses,
        },
      },
    },
    "/invoices": {
      get: {
        tags: ["Invoices"],
        summary: "List invoices",
        parameters: [
          { name: "customerId", in: "query", schema: { type: "integer" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["UNPAID", "PARTIAL", "PAID", "VOID"] } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          200: successResponse({ type: "array", items: { $ref: "#/components/schemas/Invoice" } }),
          ...authHeaderResponses,
        },
      },
    },
    "/invoices/preview": {
      post: {
        tags: ["Invoices"],
        summary: "Preview invoice totals without creating an invoice",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/InvoiceGenerate" }),
        },
        responses: {
          200: successResponse({ $ref: "#/components/schemas/InvoicePreview" }),
          ...authHeaderResponses,
        },
      },
    },
    "/invoices/generate": {
      post: {
        tags: ["Invoices"],
        summary: "Generate invoice for a customer date range",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/InvoiceGenerate" }),
        },
        responses: {
          201: successResponse({ $ref: "#/components/schemas/Invoice" }, "Created"),
          ...authHeaderResponses,
        },
      },
    },
    "/invoices/{id}/void": {
      post: {
        tags: ["Invoices"],
        summary: "Void an invoice and exclude it from totals",
        parameters: [idParam],
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Invoice" }),
          ...authHeaderResponses,
        },
      },
    },
    "/invoices/{id}": {
      get: {
        tags: ["Invoices"],
        summary: "Get invoice details",
        parameters: [idParam],
        responses: {
          200: successResponse({ $ref: "#/components/schemas/Invoice" }),
          ...authHeaderResponses,
        },
      },
    },
    "/invoices/{id}/pdf": {
      get: {
        tags: ["Invoices"],
        summary: "Download invoice PDF",
        operationId: "downloadInvoicePdf",
        parameters: [idParam],
        responses: {
          200: {
            description: "PDF file",
            headers: {
              "Content-Disposition": {
                description: "Attachment filename for the generated invoice PDF",
                schema: { type: "string", example: 'attachment; filename="INV-20260517-C1-ABC12345.pdf"' },
              },
              "Content-Length": {
                description: "PDF size in bytes",
                schema: { type: "integer", example: 2149 },
              },
            },
            content: {
              "application/pdf": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          ...authHeaderResponses,
        },
      },
    },
    "/payments": {
      get: {
        tags: ["Payments"],
        summary: "List payments",
        parameters: [
          { name: "invoiceId", in: "query", schema: { type: "integer" } },
          { name: "customerId", in: "query", schema: { type: "integer" } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          200: successResponse({ type: "array", items: { $ref: "#/components/schemas/Payment" } }),
          ...authHeaderResponses,
        },
      },
      post: {
        tags: ["Payments"],
        summary: "Record invoice payment",
        requestBody: {
          required: true,
          content: jsonContent({ $ref: "#/components/schemas/PaymentCreate" }),
        },
        responses: {
          201: successResponse({
            type: "object",
            properties: {
              payment: { $ref: "#/components/schemas/Payment" },
              invoice: { $ref: "#/components/schemas/Invoice" },
            },
          }),
          ...authHeaderResponses,
        },
      },
    },
    "/reports/dashboard": {
      get: {
        tags: ["Reports"],
        summary: "Dashboard stats and recent admin activity",
        parameters: [
          { name: "date", in: "query", schema: { type: "string", format: "date" } },
          { name: "month", in: "query", schema: { type: "string", example: "2026-05" } },
          { name: "customerId", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          200: successResponse({ $ref: "#/components/schemas/DashboardReport" }),
          ...authHeaderResponses,
        },
      },
    },
    "/reports/daily-sales": {
      get: {
        tags: ["Reports"],
        summary: "Daily sales report",
        parameters: [{ name: "date", in: "query", schema: { type: "string", format: "date" } }],
        responses: {
          200: successResponse({ type: "object" }),
          ...authHeaderResponses,
        },
      },
    },
    "/reports/monthly-sales": {
      get: {
        tags: ["Reports"],
        summary: "Monthly sales report",
        parameters: [{ name: "month", in: "query", required: true, schema: { type: "string", example: "2026-05" } }],
        responses: {
          200: successResponse({ type: "object" }),
          ...authHeaderResponses,
        },
      },
    },
    "/reports/customer-summary": {
      get: {
        tags: ["Reports"],
        summary: "Customer summary report",
        parameters: [{ name: "customerId", in: "query", schema: { type: "integer" } }],
        responses: {
          200: successResponse({ type: "array", items: { type: "object" } }),
          ...authHeaderResponses,
        },
      },
    },
    "/reports/customer-ledger": {
      get: {
        tags: ["Reports"],
        summary: "Customer purchase ledger for entries, product totals, and related invoices",
        parameters: [
          { name: "customerId", in: "query", schema: { type: "integer" } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          200: successResponse({ $ref: "#/components/schemas/CustomerLedger" }),
          ...authHeaderResponses,
        },
      },
    },
  },
} as const;
