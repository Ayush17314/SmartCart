require("dotenv").config();

const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = express();
const Schema = mongoose.Schema;
const ORDER_STATUSES = [
    "PENDING",
    "CONFIRMED",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
];

const ALLOWED_TRANSITIONS = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: ["RETURNED"],
    CANCELLED: [],
    RETURNED: [],
};

const orderItemSchema = new Schema(
    {
        productId: { type: String, required: true },
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
    },
    { _id: false },
);

const statusEventSchema = new Schema(
    {
        status: { type: String, enum: ORDER_STATUSES, required: true },
        note: { type: String, trim: true, maxlength: 500, default: "" },
        changedBy: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const orderSchema = new Schema(
    {
        userId: { type: String, required: true, index: true },
        items: { type: [orderItemSchema], required: true },
        shippingAddress: { type: Schema.Types.Mixed, default: {} },
        totalAmount: { type: Number, required: true, min: 0 },
        paymentId: { type: String, default: null },
        paymentMethod: { type: String, enum: ["UPI", "CARD", "COD"], default: "UPI" },
        paymentCheckout: { type: Schema.Types.Mixed, default: null },
        paymentStatus: {
            type: String,
            enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
            default: "PENDING",
        },
        orderStatus: {
            type: String,
            enum: ORDER_STATUSES,
            default: "PENDING",
        },
        statusHistory: { type: [statusEventSchema], default: [] },
        shipment: {
            carrier: { type: String, trim: true, default: null },
            trackingNumber: { type: String, trim: true, default: null },
            trackingUrl: { type: String, trim: true, default: null },
            shippedAt: { type: Date, default: null },
            deliveredAt: { type: Date, default: null },
        },
    },
    { timestamps: true },
);

orderSchema.index({ userId: 1, createdAt: -1 });
const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

app.use(cors({ origin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map((value) => value.trim()), credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
    if (req.method === "GET") res.set("Cache-Control", req.path === "/health" ? "no-store" : "private, no-cache");
    next();
});

function sendData(res, data, statusCode = 200) {
    return res.status(statusCode).json({ success: true, data });
}

function sendError(res, error) {
    let statusCode = error.statusCode || 500;
    if (error.name === "ValidationError" || error.name === "CastError") {
        statusCode = 400;
    }
    const message = statusCode >= 500 ? "Internal server error" : error.message;
    return res.status(statusCode).json({ success: false, message });
}

function authenticate(req, res, next) {
    const authorization = req.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");

    try {
        if (!token || !process.env.JWT_SECRET) {
            throw new Error("Missing authentication configuration");
        }

        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }
}

function requireAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required",
        });
    }

    return next();
}

function canViewOrder(order, user) {
    return order.userId === user.userId || user.role === "admin";
}

function parsePagination(query) {
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
    return { page, limit };
}

function decodeOrderCursor(value) {
    try {
        const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
        if (!cursor.createdAt || !mongoose.isValidObjectId(cursor.id) || Number.isNaN(Date.parse(cursor.createdAt))) throw new Error("Invalid cursor");
        return { createdAt: new Date(cursor.createdAt), id: new mongoose.Types.ObjectId(cursor.id) };
    } catch {
        const error = new Error("Invalid pagination cursor");
        error.statusCode = 400;
        throw error;
    }
}

const encodeOrderCursor = (order) => Buffer.from(JSON.stringify({ createdAt: order.createdAt.toISOString(), id: String(order._id) })).toString("base64url");

function getProductServiceUrl() {
    return process.env.PRODUCT_SERVICE_URL || "http://localhost:4002";
}

async function loadOrderItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        const error = new Error("Order items are required");
        error.statusCode = 400;
        throw error;
    }

    if (items.length > 50) {
        const error = new Error("An order cannot contain more than 50 line items");
        error.statusCode = 400;
        throw error;
    }

    return Promise.all(
        items.map(async (item) => {
            const quantity = Number(item.quantity);
            if (!item.productId || !Number.isInteger(quantity) || quantity < 1) {
                const error = new Error("Each item needs a productId and positive integer quantity");
                error.statusCode = 400;
                throw error;
            }

            const response = await axios.get(
                `${getProductServiceUrl()}/api/products/${encodeURIComponent(item.productId)}`,
                { timeout: 5000 },
            );
            const product = response.data?.data;

            if (!product) {
                const error = new Error("Product was not found");
                error.statusCode = 404;
                throw error;
            }

            if (product.stock < quantity) {
                const error = new Error(`Insufficient stock for ${product.name}`);
                error.statusCode = 409;
                throw error;
            }

            return {
                productId: String(product._id),
                name: product.name,
                price: product.price,
                quantity,
            };
        }),
    );
}

