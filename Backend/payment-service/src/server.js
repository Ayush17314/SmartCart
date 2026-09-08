require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const port = Number(process.env.PORT) || 5004;

const startServer = async () => {
    await connectDB();
    app.listen(port, () => {
        console.log(`Payment service is running on port ${port}`);
    });
};

startServer();
