import { Router } from "express";
import crypto from "node:crypto";
import { marked } from "marked";
import pool from "../db.js";

const router = Router();
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;

const adminToken = () => process.env.ADMIN_TOKEN || "";

const isAuthorized = (req) => {
  const expected = Buffer.from(adminToken());
  if (expected.length === 0) return "unconfigured";
  const header = req.get("Authorization") || "";
  const provided = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
};

const stripMarkdown = (md) =>
  md
    .replace(/[#>*`\-[\]()!|~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

// 管理提交:存 Markdown 原文
router.post("/", async (req, res, next) => {
  try {
    const auth = isAuthorized(req);
    if (auth === "unconfigured") {
      return res.status(503).json({ error: "admin_not_configured" });
    }
    if (!auth) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const { title, slug, markdown } = req.body || {};
    if (
      typeof title !== "string" || !title.trim() || title.trim().length > 200 ||
      typeof slug !== "string" || !SLUG_RE.test(slug) ||
      typeof markdown !== "string" || !markdown.trim()
    ) {
      return res.status(400).json({ error: "invalid_input" });
    }
    try {
      await pool.query(
        "INSERT INTO posts (slug, title, markdown) VALUES (?, ?, ?)",
        [slug, title.trim(), markdown]
      );
    } catch (err) {
      if (err && err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "slug_exists" });
      }
      throw err;
    }
    res.status(201).json({ slug });
  } catch (err) {
    next(err);
  }
});

// 公开列表:新的在前
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT slug, title, markdown, created_at FROM posts ORDER BY created_at DESC, id DESC"
    );
    res.json(
      rows.map((r) => ({
        slug: r.slug,
        title: r.title,
        created_at: r.created_at,
        excerpt: stripMarkdown(r.markdown),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// 公开详情:服务端渲染 HTML
router.get("/:slug", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT slug, title, markdown, created_at FROM posts WHERE slug = ?",
      [req.params.slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "not_found" });
    }
    const post = rows[0];
    res.json({
      slug: post.slug,
      title: post.title,
      created_at: post.created_at,
      html: marked(post.markdown),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
