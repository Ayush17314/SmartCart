require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const Schema = mongoose.Schema;

app.use(cors({ origin: (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map((value) => value.trim()), credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") res.set("Cache-Control", "public, max-age=30, must-revalidate");
  next();
});

const Model = (name, schema) =>
  mongoose.models[name] || mongoose.model(name, new Schema(schema, { timestamps: true }));

const reply = (res, data, status = 200) => res.status(status).json({ success: true, data });
const error = (res, err) => {
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  return res.status(err.status || 500).json({
    success: false,
    message: err.status ? err.message : "Internal server error",
  });
};

const auth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ") || !process.env.JWT_SECRET) throw new Error("Unauthorized");
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Authentication required" });
  }
};
const admin = (req, res, next) =>
  req.user.role === "admin"
    ? next()
    : res.status(403).json({ success: false, message: "Admin access required" });
const guard = (req, res, next) => auth(req, res, () => admin(req, res, next));

const Product = Model("Product", {
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000 },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  brand: { type: String, trim: true, maxlength: 100 },
  images: { type: [String], default: [] },
  stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  specifications: Schema.Types.Mixed,
});

Product.schema.index({ category: 1, price: 1 });
Product.schema.index({ brand: 1 });
Product.schema.index({ name: "text", description: "text", brand: "text" });

app.get("/health", (req, res) =>
  res.json({ service: "product-service", status: "OK", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeXml = (value) => String(value ?? "").replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]);
const encodeCursor = (product) => Buffer.from(JSON.stringify({ createdAt: product.createdAt.toISOString(), id: String(product._id) })).toString("base64url");
const decodeCursor = (cursor) => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!decoded.createdAt || !mongoose.isValidObjectId(decoded.id) || Number.isNaN(Date.parse(decoded.createdAt))) throw new Error("bad cursor");
    return { createdAt: new Date(decoded.createdAt), id: new mongoose.Types.ObjectId(decoded.id) };
  } catch {
    const err = new Error("Invalid pagination cursor"); err.status = 400; throw err;
  }
};
const xmlTag = (value) => String(value).replace(/[^a-zA-Z0-9_.-]/g, "_") || "item";
const toXml = (value, tag = "item") => {
  const safeTag = xmlTag(tag);
  if (value === null || value === undefined) return `<${safeTag}/>`;
  if (Array.isArray(value)) return value.map((entry) => toXml(entry, "item")).join("");
  if (typeof value === "object") return `<${safeTag}>${Object.entries(value).map(([key, entry]) => toXml(entry, key)).join("")}</${safeTag}>`;
  return `<${safeTag}>${escapeXml(value)}</${safeTag}>`;
};
const asXml = (result) => `<?xml version="1.0" encoding="UTF-8"?>${toXml(result, "response")}`;
const SORT_FIELDS = new Set(["createdAt", "updatedAt", "name", "price", "rating", "stock"]);
const listing = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, message: "Page must be positive and limit must be between 1 and 100" });
    }

    const filter = {};
    const search = String(req.query.q || req.query.search || "").trim();
    if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
    const category = req.params.category || req.query.category;
    if (category) filter.category = String(category).trim();
    if (req.query.brand) filter.brand = String(req.query.brand).trim();

    const price = {};
    for (const [key, operator] of [["minPrice", "$gte"], ["maxPrice", "$lte"]]) {
      if (req.query[key] !== undefined) {
        const value = Number(req.query[key]);
        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({ success: false, message: `${key} must be a non-negative number` });
        }
        price[operator] = value;
      }
    }
    if (price.$gte !== undefined && price.$lte !== undefined && price.$gte > price.$lte) {
      return res.status(400).json({ success: false, message: "minPrice cannot exceed maxPrice" });
    }
    if (Object.keys(price).length) filter.price = price;
    if (req.query.inStock === "true") filter.stock = { $gt: 0 };
    if (req.query.inStock === "false") filter.stock = 0;

    const sortField = SORT_FIELDS.has(req.query.sort) ? req.query.sort : "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    if (req.query.after && (sortField !== "createdAt" || sortOrder !== -1)) {
      return res.status(400).json({ success: false, message: "Cursor pagination currently uses the default createdAt descending sort" });
    }
    let cursor;
    if (req.query.after) {
      cursor = decodeCursor(String(req.query.after));
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ];
    }
    const rows = await Product.find(filter)
      .sort({ [sortField]: sortOrder, _id: sortField === "createdAt" ? sortOrder : 1 })
      .skip(req.query.after ? 0 : (page - 1) * limit)
      .limit(limit + 1);
    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor = sortField === "createdAt" && sortOrder === -1 && hasNext && items.length ? encodeCursor(items[items.length - 1]) : null;
    const total = req.query.after ? undefined : await Product.countDocuments(filter);
    const url = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
    if (nextCursor) url.searchParams.set("after", nextCursor);
    else url.searchParams.delete("after");
    const next = nextCursor ? `${url.pathname}${url.search}` : null;
    const body = {
      success: true,
      data: { items, pagination: { limit, ...(total === undefined ? {} : { total }), ...(total === undefined ? {} : { pages: Math.ceil(total / limit) }), hasNext, nextCursor }, links: { next } },
    };
    res.vary("Accept");
    if (next) res.set("Link", `<${next}>; rel="next"`);
    if (req.accepts(["json", "xml"]) === "xml") return res.type("application/xml").send(asXml(body));
    return res.json(body);
  } catch (err) {
    return error(res, err);
  }
};

