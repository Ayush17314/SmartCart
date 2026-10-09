module.exports = {
    openapi: "3.0.3",
    info: {
        title: "SmartCart API",
        version: "1.0.0",
        description: "Versioned REST API for SmartCart. Requests and responses support JSON; product listings also support XML.",
    },
    servers: [{ url: "/v1", description: "Version 1 API through the gateway" }],
    components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
        schemas: {
            Error: { type: "object", required: ["success", "message", "requestId"], properties: { success: { type: "boolean", enum: [false] }, message: { type: "string" }, requestId: { type: "string" } } },
            Product: { type: "object", properties: { _id: { type: "string" }, name: { type: "string" }, price: { type: "number" }, category: { type: "string" }, stock: { type: "integer" } } },
            ProductInput: { type: "object", required: ["name", "price", "category"], properties: { name: { type: "string", maxLength: 200 }, description: { type: "string" }, price: { type: "number", minimum: 0 }, category: { type: "string" }, brand: { type: "string" }, stock: { type: "integer", minimum: 0 }, images: { type: "array", items: { type: "string" } } } },
            ProductList: { type: "object", properties: { success: { type: "boolean" }, data: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Product" } }, pagination: { type: "object", properties: { nextCursor: { type: "string", nullable: true } } }, links: { type: "object", properties: { next: { type: "string", nullable: true } } } } } } },
            OrderInput: { type: "object", required: ["items"], properties: { items: { type: "array", minItems: 1, items: { type: "object", required: ["productId", "quantity"], properties: { productId: { type: "string" }, quantity: { type: "integer", minimum: 1 } } } }, shippingAddress: { type: "object" }, paymentMethod: { type: "string", enum: ["UPI", "CARD", "COD"] } } },
        },
        parameters: {
            IdempotencyKey: { in: "header", name: "Idempotency-Key", required: true, schema: { type: "string", maxLength: 200 } },
            Cursor: { in: "query", name: "after", schema: { type: "string" }, description: "Opaque cursor returned by the previous page" },
            Limit: { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        },
        responses: {
            Error: { description: "Standard API error body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            NotModified: { description: "Cached representation has not changed" },
            RateLimited: { description: "Rate limit exceeded", headers: { "RateLimit-Limit": { schema: { type: "integer" } }, "RateLimit-Remaining": { schema: { type: "integer" } }, "Retry-After": { schema: { type: "integer" } } } },
        },
    },
    paths: {
        "/api/products": {
            get: {
                summary: "List products using cursor pagination",
                parameters: [
                    { $ref: "#/components/parameters/Cursor" }, { $ref: "#/components/parameters/Limit" },
                    { in: "query", name: "search", schema: { type: "string" } },
                    { in: "query", name: "category", schema: { type: "string" } },
                    { in: "header", name: "If-None-Match", schema: { type: "string" } },
                    { in: "header", name: "Accept", schema: { type: "string", enum: ["application/json", "application/xml"] } },
                ],
                responses: { "200": { description: "Product page", headers: { ETag: { schema: { type: "string" } }, Link: { schema: { type: "string" } }, "Cache-Control": { schema: { type: "string" } } }, content: { "application/json": { schema: { $ref: "#/components/schemas/ProductList" } }, "application/xml": { schema: { type: "string" } } } }, "304": { $ref: "#/components/responses/NotModified" }, "429": { $ref: "#/components/responses/RateLimited" }, "500": { $ref: "#/components/responses/Error" } },
            },
            post: { security: [{ bearerAuth: [] }], summary: "Create a product", parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } } } }, responses: { "201": { description: "Created" }, "400": { $ref: "#/components/responses/Error" }, "401": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" }, "429": { $ref: "#/components/responses/RateLimited" } } },
        },
        "/api/products/{id}": {
            get: { summary: "Get a product", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }, { in: "header", name: "If-None-Match", schema: { type: "string" } }], responses: { "200": { description: "Product" }, "304": { $ref: "#/components/responses/NotModified" }, "404": { $ref: "#/components/responses/Error" } } },
            put: { security: [{ bearerAuth: [] }], summary: "Replace product details", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } } } }, responses: { "200": { description: "Updated" }, "404": { $ref: "#/components/responses/Error" } } },
            delete: { security: [{ bearerAuth: [] }], summary: "Delete a product", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Deleted" }, "404": { $ref: "#/components/responses/Error" } } },
        },
        "/api/orders": {
            get: { security: [{ bearerAuth: [] }], summary: "List the caller’s orders", parameters: [{ $ref: "#/components/parameters/Cursor" }, { $ref: "#/components/parameters/Limit" }], responses: { "200": { description: "Orders" }, "401": { $ref: "#/components/responses/Error" } } },
            post: { security: [{ bearerAuth: [] }], summary: "Create an order", parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderInput" } } } }, responses: { "201": { description: "Order created" }, "400": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" }, "503": { $ref: "#/components/responses/Error" } } },
        },
        "/api/orders/{id}/cancellation": { patch: { security: [{ bearerAuth: [] }], summary: "Cancel an eligible order", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }], responses: { "200": { description: "Order cancelled" }, "401": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" } } } },
        "/api/orders/{id}/returns": { post: { security: [{ bearerAuth: [] }], summary: "Request a return", parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }, { $ref: "#/components/parameters/IdempotencyKey" }], responses: { "200": { description: "Return requested" }, "401": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" } } } },
        "/api/auth/register": {
            post: {
                summary: "Register a customer",
                requestBody: { required: true, content: { "application/json": { schema: {
                    type: "object", required: ["name", "email", "password"],
                    properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } },
                } } } },
                responses: { "201": { description: "Registered" }, "400": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" } },
            },
        },
        "/api/auth/login": {
            post: {
                summary: "Log in",
                requestBody: { required: true, content: { "application/json": { schema: {
                    type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } },
                } } } },
                responses: { "200": { description: "JWT issued" }, "401": { $ref: "#/components/responses/Error" } },
            },
        },
        "/api/payments/create": {
            post: {
                security: [{ bearerAuth: [] }], summary: "Create an idempotent Razorpay checkout order",
                parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
                requestBody: { required: true, content: { "application/json": { schema: {
                    type: "object", required: ["orderId", "amount", "paymentMethod"],
                    properties: { orderId: { type: "string" }, amount: { type: "number", exclusiveMinimum: 0 }, paymentMethod: { type: "string", enum: ["UPI", "CARD", "COD"] } },
                } } } },
                responses: { "201": { description: "Checkout order" }, "401": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" }, "503": { $ref: "#/components/responses/Error" } },
            },
        },
        "/api/payments/verify/{paymentId}": {
            post: {
                security: [{ bearerAuth: [] }], summary: "Verify Razorpay Checkout signature",
                parameters: [{ in: "path", name: "paymentId", required: true, schema: { type: "string" } }, { $ref: "#/components/parameters/IdempotencyKey" }],
                responses: { "200": { description: "Payment verified" }, "401": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" } },
            },
        },
        "/api/payments/{paymentId}/refunds": {
            post: {
                security: [{ bearerAuth: [] }], summary: "Issue a payment refund",
                parameters: [{ in: "path", name: "paymentId", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Refund submitted" }, "401": { $ref: "#/components/responses/Error" }, "409": { $ref: "#/components/responses/Error" } },
            },
        },
    },
};
