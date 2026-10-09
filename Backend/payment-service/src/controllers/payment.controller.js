const paymentService = require("../services/payment.service");

const sendError = (res, error) => {
    const statusCode = error.code === 11000 ? 409 : error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: statusCode >= 500 ? "Payment provider or service is unavailable" : error.message });
};

const createPayment = async (req, res) => {
    try {
        const result = await paymentService.createPayment({ ...req.body, userId: req.user.userId }, req.get("Idempotency-Key"));
        const payload = { payment: result.payment, checkout: result.checkout };
        return res.status(result.created ? 201 : 200).json({
            success: true,
            message: result.created ? "Payment order created" : "Existing payment returned",
            ...payload,
            data: payload,
        });
    } catch (error) { return sendError(res, error); }
};

const verifyPayment = async (req, res) => {
    try {
        const payment = await paymentService.getPaymentById(req.params.paymentId);
        if (payment.userId !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Forbidden" });
        const verified = await paymentService.verifyCheckoutPayment({ paymentId: req.params.paymentId, ...req.body });
        return res.json({ success: true, message: "Razorpay payment verified", data: { payment: verified } });
    } catch (error) { return sendError(res, error); }
};

const getPayment = async (req, res) => {
    try {
        const payment = await paymentService.getPaymentByOrderId(req.params.orderId);
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
        if (payment.userId !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Forbidden" });
        return res.json({ success: true, payment });
    } catch (error) { return sendError(res, error); }
};

const getUserPayments = async (req, res) => {
    try {
        const requestedUser = req.params.userId || req.user.userId;
        if (requestedUser !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Forbidden" });
        const result = await paymentService.getPaymentsByUserId(requestedUser, req.query.page, req.query.limit, req.query.status);
        return res.json({ success: true, ...result });
    } catch (error) { return sendError(res, error); }
};

const refundPayment = async (req, res) => {
    try {
        const payment = await paymentService.getPaymentById(req.params.paymentId);
        if (payment.userId !== req.user.userId && req.user.role !== "admin") return res.status(403).json({ success: false, message: "Forbidden" });
        return res.json({ success: true, message: "Refund submitted to Razorpay", payment: await paymentService.refundPayment(req.params.paymentId) });
    } catch (error) { return sendError(res, error); }
};

const handleWebhook = async (req, res) => {
    try {
        const payment = await paymentService.processWebhook(req.body, req.get("X-Razorpay-Signature"), req.rawBody);
        return res.json({ success: true, message: "Webhook processed", paymentId: payment._id });
    } catch (error) { return sendError(res, error); }
};

module.exports = { createPayment, verifyPayment, getPayment, getUserPayments, refundPayment, handleWebhook };
