// import amqp from "amqplib";
// import express from "express";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();
// app.use(express.json());

// const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
// const QUEUE = "transaction_events";

// async function startConsumer() {
//   try {
//     console.log("⏳ Connecting to RabbitMQ...");
//     const connection = await amqp.connect(RABBITMQ_URL);
//     const channel = await connection.createChannel();
//     await channel.assertQueue(QUEUE, { durable: true });

//     console.log(`✅ Connected. Waiting for messages in queue: ${QUEUE}`);

//     channel.consume(
//       QUEUE,
//       (msg) => {
//         if (msg !== null) {
//           const content = msg.content.toString();
//           const event = JSON.parse(content);
//           console.log(`📩 Received event: ${event.type}`);

//           if (event.type === "TRANSFER_COMPLETED") {
//             console.log(
//               `💸 Transfer completed from Account #${event.sender.account_id} → Account #${event.receiver.account_id} (₹${event.sender.amount})`
//             );
//           } else if (event.type === "DEPOSIT_CREATED") {
//             console.log(
//               `🏦 Deposit received for Account #${event.transaction.account_id} (₹${event.transaction.amount})`
//             );
//           } else {
//             console.log("ℹ️ Unknown event:", event);
//           }

//           channel.ack(msg);
//         }
//       },
//       { noAck: false }
//     );
//   } catch (err) {
//     console.error("❌ RabbitMQ Consumer Error:", err.message);
//     setTimeout(startConsumer, 5000); // retry after 5 sec
//   }
// }

// // Start listening to RabbitMQ
// startConsumer();

// // Optional: Health endpoint
// app.get("/health", (req, res) => {
//   res.json({ status: "Notification Service running" });
// });

// const port = process.env.PORT || 8084;
// app.listen(port, () => console.log(`📬 Notification Service running on port ${port}`));

// import amqp from "amqplib";
// import express from "express";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();
// app.use(express.json());

// const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
// const QUEUE = "transaction_events";

// async function startConsumer() {
//   try {
//     console.log("⏳ Connecting to RabbitMQ...");
//     const connection = await amqp.connect(RABBITMQ_URL);
//     const channel = await connection.createChannel();
//     await channel.assertQueue(QUEUE, { durable: true });

//     console.log(`✅ Connected. Waiting for messages in queue: ${QUEUE}`);

//     channel.consume(
//       QUEUE,
//       (msg) => {
//         if (msg !== null) {
//           const content = msg.content.toString();
//           const event = JSON.parse(content);
//           console.log(`📩 Received event: ${event.type}`);

//           if (event.type === "TRANSFER_COMPLETED") {
//             console.log(
//               `💸 Transfer completed from Account #${event.sender.account_id} → Account #${event.receiver.account_id} (₹${event.sender.amount})`
//             );
//           } else if (event.type === "DEPOSIT_CREATED") {
//             console.log(
//               `🏦 Deposit received for Account #${event.transaction.account_id} (₹${event.transaction.amount})`
//             );
//           } else {
//             console.log("ℹ️ Unknown event:", event);
//           }

//           // ⏳ Simulate slow processing so message stays visible in queue
//           setTimeout(() => {
//             channel.ack(msg);
//             console.log("✅ Message acknowledged");
//           }, 5000); // message will stay “unacked” for 5 seconds
//         }
//       },
//       { noAck: false }
//     );
//   } catch (err) {
//     console.error("❌ RabbitMQ Consumer Error:", err.message);
//     setTimeout(startConsumer, 5000); // retry after 5 sec
//   }
// }

// // Start listening to RabbitMQ
// startConsumer();

// // Optional: Health endpoint
// app.get("/health", (req, res) => {
//   res.json({ status: "Notification Service running" });
// });

// const port = process.env.PORT || 8084;
// app.listen(port, () => console.log(`📬 Notification Service running on port ${port}`));

import amqp from "amqplib";
import express from "express";
import dotenv from "dotenv";
import pino from "pino";

dotenv.config();

const app = express();
app.use(express.json());

// 🧩 Setup Logger
const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
  base: { service: "notification-service" },
});

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
const QUEUE = "transaction_events";

async function startConsumer() {
  try {
    logger.info(`⏳ Connecting to RabbitMQ at ${RABBITMQ_URL} ...`);
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE, { durable: true });

    logger.info(`✅ Connected to RabbitMQ. Listening on queue: ${QUEUE}`);

    channel.consume(
      QUEUE,
      (msg) => {
        if (msg !== null) {
          try {
            const content = msg.content.toString();
            const event = JSON.parse(content);

            const correlationId = event.transaction?.correlationId || "N/A";

            logger.info({
              eventType: event.type,
              correlationId,
            }, `📩 Received event from queue`);

            if (event.type === "TRANSFER_COMPLETED") {
              logger.info(
                {
                  correlationId,
                  from: event.sender.account_id,
                  to: event.receiver.account_id,
                  amount: event.sender.amount,
                },
                `💸 Transfer completed from Account #${event.sender.account_id} → Account #${event.receiver.account_id} (₹${event.sender.amount})`
              );
            } else if (event.type === "DEPOSIT_CREATED") {
              logger.info(
                {
                  correlationId,
                  account: event.transaction.account_id,
                  amount: event.transaction.amount,
                },
                `🏦 Deposit received for Account #${event.transaction.account_id} (₹${event.transaction.amount})`
              );
            } else {
              logger.warn({ event }, "ℹ️ Unknown event type");
            }

            // Acknowledge after small delay (simulate slow processing)
            setTimeout(() => {
              channel.ack(msg);
              logger.info({ correlationId }, "✅ Message acknowledged");
            }, 2000);
          } catch (err) {
            logger.error({ err }, "❌ Failed to process message");
            channel.nack(msg, false, false); // discard bad message
          }
        }
      },
      { noAck: false }
    );
  } catch (err) {
    logger.error({ error: err.message }, "❌ RabbitMQ Consumer Error");
    setTimeout(startConsumer, 5000); // retry after 5 sec
  }
}

// Start listening to RabbitMQ
startConsumer();

// Health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "Notification Service running" });
});

const port = process.env.PORT || 8084;
app.listen(port, () =>
  logger.info(`📬 Notification Service running on port ${port}`)
);
