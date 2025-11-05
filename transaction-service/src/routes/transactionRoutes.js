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

import express from "express";
import { pool } from "../db.js";
import logger from "../logger.js";

const router = express.Router();

// ✅ List all or filter by account_id (?account_id=)
router.get("/", async (req, res) => {
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

    res.json({
      success: true,
      count: result.rows.length,
      transactions: result.rows,
    });
  } catch (err) {
    logger.error("List transactions error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Get all transactions for a given account
router.get("/account/:accountId", async (req, res) => {
  const { accountId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE account_id = $1 ORDER BY created_at DESC",
      [accountId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No transactions found for account ID ${accountId}`,
      });
    }

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    logger.error("Error fetching transactions by account ID:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Get transaction by transaction ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM transactions WHERE txn_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Transaction with ID ${id} not found`,
      });
    }

    res.json({
      success: true,
      transaction: result.rows[0],
    });
  } catch (err) {
    logger.error("Error fetching transaction by ID:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
