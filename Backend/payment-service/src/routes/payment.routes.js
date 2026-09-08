const express = require("express");
const {
    createPayment,
    verifyPayment,
    getPayment,
    getUserPayments,
    refundPayment,
    handleWebhook
} = require("../controllers/payment.controller");

const router = express.Router();

router.post("/create", createPayment);
router.post("/verify/:paymentId", verifyPayment); // Development-only gateway simulation.
router.post("/webhook", handleWebhook);
router.get("/order/:orderId", getPayment);
router.get("/user/:userId", getUserPayments);
router.post("/refund/:paymentId", refundPayment);

module.exports = router;
