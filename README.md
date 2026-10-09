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

Backend services are organized under `Backend`; their local container setup is
in `Backend/docker-compose.yml`.

## Razorpay Checkout

UPI and card checkout use Razorpay Orders and Standard Checkout. Payment
signatures are verified by the backend, and payment status is confirmed with
Razorpay and synced to the order. Cash on delivery does not open Razorpay.

Copy `Backend/.env.example` to `Backend/.env`, add Razorpay test keys and a
webhook secret, then start the services from `Backend` with
`docker compose up --build`. Setup, routes, and webhook instructions are in the
[payment service guide](Backend/payment-service/README.md).

## Technology Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- REST APIs
- Git and GitHub

## Security Notes

The payment service does not receive or store card numbers. A real payment provider should process payment details and notify SmartCart through a signed webhook. Keep `.env` files out of version control and never commit database URLs, API keys, or webhook secrets.
