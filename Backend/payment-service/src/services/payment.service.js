const crypto = require("crypto");
const Payment = require("../models/payment.model");

class PaymentError extends Error {
    constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}

const PAYMENT_METHODS = ["UPI", "CARD", "COD"];
const PAYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"];
const addEvent = (payment, type, message) => payment.events.push({ type, message });

const getPaymentById = async (paymentId) => {
    if (!/^[a-f\d]{24}$/i.test(paymentId)) throw new PaymentError("Invalid payment id");
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new PaymentError("Payment not found", 404);
    return payment;
};

const validatePaymentData = ({ orderId, userId, amount, paymentMethod }) => {
    if (!orderId || !String(orderId).trim()) throw new PaymentError("orderId is required");
    if (!userId || !String(userId).trim()) throw new PaymentError("userId is required");
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new PaymentError("amount must be a positive number");
    if (!PAYMENT_METHODS.includes(String(paymentMethod).toUpperCase())) throw new PaymentError("paymentMethod must be UPI, CARD, or COD");
};

const createPayment = async (data, idempotencyKey) => {
    validatePaymentData(data);
    const userId = String(data.userId).trim();
    const orderId = String(data.orderId).trim();
    const amount = Number(data.amount);

    if (idempotencyKey) {
        const priorPayment = await Payment.findOne({ userId, idempotencyKey }).select("+idempotencyKey");
        if (priorPayment) {
            if (priorPayment.orderId !== orderId || priorPayment.amount !== amount) throw new PaymentError("Idempotency key was already used with different payment data", 409);
            return { payment: priorPayment, created: false };
        }
    }
    if (await Payment.exists({ orderId })) throw new PaymentError("A payment already exists for this order", 409);

    const payment = await Payment.create({
        orderId, userId, amount,
        paymentMethod: String(data.paymentMethod).toUpperCase(),
        idempotencyKey: idempotencyKey || null,
        gateway: { provider: process.env.PAYMENT_PROVIDER || "MOCK", paymentIntentId: `pi_${crypto.randomUUID()}` },
        events: [{ type: "PAYMENT_CREATED", message: "Payment intent created" }]
    });
    return { payment, created: true };
};

const verifyPayment = async (paymentId, success) => {
    const payment = await getPaymentById(paymentId);
    if (typeof success !== "boolean") throw new PaymentError("success must be a boolean");
    if (payment.status !== "PENDING") throw new PaymentError(`A ${payment.status.toLowerCase()} payment cannot be verified`, 409);
    if (success) {
        payment.status = "SUCCESS";
        payment.transactionId = `TXN-${crypto.randomUUID()}`;
        addEvent(payment, "PAYMENT_SUCCEEDED", "Payment confirmed by gateway");
    } else {
        payment.status = "FAILED";
        payment.failureReason = "Payment was declined or cancelled";
        addEvent(payment, "PAYMENT_FAILED", payment.failureReason);
    }
    await payment.save();
    return payment;
};

const getPaymentByOrderId = (orderId) => Payment.findOne({ orderId: String(orderId).trim() });

const getPaymentsByUserId = async (userId, page = 1, limit = 10, status) => {
    if (!userId || !String(userId).trim()) throw new PaymentError("userId is required");
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const filter = { userId: String(userId).trim() };
    if (status) {
        const normalizedStatus = String(status).toUpperCase();
        if (!PAYMENT_STATUSES.includes(normalizedStatus)) throw new PaymentError("Invalid payment status");
        filter.status = normalizedStatus;
    }
    const [payments, total] = await Promise.all([
        Payment.find(filter).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit),
        Payment.countDocuments(filter)
    ]);
    return { payments, pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
};

const refundPayment = async (paymentId) => {
    const payment = await getPaymentById(paymentId);
    if (payment.status !== "SUCCESS") throw new PaymentError("Only successful payments can be refunded", 409);
    payment.status = "REFUNDED";
    payment.refundedAmount = payment.amount;
    payment.refundId = `ref_${crypto.randomUUID()}`;
    addEvent(payment, "PAYMENT_REFUNDED", `Refund ${payment.refundId} created`);
    await payment.save();
    return payment;
};

const processWebhook = async (payload, signature, rawBody) => {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) throw new PaymentError("Webhook processing is not configured", 503);
    if (!signature || !rawBody) throw new PaymentError("Webhook signature is required", 401);
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const received = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (received.length !== expectedBuffer.length || !crypto.timingSafeEqual(received, expectedBuffer)) throw new PaymentError("Invalid webhook signature", 401);
    if (!payload.paymentId || typeof payload.success !== "boolean") throw new PaymentError("Webhook payload requires paymentId and boolean success");
    return verifyPayment(payload.paymentId, payload.success);
};

module.exports = { createPayment, verifyPayment, getPaymentByOrderId, getPaymentsByUserId, refundPayment, processWebhook, PaymentError };
