process.env.NODE_ENV = "test";
process.env.IDEMPOTENCY_STORE = "memory";
process.env.RATE_LIMIT_MAX = "120";
process.env.JWT_SECRET = "test-secret";

const http = require("http");
const request = require("supertest");
const app = require("../src/app");

describe("SmartCart API gateway", () => {
    let upstream;
    let upstreamUrl;
    let products = [];

    beforeAll(async () => {
        upstream = http.createServer((req, res) => {
            if (req.method === "POST") {
                let body = "";
                req.on("data", (chunk) => { body += chunk; });
                req.on("end", () => {
                    products.push(JSON.parse(body));
                    res.statusCode = 201;
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ success: true, data: { id: products.length } }));
                });
                return;
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, data: { items: [{ _id: "p1", name: "Desk lamp", price: 20, category: "home", stock: 4 }], pagination: { nextCursor: null }, links: { next: null } } }));
        });
        await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
        upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;
        process.env.PRODUCT_SERVICE_URL = upstreamUrl;
    });

    afterAll(async () => new Promise((resolve) => upstream.close(resolve)));

    beforeEach(() => { products = []; });

    test("serves health and documents", async () => {
        await request(app).get("/health").expect(200).expect("Cache-Control", "no-store");
        await request(app).get("/openapi.json").expect(200).expect((response) => {
            if (!response.body.paths["/api/products"]) throw new Error("OpenAPI paths are missing");
        });
        await request(app).get("/docs/").expect(200);
    });

    test("validates product bodies with AJV before proxying", async () => {
        await request(app).post("/api/products").set("Idempotency-Key", "bad-product").send({ name: "", price: -1 }).expect(400);
        expect(products).toHaveLength(0);
    });

    test("routes versioned GET requests and emits ETags", async () => {
        const response = await request(app).get("/v1/api/products?limit=1").expect(200);
        expect(response.headers.etag).toBeTruthy();
        expect(response.headers["x-request-id"]).toBeTruthy();
        expect(response.body.data.items[0].name).toBe("Desk lamp");
        await request(app).get("/v1/api/products?limit=1").set("If-None-Match", response.headers.etag).expect(304);
    });

    test("replays idempotent POST responses and rejects a changed payload", async () => {
        const body = { name: "Desk lamp", price: 20, category: "home" };
        const first = await request(app).post("/v1/api/products").set("Idempotency-Key", "product-key-1").send(body).expect(201);
        await request(app).post("/v1/api/products").set("Idempotency-Key", "product-key-1").send(body).expect(201).expect("Idempotency-Replayed", "true");
        await request(app).post("/v1/api/products").set("Idempotency-Key", "product-key-1").send({ ...body, price: 22 }).expect(409);
        expect(first.body.data.id).toBe(1);
        expect(products).toHaveLength(1);
    });

    test("normalizes missing routes and applies rate limit headers", async () => {
        const response = await request(app).get("/api/unknown").expect(404);
        expect(response.body).toMatchObject({ success: false, message: "Route not found" });
        expect(response.headers["ratelimit-limit"]).toBe("120");
    });

    test("opens a circuit after repeated upstream failures", async () => {
        const { CircuitBreaker, CircuitOpenError } = require("../src/resilience");
        const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 10_000 });
        const fail = () => breaker.execute("broken", async () => { throw new Error("offline"); });
        await expect(fail()).rejects.toThrow("offline");
        await expect(fail()).rejects.toThrow("offline");
        await expect(fail()).rejects.toBeInstanceOf(CircuitOpenError);
    });
});
