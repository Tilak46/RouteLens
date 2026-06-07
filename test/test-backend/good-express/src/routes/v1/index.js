const express = require("express");

const authRouter = require("./auth");
const usersRouter = require("./users");

const router = express.Router();

// local-only middleware (should not affect mount path)
router.use((req, res, next) => next());

router.use("/auth", authRouter);

function requireAuth(req, res, next) {
  next();
}

// mount with middleware + router
router.use("/users", requireAuth, usersRouter);

module.exports = router;
