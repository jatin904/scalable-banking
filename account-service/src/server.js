// import express from "express";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();
// app.use(express.json());

// // Mock accounts data
// const accounts = [
//   { account_id: 10, balance: 25000, status: "ACTIVE" },
//   { account_id: 11, balance: 500, status: "FROZEN" },
//   { account_id: 12, balance: 200000, status: "ACTIVE" },
// ];

// // Health check
// app.get("/health", (req, res) => {
//   res.json({ status: "Account Service running" });
// });

// // Check account balance
// app.get("/accounts/:id/balance", (req, res) => {
//   const id = parseInt(req.params.id);
//   const account = accounts.find((a) => a.account_id === id);
//   if (!account) {
//     return res.status(404).json({ success: false, message: "Account not found" });
//   }
//   res.json({ success: true, account_id: id, balance: account.balance, status: account.status });
// });

// // Mock debit/credit endpoints (for Transaction service)
// app.post("/accounts/debit", (req, res) => {
//   const { account_id, amount } = req.body;
//   const account = accounts.find((a) => a.account_id === account_id);
//   if (!account) return res.status(404).json({ success: false, message: "Account not found" });
//   if (account.status !== "ACTIVE") return res.status(403).json({ success: false, message: "Account frozen" });
//   if (account.balance < amount) return res.status(400).json({ success: false, message: "Insufficient balance" });

//   account.balance -= amount;
//   res.json({ success: true, balance: account.balance });
// });

// app.post("/accounts/credit", (req, res) => {
//   const { account_id, amount } = req.body;
//   const account = accounts.find((a) => a.account_id === account_id);
//   if (!account) return res.status(404).json({ success: false, message: "Account not found" });
//   if (account.status !== "ACTIVE") return res.status(403).json({ success: false, message: "Account frozen" });

//   account.balance += amount;
//   res.json({ success: true, balance: account.balance });
// });

// const port = process.env.PORT || 8083;
// app.listen(port, () => console.log(`Account Service running on port ${port}`));

import express from "express";
import dotenv from "dotenv";
import { correlationIdMiddleware } from "./middleware/correlationId.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(correlationIdMiddleware); // 🧩 add this line

// Mock accounts data
const accounts = [
  { account_id: 10, balance: 25000, status: "ACTIVE" },
  { account_id: 11, balance: 500, status: "FROZEN" },
  { account_id: 12, balance: 200000, status: "ACTIVE" },
];

// Simple logger
function log(message, req) {
  console.log(`[${new Date().toISOString()}] ${message} | correlationId=${req.correlationId}`);
}

// Health check
app.get("/health", (req, res) => {
  log("Health check accessed", req);
  res.json({ status: "Account Service running" });
});

// Check account balance
app.get("/accounts/:id/balance", (req, res) => {
  const id = parseInt(req.params.id);
  const account = accounts.find((a) => a.account_id === id);
  if (!account) {
    log(`Account ${id} not found`, req);
    return res.status(404).json({ success: false, message: "Account not found" });
  }
  log(`Fetched balance for Account ${id}`, req);
  res.json({ success: true, account_id: id, balance: account.balance, status: account.status });
});

// Debit endpoint
app.post("/accounts/debit", (req, res) => {
  const { account_id, amount } = req.body;
  const account = accounts.find((a) => a.account_id === account_id);
  if (!account) {
    log(`Debit failed: Account ${account_id} not found`, req);
    return res.status(404).json({ success: false, message: "Account not found" });
  }
  if (account.status !== "ACTIVE") {
    log(`Debit failed: Account ${account_id} frozen`, req);
    return res.status(403).json({ success: false, message: "Account frozen" });
  }
  if (account.balance < amount) {
    log(`Debit failed: Insufficient balance in Account ${account_id}`, req);
    return res.status(400).json({ success: false, message: "Insufficient balance" });
  }

  account.balance -= amount;
  log(`Debited ₹${amount} from Account ${account_id}`, req);
  res.json({ success: true, balance: account.balance });
});

// Credit endpoint
app.post("/accounts/credit", (req, res) => {
  const { account_id, amount } = req.body;
  const account = accounts.find((a) => a.account_id === account_id);
  if (!account) {
    log(`Credit failed: Account ${account_id} not found`, req);
    return res.status(404).json({ success: false, message: "Account not found" });
  }
  if (account.status !== "ACTIVE") {
    log(`Credit failed: Account ${account_id} frozen`, req);
    return res.status(403).json({ success: false, message: "Account frozen" });
  }

  account.balance += amount;
  log(`Credited ₹${amount} to Account ${account_id}`, req);
  res.json({ success: true, balance: account.balance });
});

const port = process.env.PORT || 8083;
app.listen(port, () => console.log(`🏦 Account Service running on port ${port}`));