app.get("/health", (req, res) => {
    res.json({ service: "order-service", status: "OK" });
});

app.patch("/internal/orders/:id/payment", async (req, res) => {
    const secret = process.env.PAYMENT_SERVICE_SECRET || "";
    const provided = req.get("X-Payment-Service-Secret") || "";
    const expectedBuffer = Buffer.from(secret);
    const providedBuffer = Buffer.from(provided);
    if (!secret || expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const allowedPaymentStatuses = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"];
    if (!allowedPaymentStatuses.includes(req.body.paymentStatus) || !req.body.paymentId) {
        return res.status(400).json({ success: false, message: "Valid paymentId and paymentStatus are required" });
    }
    try {
        const order = await Order.findByIdAndUpdate(req.params.id, {
            paymentId: String(req.body.paymentId),
            paymentStatus: req.body.paymentStatus,
        }, { new: true, runValidators: true });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        return res.json({ success: true, data: { orderId: String(order._id), paymentStatus: order.paymentStatus } });
    } catch (error) {
        return sendError(res, error);
    }
});

app.post("/api/orders", authenticate, async (req, res) => {
    try {
        const items = await loadOrderItems(req.body.items);
        const totalAmount = items.reduce(
            (total, item) => total + item.price * item.quantity,
            0,
        );
        const order = await Order.create({
            userId: req.user.userId,
            items,
            shippingAddress: req.body.shippingAddress || {},
            totalAmount,
            paymentMethod: req.body.paymentMethod || "UPI",
            statusHistory: [
                {
                    status: "PENDING",
                    note: "Order placed",
                    changedBy: req.user.userId,
                },
            ],
        });

        // Payment setup is best-effort; the order remains visible with PENDING status
        // so the client can safely retry payment without losing its order record.
        try {
            const paymentResponse = await axios.post(
                `${process.env.PAYMENT_SERVICE_URL || "http://localhost:4006"}/api/payments/create`,
                {
                    orderId: String(order._id),
                    userId: req.user.userId,
                    amount: totalAmount,
                    paymentMethod: req.body.paymentMethod || "UPI",
                },
                {
                    headers: {
                        Authorization: req.get("Authorization"),
                        "Idempotency-Key": `order-${String(order._id)}`,
                    },
                    timeout: 5000,
                },
            );
            const payment = paymentResponse.data.payment || paymentResponse.data.data;
            if (payment) {
                order.paymentId = String(payment._id);
                order.paymentStatus = payment.status || "PENDING";
                order.paymentCheckout = paymentResponse.data.checkout || null;
                await order.save();
            }
        } catch (paymentError) {
            console.warn("Payment setup failed for order", String(order._id), paymentError.message);
        }

        const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4007";
        axios
            .post(`${notificationUrl}/api/notifications/order`, {
                userId: req.user.userId,
                orderId: String(order._id),
            }, { timeout: 3000 })
            .catch((notificationError) => {
                console.warn("Order notification failed:", notificationError.message);
            });

        return sendData(res, order, 201);
    } catch (error) {
        if (error.response?.status === 404) {
            error.statusCode = 404;
            error.message = "A requested product was not found";
        } else if (error.response?.status >= 400 && error.response?.status < 500) {
            error.statusCode = error.response.status;
            error.message = error.response.data?.message || "A requested product is unavailable";
        } else if (error.code === "ECONNABORTED" || error.code === "ECONNREFUSED") {
            error.statusCode = 503;
            error.message = "A dependent service is unavailable";
        }
        return sendError(res, error);
    }
});

app.get("/api/orders", authenticate, async (req, res) => {
    try {
        const { page, limit } = parsePagination(req.query);
        const filter = req.user.role === "admin" ? {} : { userId: req.user.userId };

        if (req.user.role === "admin" && req.query.status) {
            if (!ORDER_STATUSES.includes(String(req.query.status).toUpperCase())) {
                return res.status(400).json({ success: false, message: "Invalid order status" });
            }
            filter.orderStatus = String(req.query.status).toUpperCase();
        }

        if (req.query.after) {
            const cursor = decodeOrderCursor(String(req.query.after));
            filter.$or = [
                { createdAt: { $lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
            ];
            const rows = await Order.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
            const hasNext = rows.length > limit;
            const orders = hasNext ? rows.slice(0, limit) : rows;
            const nextCursor = hasNext && orders.length ? encodeOrderCursor(orders[orders.length - 1]) : null;
            const url = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
            if (nextCursor) url.searchParams.set("after", nextCursor);
            else url.searchParams.delete("after");
            const next = nextCursor ? `${url.pathname}${url.search}` : null;
            if (next) res.set("Link", `<${next}>; rel="next"`);
            return res.json({ success: true, data: orders, pagination: { limit, hasNext, nextCursor }, links: { next } });
        }

        const [orders, total] = await Promise.all([
            Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
            Order.countDocuments(filter),
        ]);
        const nextCursor = orders.length === limit ? encodeOrderCursor(orders[orders.length - 1]) : null;
        const url = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
        if (nextCursor) url.searchParams.set("after", nextCursor);
        else url.searchParams.delete("after");
        const next = nextCursor && (page * limit < total) ? `${url.pathname}${url.search}` : null;
        if (next) res.set("Link", `<${next}>; rel="next"`);
        return res.json({
            success: true,
            data: orders,
            pagination: { page, limit, total, pages: Math.ceil(total / limit), hasNext: page * limit < total, nextCursor: next ? nextCursor : null },
            links: { next },
        });
    } catch (error) {
        return sendError(res, error);
    }
});

app.get("/api/orders/:id/tracking", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid order id" });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (!canViewOrder(order, req.user)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        return sendData(res, {
            orderId: String(order._id),
            status: order.orderStatus,
            shipment: order.shipment,
            history: order.statusHistory,
            updatedAt: order.updatedAt,
        });
    } catch (error) {
        return sendError(res, error);
    }
});

