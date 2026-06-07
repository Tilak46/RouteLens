const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => res.json({ ok: true }));
router.get("/ready", (req, res) => res.json({ ready: true }));

module.exports = router;
