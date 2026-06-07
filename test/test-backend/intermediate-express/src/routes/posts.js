const express = require("express");
const commentsRouter = require("./posts.comments");

const router = express.Router();

router.get("/", (req, res) => res.json([]));
router.post("/", (req, res) => res.status(201).json({ created: true }));

router.get("/:id", (req, res) => res.json({ id: req.params.id }));
router.put("/:id", (req, res) =>
  res.json({ id: req.params.id, updated: true }),
);
router.delete("/:id", (req, res) => res.status(204).end());

// Nested mount under a dynamic segment
router.use("/:id/comments", commentsRouter);

module.exports = router;
