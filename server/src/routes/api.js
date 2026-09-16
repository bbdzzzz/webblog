import { Router } from "express";
import pool from "../db.js";

const router = Router();

// 不查库,用于容器/部署探活
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 查库,证明后端能连通 MySQL
router.get("/time", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS now");
    res.json({ now: rows[0].now });
  } catch (err) {
    next(err);
  }
});

export default router;
