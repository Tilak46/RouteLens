const express = require("express");

const app = express();
app.use(express.json());

// Single-segment route (should stay at root)
app.get("/health", (req, res) => res.json({ ok: true }));

// Same segment multiple methods (should become a folder "Posts" with GET / and POST /)
app.get("/posts", (req, res) => res.json([]));
app.post("/posts", (req, res) => res.status(201).json({ created: true }));

// Nested under posts (should appear inside Posts folder)
app.get("/posts/:id", (req, res) => res.json({ id: req.params.id }));

// Multi-segment foldering
app.get("/admin/metrics", (req, res) => res.json({ uptime: process.uptime() }));

module.exports = app;

if (require.main === module) {
  app.listen(4011, () => console.log("noob-express on :4011"));
}
