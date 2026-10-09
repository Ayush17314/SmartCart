const express = require("express");
const jwt = require("jsonwebtoken");
const {
    createPayment,
    verifyPayment,
    getPayment,
    getUserPayments,
    refundPayment,
    handleWebhook,
} = require("../controllers/payment.controller");

const router = express.Router();

function authenticate(req, res, next) {
    try {
        const token = (req.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token || !process.env.JWT_SECRET) throw new Error("Missing token");
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }
}

router.post("/webhook", handleWebhook);
router.use(authenticate);
router.post("/create", createPayment);
router.post("/verify/:paymentId", verifyPayment);
router.get("/order/:orderId", getPayment);
router.get("/user", getUserPayments);
router.get("/user/:userId", getUserPayments);
router.post("/refund/:paymentId", refundPayment);

module.exports = router;
