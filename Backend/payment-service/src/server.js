require("dotenv").config();
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const app = require("./app");

const port = Number(process.env.PORT) || 4006;
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

mongoose.connect(mongoUri, { dbName: process.env.MONGODB_DB || "smartcart_payments" })
    .then(() => app.listen(port, () => console.log(JSON.stringify({ level: "info", service: "payment-service", message: "listening", port }))))
    .catch((error) => {
        console.error(JSON.stringify({ level: "error", service: "payment-service", message: "MongoDB connection failed", error: error.message }));
        process.exit(1);
    });