app.get("/api/products", listing);
app.get("/api/products/search", listing);
app.get("/api/products/category/:category", listing);

app.get("/api/products/categories", async (req, res) => {
  try {
    res.vary("Accept");
    const categories = await Product.aggregate([
      { $group: { _id: "$category", productCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, name: "$_id", productCount: 1 } },
    ]);
    if (req.accepts(["json", "xml"]) === "xml") return res.type("application/xml").send(asXml({ success: true, data: categories }));
    return reply(res, categories);
  } catch (err) {
    return error(res, err);
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    res.vary("Accept");
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    if (req.accepts(["json", "xml"]) === "xml") return res.type("application/xml").send(asXml({ success: true, data: product }));
    return reply(res, product);
  } catch (err) {
    return error(res, err);
  }
});

const writableFields = ["name", "description", "price", "category", "brand", "images", "stock", "rating", "specifications"];
const pickProductFields = (body) => Object.fromEntries(writableFields
  .filter((field) => Object.hasOwn(body, field))
  .map((field) => [field, body[field]]));

app.post("/api/products", guard, async (req, res) => {
  try {
    return reply(res, await Product.create(pickProductFields(req.body)), 201);
  } catch (err) {
    return error(res, err);
  }
});

app.put("/api/products/:id", guard, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, pickProductFields(req.body), { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return reply(res, product);
  } catch (err) {
    return error(res, err);
  }
});

app.delete("/api/products/:id", guard, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return reply(res, null);
  } catch (err) {
    return error(res, err);
  }
});

app.patch("/api/products/:id/stock", guard, async (req, res) => {
  const stock = Number(req.body.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ success: false, message: "Stock must be a non-negative integer" });
  }
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: "Product not found" });
    return reply(res, product);
  } catch (err) {
    return error(res, err);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && Object.hasOwn(err, "body")) {
    return res.status(400).json({ success: false, message: "Invalid JSON" });
  }
  return error(res, err);
});

const port = Number(process.env.PORT) || 4002;
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017", {
  dbName: process.env.MONGODB_DB || "smartcart_product",
}).then(() => {
  app.listen(port, () => console.log(`product-service listening on ${port}`));
}).catch((err) => {
  console.error("MongoDB connection failed", err.message);
  process.exit(1);
});
