# SmartCart

SmartCart is an Amazon-inspired e-commerce web platform engineered with a **polyglot microservices backend** and a modern **Next.js 15 App Router frontend**. The backend utilizes Node.js, Express, MongoDB (Atlas/Local), and MySQL, decoupled through an intelligent API Gateway supporting both REST and GraphQL.

## TeamID 03

| Name | Roll no. |
| --- | --- |
| Ayush Kumar Dubey | 20251651030 |
| Abhinav Jain | 20251651003 |
| Anuj Gupta | 20251651025 |
| Bharath Kumar MP | 20251651031 |
| Kaushik Nanda Upadhaya | 20251651050 |

---

## Architecture Overview

```text
SmartCart/
├── Frontend/
│   └── smartcart-web/             # Next.js 15 (App Router), React 19, Tailwind CSS v4, Zustand, TanStack Query
├── Backend/
│   ├── api-gateway/               # Entrypoint (Port 4000) - Routing, Rate Limiting, GraphQL, OpenAPI, Idempotency
│   ├── auth-service/              # Identity (Port 4001) - Registration, Login, RBAC, Sessions, Verification
│   ├── product-service/           # Catalog (Port 4002) - Products, Search, Categories, Inventory, Reviews, Settings
│   ├── cart-service/              # Shopping Cart (Port 4003) - Cart Items, Quantities, Pricing
│   ├── wishlist-service/          # Saved Items (Port 4004) - Customer Wishlists
│   ├── order-service/             # Orders (Port 4005) - Checkout, Stock Reservations, Returns, Coupons, Tracking
│   ├── payment-service/           # Payments (Port 4006) - Razorpay Orders/Checkout, Webhooks, Refunds, COD
│   ├── notification-service/      # Notifications (Port 4007) - Order/Payment/Security alerts via Resend / Mock
│   ├── docker-compose.yml         # Multi-container orchestration (Node, MongoDB, MySQL)
│   └── SmartCart.postman_collection.json # API endpoints collection
├── SmartCart-Backend-Checklist-Guide.pdf # Detailed 28-item implementation & architecture guide
└── README.md
```

---

## 28 Web Services Engineering Checklist: Status & Implementation

SmartCart incorporates the comprehensive 28-point enterprise backend and distributed systems engineering checklist. Below is the current implementation matrix and breakdown:

### Summary Scorecard
* **Implemented:** 22 items
* **Partial (Scoped by design):** 5 items
* **Pending:** 1 item (*Live Cloud/Internet Deployment* — project is fully containerized for local Docker/Compose)

---

### Detailed Implementation Matrix

