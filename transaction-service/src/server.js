// import express from 'express';
// import dotenv from 'dotenv';
// import { pool } from './db.js';  // ✅ Make sure this import exists

// dotenv.config();

// const app = express();
// app.use(express.json());

// // ✅ Health check
// app.get('/health', (req, res) => {
//   res.json({ status: 'Transaction Service running' });
// });

// // ✅ Database connectivity check
// app.get('/db-check', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT NOW() AS current_time');
//     res.json({
//       success: true,
//       db_time: result.rows[0].current_time,
//     });
//   } catch (err) {
//     console.error('DB error:', err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// });

// const port = process.env.PORT || 8082;
// app.listen(port, () => console.log(`Server running on port ${port}`));

// // ✅ Deposit API with idempotency
// app.post("/transactions/deposit", async (req, res) => {
//   const { account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!account_id || !amount) {
//     return res.status(400).json({ success: false, message: "account_id and amount are required" });
//   }

//   if (!idempotencyKey) {
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });
//   }

//   try {
//     // Check if this idempotency key was used before
//     const existingKey = await pool.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await pool.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     // Insert new transaction
//     const ref = `REF-${Date.now()}`;
//     const counterparty = "SYSTEM:Deposit";

//     const insertTxn = await pool.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'DEPOSIT', $3, $4)
//        RETURNING txn_id, account_id, amount, txn_type, counterparty, reference, status, created_at;`,
//       [account_id, amount, counterparty, ref]
//     );

//     const txn = insertTxn.rows[0];

//     // Store idempotency key linked to this transaction
//     await pool.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, txn.txn_id]
//     );

//     res.status(201).json({ success: true, transaction: txn });
//   } catch (err) {
//     console.error("Deposit error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ✅ Transfer API with idempotency
// app.post("/transactions/transfer", async (req, res) => {
//   const { from_account_id, to_account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!from_account_id || !to_account_id || !amount) {
//     return res.status(400).json({
//       success: false,
//       message: "from_account_id, to_account_id, and amount are required",
//     });
//   }

//   if (!idempotencyKey) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Missing Idempotency-Key header" });
//   }

//   const client = await pool.connect();
//   try {
//     // 🔁 Check for duplicate requests
//     const existingKey = await client.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await client.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     // Begin DB transaction
//     await client.query("BEGIN");

//     // 🔹 Record sender transaction
//     const outRef = `REF-OUT-${Date.now()}`;
//     const senderTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_OUT', $3, $4)
//        RETURNING *;`,
//       [from_account_id, amount, `TO:${to_account_id}`, outRef]
//     );

//     // 🔹 Record receiver transaction
//     const inRef = `REF-IN-${Date.now()}`;
//     const receiverTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_IN', $3, $4)
//        RETURNING *;`,
//       [to_account_id, amount, `FROM:${from_account_id}`, inRef]
//     );

//     // 🔹 Save idempotency key
//     await client.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id)
//        VALUES ($1, $2);`,
//       [idempotencyKey, senderTxn.rows[0].txn_id]
//     );

//     await client.query("COMMIT");

//     res.status(201).json({
//       success: true,
//       sender_transaction: senderTxn.rows[0],
//       receiver_transaction: receiverTxn.rows[0],
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("Transfer error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   } finally {
//     client.release();
//   }
// });
// import express from "express";
// import dotenv from "dotenv";
// import { pool } from "./db.js";
// import transactionRoutes from "./routes/transactionRoutes.js";
// import { connectQueue, getChannel, publishToQueue } from "./messageQueue.js";
// import client from "prom-client";

// dotenv.config();

// const app = express();
// app.use(express.json());

// /* --------------------- Connect to RabbitMQ --------------------- */
// connectQueue()
//   .then(() => console.log("✅ RabbitMQ connected"))
//   .catch((err) => console.error("❌ RabbitMQ connection error:", err));


// /*--------metric endpoints-----*/
// import client from 'prom-client';

// // Create a new registry
// const register = new client.Registry();

// // Collect default metrics (CPU, memory, event loop)
// client.collectDefaultMetrics({ register });

// // Custom metrics
// const httpRequestCounter = new client.Counter({
//   name: 'http_requests_total',
//   help: 'Total number of HTTP requests',
//   labelNames: ['method', 'route', 'status_code'],
// });

// register.registerMetric(httpRequestCounter);

// // Middleware to count each request
// app.use((req, res, next) => {
//   res.on('finish', () => {
//     httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
//   });
//   next();
// });

// // 🐇 Connect to RabbitMQ
// connectQueue()
//   .then(() => console.log("RabbitMQ connected"))
//   .catch(err => console.error("RabbitMQ connection error:", err));


// // Metrics endpoint
// app.get('/metrics', async (req, res) => {
//   try {
//     res.set('Content-Type', register.contentType);
//     res.end(await register.metrics());
//   } catch (err) {
//     res.status(500).end(err.message);
//   }
// });


// /* --------------------- Health Check --------------------- */
// app.get('/health', (req, res) => {
//   res.json({ status: 'Transaction Service running' });
// });

// /*--------list all transaction routes--------*/
// app.use("/transactions", transactionRoutes);

// /* --------------------- DB Connectivity Check --------------------- */
// app.get('/db-check', async (req, res) => {
//   try {
//     const result = await pool.query('SELECT NOW() AS current_time');
//     res.json({
//       success: true,
//       db_time: result.rows[0].current_time,
//     });
//   } catch (err) {
//     console.error('DB error:', err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// });

// /* --------------------- Deposit API (Idempotent) --------------------- */
// app.post("/transactions/deposit", async (req, res) => {
//   const { account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!account_id || !amount) {
//     return res.status(400).json({ success: false, message: "account_id and amount are required" });
//   }

//   if (!idempotencyKey) {
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });
//   }

//   try {
//     const existingKey = await pool.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await pool.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     const ref = `REF-${Date.now()}`;
//     const counterparty = "SYSTEM:Deposit";

//     const insertTxn = await pool.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'DEPOSIT', $3, $4)
//        RETURNING txn_id, account_id, amount, txn_type, counterparty, reference, status, created_at;`,
//       [account_id, amount, counterparty, ref]
//     );

//     const txn = insertTxn.rows[0];

//     await pool.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, txn.txn_id]
//     );

//     // 🐇 NEW: Publish message to RabbitMQ
//     try {
//       const channel = getChannel(); // from messageQueue.js
//       await channel.assertQueue("transaction_events");
//       channel.sendToQueue(
//         "transaction_events",
//         Buffer.from(
//           JSON.stringify({
//             type: "DEPOSIT_CREATED",
//             transaction: txn,
//           })
//         )
//       );
//       console.log("📤 Sent DEPOSIT_CREATED event to RabbitMQ");
//     } catch (mqErr) {
//       console.error("RabbitMQ publish error:", mqErr.message);
//     }

