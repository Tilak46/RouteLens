const express = require("express");

// Factory returns a router, not exported router directly
module.exports = function createFactoryRouter() {
  const router = express.Router();

  router.get("/ping", (req, res) => res.json({ pong: true }));

  router
    .route("/items")
    .get((req, res) => res.json([]))
    .post((req, res) => res.status(201).json({ created: true }));

  return router;
};
