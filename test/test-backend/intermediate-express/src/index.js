const express = require("express");

const authRouter = require("./routes/auth");
const postsRouter = require("./routes/posts");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

// Mounted routers (scanner must compose mount prefix)
app.use("/api/auth", authRouter);
app.use("/api/posts", postsRouter);

module.exports = app;

if (require.main === module) {
  app.listen(4012, () => console.log("intermediate-express on :4012"));
}
