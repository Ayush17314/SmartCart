# SmartCart

SmartCart is an Amazon-inspired e-commerce web application built with a microservices architecture. The backend uses Node.js, Express.js, and MongoDB, so each business area can be developed and deployed independently.

## Features

- User registration and login
- Product browsing, searching, and filtering
- Shopping cart management
- Wishlist management
- Payment creation, verification, refund processing, and payment history
- Order creation and order tracking

## Architecture

```text
SmartCart/
├── Backend/
│   ├── auth-service/          # Registration, login, and authentication
│   ├── product-service/       # Product catalogue, search, and filters
│   ├── cart-service/          # Cart items and quantities
│   ├── wishlist-service/      # Saved products
│   ├── order-service/         # Orders and delivery tracking
│   ├── payment-service/       # Payments, refunds, and gateway callbacks
│   └── notification-service/  # Email/SMS notifications
└── README.md
```

Currently, the `payment-service` is implemented. The remaining service folders represent the planned SmartCart architecture.

## Payment Service

The payment service provides a gateway-ready payment lifecycle:

- Creates a unique payment intent for an order
- Prevents duplicate charges with an `Idempotency-Key`
- Supports UPI, card, and cash-on-delivery payment methods
- Tracks `PENDING`, `SUCCESS`, `FAILED`, and `REFUNDED` states
- Records payment events for auditing
- Supports full refunds for successful payments
- Accepts HMAC-SHA256 signed webhook callbacks
- Provides paginated payment history for each user

### Run locally

```bash
cd Backend/payment-service
copy .env.example .env
npm install
npm run dev
```

Set `MONGO_URI` in `Backend/payment-service/.env` and make sure MongoDB is running. The service starts at `http://localhost:5004` by default.

### Payment API

Base URL: `http://localhost:5004/api/payments`

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/create` | Create a pending payment intent |
| `POST` | `/verify/:paymentId` | Simulate a gateway result during development |
| `POST` | `/webhook` | Process a signed payment gateway callback |
| `GET` | `/order/:orderId` | Get a payment by order ID |
| `GET` | `/user/:userId` | Get paginated payment history |
| `POST` | `/refund/:paymentId` | Refund a successful payment |

Example create request:

```json
{
  "orderId": "order-1001",
  "userId": "user-2001",
  "amount": 1299.5,
  "paymentMethod": "UPI"
}
```

For a full payment-service setup and webhook instructions, see [Backend/payment-service/README.md](Backend/payment-service/README.md).

## Technology Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- REST APIs
- Git and GitHub

## Security Notes

The payment service does not receive or store card numbers. A real payment provider should process payment details and notify SmartCart through a signed webhook. Keep `.env` files out of version control and never commit database URLs, API keys, or webhook secrets.
