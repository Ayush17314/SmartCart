const paymentService = require("../services/payment.service");

const sendError = (res, error) => {
    const statusCode = error.code === 11000 ? 409 : error.statusCode || 500;
    res.status(statusCode).json({ success: false, message: statusCode === 500 ? "Internal server error" : error.message });
};

const createPayment = async (req, res) => {
    try {
        const result = await paymentService.createPayment(req.body, req.get("Idempotency-Key"));
        res.status(result.created ? 201 : 200).json({ success: true, message: result.created ? "Payment created" : "Existing payment returned", payment: result.payment });
    } catch (error) { sendError(res, error); }
};

const verifyPayment = async (req, res) => {
    try {
        const payment = await paymentService.verifyPayment(req.params.paymentId, req.body.success);
        res.json({ success: true, message: "Payment verified", payment });
    } catch (error) { sendError(res, error); }
};

const getPayment = async (req, res) => {
    try {
        const payment = await paymentService.getPaymentByOrderId(req.params.orderId);
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
        res.json({ success: true, payment });
    } catch (error) { sendError(res, error); }
};

const getUserPayments = async (req, res) => {
    try {
        const result = await paymentService.getPaymentsByUserId(req.params.userId, req.query.page, req.query.limit, req.query.status);
        res.json({ success: true, ...result });
    } catch (error) { sendError(res, error); }
};

const refundPayment = async (req, res) => {
    try {
        const payment = await paymentService.refundPayment(req.params.paymentId);
        res.json({ success: true, message: "Payment refunded", payment });
    } catch (error) { sendError(res, error); }
};

const handleWebhook = async (req, res) => {
    try {
        const payment = await paymentService.processWebhook(req.body, req.get("X-Payment-Signature"), req.rawBody);
        res.json({ success: true, message: "Webhook processed", payment });
    } catch (error) { sendError(res, error); }
};

module.exports = { createPayment, verifyPayment, getPayment, getUserPayments, refundPayment, handleWebhook };
