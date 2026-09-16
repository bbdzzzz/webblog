import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "web",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "web",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
