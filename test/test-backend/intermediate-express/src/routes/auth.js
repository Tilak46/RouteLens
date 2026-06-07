const express = require("express");

const router = express.Router();

router.post("/register", (req, res) => res.json({ registered: true }));
router.post("/login", (req, res) => res.json({ token: "token" }));
router.post("/logout", (req, res) => res.json({ loggedOut: true }));

// route() chaining
router
  .route("/session")
  .get((req, res) => res.json({ session: true }))
  .delete((req, res) => res.status(204).end());

module.exports = router;
