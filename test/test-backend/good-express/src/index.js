const express = require("express");

const v1Router = require("./routes/v1");
const statusRouter = require("./routes/status");

const app = express();
app.use(express.json());

// Non-api root route
app.get("/", (req, res) => res.send("ok"));

// version prefix (DevDash tree builder drops v1)
app.use("/api/v1", v1Router);

// middleware-in-mount: app.use('/api/status', mw, router)
function trace(req, res, next) {
  next();
}
app.use("/api/status", trace, statusRouter);

module.exports = app;

if (require.main === module) {
  app.listen(4013, () => console.log("good-express on :4013"));
}
