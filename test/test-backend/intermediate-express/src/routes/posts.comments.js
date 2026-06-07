const express = require("express");

const router = express.Router({ mergeParams: true });

router.get("/", (req, res) =>
  res.json({ postId: req.params.id, comments: [] }),
);
router.post("/", (req, res) =>
  res.status(201).json({ postId: req.params.id, created: true }),
);

module.exports = router;
