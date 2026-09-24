import express from "express";
import apiRouter from "./routes/api.js";
import postsRouter from "./routes/posts.js";
import pool from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);
app.use("/api/posts", postsRouter);

// 本地开发同源静态伺服(生产由 nginx 托管,不设此变量则完全不影响)
if (process.env.SERVE_STATIC) {
  app.use(express.static(process.env.SERVE_STATIC));
}

// 统一错误处理(含 MySQL 连接失败)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || err.statusCode || 500).json({ error: "internal_error" });
});

// 幂等建表,就绪后才监听
const ensurePostsTable = `
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  markdown MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

pool
  .query(ensurePostsTable)
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`server listening on :${port}`);
    });
  })
  .catch((err) => {
    console.error("failed to ensure posts table:", err);
    process.exit(1);
  });