| # | Checklist Requirement | Status | Component / Location | Description & Implementation Details |
| :-: | :--- | :---: | :--- | :--- |
| **1** | **HTTP Methods & Resource URLs** | 🔄 *Partial* | `api-gateway`, Domain Services | Public routes follow clean REST resource naming conventions (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`). The gateway exposes both `/api/*` and versioned `/v1/api/*` routes. Internal service adapters map specialized actions (e.g. cancellation) cleanly. |
| **2** | **API Versioning (`/v1`)** | ✅ *Implemented* | `api-gateway/src/app.js` | The API Gateway exposes version-prefixed routes (e.g., `/v1/api/products`) with transparent URL rewriting to upstream services while maintaining backward compatibility with `/api/*`. |
| **3** | **Durable Idempotency on POST** | ✅ *Implemented* | `api-gateway/src/sql-store.js`, MySQL | State-changing operations (orders, payments, returns, product creation) require an `Idempotency-Key` header. Requests and response payloads are recorded in MySQL (`api_idempotency`). Replayed keys return identical cached responses (`Idempotency-Replayed: true`); changed bodies return `409 Conflict`. |
| **4** | **AJV JSON Schema Validation** | ✅ *Implemented* | `api-gateway/src/schemas.js` | Fast, pre-compiled AJV JSON schemas validate client request payloads at the Gateway boundary before traffic reaches upstream microservices. Malformed payloads are rejected immediately with `400 Bad Request`. |
| **5** | **Rich HTTP Status Codes (≥ 8 Codes)** | ✅ *Implemented* | Across All Services | Exposes over 10 distinct, semantically correct HTTP status codes: `200 OK`, `201 Created`, `304 Not Modified`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `429 Too Many Requests`, `500 Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`. |
| **6** | **ETag & Conditional 304 Responses** | ✅ *Implemented* | `api-gateway`, `product-service` | Generates standard HTTP entity tags (ETags). The Gateway proxies `If-None-Match` headers upstream; when content is unmodified, returns `304 Not Modified` without transferring redundant payloads. |
| **7** | **Content Negotiation (JSON & XML)** | 🔄 *Partial* | `product-service/src/server.js` | Product catalog endpoints inspect the `Accept` header. Supports both JSON (`application/json`) and XML (`application/xml`) serializations with `Vary: Accept` headers to prevent cache pollution. |
| **8** | **Cursor-Based Pagination** | ✅ *Implemented* | `product-service`, `order-service` | Stable sequential cursor pagination using encoded timestamp/ID cursors (`after=<cursor>`). Responses return `pagination.nextCursor`, `links.next`, and RFC-5988 standard `Link: <...>; rel="next"` headers alongside classic offset pagination. |
| **9** | **Declarative Cache-Control** | ✅ *Implemented* | `api-gateway`, `product-service` | Explicit HTTP caching directives: public catalog responses emit `Cache-Control: public, max-age=30, must-revalidate`; sensitive user and order routes emit `private, no-cache`; `/health` endpoints emit `no-store`. |
| **10** | **Unified Error Envelope** | 🔄 *Partial* | `api-gateway/src/app.js` | Centralized gateway error handler normalizes errors into a predictable JSON structure: `{ "success": false, "message": "...", "requestId": "..." }`. Direct microservice calls preserve domain-specific errors. |
| **11** | **Rate Limiting & 429 Headers** | ✅ *Implemented* | `api-gateway/src/app.js` | Built with `express-rate-limit`. Tracks sliding windows, emits standard `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers, and responds with `429 Too Many Requests` when limits are exceeded. |
| **12** | **OpenAPI 3.0 & Swagger UI** | ✅ *Implemented* | `api-gateway/src/openapi.js` | Handcrafted OpenAPI 3.0 specification available at `GET /openapi.json`. Interactive documentation and live endpoint testing served via Swagger UI at `/docs`. |
| **13** | **GraphQL Interface** | ✅ *Implemented* | `api-gateway/src/app.js` | GraphQL endpoint at `POST /graphql` (with GraphiQL explorer in non-production environments). Allows querying products by search, category, and cursor pagination alongside REST. |
| **14** | **Relational Database (SQL)** | ✅ *Implemented* | MySQL 8.4 (`api-gateway`) | Parameterized SQL queries using `mysql2` prevent SQL injection. Manages durable idempotency states (`api_idempotency`) and durable audit trails (`api_request_audit`). |
| **15** | **Document Database (NoSQL)** | ✅ *Implemented* | MongoDB 7 / Atlas | Domain microservices maintain independent MongoDB databases (`smartcart_auth`, `smartcart_products`, `smartcart_cart`, `smartcart_wishlist`, `smartcart_orders`, `smartcart_payments`, `smartcart_notifications`). |
| **16** | **Outbound Request Timeouts** | ✅ *Implemented* | `api-gateway`, `order-service`, `payment-service` | Microservice HTTP calls enforce strict timeouts (`AbortSignal.timeout` on fetch, Axios `timeout: 3000ms - 8000ms`). Slow or unresponsive downstream services fail safely without consuming server sockets. |
| **17** | **Exponential Backoff & Retries** | ✅ *Implemented* | `api-gateway/src/resilience.js` | Automated retry mechanism with increasing backoff delay (`retryWithBackoff`). Restricted strictly to idempotent `GET` and `HEAD` requests to prevent duplicate write mutations. |
| **18** | **Circuit Breaker Pattern** | ✅ *Implemented* | `api-gateway/src/resilience.js` | Gateway monitors upstream service failures per host. Trips open after exceeding failure thresholds to fail fast, followed by timed probes to automatically heal when downstream services recover. |
| **19** | **Strict CORS Allowlist** | ✅ *Implemented* | All backend services | Eliminates wildcards (`*`). Reads comma-separated origins from `CORS_ORIGIN` (default `http://localhost:3000`) with `credentials: true` for secure browser cross-origin requests. |
| **20** | **Express Middleware Pipeline** | ✅ *Implemented* | All backend services | Multi-tiered middleware chain enforcing request parsing limits (`limit: "100kb"`), request ID stamping, custom CORS headers, security guards, and central exception formatting. |
| **21** | **Structured Logging & Correlation IDs** | ✅ *Implemented* | `api-gateway`, All services | Generates or propagates `X-Request-Id` across all network hops. Emits machine-readable JSON logs (`level`, `service`, `requestId`, `method`, `status`, `durationMs`) for cross-service observability. |
| **22** | **Secure JWT & BFF Architecture** | ✅ *Implemented* | `auth-service`, `Frontend/smartcart-web` | Next.js server proxies authentication using a server-only `AUTH_EXCHANGE_SECRET`. Browser clients hold only an **HTTP-only, 7-day secure cookie**; raw tokens are never exposed to client-side scripts. |
| **23** | **Role-Based Access Control (RBAC)** | ✅ *Implemented* | `auth-service`, Domain Services | Granular permission model with distinct roles: `customer`, `staff`, `admin`, and `super-admin`. Permissions are verified dynamically on sensitive administration routes and portals. |
| **24** | **Payment Gateway Integration** | ✅ *Implemented* | `payment-service` | Integrated with **Razorpay Orders** and Standard Checkout. Features HMAC-SHA256 signature verification, webhook handler (`payment.captured`, `payment.failed`), automated refunds, and offline Cash on Delivery (COD) support. |
| **25** | **Transactional Notifications** | 🔄 *Partial* | `notification-service` | Event-driven transactional notifications for orders, shipments, returns, and security challenges. Supports Resend API integration, delivery queues, and a local mock email provider for development. SMS unconfigured. |
| **26** | **Containerization & Orchestration** | ✅ *Implemented* | `docker-compose.yml`, Dockerfiles | Each microservice and database possesses optimized Dockerfiles. Orchestrated via `docker-compose.yml` with health checks, network bridges, and persistent volumes for local multi-service execution. |
| **27** | **Twelve-Factor Configuration** | ✅ *Implemented* | Root & Service `.env.example` files | Complete decoupling of environment configuration. Database URIs, secrets, service endpoints, port bindings, and API keys are read from environment variables across dev, test, and production. |
| **28** | **Automated Testing Suite** | ✅ *Implemented* | `api-gateway/tests/api.test.js` | Integration test suite using **Jest** and **Supertest**. Verifies route versioning, AJV rejections, idempotency replay, ETags, conditional 304, XML content negotiation, rate-limit headers, and circuit breaker behavior. |
| *--* | *Live Cloud Deployment* | ⏳ *Pending* | Production Hosting | Prepared for containerized cloud deployment (AWS ECS, GCP Cloud Run, or Kubernetes). Local development runs seamlessly via Docker Compose. |

---

## Services & Ports Reference

| Service | Port | Database | Primary Responsibility |
| :--- | :---: | :--- | :--- |
| **API Gateway** | `4000` | MySQL (`smartcart`) | Routing (`/v1/api` & `/api`), Rate Limiting, OpenAPI/Swagger, GraphQL, Idempotency, Request Audits |
| **Auth Service** | `4001` | MongoDB (`smartcart_auth`) | User signup, login, Google OAuth, Email verification, RBAC permissions, Staff invites |
| **Product Service** | `4002` | MongoDB (`smartcart_products`) | Product catalog, Category filters, Search, Inventory management, Customer reviews |
| **Cart Service** | `4003` | MongoDB (`smartcart_cart`) | Customer shopping carts, Item quantities, Cart totals |
| **Wishlist Service** | `4004` | MongoDB (`smartcart_wishlist`) | Customer saved product wishlists |
| **Order Service** | `4005` | MongoDB (`smartcart_orders`) | Order placement, Stock reservations/rollbacks, Coupon discounts, Shipment tracking, Returns |
| **Payment Service** | `4006` | MongoDB (`smartcart_payments`) | Razorpay order creation, Signature verification, Webhook processing, Refund management, COD |
| **Notification Service** | `4007` | MongoDB (`smartcart_notifications`) | Transactional email delivery (Resend / Mock), Delivery logs, Notification preferences |
| **Frontend Web App** | `3000` | — | Next.js 15 App Router storefront, Customer portal, Staff & Admin management suite |

---

## Order & Payment Lifecycle

### 1. Online Payments (UPI & Card via Razorpay)
1. **Order Creation:** Client submits `POST /api/orders`. Order Service validates prices, reserves inventory in Product Service, calculates taxes/shipping, and calls Payment Service (`POST /api/payments/create`).
2. **Payment Intent:** Payment Service creates a Razorpay Order and returns checkout options (`orderId`, `amount`, `keyId`).
3. **Verification:** The frontend opens the Razorpay modal. Upon completion, it sends `POST /api/payments/verify/:paymentId`. Payment Service validates the cryptographic HMAC-SHA256 signature and queries Razorpay's API to confirm `status === 'captured'`.
4. **Order Confirmation:** Payment Service notifies Order Service via `PATCH /internal/orders/:id/payment`, setting `paymentStatus: "SUCCESS"` and committing reserved inventory. Webhooks (`POST /api/payments/webhook`) serve as a resilient fallback if the client window closes.

### 2. Cash on Delivery (COD)
1. Order is created with `paymentMethod: "COD"`. Payment Service marks gateway as `OFFLINE` and payment status as `PENDING`.
2. Admin confirms and ships the order (`CONFIRMED` -> `SHIPPED`), which automatically commits stock.

---

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v20+ recommended)
* [pnpm](https://pnpm.io/) (v9+)
* [Docker Desktop](https://www.docker.com/) (for Docker Compose) or local MongoDB & MySQL instances

### Option A: Running with Docker Compose (Recommended)

1. **Clone and setup environment variables:**
   ```bash
   cp Backend/.env.example Backend/.env
   ```
   *(Update `MONGODB_URI`, `JWT_SECRET`, and Razorpay test credentials if testing payments).*

2. **Start the backend stack:**
   ```bash
   cd Backend
   docker compose up --build
   ```
   * API Gateway will be live at `http://localhost:4000`
   * Swagger Documentation will be accessible at `http://localhost:4000/docs`

3. **Start the Frontend:**
   ```bash
   cd ../Frontend/smartcart-web
   pnpm install
   pnpm dev
   ```
   * Storefront & Admin interface will be live at `http://localhost:3000`

---

### Option B: Running Locally Without Docker

1. **Start MongoDB and MySQL locally.**
2. **Install and run API Gateway & Services:**
   In each service folder (`Backend/api-gateway`, `Backend/auth-service`, `Backend/product-service`, etc.):
   ```bash
   npm install
   npm run dev
   ```
3. **Run the Next.js Frontend:**
   ```bash
   cd Frontend/smartcart-web
   pnpm install
   pnpm dev
   ```

---

## Testing & Verification

### Running Gateway & Integration Tests
```bash
cd Backend/api-gateway
npm test
```
The test suite covers:
* Pre-proxy AJV payload validation
* Versioned `/v1/api` routing & ETag conditional 304 caching
* Idempotent POST replay and conflict detection
* Rate-limit header verification
* Circuit breaker failure tripping
* Accept header XML content negotiation
* Uniform error envelopes with correlation request IDs

### Postman Collection
Import `Backend/SmartCart.postman_collection.json` into Postman to inspect and test all microservice REST routes.
