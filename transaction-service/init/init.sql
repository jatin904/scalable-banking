-- CREATE TABLE IF NOT EXISTS transactions (
--   txn_id BIGSERIAL PRIMARY KEY,
--   account_id BIGINT NOT NULL,
--   amount NUMERIC(14,2) NOT NULL,
--   txn_type VARCHAR(32) NOT NULL,
--   counterparty VARCHAR(255),
--   reference VARCHAR(255),
--   status VARCHAR(20) DEFAULT 'SUCCESS',
--   created_at TIMESTAMP DEFAULT now()
-- );

-- CREATE TABLE IF NOT EXISTS idempotency_keys (
--   idempotency_key VARCHAR(255) PRIMARY KEY,
--   txn_id BIGINT REFERENCES transactions(txn_id),
--   created_at TIMESTAMP DEFAULT now()
-- );

-- -- 🧱 Create tables
-- CREATE TABLE IF NOT EXISTS transactions (
--   txn_id BIGSERIAL PRIMARY KEY,
--   account_id BIGINT NOT NULL,
--   amount NUMERIC(14,2) NOT NULL,
--   txn_type VARCHAR(32) NOT NULL,
--   counterparty VARCHAR(255),
--   reference VARCHAR(255),
--   status VARCHAR(20) DEFAULT 'SUCCESS',
--   created_at TIMESTAMP DEFAULT now()
-- );

-- CREATE TABLE IF NOT EXISTS idempotency_keys (
--   idempotency_key VARCHAR(255) PRIMARY KEY,
--   txn_id BIGINT,
--   created_at TIMESTAMP DEFAULT now()
-- );

-- -- 📦 Import data from CSV
-- -- Note: The path inside the container is /docker-entrypoint-initdb.d/transactions.csv
-- \copy transactions(txn_id, account_id, amount, txn_type, counterparty, reference, created_at)
-- FROM '/docker-entrypoint-initdb.d/transactions.csv'
-- DELIMITER ','
-- CSV HEADER;

-- ====================================
-- 🏦 Transaction Service Database Setup
-- ====================================

-- 1️⃣ Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  txn_id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  txn_type VARCHAR(32) NOT NULL,
  counterparty VARCHAR(255),
  reference VARCHAR(255),
  status VARCHAR(20) DEFAULT 'SUCCESS',
  created_at TIMESTAMP DEFAULT now()
);

-- 2️⃣ Create idempotency key table
CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  txn_id BIGINT,
  created_at TIMESTAMP DEFAULT now()
);

-- ====================================
-- 🗃 CSV Import Section (server-side COPY)
-- ====================================

DO
$$
BEGIN
  BEGIN
    RAISE NOTICE '📥 Importing transactions from CSV (server COPY)...';
    EXECUTE $cmd$
      COPY transactions (txn_id, account_id, amount, txn_type, counterparty, reference, created_at)
      FROM '/docker-entrypoint-initdb.d/transactions.csv'
      WITH (FORMAT csv, HEADER true, DELIMITER ',');
    $cmd$;
    RAISE NOTICE '✅ CSV import completed successfully.';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ CSV import skipped or failed: %', SQLERRM;
  END;
END;
$$;

-- ✅ Fix sequence sync after CSV import
DO
$$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'transactions_txn_id_seq'
    ) THEN
        RAISE NOTICE '🔧 Adjusting transactions_txn_id_seq to match current max(txn_id)';
        PERFORM setval('transactions_txn_id_seq', (SELECT COALESCE(MAX(txn_id), 0) + 1 FROM transactions));
    END IF;
END;
$$;
