# SmartCart Payment Service

Node.js, Express, and MongoDB microservice for recording a payment and its lifecycle. It includes idempotent payment creation, payment history, an audit trail, refund records, request IDs, and signed gateway-webhook support. It deliberately does **not** collect card numbers.

## Run

1. Copy `.env.example` to `.env` and set `MONGO_URI`.
2. Start MongoDB.
3. Run `npm run dev` (or `npm start`).

## API

Base URL: `http://localhost:5004/api/payments`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/create` | Create a pending payment |
| `POST` | `/verify/:paymentId` | Mark a pending payment successful or failed (development simulation) |
| `POST` | `/webhook` | Process a signed gateway payment result |
| `GET` | `/order/:orderId` | Get the payment for an order |
| `GET` | `/user/:userId?page=1&limit=10&status=SUCCESS` | Get paginated payment history |
| `POST` | `/refund/:paymentId` | Refund a successful payment |

Create request body:

```json
{
  "orderId": "order-1001",
  "userId": "user-2001",
  "amount": 1299.5,
  "paymentMethod": "UPI"
}
```

Verify request body:

```json
{ "success": true }
```

Payment states: `PENDING` → `SUCCESS` or `FAILED`; only `SUCCESS` can become `REFUNDED`.

## Reliability and gateway integration

Send an `Idempotency-Key` header with every `POST /create`. Retrying the exact same request returns the original payment instead of creating another charge.

For production, have the payment provider call `POST /webhook` with `{ "paymentId": "...", "success": true }`. Sign the exact JSON request body with HMAC-SHA256 using `WEBHOOK_SECRET`, then send the hex signature in `X-Payment-Signature`. The service verifies the signature before changing payment status.

`POST /verify/:paymentId` is only a local-development simulation; protect or remove it when a real provider is connected.
