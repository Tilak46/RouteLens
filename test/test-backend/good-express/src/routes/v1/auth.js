const express = require("express");

const router = express.Router();

router.post("/register", (req, res) => res.json({ registered: true }));
router.post("/login", (req, res) => res.json({ token: "token" }));

// extra nesting
router.get("/oauth/callback", (req, res) => res.json({ ok: true }));

module.exports = router;
