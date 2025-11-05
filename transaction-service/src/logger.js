// import pino from "pino";

// const logger = pino({
//   transport: {
//     target: "pino-pretty",
//     options: { colorize: true, translateTime: "SYS:standard" }
//   },
//   level: process.env.LOG_LEVEL || "info",
// });

// export default logger;

import pino from "pino";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
  base: { service: "transaction-service" },
});

export default logger;
