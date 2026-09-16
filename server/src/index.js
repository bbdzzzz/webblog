import express from "express";
import apiRouter from "./routes/api.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use("/api", apiRouter);

// 统一错误处理(含 MySQL 连接失败)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`server listening on :${port}`);
});
