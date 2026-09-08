const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    orderId: { type: String, required: true, trim: true, unique: true },
    userId: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, enum: ["UPI", "CARD", "COD"], required: true, uppercase: true },
    transactionId: { type: String, default: null },
    idempotencyKey: { type: String, default: null, select: false },
    gateway: {
        provider: { type: String, default: "MOCK" },
        paymentIntentId: { type: String, default: null },
        reference: { type: String, default: null }
    },
    status: { type: String, enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"], default: "PENDING" },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refundId: { type: String, default: null },
    failureReason: { type: String, default: null },
    events: [{
        type: { type: String, required: true },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index(
    { userId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

module.exports = mongoose.model("Payment", paymentSchema);