//     res.status(201).json({ success: true, transaction: txn });
//   } catch (err) {
//     console.error("Deposit error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Transfer API (Idempotent) --------------------- */
// app.post("/transactions/transfer", async (req, res) => {
//   const { from_account_id, to_account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!from_account_id || !to_account_id || !amount) {
//     return res.status(400).json({
//       success: false,
//       message: "from_account_id, to_account_id, and amount are required",
//     });
//   }

//   if (!idempotencyKey) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Missing Idempotency-Key header" });
//   }

//   const client = await pool.connect();
//   try {
//     const existingKey = await client.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await client.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     await client.query("BEGIN");

//     const outRef = `REF-OUT-${Date.now()}`;
//     const senderTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_OUT', $3, $4)
//        RETURNING *;`,
//       [from_account_id, amount, `TO:${to_account_id}`, outRef]
//     );

//     const inRef = `REF-IN-${Date.now()}`;
//     const receiverTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_IN', $3, $4)
//        RETURNING *;`,
//       [to_account_id, amount, `FROM:${from_account_id}`, inRef]
//     );

//     await client.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id)
//        VALUES ($1, $2);`,
//       [idempotencyKey, senderTxn.rows[0].txn_id]
//     );

//     await client.query("COMMIT");


//     // 🐇 NEW: Publish RabbitMQ event
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       channel.sendToQueue(
//         "transaction_events",
//         Buffer.from(
//           JSON.stringify({
//             type: "TRANSFER_COMPLETED",
//             sender: senderTxn.rows[0],
//             receiver: receiverTxn.rows[0],
//           })
//         )
//       );
//       console.log("📤 Sent TRANSFER_COMPLETED event to RabbitMQ");
//     } catch (mqErr) {
//       console.error("RabbitMQ publish error:", mqErr.message);
//     }

//     res.status(201).json({
//       success: true,
//       sender_transaction: senderTxn.rows[0],
//       receiver_transaction: receiverTxn.rows[0],
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("Transfer error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   } finally {
//     client.release();
//   }
// });

// /* --------------------- Fetch Transactions by Account ID --------------------- */
// app.get("/transactions/:accountId", async (req, res) => {
//   const { accountId } = req.params;

//   try {
//     const result = await pool.query(
//       "SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC",
//       [accountId]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `No transactions found for account ID ${accountId}`,
//       });
//     }

//     res.json({
//       success: true,
//       count: result.rows.length,
//       data: result.rows,
//     });
//   } catch (err) {
//     console.error("Fetch error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Start Server --------------------- */
// const port = process.env.PORT || 8082;
// app.listen(port, () => console.log(`Server running on port ${port}`));

// import { fetchAccountBalanceCB, debitAccount, creditAccount } from "./accountClient.js";
// import axios from "axios";
// import express from "express";
// import dotenv from "dotenv";
// import promClient from "prom-client";  // ✅ fixed duplicate name
// import { pool } from "./db.js";
// import transactionRoutes from "./routes/transactionRoutes.js";
// import { connectQueue, getChannel } from "./messageQueue.js"; // ✅ single import

// dotenv.config();

// const app = express();
// app.use(express.json());

// /* --------------------- Connect to RabbitMQ --------------------- */
// connectQueue()
//   .then(() => console.log("✅ RabbitMQ connected"))
//   .catch((err) => console.error("❌ RabbitMQ connection error:", err));

// /* --------------------- Prometheus Metrics --------------------- */
// const register = new promClient.Registry();

// // Collect default metrics (CPU, memory, etc.)
// promClient.collectDefaultMetrics({ register });

// // Custom counter for HTTP requests
// const httpRequestCounter = new promClient.Counter({
//   name: "http_requests_total",
//   help: "Total number of HTTP requests",
//   labelNames: ["method", "route", "status_code"],
// });

// register.registerMetric(httpRequestCounter);

// // Middleware to count every request
// app.use((req, res, next) => {
//   res.on("finish", () => {
//     httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
//   });
//   next();
// });

// // Expose metrics
// app.get("/metrics", async (req, res) => {
//   try {
//     res.set("Content-Type", register.contentType);
//     res.end(await register.metrics());
//   } catch (err) {
//     res.status(500).end(err.message);
//   }
// });

// /* --------------------- Health Check --------------------- */
// app.get("/health", (req, res) => {
//   res.json({ status: "Transaction Service running" });
// });

// /* --------------------- DB Connectivity Check --------------------- */
// app.get("/db-check", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT NOW() AS current_time");
//     res.json({
//       success: true,
//       db_time: result.rows[0].current_time,
//     });
//   } catch (err) {
//     console.error("DB error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// });

// /* --------------------- Deposit API (Idempotent) --------------------- */
// app.post("/transactions/deposit", async (req, res) => {
//   const { account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!account_id || !amount)
//     return res.status(400).json({ success: false, message: "account_id and amount are required" });

//   if (!idempotencyKey)
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

//   try {
//     const existingKey = await pool.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await pool.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     const ref = `REF-${Date.now()}`;
//     const counterparty = "SYSTEM:Deposit";

//     const insertTxn = await pool.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'DEPOSIT', $3, $4)
//        RETURNING *;`,
//       [account_id, amount, counterparty, ref]
//     );

//     const txn = insertTxn.rows[0];
//     await pool.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, txn.txn_id]
//     );

//     // 🐇 Publish to RabbitMQ
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       channel.sendToQueue(
//         "transaction_events",
//         Buffer.from(JSON.stringify({ type: "DEPOSIT_CREATED", transaction: txn }))
//       );
//       console.log("📤 Sent DEPOSIT_CREATED event to RabbitMQ");
//     } catch (mqErr) {
//       console.error("RabbitMQ publish error:", mqErr.message);
//     }

//     res.status(201).json({ success: true, transaction: txn });
//   } catch (err) {
//     console.error("Deposit error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Transfer API (Idempotent + Business Rules) --------------------- */
// app.post("/transactions/transfer", async (req, res) => {
//   const { from_account_id, to_account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!from_account_id || !to_account_id || !amount) {
//     return res.status(400).json({
//       success: false,
//       message: "from_account_id, to_account_id, and amount are required",
//     });
//   }

//   if (!idempotencyKey) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Missing Idempotency-Key header" });
//   }

//   const client = await pool.connect();
//   try {
//     /* -------------------- Idempotency Check -------------------- */
//     const existingKey = await client.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await client.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     /* -------------------- Business Rule #1: Frozen Account -------------------- */
//     const frozenAccounts = new Set([999, 1001]); // mock example IDs
//     if (frozenAccounts.has(from_account_id) || frozenAccounts.has(to_account_id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Transfer failed: one of the accounts is frozen.",
//       });
//     }

//     /* -------------------- Business Rule #2: Daily Limit -------------------- */
//     const DAILY_LIMIT = 200000; // ₹2,00,000
//     const { rows: dailyRows } = await client.query(
//       `SELECT COALESCE(SUM(amount), 0) AS total_today
//        FROM transactions
//        WHERE account_id = $1
//          AND txn_type = 'TRANSFER_OUT'
//          AND DATE(created_at) = CURRENT_DATE`,
//       [from_account_id]
//     );
//     const totalToday = parseFloat(dailyRows[0].total_today || 0);
//     if (totalToday + Number(amount) > DAILY_LIMIT) {
//       return res.status(400).json({
//         success: false,
//         message: `Daily transfer limit exceeded. Limit ₹${DAILY_LIMIT}, used ₹${totalToday}`,
//       });
//     }

//     /* -------------------- Business Rule #3: No Overdraft for BASIC -------------------- */
//     // Mock rule: assume "basic" accounts have < ₹10,000 balance
//     const simulatedAccountType = "BASIC";
//     const simulatedBalance = 8000; // mock data for test
//     if (simulatedAccountType === "BASIC" && simulatedBalance < Number(amount)) {
//       return res.status(400).json({
//         success: false,
//         message: "Insufficient balance. Basic accounts cannot overdraft.",
//       });
//     }


// /* -------------------- Validate & Update Accounts via Account Service -------------------- */
// try {
//   const accountServiceUrl = process.env.ACCOUNT_SERVICE_URL || "http://localhost:8083";
//   console.log("🔍 Checking account with:", `${accountServiceUrl}/accounts/${from_account_id}/balance`);

//   const check = await axios.get(`${accountServiceUrl}/accounts/${from_account_id}/balance`);

//   console.log("✅ Account service response:", check.data);

//   if (check.data.status !== "ACTIVE") {
//     return res.status(400).json({ success: false, message: "Account not active" });
//   }
// } catch (err) {
//   console.error("❌ Account service error:", err.message);

//   if (err.response) {
//     console.error("❌ Response status:", err.response.status);
//     console.error("❌ Response data:", err.response.data);
//   } else if (err.request) {
//     console.error("❌ No response received from Account Service");
//   } else {
//     console.error("❌ Unexpected error:", err);
//   }

//   return res.status(400).json({
//     success: false,
//     message: "Account Service validation failed",
//     details: err.message,
//   });
// }




//     /* -------------------- Begin Transaction -------------------- */
//     await client.query("BEGIN");

//     const outRef = `REF-OUT-${Date.now()}`;
//     const senderTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_OUT', $3, $4)
//        RETURNING *;`,
//       [from_account_id, amount, `TO:${to_account_id}`, outRef]
//     );

//     const inRef = `REF-IN-${Date.now()}`;
//     const receiverTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_IN', $3, $4)
//        RETURNING *;`,
//       [to_account_id, amount, `FROM:${from_account_id}`, inRef]
//     );

//     await client.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id)
//        VALUES ($1, $2);`,
//       [idempotencyKey, senderTxn.rows[0].txn_id]
//     );

//     await client.query("COMMIT");

//     /* -------------------- Publish RabbitMQ Event -------------------- */
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       channel.sendToQueue(
//         "transaction_events",
//         Buffer.from(
//           JSON.stringify({
//             type: "TRANSFER_COMPLETED",
//             sender: senderTxn.rows[0],
//             receiver: receiverTxn.rows[0],
//           })
//         )
//       );
//       console.log("📤 Sent TRANSFER_COMPLETED event to RabbitMQ");
//     } catch (mqErr) {
//       console.error("RabbitMQ publish error:", mqErr.message);
//     }

//     /* -------------------- Respond -------------------- */
//     res.status(201).json({
//       success: true,
//       sender_transaction: senderTxn.rows[0],
//       receiver_transaction: receiverTxn.rows[0],
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("Transfer error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   } finally {
//     client.release();
//   }
// });


// // /* --------------------- Transfer API (Idempotent) --------------------- */
// // app.post("/transactions/transfer", async (req, res) => {
// //   const { from_account_id, to_account_id, amount } = req.body;
// //   const idempotencyKey = req.headers["idempotency-key"];

// //   if (!from_account_id || !to_account_id || !amount)
// //     return res.status(400).json({
// //       success: false,
// //       message: "from_account_id, to_account_id, and amount are required",
// //     });

// //   if (!idempotencyKey)
// //     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

// //   const client = await pool.connect();
// //   try {
// //     const existingKey = await client.query(
// //       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
// //       [idempotencyKey]
// //     );

// //     if (existingKey.rows.length > 0) {
// //       const existingTxn = await client.query(
// //         "SELECT * FROM transactions WHERE txn_id = $1",
// //         [existingKey.rows[0].txn_id]
// //       );
// //       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
// //     }

// //     await client.query("BEGIN");

// //     const outRef = `REF-OUT-${Date.now()}`;
// //     const senderTxn = await client.query(
// //       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
// //        VALUES ($1, $2, 'TRANSFER_OUT', $3, $4)
// //        RETURNING *;`,
// //       [from_account_id, amount, `TO:${to_account_id}`, outRef]
// //     );

// //     const inRef = `REF-IN-${Date.now()}`;
// //     const receiverTxn = await client.query(
// //       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
// //        VALUES ($1, $2, 'TRANSFER_IN', $3, $4)
// //        RETURNING *;`,
// //       [to_account_id, amount, `FROM:${from_account_id}`, inRef]
// //     );

// //     await client.query(
// //       `INSERT INTO idempotency_keys (idempotency_key, txn_id)
// //        VALUES ($1, $2);`,
// //       [idempotencyKey, senderTxn.rows[0].txn_id]
// //     );

// //     await client.query("COMMIT");

// //     // 🐇 Publish to RabbitMQ
// //     try {
// //       const channel = getChannel();
// //       await channel.assertQueue("transaction_events");
// //       channel.sendToQueue(
// //         "transaction_events",
// //         Buffer.from(
// //           JSON.stringify({
// //             type: "TRANSFER_COMPLETED",
// //             sender: senderTxn.rows[0],
// //             receiver: receiverTxn.rows[0],
// //           })
// //         )
// //       );
// //       console.log("📤 Sent TRANSFER_COMPLETED event to RabbitMQ");
// //     } catch (mqErr) {
// //       console.error("RabbitMQ publish error:", mqErr.message);
// //     }

// //     res.status(201).json({
// //       success: true,
// //       sender_transaction: senderTxn.rows[0],
// //       receiver_transaction: receiverTxn.rows[0],
// //     });
// //   } catch (err) {
// //     await client.query("ROLLBACK");
// //     console.error("Transfer error:", err);
// //     res.status(500).json({ success: false, message: err.message });
// //   } finally {
// //     client.release();
// //   }
// // });

// /* --------------------- Transactions Route --------------------- */
// app.use("/transactions", transactionRoutes);

// /* --------------------- Start Server --------------------- */
// const port = process.env.PORT || 8082;
// app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
// import logger from "./logger.js";
// import { correlationIdMiddleware } from "./middleware/correlationId.js";

// app.use(correlationIdMiddleware);

// import express from "express";
// import dotenv from "dotenv";
// import promClient from "prom-client";
// import { pool } from "./db.js";
// import transactionRoutes from "./routes/transactionRoutes.js";
// import { connectQueue, getChannel } from "./messageQueue.js";
// import { fetchAccountBalanceCB, debitAccount, creditAccount } from "./accountClient.js";

// dotenv.config();

// const app = express();
// app.use(express.json());

// /* --------------------- Connect to RabbitMQ --------------------- */
// connectQueue()
//   .then(() => console.log("✅ RabbitMQ connected"))
//   .catch((err) => console.error("❌ RabbitMQ connection error:", err));

// /* --------------------- Prometheus Metrics --------------------- */
// const register = new promClient.Registry();
// promClient.collectDefaultMetrics({ register });

// const httpRequestCounter = new promClient.Counter({
//   name: "http_requests_total",
//   help: "Total number of HTTP requests",
//   labelNames: ["method", "route", "status_code"],
// });
// register.registerMetric(httpRequestCounter);

// app.use((req, res, next) => {
//   res.on("finish", () => {
//     httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
//   });
//   next();
// });

// app.get("/metrics", async (req, res) => {
//   try {
//     res.set("Content-Type", register.contentType);
//     res.end(await register.metrics());
//   } catch (err) {
//     res.status(500).end(err.message);
//   }
// });

// /* --------------------- Health Check --------------------- */
// app.get("/health", (req, res) => {
//   res.json({ status: "Transaction Service running" });
// });

// /* --------------------- DB Check --------------------- */
// app.get("/db-check", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT NOW() AS current_time");
//     res.json({ success: true, db_time: result.rows[0].current_time });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Deposit API --------------------- */
// app.post("/transactions/deposit", async (req, res) => {
//   const { account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!account_id || !amount)
//     return res.status(400).json({ success: false, message: "account_id and amount are required" });
//   if (!idempotencyKey)
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

//   try {
//     const existingKey = await pool.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await pool.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     // ✅ Perform DB insert
//     const ref = `REF-${Date.now()}`;
//     const counterparty = "SYSTEM:Deposit";

//     const insertTxn = await pool.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'DEPOSIT', $3, $4)
//        RETURNING *;`,
//       [account_id, amount, counterparty, ref]
//     );
//     const txn = insertTxn.rows[0];

//     await pool.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, txn.txn_id]
//     );

//     // ✅ Publish event
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       channel.sendToQueue(
//         "transaction_events",
//         Buffer.from(JSON.stringify({ type: "DEPOSIT_CREATED", transaction: txn }))
//       );
//       console.log("📤 Sent DEPOSIT_CREATED event to RabbitMQ");
//     } catch (mqErr) {
//       console.error("RabbitMQ publish error:", mqErr.message);
//     }

//     res.status(201).json({ success: true, transaction: txn });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Transfer API (Resilient + Business Rules) --------------------- */
// app.post("/transactions/transfer", async (req, res) => {
//   const { from_account_id, to_account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!from_account_id || !to_account_id || !amount)
//     return res.status(400).json({
//       success: false,
//       message: "from_account_id, to_account_id, and amount are required",
//     });
//   if (!idempotencyKey)
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

//   const client = await pool.connect();
//   try {
//     // Idempotency check
//     const existingKey = await client.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );
//     if (existingKey.rows.length > 0) {
//       const existingTxn = await client.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     // Business rule: check via Account Service with circuit breaker
//     console.log("🔍 Checking source account via circuit breaker...");
//     const fromAcc = await fetchAccountBalanceCB.fire(from_account_id);
//     if (!fromAcc.success)
//       return res.status(503).json({ success: false, message: fromAcc.message });

//     if (fromAcc.status !== "ACTIVE")
//       return res.status(403).json({ success: false, message: "Account frozen or inactive" });

//     if (fromAcc.balance < amount)
//       return res.status(400).json({ success: false, message: "Insufficient balance" });

//     // Daily limit rule
//     const DAILY_LIMIT = 200000;
//     const { rows: dailyRows } = await client.query(
//       `SELECT COALESCE(SUM(amount), 0) AS total_today
//        FROM transactions
//        WHERE account_id = $1
//          AND txn_type = 'TRANSFER_OUT'
//          AND DATE(created_at) = CURRENT_DATE`,
//       [from_account_id]
//     );
//     const totalToday = parseFloat(dailyRows[0].total_today || 0);
//     if (totalToday + Number(amount) > DAILY_LIMIT)
//       return res.status(400).json({
//         success: false,
//         message: `Daily transfer limit exceeded (₹${DAILY_LIMIT})`,
//       });

//     // ✅ Debit/Credit via Account Service (resilient)
//     await debitAccount(from_account_id, amount);
//     await creditAccount(to_account_id, amount);

//     await client.query("BEGIN");

//     const outRef = `REF-OUT-${Date.now()}`;
//     const senderTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_OUT', $3, $4)
//        RETURNING *;`,
//       [from_account_id, amount, `TO:${to_account_id}`, outRef]
//     );

//     const inRef = `REF-IN-${Date.now()}`;
//     const receiverTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_IN', $3, $4)
//        RETURNING *;`,
//       [to_account_id, amount, `FROM:${from_account_id}`, inRef]
//     );

//     await client.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, senderTxn.rows[0].txn_id]
//     );
//     await client.query("COMMIT");

//     // Publish event
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       channel.sendToQueue(
//         "transaction_events",
//         Buffer.from(
//           JSON.stringify({
//             type: "TRANSFER_COMPLETED",
//             sender: senderTxn.rows[0],
//             receiver: receiverTxn.rows[0],
//           })
//         )
//       );
//       console.log("📤 Sent TRANSFER_COMPLETED event to RabbitMQ");
//     } catch (mqErr) {
//       console.error("RabbitMQ publish error:", mqErr.message);
//     }

//     res.status(201).json({
//       success: true,
//       sender_transaction: senderTxn.rows[0],
//       receiver_transaction: receiverTxn.rows[0],
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     res.status(500).json({ success: false, message: err.message });
//   } finally {
//     client.release();
//   }
// });

// /* --------------------- Transactions Route --------------------- */
// app.use("/transactions", transactionRoutes);

// /* --------------------- Start Server --------------------- */
// const port = process.env.PORT || 8082;
// app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
// import express from "express";
// import swaggerUi from "swagger-ui-express";
// import YAML from "yamljs";


// // existing routes here...

// import dotenv from "dotenv";
// import promClient from "prom-client";
// import path from "path";
// import { fileURLToPath } from "url";
// import { pool } from "./db.js";
// import transactionRoutes from "./routes/transactionRoutes.js";
// import { connectQueue, getChannel } from "./messageQueue.js";
// import { fetchAccountBalanceCB, debitAccount, creditAccount } from "./accountClient.js";
// import logger from "./logger.js";
// import { correlationIdMiddleware } from "./middleware/correlationId.js";

// dotenv.config();

// // Setup path resolution for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();

// // 🧠 Load and serve Swagger OpenAPI
// const swaggerDocument = YAML.load(path.join(__dirname, "../openapi.yaml"));
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// app.use(express.json());
// app.use(correlationIdMiddleware); // 🧩 Add correlation ID early

// /* --------------------- Connect to RabbitMQ --------------------- */
// connectQueue()
//   .then(() => logger.info("✅ RabbitMQ connected"))
//   .catch((err) => logger.error("❌ RabbitMQ connection error:", err));

// /* --------------------- Prometheus Metrics --------------------- */


// const register = new promClient.Registry();

// // Collect default metrics (CPU, memory, etc.)
// promClient.collectDefaultMetrics({ register });

// // Custom HTTP request counter
// const httpRequestCounter = new promClient.Counter({
//   name: "http_requests_total",
//   help: "Total number of HTTP requests",
//   labelNames: ["method", "route", "status_code"],
// });
// register.registerMetric(httpRequestCounter);

// // Middleware to increment counter
// app.use((req, res, next) => {
//   res.on("finish", () => {
//     httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
//   });
//   next();
// });

// // ✅ Expose /metrics endpoint
// app.get("/metrics", async (req, res) => {
//   try {
//     res.set("Content-Type", register.contentType);
//     res.end(await register.metrics());
//   } catch (err) {
//     res.status(500).end(err);
//   }
// });


// /* --------------------- Health --------------------- */
// app.get("/health", (req, res) => {
//   logger.info({ correlationId: req.correlationId }, "Health check OK");
//   res.json({ status: "Transaction Service running" });
// });

// /* --------------------- transaction routes check --------------------- */
// app.use("/transactions", transactionRoutes);

// /* --------------------- DB Check --------------------- */
// app.get("/db-check", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT NOW() AS current_time");
//     logger.info({ correlationId: req.correlationId }, "DB connectivity OK");
//     res.json({ success: true, db_time: result.rows[0].current_time });
//   } catch (err) {
//     logger.error({ correlationId: req.correlationId, error: err.message }, "DB check failed");
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Deposit API --------------------- */
// app.post("/transactions/deposit", async (req, res) => {
//   const { account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];

//   if (!account_id || !amount)
//     return res.status(400).json({ success: false, message: "account_id and amount are required" });
//   if (!idempotencyKey)
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

//   try {
//     const existingKey = await pool.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await pool.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       logger.info({ correlationId: req.correlationId }, "Reused existing deposit transaction");
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     const ref = `REF-${Date.now()}`;
//     const counterparty = "SYSTEM:Deposit";

//     const insertTxn = await pool.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'DEPOSIT', $3, $4)
//        RETURNING *;`,
//       [account_id, amount, counterparty, ref]
//     );
//     const txn = insertTxn.rows[0];

//     await pool.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, txn.txn_id]
//     );

//     // 🐇 Publish event with correlationId
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       const event = {
//         type: "DEPOSIT_CREATED",
//         transaction: txn,
//         correlationId: req.correlationId,
//         source: "transaction-service",
//       };
//       channel.sendToQueue("transaction_events", Buffer.from(JSON.stringify(event)), {
//         persistent: true,
//       });
//       logger.info({ correlationId: req.correlationId }, "📤 Sent DEPOSIT_CREATED event");
//     } catch (mqErr) {
//       logger.error({ correlationId: req.correlationId, error: mqErr.message }, "RabbitMQ publish failed");
//     }

//     res.status(201).json({ success: true, transaction: txn });
//   } catch (err) {
//     logger.error({ correlationId: req.correlationId, error: err.message }, "Deposit error");
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Transfer API --------------------- */
// app.post("/transactions/transfer", async (req, res) => {
//   const { from_account_id, to_account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];
//   const correlationId = req.correlationId;

//   if (!from_account_id || !to_account_id || !amount)
//     return res.status(400).json({
//       success: false,
//       message: "from_account_id, to_account_id, and amount are required",
//     });
//   if (!idempotencyKey)
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

//   const client = await pool.connect();
//   try {
//     const existingKey = await client.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );
//     if (existingKey.rows.length > 0) {
//       const existingTxn = await client.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       logger.info({ correlationId }, "Reused existing transfer transaction");
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     logger.info({ correlationId }, "🔍 Validating source account via circuit breaker...");
//     const fromAcc = await fetchAccountBalanceCB.fire(from_account_id);
//     if (!fromAcc.success)
//       return res.status(503).json({ success: false, message: fromAcc.message });

//     if (fromAcc.status !== "ACTIVE")
//       return res.status(403).json({ success: false, message: "Account frozen or inactive" });

//     if (fromAcc.balance < amount)
//       return res.status(400).json({ success: false, message: "Insufficient balance" });

//     const DAILY_LIMIT = 200000;
//     const { rows: dailyRows } = await client.query(
//       `SELECT COALESCE(SUM(amount), 0) AS total_today
//        FROM transactions
//        WHERE account_id = $1
//          AND txn_type = 'TRANSFER_OUT'
//          AND DATE(created_at) = CURRENT_DATE`,
//       [from_account_id]
//     );
//     const totalToday = parseFloat(dailyRows[0].total_today || 0);
//     if (totalToday + Number(amount) > DAILY_LIMIT)
//       return res.status(400).json({
//         success: false,
//         message: `Daily transfer limit exceeded (₹${DAILY_LIMIT})`,
//       });

//     await debitAccount(from_account_id, amount);
//     await creditAccount(to_account_id, amount);

//     await client.query("BEGIN");

//     const outRef = `REF-OUT-${Date.now()}`;
//     const senderTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_OUT', $3, $4)
//        RETURNING *;`,
//       [from_account_id, amount, `TO:${to_account_id}`, outRef]
//     );

//     const inRef = `REF-IN-${Date.now()}`;
//     const receiverTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_IN', $3, $4)
//        RETURNING *;`,
//       [to_account_id, amount, `FROM:${from_account_id}`, inRef]
//     );

//     await client.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, senderTxn.rows[0].txn_id]
//     );
//     await client.query("COMMIT");

//     // 🐇 Publish event with correlationId
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       const event = {
//         type: "TRANSFER_COMPLETED",
//         sender: senderTxn.rows[0],
//         receiver: receiverTxn.rows[0],
//         correlationId,
//         source: "transaction-service",
//       };
//       channel.sendToQueue("transaction_events", Buffer.from(JSON.stringify(event)), {
//         persistent: true,
//       });
//       logger.info({ correlationId }, "📤 Sent TRANSFER_COMPLETED event");
//     } catch (mqErr) {
//       logger.error({ correlationId, error: mqErr.message }, "RabbitMQ publish failed");
//     }

//     res.status(201).json({
//       success: true,
//       sender_transaction: senderTxn.rows[0],
//       receiver_transaction: receiverTxn.rows[0],
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     logger.error({ correlationId, error: err.message }, "Transfer error");
//     res.status(500).json({ success: false, message: err.message });
//   } finally {
//     client.release();
//   }
// });

// /* --------------------- Start Server --------------------- */
// const port = process.env.PORT || 8082;
// app.listen(port, () => logger.info(`🚀 Server running on port ${port}`));

// import cors from "cors";
// import express from "express";
// import swaggerUi from "swagger-ui-express";
// import YAML from "yamljs";
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";
// import promClient from "prom-client";
// import { performance } from "perf_hooks";
// import crypto from "crypto";

// import { pool } from "./db.js";
// import transactionRoutes from "./routes/transactionRoutes.js";
// import { connectQueue, getChannel } from "./messageQueue.js";
// import { fetchAccountBalanceCB, debitAccount, creditAccount } from "./accountClient.js";
// import logger from "./logger.js";
// import { correlationIdMiddleware } from "./middleware/correlationId.js";

// /* --------------------- Setup --------------------- */
// dotenv.config();
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const app = express();
// app.use(cors()); /*--added for minikube--*/

// app.use(express.json());
// app.use(correlationIdMiddleware);

// /* --------------------- Swagger --------------------- */
// const swaggerDocument = YAML.load(path.join(__dirname, "../openapi.yaml"));
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// /* --------------------- RabbitMQ --------------------- */
// connectQueue()
//   .then(() => logger.info("✅ RabbitMQ connected"))
//   .catch((err) => logger.error("❌ RabbitMQ connection error:", err));

// /* --------------------- Prometheus Metrics --------------------- */
// const register = new promClient.Registry();
// promClient.collectDefaultMetrics({ register });

// // RED / USE metrics
// const httpRequestCounter = new promClient.Counter({
//   name: "http_requests_total",
//   help: "Total number of HTTP requests",
//   labelNames: ["method", "route", "status_code"],
// });
// const httpRequestErrors = new promClient.Counter({
//   name: "http_request_errors_total",
//   help: "Total number of failed HTTP requests",
//   labelNames: ["method", "route"],
// });
// const httpRequestDuration = new promClient.Histogram({
//   name: "http_request_duration_seconds",
//   help: "HTTP request duration in seconds",
//   labelNames: ["method", "route", "status_code"],
//   buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
// });

// // Business metrics
// const transactionsTotal = new promClient.Counter({
//   name: "transactions_total",
//   help: "Total number of transactions processed",
//   labelNames: ["txn_type"],
// });
// const failedTransfersTotal = new promClient.Counter({
//   name: "failed_transfers_total",
//   help: "Total number of failed transfer attempts",
// });
// const balanceCheckLatency = new promClient.Histogram({
//   name: "balance_check_latency_ms",
//   help: "Latency of balance-check operations (ms)",
//   buckets: [5, 10, 20, 50, 100, 200, 500],
// });

// // register metrics
// register.registerMetric(httpRequestCounter);
// register.registerMetric(httpRequestErrors);
// register.registerMetric(httpRequestDuration);
// register.registerMetric(transactionsTotal);
// register.registerMetric(failedTransfersTotal);
// register.registerMetric(balanceCheckLatency);

// /* Middleware: track RED metrics */
// app.use((req, res, next) => {
//   const start = performance.now();
//   res.on("finish", () => {
//     const dur = (performance.now() - start) / 1000;
//     httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
//     httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(dur);
//     if (res.statusCode >= 400) httpRequestErrors.labels(req.method, req.path).inc();
//   });
//   next();
// });

// /* /metrics endpoint */
// app.get("/metrics", async (req, res) => {
//   try {
//     res.set("Content-Type", register.contentType);
//     res.end(await register.metrics());
//   } catch (err) {
//     res.status(500).end(err);
//   }
// });

// /* --------------------- Structured Logging --------------------- */
// app.use((req, res, next) => {
//   const start = performance.now();
//   const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
//   res.setHeader("x-correlation-id", correlationId);
//   req.correlationId = correlationId;

//   res.on("finish", () => {
//     const latency = performance.now() - start;
//     const safeBody = JSON.stringify(req.body || {})
//       .replace(/"email":"[^"]+"/g, '"email":"***"')
//       .replace(/"phone":"[^"]+"/g, '"phone":"***"');
//     logger.info({
//       correlationId,
//       method: req.method,
//       path: req.path,
//       status: res.statusCode,
//       latency_ms: latency.toFixed(2),
//       body: safeBody,
//     });
//   });
//   next();
// });

// /* --------------------- Health --------------------- */
// app.get("/health", (req, res) => {
//   logger.info({ correlationId: req.correlationId }, "Health check OK");
//   res.json({ status: "Transaction Service running" });
// });

// /* --------------------- DB Check --------------------- */
// app.get("/db-check", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT NOW() AS current_time");
//     logger.info({ correlationId: req.correlationId }, "DB connectivity OK");
//     res.json({ success: true, db_time: result.rows[0].current_time });
//   } catch (err) {
//     logger.error({ correlationId: req.correlationId, error: err.message }, "DB check failed");
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Deposit API --------------------- */
// app.post("/transactions/deposit", async (req, res) => {
//   const { account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];
//   const correlationId = req.correlationId;

//   if (!account_id || !amount)
//     return res.status(400).json({ success: false, message: "account_id and amount are required" });
//   if (!idempotencyKey)
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

//   try {
//     const existingKey = await pool.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );

//     if (existingKey.rows.length > 0) {
//       const existingTxn = await pool.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       logger.info({ correlationId }, "Reused existing deposit transaction");
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     const ref = `REF-${Date.now()}`;
//     const counterparty = "SYSTEM:Deposit";

//     const insertTxn = await pool.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'DEPOSIT', $3, $4)
//        RETURNING *;`,
//       [account_id, amount, counterparty, ref]
//     );
//     const txn = insertTxn.rows[0];
//     transactionsTotal.labels("deposit").inc(); // ✅ Business metric

//     await pool.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, txn.txn_id]
//     );

//     // Publish event
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       const event = {
//         type: "DEPOSIT_CREATED",
//         transaction: txn,
//         correlationId,
//         source: "transaction-service",
//       };
//       channel.sendToQueue("transaction_events", Buffer.from(JSON.stringify(event)), {
//         persistent: true,
//       });
//       logger.info({ correlationId }, "📤 Sent DEPOSIT_CREATED event");
//     } catch (mqErr) {
//       logger.error({ correlationId, error: mqErr.message }, "RabbitMQ publish failed");
//     }

//     res.status(201).json({ success: true, transaction: txn });
//   } catch (err) {
//     logger.error({ correlationId, error: err.message }, "Deposit error");
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// /* --------------------- Transfer API --------------------- */
// app.post("/transactions/transfer", async (req, res) => {
//   const { from_account_id, to_account_id, amount } = req.body;
//   const idempotencyKey = req.headers["idempotency-key"];
//   const correlationId = req.correlationId;

//   if (!from_account_id || !to_account_id || !amount)
//     return res.status(400).json({
//       success: false,
//       message: "from_account_id, to_account_id, and amount are required",
//     });
//   if (!idempotencyKey)
//     return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

//   const client = await pool.connect();
//   try {
//     const existingKey = await client.query(
//       "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
//       [idempotencyKey]
//     );
//     if (existingKey.rows.length > 0) {
//       const existingTxn = await client.query(
//         "SELECT * FROM transactions WHERE txn_id = $1",
//         [existingKey.rows[0].txn_id]
//       );
//       logger.info({ correlationId }, "Reused existing transfer transaction");
//       return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
//     }

//     const startCheck = performance.now();
//     const fromAcc = await fetchAccountBalanceCB.fire(from_account_id);
//     balanceCheckLatency.observe(performance.now() - startCheck);

//     if (!fromAcc.success)
//       return res.status(503).json({ success: false, message: fromAcc.message });
//     if (fromAcc.status !== "ACTIVE")
//       return res.status(403).json({ success: false, message: "Account frozen or inactive" });
//     if (fromAcc.balance < amount)
//       return res.status(400).json({ success: false, message: "Insufficient balance" });

//     const DAILY_LIMIT = 200000;
//     const { rows: dailyRows } = await client.query(
//       `SELECT COALESCE(SUM(amount), 0) AS total_today
//        FROM transactions
//        WHERE account_id = $1
//          AND txn_type = 'TRANSFER_OUT'
//          AND DATE(created_at) = CURRENT_DATE`,
//       [from_account_id]
//     );
//     const totalToday = parseFloat(dailyRows[0].total_today || 0);
//     if (totalToday + Number(amount) > DAILY_LIMIT)
//       return res.status(400).json({
//         success: false,
//         message: `Daily transfer limit exceeded (₹${DAILY_LIMIT})`,
//       });

//     await debitAccount(from_account_id, amount);
//     await creditAccount(to_account_id, amount);

//     await client.query("BEGIN");

//     const outRef = `REF-OUT-${Date.now()}`;
//     const senderTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_OUT', $3, $4)
//        RETURNING *;`,
//       [from_account_id, amount, `TO:${to_account_id}`, outRef]
//     );

//     const inRef = `REF-IN-${Date.now()}`;
//     const receiverTxn = await client.query(
//       `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
//        VALUES ($1, $2, 'TRANSFER_IN', $3, $4)
//        RETURNING *;`,
//       [to_account_id, amount, `FROM:${from_account_id}`, inRef]
//     );

//     await client.query(
//       `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
//       [idempotencyKey, senderTxn.rows[0].txn_id]
//     );
//     await client.query("COMMIT");

//     transactionsTotal.labels("transfer").inc(); // ✅ Business metric

//     // Publish event
//     try {
//       const channel = getChannel();
//       await channel.assertQueue("transaction_events");
//       const event = {
//         type: "TRANSFER_COMPLETED",
//         sender: senderTxn.rows[0],
//         receiver: receiverTxn.rows[0],
//         correlationId,
//         source: "transaction-service",
//       };
//       channel.sendToQueue("transaction_events", Buffer.from(JSON.stringify(event)), {
//         persistent: true,
//       });
//       logger.info({ correlationId }, "📤 Sent TRANSFER_COMPLETED event");
//     } catch (mqErr) {
//       logger.error({ correlationId, error: mqErr.message }, "RabbitMQ publish failed");
//     }

//     res.status(201).json({
//       success: true,
//       sender_transaction: senderTxn.rows[0],
//       receiver_transaction: receiverTxn.rows[0],
//     });
//   } catch (err) {
//     await client.query("ROLLBACK");
//     failedTransfersTotal.inc(); // ✅ Business metric
//     logger.error({ correlationId, error: err.message }, "Transfer error");
//     res.status(500).json({ success: false, message: err.message });
//   } finally {
//     client.release();
//   }
// });

// /* --------------------- Transaction Routes --------------------- */
// app.use("/transactions", transactionRoutes);

// /* --------------------- Start Server --------------------- */
// const port = process.env.PORT || 8082;
// app.listen(port, () => logger.info(`🚀 Transaction Service running on port ${port}`));

// export { register, transactionsTotal, failedTransfersTotal, balanceCheckLatency };


import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import promClient from "prom-client";
import { performance } from "perf_hooks";
import crypto from "crypto";

import { pool } from "./db.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import { connectQueue, getChannel } from "./messageQueue.js";
import { fetchAccountBalanceCB, debitAccount, creditAccount } from "./accountClient.js";
import logger from "./logger.js";
import { correlationIdMiddleware } from "./middleware/correlationId.js";

/* --------------------- Setup --------------------- */
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

/* --------------------- Middleware --------------------- */
// ✅ Enable full CORS for Swagger UI + REST clients
/* --------------------- CORS for Swagger + APIs --------------------- */
app.use(
  cors({
    origin: "*", // allow all origins (Swagger UI runs from same container)
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-Correlation-ID",
    ],
    exposedHeaders: ["X-Correlation-ID"],
  })
);

// ✅ Handle preflight OPTIONS requests for all routes
app.options(/.*/, cors());

 
app.use(express.json());
app.use(correlationIdMiddleware);

/* --------------------- Swagger --------------------- */
const swaggerPath = path.join(__dirname, "../openapi.yaml");
// const swaggerDocument = YAML.load(swaggerPath);
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
const swaggerDocument = YAML.load(path.join(__dirname, "../openapi.yaml"));

// 🧠 Dynamically set Swagger server URL to match where it's actually running
swaggerDocument.servers = [
  {
    url: `${process.env.BASE_URL || ''}`, // allows override via .env if needed
    description: "Dynamic base (matches current host)"
  }
];

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

/* --------------------- RabbitMQ --------------------- */
connectQueue()
  .then(() => logger.info("✅ RabbitMQ connected"))
  .catch((err) => logger.error("❌ RabbitMQ connection error:", err));

/* --------------------- Prometheus Metrics --------------------- */
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// RED / USE metrics
const httpRequestCounter = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});
const httpRequestErrors = new promClient.Counter({
  name: "http_request_errors_total",
  help: "Total number of failed HTTP requests",
  labelNames: ["method", "route"],
});
const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

// Business metrics
const transactionsTotal = new promClient.Counter({
  name: "transactions_total",
  help: "Total number of transactions processed",
  labelNames: ["txn_type"],
});
const failedTransfersTotal = new promClient.Counter({
  name: "failed_transfers_total",
  help: "Total number of failed transfer attempts",
});
const balanceCheckLatency = new promClient.Histogram({
  name: "balance_check_latency_ms",
  help: "Latency of balance-check operations (ms)",
  buckets: [5, 10, 20, 50, 100, 200, 500],
});

// register metrics
register.registerMetric(httpRequestCounter);
register.registerMetric(httpRequestErrors);
register.registerMetric(httpRequestDuration);
register.registerMetric(transactionsTotal);
register.registerMetric(failedTransfersTotal);
register.registerMetric(balanceCheckLatency);

/* Middleware: track RED metrics */
app.use((req, res, next) => {
  const start = performance.now();
  res.on("finish", () => {
    const dur = (performance.now() - start) / 1000;
    httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
    httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(dur);
    if (res.statusCode >= 400) httpRequestErrors.labels(req.method, req.path).inc();
  });
  next();
});

/* /metrics endpoint */
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

/* --------------------- Structured Logging --------------------- */
app.use((req, res, next) => {
  const start = performance.now();
  const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  res.setHeader("x-correlation-id", correlationId);
  req.correlationId = correlationId;

  res.on("finish", () => {
    const latency = performance.now() - start;
    const safeBody = JSON.stringify(req.body || {})
      .replace(/"email":"[^"]+"/g, '"email":"***"')
      .replace(/"phone":"[^"]+"/g, '"phone":"***"');
    logger.info({
      correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latency_ms: latency.toFixed(2),
      body: safeBody,
    });
  });
  next();
});

/* --------------------- Health --------------------- */
app.get("/health", (req, res) => {
  logger.info({ correlationId: req.correlationId }, "Health check OK");
  res.json({ status: "Transaction Service running" });
});

/* --------------------- DB Check --------------------- */
app.get("/db-check", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");
    logger.info({ correlationId: req.correlationId }, "DB connectivity OK");
    res.json({ success: true, db_time: result.rows[0].current_time });
  } catch (err) {
    logger.error({ correlationId: req.correlationId, error: err.message }, "DB check failed");
    res.status(500).json({ success: false, message: err.message });
  }
});

/* --------------------- Deposit API --------------------- */
app.post("/transactions/deposit", async (req, res) => {
  const { account_id, amount } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];
  const correlationId = req.correlationId;

  if (!account_id || !amount)
    return res.status(400).json({ success: false, message: "account_id and amount are required" });
  if (!idempotencyKey)
    return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

  try {
    const existingKey = await pool.query(
      "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
      [idempotencyKey]
    );

    if (existingKey.rows.length > 0) {
      const existingTxn = await pool.query(
        "SELECT * FROM transactions WHERE txn_id = $1",
        [existingKey.rows[0].txn_id]
      );
      logger.info({ correlationId }, "Reused existing deposit transaction");
      return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
    }

    const ref = `REF-${Date.now()}`;
    const counterparty = "SYSTEM:Deposit";

    const insertTxn = await pool.query(
      `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
       VALUES ($1, $2, 'DEPOSIT', $3, $4)
       RETURNING *;`,
      [account_id, amount, counterparty, ref]
    );
    const txn = insertTxn.rows[0];
    transactionsTotal.labels("deposit").inc(); // ✅ Business metric

    await pool.query(
      `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
      [idempotencyKey, txn.txn_id]
    );

    // Publish event
    try {
      const channel = getChannel();
      await channel.assertQueue("transaction_events");
      const event = {
        type: "DEPOSIT_CREATED",
        transaction: txn,
        correlationId,
        source: "transaction-service",
      };
      channel.sendToQueue("transaction_events", Buffer.from(JSON.stringify(event)), {
        persistent: true,
      });
      logger.info({ correlationId }, "📤 Sent DEPOSIT_CREATED event");
    } catch (mqErr) {
      logger.error({ correlationId, error: mqErr.message }, "RabbitMQ publish failed");
    }

    res.status(201).json({ success: true, transaction: txn });
  } catch (err) {
    logger.error({ correlationId, error: err.message }, "Deposit error");
    res.status(500).json({ success: false, message: err.message });
  }
});

/* --------------------- Transfer API --------------------- */
app.post("/transactions/transfer", async (req, res) => {
  const { from_account_id, to_account_id, amount } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];
  const correlationId = req.correlationId;

  if (!from_account_id || !to_account_id || !amount)
    return res.status(400).json({
      success: false,
      message: "from_account_id, to_account_id, and amount are required",
    });
  if (!idempotencyKey)
    return res.status(400).json({ success: false, message: "Missing Idempotency-Key header" });

  const client = await pool.connect();
  try {
    const existingKey = await client.query(
      "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
      [idempotencyKey]
    );
    if (existingKey.rows.length > 0) {
      const existingTxn = await client.query(
        "SELECT * FROM transactions WHERE txn_id = $1",
        [existingKey.rows[0].txn_id]
      );
      logger.info({ correlationId }, "Reused existing transfer transaction");
      return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
    }

    const startCheck = performance.now();
    const fromAcc = await fetchAccountBalanceCB.fire(from_account_id);
    balanceCheckLatency.observe(performance.now() - startCheck);

    if (!fromAcc.success)
      return res.status(503).json({ success: false, message: fromAcc.message });
    if (fromAcc.status !== "ACTIVE")
      return res.status(403).json({ success: false, message: "Account frozen or inactive" });
    if (fromAcc.balance < amount)
      return res.status(400).json({ success: false, message: "Insufficient balance" });

    const DAILY_LIMIT = 200000;
    const { rows: dailyRows } = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_today
       FROM transactions
       WHERE account_id = $1
         AND txn_type = 'TRANSFER_OUT'
         AND DATE(created_at) = CURRENT_DATE`,
      [from_account_id]
    );
    const totalToday = parseFloat(dailyRows[0].total_today || 0);
    if (totalToday + Number(amount) > DAILY_LIMIT)
      return res.status(400).json({
        success: false,
        message: `Daily transfer limit exceeded (₹${DAILY_LIMIT})`,
      });

    await debitAccount(from_account_id, amount);
    await creditAccount(to_account_id, amount);

    await client.query("BEGIN");

    const outRef = `REF-OUT-${Date.now()}`;
    const senderTxn = await client.query(
      `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
       VALUES ($1, $2, 'TRANSFER_OUT', $3, $4)
       RETURNING *;`,
      [from_account_id, amount, `TO:${to_account_id}`, outRef]
    );

    const inRef = `REF-IN-${Date.now()}`;
    const receiverTxn = await client.query(
      `INSERT INTO transactions (account_id, amount, txn_type, counterparty, reference)
       VALUES ($1, $2, 'TRANSFER_IN', $3, $4)
       RETURNING *;`,
      [to_account_id, amount, `FROM:${from_account_id}`, inRef]
    );

    await client.query(
      `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
      [idempotencyKey, senderTxn.rows[0].txn_id]
    );
    await client.query("COMMIT");

    transactionsTotal.labels("transfer").inc(); // ✅ Business metric

    // Publish event
    try {
      const channel = getChannel();
      await channel.assertQueue("transaction_events");
      const event = {
        type: "TRANSFER_COMPLETED",
        sender: senderTxn.rows[0],
        receiver: receiverTxn.rows[0],
        correlationId,
        source: "transaction-service",
      };
      channel.sendToQueue("transaction_events", Buffer.from(JSON.stringify(event)), {
        persistent: true,
      });
      logger.info({ correlationId }, "📤 Sent TRANSFER_COMPLETED event");
    } catch (mqErr) {
      logger.error({ correlationId, error: mqErr.message }, "RabbitMQ publish failed");
    }

    res.status(201).json({
      success: true,
      sender_transaction: senderTxn.rows[0],
      receiver_transaction: receiverTxn.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    failedTransfersTotal.inc(); // ✅ Business metric
    logger.error({ correlationId, error: err.message }, "Transfer error");
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/* --------------------- Transaction Routes --------------------- */
app.use("/transactions", transactionRoutes);

/* --------------------- Start Server --------------------- */
const port = process.env.PORT || 8082;
app.listen(port, () => logger.info(`🚀 Transaction Service running on port ${port}`));

export { register, transactionsTotal, failedTransfersTotal, balanceCheckLatency };
