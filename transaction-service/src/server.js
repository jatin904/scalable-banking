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

import express from "express";
import dotenv from "dotenv";
import promClient from "prom-client";  // ✅ fixed duplicate name
import { pool } from "./db.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import { connectQueue, getChannel } from "./messageQueue.js"; // ✅ single import

dotenv.config();

const app = express();
app.use(express.json());

/* --------------------- Connect to RabbitMQ --------------------- */
connectQueue()
  .then(() => console.log("✅ RabbitMQ connected"))
  .catch((err) => console.error("❌ RabbitMQ connection error:", err));

/* --------------------- Prometheus Metrics --------------------- */
const register = new promClient.Registry();

// Collect default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom counter for HTTP requests
const httpRequestCounter = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

register.registerMetric(httpRequestCounter);

// Middleware to count every request
app.use((req, res, next) => {
  res.on("finish", () => {
    httpRequestCounter.labels(req.method, req.path, res.statusCode).inc();
  });
  next();
});

// Expose metrics
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

/* --------------------- Health Check --------------------- */
app.get("/health", (req, res) => {
  res.json({ status: "Transaction Service running" });
});

/* --------------------- DB Connectivity Check --------------------- */
app.get("/db-check", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");
    res.json({
      success: true,
      db_time: result.rows[0].current_time,
    });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* --------------------- Deposit API (Idempotent) --------------------- */
app.post("/transactions/deposit", async (req, res) => {
  const { account_id, amount } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];

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
    await pool.query(
      `INSERT INTO idempotency_keys (idempotency_key, txn_id) VALUES ($1, $2);`,
      [idempotencyKey, txn.txn_id]
    );

    // 🐇 Publish to RabbitMQ
    try {
      const channel = getChannel();
      await channel.assertQueue("transaction_events");
      channel.sendToQueue(
        "transaction_events",
        Buffer.from(JSON.stringify({ type: "DEPOSIT_CREATED", transaction: txn }))
      );
      console.log("📤 Sent DEPOSIT_CREATED event to RabbitMQ");
    } catch (mqErr) {
      console.error("RabbitMQ publish error:", mqErr.message);
    }

    res.status(201).json({ success: true, transaction: txn });
  } catch (err) {
    console.error("Deposit error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* --------------------- Transfer API (Idempotent + Business Rules) --------------------- */
app.post("/transactions/transfer", async (req, res) => {
  const { from_account_id, to_account_id, amount } = req.body;
  const idempotencyKey = req.headers["idempotency-key"];

  if (!from_account_id || !to_account_id || !amount) {
    return res.status(400).json({
      success: false,
      message: "from_account_id, to_account_id, and amount are required",
    });
  }

  if (!idempotencyKey) {
    return res
      .status(400)
      .json({ success: false, message: "Missing Idempotency-Key header" });
  }

  const client = await pool.connect();
  try {
    /* -------------------- Idempotency Check -------------------- */
    const existingKey = await client.query(
      "SELECT txn_id FROM idempotency_keys WHERE idempotency_key = $1",
      [idempotencyKey]
    );

    if (existingKey.rows.length > 0) {
      const existingTxn = await client.query(
        "SELECT * FROM transactions WHERE txn_id = $1",
        [existingKey.rows[0].txn_id]
      );
      return res.json({ success: true, transaction: existingTxn.rows[0], reused: true });
    }

    /* -------------------- Business Rule #1: Frozen Account -------------------- */
    const frozenAccounts = new Set([999, 1001]); // mock example IDs
    if (frozenAccounts.has(from_account_id) || frozenAccounts.has(to_account_id)) {
      return res.status(400).json({
        success: false,
        message: "Transfer failed: one of the accounts is frozen.",
      });
    }

    /* -------------------- Business Rule #2: Daily Limit -------------------- */
    const DAILY_LIMIT = 200000; // ₹2,00,000
    const { rows: dailyRows } = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_today
       FROM transactions
       WHERE account_id = $1
         AND txn_type = 'TRANSFER_OUT'
         AND DATE(created_at) = CURRENT_DATE`,
      [from_account_id]
    );
    const totalToday = parseFloat(dailyRows[0].total_today || 0);
    if (totalToday + Number(amount) > DAILY_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `Daily transfer limit exceeded. Limit ₹${DAILY_LIMIT}, used ₹${totalToday}`,
      });
    }

    /* -------------------- Business Rule #3: No Overdraft for BASIC -------------------- */
    // Mock rule: assume "basic" accounts have < ₹10,000 balance
    const simulatedAccountType = "BASIC";
    const simulatedBalance = 8000; // mock data for test
    if (simulatedAccountType === "BASIC" && simulatedBalance < Number(amount)) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance. Basic accounts cannot overdraft.",
      });
    }

    /* -------------------- Begin Transaction -------------------- */
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
      `INSERT INTO idempotency_keys (idempotency_key, txn_id)
       VALUES ($1, $2);`,
      [idempotencyKey, senderTxn.rows[0].txn_id]
    );

    await client.query("COMMIT");

    /* -------------------- Publish RabbitMQ Event -------------------- */
    try {
      const channel = getChannel();
      await channel.assertQueue("transaction_events");
      channel.sendToQueue(
        "transaction_events",
        Buffer.from(
          JSON.stringify({
            type: "TRANSFER_COMPLETED",
            sender: senderTxn.rows[0],
            receiver: receiverTxn.rows[0],
          })
        )
      );
      console.log("📤 Sent TRANSFER_COMPLETED event to RabbitMQ");
    } catch (mqErr) {
      console.error("RabbitMQ publish error:", mqErr.message);
    }

    /* -------------------- Respond -------------------- */
    res.status(201).json({
      success: true,
      sender_transaction: senderTxn.rows[0],
      receiver_transaction: receiverTxn.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Transfer error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});


// /* --------------------- Transfer API (Idempotent) --------------------- */
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

//     // 🐇 Publish to RabbitMQ
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

/* --------------------- Transactions Route --------------------- */
app.use("/transactions", transactionRoutes);

/* --------------------- Start Server --------------------- */
const port = process.env.PORT || 8082;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