app.get("/api/orders/:id", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid order id" });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (!canViewOrder(order, req.user)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        return sendData(res, order);
    } catch (error) {
        return sendError(res, error);
    }
});

app.patch("/api/orders/:id/status", authenticate, requireAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid order id" });
        }

        const nextStatus = String(req.body.status || "").toUpperCase();
        if (!ORDER_STATUSES.includes(nextStatus)) {
            return res.status(400).json({ success: false, message: "Invalid order status" });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (!ALLOWED_TRANSITIONS[order.orderStatus].includes(nextStatus)) {
            return res.status(409).json({
                success: false,
                message: `Order cannot move from ${order.orderStatus} to ${nextStatus}`,
            });
        }

        const shipment = req.body.shipment || {};
        if (nextStatus === "SHIPPED" && (!shipment.carrier || !shipment.trackingNumber)) {
            return res.status(400).json({
                success: false,
                message: "Carrier and trackingNumber are required when shipping an order",
            });
        }

        order.orderStatus = nextStatus;
        if (nextStatus === "SHIPPED") {
            order.shipment.carrier = shipment.carrier;
            order.shipment.trackingNumber = shipment.trackingNumber;
            order.shipment.trackingUrl = shipment.trackingUrl || null;
            order.shipment.shippedAt = new Date();
        }
        if (nextStatus === "DELIVERED") {
            order.shipment.deliveredAt = new Date();
        }
        order.statusHistory.push({
            status: nextStatus,
            note: req.body.note || "",
            changedBy: req.user.userId,
        });

        await order.save();
        return sendData(res, order);
    } catch (error) {
        return sendError(res, error);
    }
});

app.post("/api/orders/:id/cancel", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid order id" });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (!canViewOrder(order, req.user)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }
        if (!ALLOWED_TRANSITIONS[order.orderStatus].includes("CANCELLED")) {
            return res.status(409).json({
                success: false,
                message: "This order can no longer be cancelled",
            });
        }

        order.orderStatus = "CANCELLED";
        order.statusHistory.push({
            status: "CANCELLED",
            note: req.body.note || "Cancelled by customer",
            changedBy: req.user.userId,
        });
        await order.save();
        return sendData(res, order);
    } catch (error) {
        return sendError(res, error);
    }
});

app.post("/api/orders/:id/return", authenticate, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid order id" });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        if (!canViewOrder(order, req.user)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }
        if (!ALLOWED_TRANSITIONS[order.orderStatus].includes("RETURNED")) {
            return res.status(409).json({
                success: false,
                message: "Only shipped or delivered orders can be returned",
            });
        }

        order.orderStatus = "RETURNED";
        order.statusHistory.push({
            status: "RETURNED",
            note: req.body.note || "Return requested",
            changedBy: req.user.userId,
        });
        await order.save();
        return sendData(res, order);
    } catch (error) {
        return sendError(res, error);
    }
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && "body" in error) {
        return res.status(400).json({ success: false, message: "Invalid JSON" });
    }
    return sendError(res, error);
});

const port = Number(process.env.PORT) || 4005;
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

mongoose
    .connect(mongoUri, { dbName: process.env.MONGODB_DB || "smartcart_orders" })
    .then(() => {
        app.listen(port, () => {
            console.log(`Order service listening on port ${port}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    });
