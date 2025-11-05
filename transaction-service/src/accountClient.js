import axios from "axios";
import axiosRetry from "axios-retry";
import CircuitBreaker from "opossum";

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || "http://account-service:8083";

// ✅ Axios client with 2s timeout
const api = axios.create({
  baseURL: ACCOUNT_SERVICE_URL,
  timeout: 2000,
});

// ✅ Retry failed requests up to 3 times (exponential backoff)
axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) =>
    axiosRetry.isNetworkOrIdempotentRequestError(err) || err.code === "ECONNABORTED",
});

// ✅ Circuit breaker wrapper
const circuitOptions = {
  timeout: 3000, // fail fast after 3 s
  errorThresholdPercentage: 50, // trip if 50 % of recent calls failed
  resetTimeout: 10000, // after 10 s try again
};

async function fetchAccountBalance(id) {
  const res = await api.get(`/accounts/${id}/balance`);
  return res.data;
}

async function debitAccount(account_id, amount) {
  const res = await api.post(`/accounts/debit`, { account_id, amount });
  return res.data;
}

async function creditAccount(account_id, amount) {
  const res = await api.post(`/accounts/credit`, { account_id, amount });
  return res.data;
}

// Wrap all calls in a circuit breaker
const breaker = new CircuitBreaker(fetchAccountBalance, circuitOptions);
breaker.fallback(() => ({
  success: false,
  message: "Account Service temporarily unavailable (circuit open)",
}));

export { breaker as fetchAccountBalanceCB, debitAccount, creditAccount };
