const express = require("express");

const router = express.Router();

router
  .route("/")
  .get((req, res) => res.json([]))
  .post((req, res) => res.status(201).json({ created: true }));

router
  .route("/:id")
  .get((req, res) => res.json({ id: req.params.id }))
  .put((req, res) => res.json({ id: req.params.id, updated: true }))
  .delete((req, res) => res.status(204).end());

module.exports = router;
