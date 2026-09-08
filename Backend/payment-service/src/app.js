const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const paymentRoutes = require("./routes/payment.routes");

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));
app.use((req, res, next) => {
    req.requestId = req.get("X-Request-Id") || crypto.randomUUID();
    res.set("X-Request-Id", req.requestId);
    next();
});
app.use(express.json({
    limit: "100kb",
    verify: (req, res, buffer) => {
        req.rawBody = buffer;
    }
}));

app.get("/health", (req, res) => {
    res.status(200).json({ success: true, service: "payment-service" });
});

app.use("/api/payments", paymentRoutes);

app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && "body" in error) {
        return res.status(400).json({ success: false, message: "Invalid JSON body" });
    }

    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
});

module.exports = app;
