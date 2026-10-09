# SmartCart Backend

SmartCart uses a Node.js and Express microservices backend. Each domain service
owns a MongoDB database and exposes REST. The gateway exposes both `/api` legacy
paths and the versioned `/v1/api` API, adds shared middleware and GraphQL, and
uses MySQL for durable gateway idempotency and request audit rows.

## Services

| Service | Port | Database | Responsibility |
| --- | ---: | --- | --- |
| API Gateway | 4000 | MySQL | Versioned REST routing, rate limiting, GraphQL, docs |
| Auth | 4001 | `smartcart_auth` | Registration, login, profiles, roles |
| Products | 4002 | `smartcart_products` | Catalog, search, inventory |
| Cart | 4003 | `smartcart_cart` | Customer shopping carts |
| Wishlist | 4004 | `smartcart_wishlist` | Saved products |
| Orders | 4005 | `smartcart_orders` | Checkout records, lifecycle, shipment tracking |
| Payments | 4006 | `smartcart_payments` | Payment intents and payment status |
| Notifications | 4007 | `smartcart_notifications` | Notification requests |

## Run locally

1. Start MongoDB.
2. Copy each service's `.env.example` to `.env` and set a strong shared
   `JWT_SECRET`.
3. Run `npm install` and then `npm start` in each service directory.
4. Send requests through `http://localhost:4000`.

To start the complete stack with Docker Compose, copy `.env.example` to `.env`
and run `docker compose up --build` from this directory. Set the JWT, SQL, and
Razorpay secrets before using the stack outside local development. The Compose
fallback secrets are for development only. API docs are served at `/docs` and
the handwritten specification at `/openapi.json`.

## Authentication

Register with `POST /api/auth/register`:

```json
{
  "name": "Ada",
  "email": "ada@example.com",
  "password": "password123"
}
```

Use the returned JWT on protected routes:

```http
Authorization: Bearer <token>
```

Public registration always creates a customer account. Assign admin roles only
through a controlled database or bootstrap process.

## Orders and shipment tracking

Create an order with `POST /api/orders`. The service loads current product
prices and checks stock before it saves the order. Payment initialization is
initialized after order creation. UPI and card orders include Razorpay Checkout
details for the browser; the payment service verifies the returned signature and
syncs captured payment status back to the order. If the provider is temporarily
unavailable, the saved order remains available with `paymentStatus: PENDING`.

Customers can access only their own orders. Admins can list all orders and filter
by status. Lists accept `page` and `limit` query parameters, with a maximum page
size of 100.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/orders` | Customer | Create an order |
| `GET` | `/api/orders?page=1&limit=20` | Customer or admin | List visible orders |
| `GET` | `/api/orders/:id` | Owner or admin | Get order details |
| `GET` | `/api/orders/:id/tracking` | Owner or admin | Get current shipment and status history |
| `PATCH` | `/api/orders/:id/status` | Admin | Advance the order and add a history event |
| `POST` | `/api/orders/:id/cancel` | Owner or admin | Cancel an eligible order |
| `POST` | `/api/orders/:id/return` | Owner or admin | Request a return for an eligible order |

Statuses follow this lifecycle:

```text
PENDING -> CONFIRMED -> SHIPPED -> DELIVERED -> RETURNED
    |           |
    +-> CANCELLED <-+
```

The admin status request accepts a `note`. Moving an order to `SHIPPED` also
requires shipment details:

```json
{
  "status": "SHIPPED",
  "note": "Handed to the carrier",
  "shipment": {
    "carrier": "Example Carrier",
    "trackingNumber": "SC-123456",
    "trackingUrl": "https://carrier.example/track/SC-123456"
  }
}
```

Every status change records the actor, timestamp, status, and optional note in
`statusHistory`. Customers can retrieve this history from the tracking route.
Only valid status transitions are accepted.

## Other APIs

- Products support search and cursor pagination, for example
  `GET /v1/api/products?limit=20&search=phone&category=electronics`; follow the
  returned `Link: rel="next"` URL for the next page.
- Cart and wishlist routes require a bearer token.
- Notifications expose `/api/notifications/email`, `/sms`, `/order`, and
  `/payment`. The default provider records mock notification requests.
- GraphQL products are available at `POST /graphql`. GraphiQL is enabled
  outside production.
- Gateway POST resource creation uses an `Idempotency-Key` header and records
  replay responses in MySQL. `GET` responses carry cache policy and ETags; the
  product list supports JSON and XML representations.

## Development notes

- All services expose `/health` endpoints.
- Razorpay test keys simulate payments without moving real funds. Configure test
  keys and webhook secrets before using checkout; see
  [the payment service guide](payment-service/README.md).
- Product stock checking during order creation is a validation step. Production
  inventory reservation should use an atomic reservation or a dedicated
  inventory workflow to prevent concurrent checkouts overselling stock.
- Configure real notification, payment, and carrier integrations before
  production use.
