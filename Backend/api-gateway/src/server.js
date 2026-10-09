require("dotenv").config();
const app = require("./app");
const { initializeSqlStore, closeSqlStore } = require("./sql-store");

const port = Number(process.env.PORT) || 4000;

initializeSqlStore().then(() => {
    const server = app.listen(port, () => console.log(JSON.stringify({ level: "info", service: "api-gateway", message: "listening", port })));
    const shutdown = async () => {
        server.close(async () => {
            await closeSqlStore();
            process.exit(0);
        });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}).catch((error) => {
    console.error(JSON.stringify({ level: "error", service: "api-gateway", message: "SQL initialization failed", error: error.message }));
    process.exit(1);
});
