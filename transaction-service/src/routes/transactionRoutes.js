// import express from 'express';
// import { pool } from '../db.js';

// const router = express.Router();

// // GET /transactions/:accountId
// router.get('/:accountId', async (req, res) => {
//   const { accountId } = req.params;

//   try {
//     const result = await pool.query(
//       'SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC',
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
//     console.error('Error fetching transactions:', err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

// export default router;

// import express from "express";
// import { pool } from "../db.js";
// import logger from "../logger.js";

// const router = express.Router();

// // ✅ List all or filter by account_id (Step 5d)
// router.get("/", async (req, res) => {
//   try {
//     const { account_id } = req.query;
//     let result;

//     if (account_id) {
//       result = await pool.query(
//         "SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC",
//         [account_id]
//       );
//     } else {
//       result = await pool.query("SELECT * FROM transactions ORDER BY created_at DESC");
//     }

//     res.json({
//       success: true,
//       count: result.rows.length,
//       transactions: result.rows,
//     });
//   } catch (err) {
//     console.error("List transactions error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ✅ Get transactions by accountId (Step 5c)
// router.get("/:accountId", async (req, res) => {
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
//     console.error("Error fetching transactions:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// export default router;

// import express from "express";
// import { pool } from "../db.js";
// import logger from "../logger.js";

// const router = express.Router();

// // ✅ List all or filter by account_id (?account_id=)
// router.get("/", async (req, res) => {
//   try {
//     const { account_id } = req.query;
//     let result;

//     if (account_id) {
//       result = await pool.query(
//         "SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC",
//         [account_id]
//       );
//     } else {
//       result = await pool.query("SELECT * FROM transactions ORDER BY created_at DESC");
//     }

//     res.json({
//       success: true,
//       count: result.rows.length,
//       transactions: result.rows,
//     });
//   } catch (err) {
//     logger.error("List transactions error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ✅ Get all transactions for a given account
// router.get("/account/:accountId", async (req, res) => {
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
//     logger.error("Error fetching transactions by account ID:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// // ✅ Get transaction by transaction ID
// router.get("/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await pool.query(
//       "SELECT * FROM transactions WHERE txn_id = $1",
//       [id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: `Transaction with ID ${id} not found`,
//       });
//     }

//     res.json({
//       success: true,
//       transaction: result.rows[0],
//     });
//   } catch (err) {
//     logger.error("Error fetching transaction by ID:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

// export default router;

import express from "express";
import { pool } from "../db.js";
import logger from "../logger.js";
import { transactionsTotal, failedTransfersTotal, balanceCheckLatency } from "../server.js";
import { performance } from "perf_hooks";

const router = express.Router();

// ✅ List all or filter by account_id (?account_id=)
router.get("/", async (req, res) => {
  const start = performance.now();

  try {
    const { account_id } = req.query;
    let result;

    if (account_id) {
      result = await pool.query(
        "SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC",
        [account_id]
      );
    } else {
      result = await pool.query("SELECT * FROM transactions ORDER BY created_at DESC");
    }

    const latency = performance.now() - start;
    balanceCheckLatency.observe(latency);

    logger.info({
      correlationId: req.headers["x-correlation-id"],
      path: req.path,
      method: req.method,
      latency_ms: latency.toFixed(2),
      rows_returned: result.rows.length,
    });

    res.json({
      success: true,
      count: result.rows.length,
      transactions: result.rows,
    });
  } catch (err) {
    logger.error({
      msg: "List transactions error",
      error: err.message,
      correlationId: req.headers["x-correlation-id"],
    });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Get all transactions for a given account
router.get("/account/:accountId", async (req, res) => {
  const start = performance.now();
  const { accountId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC",
      [accountId]
    );

    const latency = performance.now() - start;
    balanceCheckLatency.observe(latency);

    if (result.rows.length === 0) {
      logger.warn({
        correlationId: req.headers["x-correlation-id"],
        path: req.path,
        latency_ms: latency.toFixed(2),
        message: `No transactions found for account ID ${accountId}`,
      });
      return res.status(404).json({
        success: false,
        message: `No transactions found for account ID ${accountId}`,
      });
    }

    logger.info({
      correlationId: req.headers["x-correlation-id"],
      path: req.path,
      latency_ms: latency.toFixed(2),
      count: result.rows.length,
    });

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    logger.error({
      msg: "Error fetching transactions by account ID",
      error: err.message,
      correlationId: req.headers["x-correlation-id"],
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Get transaction by transaction ID
router.get("/:id", async (req, res) => {
  const start = performance.now();
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE txn_id = $1",
      [id]
    );

    const latency = performance.now() - start;
    balanceCheckLatency.observe(latency);

    if (result.rows.length === 0) {
      logger.warn({
        correlationId: req.headers["x-correlation-id"],
        path: req.path,
        latency_ms: latency.toFixed(2),
        message: `Transaction with ID ${id} not found`,
      });
      return res.status(404).json({
        success: false,
        message: `Transaction with ID ${id} not found`,
      });
    }

    logger.info({
      correlationId: req.headers["x-correlation-id"],
      path: req.path,
      latency_ms: latency.toFixed(2),
      txn_id: id,
    });

    res.json({
      success: true,
      transaction: result.rows[0],
    });
  } catch (err) {
    logger.error({
      msg: "Error fetching transaction by ID",
      error: err.message,
      correlationId: req.headers["x-correlation-id"],
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
