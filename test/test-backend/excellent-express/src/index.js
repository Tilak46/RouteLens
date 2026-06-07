const express = require("express");

// 1) Named export import pattern (many scanners miss this)
const { router: productsRouter } = require("./routes/products.named-export");

// 2) Router factory pattern (scanner must understand call returning a router)
const createFactoryRouter = require("./routes/factory.router");

// 3) Non-literal mount path (scanner must evaluate const string)
const API_PREFIX = "/api";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use(API_PREFIX + "/products", productsRouter);
app.use("/api/factory", createFactoryRouter());

module.exports = app;

if (require.main === module) {
  app.listen(4014, () => console.log("excellent-express on :4014"));
}
