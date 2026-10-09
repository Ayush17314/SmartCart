const crypto = require("crypto");
const axios = require("axios");
const Payment = require("../models/payment.model");

class PaymentError extends Error {
    constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; }
}

const PAYMENT_METHODS = ["UPI", "CARD", "COD"];
const PAYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"];
const addEvent = (payment, type, message) => payment.events.push({ type, message });
const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID;

async function syncOrderPayment(payment) {
    if (!process.env.PAYMENT_SERVICE_SECRET || !process.env.ORDER_SERVICE_URL) return;
    try {
        await axios.patch(`${process.env.ORDER_SERVICE_URL}/internal/orders/${encodeURIComponent(payment.orderId)}/payment`, {
            paymentId: String(payment._id), paymentStatus: payment.status,
        }, {
            headers: { "X-Payment-Service-Secret": process.env.PAYMENT_SERVICE_SECRET },
            timeout: Number(process.env.ORDER_SERVICE_TIMEOUT_MS) || 3000,
        });
    } catch (error) {
        console.error(JSON.stringify({ level: "error", service: "payment-service", message: "Could not sync payment status to order", orderId: payment.orderId, error: error.message }));
    }
}

function getRazorpayConfig() {
    const keyId = razorpayKeyId();
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new PaymentError("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.", 503);
    return { keyId, keySecret };
}

async function razorpayRequest(method, path, data) {
    const { keyId, keySecret } = getRazorpayConfig();
    try {
        const response = await axios({
            method,
            url: `${(process.env.RAZORPAY_API_URL || "https://api.razorpay.com/v1").replace(/\/$/, "")}${path}`,
            auth: { username: keyId, password: keySecret },
            data,
            timeout: Number(process.env.RAZORPAY_TIMEOUT_MS) || 8000,
            headers: { "Content-Type": "application/json" },
        });
        return response.data;
    } catch (error) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.description;
        throw new PaymentError(message || (status ? "Razorpay rejected the request" : "Razorpay is temporarily unavailable"), status && status < 500 ? 502 : 503);
    }
}

const getPaymentById = async (paymentId) => {
    if (!/^[a-f\d]{24}$/i.test(paymentId)) throw new PaymentError("Invalid payment id");
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new PaymentError("Payment not found", 404);
    return payment;
};

const validatePaymentData = ({ orderId, userId, amount, paymentMethod }) => {
    if (!orderId || !String(orderId).trim()) throw new PaymentError("orderId is required");
    if (!userId || !String(userId).trim()) throw new PaymentError("userId is required");
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || Math.abs(Math.round(numericAmount * 100) - numericAmount * 100) > 1e-7) {
        throw new PaymentError("amount must be a positive value with no more than two decimal places");
    }
    if (!PAYMENT_METHODS.includes(String(paymentMethod).toUpperCase())) throw new PaymentError("paymentMethod must be UPI, CARD, or COD");
};

const checkoutDetails = (payment) => ({
    keyId: razorpayKeyId(),
    orderId: payment.gateway.paymentIntentId,
    amount: Math.round(payment.amount * 100),
    currency: payment.currency || process.env.PAYMENT_CURRENCY || "INR",
    name: process.env.STORE_NAME || "SmartCart",
    description: `Payment for order ${payment.orderId}`,
});

const createPayment = async (data, idempotencyKey) => {
    validatePaymentData(data);
    if (!idempotencyKey || String(idempotencyKey).length > 200) throw new PaymentError("A valid Idempotency-Key header is required");
    const userId = String(data.userId).trim();
    const orderId = String(data.orderId).trim();
    const amount = Number(data.amount);
    const paymentMethod = String(data.paymentMethod).toUpperCase();

    const priorPayment = await Payment.findOne({ userId, idempotencyKey }).select("+idempotencyKey");
    if (priorPayment) {
        if (priorPayment.orderId !== orderId || priorPayment.amount !== amount || priorPayment.paymentMethod !== paymentMethod) {
            throw new PaymentError("Idempotency key was already used with different payment data", 409);
        }
        if (priorPayment.gateway.paymentIntentId || paymentMethod === "COD") {
            return { payment: priorPayment, created: false, checkout: priorPayment.gateway.paymentIntentId ? checkoutDetails(priorPayment) : null };
        }
    }
    const priorOrderPayment = await Payment.findOne({ orderId });
    if (priorOrderPayment && (!priorPayment || String(priorOrderPayment._id) !== String(priorPayment._id))) {
        throw new PaymentError("A payment already exists for this order", 409);
    }

    if (paymentMethod === "COD") {
        const payment = await Payment.create({
            orderId, userId, amount, paymentMethod, idempotencyKey,
            gateway: { provider: "OFFLINE" },
            events: [{ type: "PAYMENT_CREATED", message: "Cash on delivery selected" }],
        });
        return { payment, created: true, checkout: null };
    }

    const currency = process.env.PAYMENT_CURRENCY || "INR";
    let payment = priorPayment;
    let created = false;
    if (!payment) {
        payment = await Payment.create({
            orderId, userId, amount, paymentMethod, currency, idempotencyKey,
            gateway: { provider: "RAZORPAY" },
            events: [{ type: "PAYMENT_CREATED", message: "Payment initialization started" }],
        });
        created = true;
    }
    const remoteOrder = await razorpayRequest("post", "/orders", {
        amount: Math.round(amount * 100), currency, receipt: orderId.slice(-40),
        notes: { smartcartOrderId: orderId, smartcartUserId: userId },
    });
    payment.gateway.provider = "RAZORPAY";
    payment.gateway.paymentIntentId = remoteOrder.id;
    payment.gateway.reference = remoteOrder.receipt;
    addEvent(payment, "RAZORPAY_ORDER_CREATED", "Razorpay checkout order created");
    await payment.save();
    return { payment, created, checkout: checkoutDetails(payment) };
};

const verifyCheckoutPayment = async ({ paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    if (!paymentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) throw new PaymentError("Razorpay payment verification fields are required");
    const payment = await getPaymentById(paymentId);
    const { keySecret } = getRazorpayConfig();
    const trustedOrderId = payment.gateway.paymentIntentId;
    if (!trustedOrderId || trustedOrderId !== razorpayOrderId) throw new PaymentError("Razorpay order does not match this payment", 400);
    const expected = crypto.createHmac("sha256", keySecret).update(`${trustedOrderId}|${razorpayPaymentId}`).digest();
    let received;
    try { received = Buffer.from(razorpaySignature, "hex"); } catch { received = Buffer.alloc(0); }
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) throw new PaymentError("Invalid Razorpay payment signature", 401);

    const remotePayment = await razorpayRequest("get", `/payments/${encodeURIComponent(razorpayPaymentId)}`);
    if (remotePayment.order_id !== trustedOrderId || remotePayment.amount !== Math.round(payment.amount * 100) || remotePayment.currency !== (payment.currency || "INR")) {
        throw new PaymentError("Razorpay payment details do not match the order", 409);
    }
    if (payment.status === "SUCCESS") {
        await syncOrderPayment(payment);
        return payment;
    }
    if (remotePayment.status === "captured") {
        payment.status = "SUCCESS";
        payment.transactionId = razorpayPaymentId;
        addEvent(payment, "PAYMENT_CAPTURED", "Payment captured by Razorpay");
    } else if (remotePayment.status === "failed") {
        payment.status = "FAILED";
        payment.failureReason = remotePayment.error_description || "Razorpay payment failed";
        addEvent(payment, "PAYMENT_FAILED", payment.failureReason);
    } else {
        payment.transactionId = razorpayPaymentId;
        addEvent(payment, "PAYMENT_AUTHORIZED", "Payment is authorized and awaiting capture");
    }
    await payment.save();
    if (["SUCCESS", "FAILED", "REFUNDED"].includes(payment.status)) await syncOrderPayment(payment);
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
        Payment.countDocuments(filter),
    ]);
    return { payments, pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } };
};

const refundPayment = async (paymentId) => {
    const payment = await getPaymentById(paymentId);
    if (payment.status !== "SUCCESS") throw new PaymentError("Only successful payments can be refunded", 409);
    if (payment.gateway.provider !== "RAZORPAY" || !payment.transactionId) throw new PaymentError("This payment cannot be refunded through Razorpay", 409);
    const remoteRefund = await razorpayRequest("post", `/payments/${encodeURIComponent(payment.transactionId)}/refund`, {
        amount: Math.round(payment.amount * 100), notes: { smartcartOrderId: payment.orderId },
    });
    payment.status = "REFUNDED";
    payment.refundedAmount = Number(remoteRefund.amount) / 100;
    payment.refundId = remoteRefund.id;
    addEvent(payment, "PAYMENT_REFUNDED", `Razorpay refund ${remoteRefund.id} created`);
    await payment.save();
    await syncOrderPayment(payment);
    return payment;
};

const processWebhook = async (payload, signature, rawBody) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new PaymentError("Razorpay webhook is not configured", 503);
    if (!signature || !rawBody) throw new PaymentError("Razorpay webhook signature is required", 401);
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) throw new PaymentError("Invalid Razorpay webhook signature", 401);
    const entity = payload?.payload?.payment?.entity;
    const orderId = entity?.order_id;
    if (!orderId) throw new PaymentError("Webhook event does not include an order id");
    const payment = await Payment.findOne({ "gateway.paymentIntentId": orderId });
    if (!payment) throw new PaymentError("Payment for Razorpay order was not found", 404);
    if (payload.event === "payment.captured" && payment.status !== "SUCCESS") {
        payment.status = "SUCCESS";
        payment.transactionId = entity.id;
        addEvent(payment, "PAYMENT_CAPTURED", "Payment captured by Razorpay webhook");
    } else if (payload.event === "payment.failed" && payment.status === "PENDING") {
        payment.status = "FAILED";
        payment.failureReason = entity.error_description || "Razorpay payment failed";
        addEvent(payment, "PAYMENT_FAILED", payment.failureReason);
    } else {
        if (["SUCCESS", "FAILED", "REFUNDED"].includes(payment.status)) await syncOrderPayment(payment);
        return payment;
    }
    await payment.save();
    if (["SUCCESS", "FAILED", "REFUNDED"].includes(payment.status)) await syncOrderPayment(payment);
    return payment;
};

module.exports = { createPayment, verifyCheckoutPayment, getPaymentById, getPaymentByOrderId, getPaymentsByUserId, refundPayment, processWebhook, PaymentError };
