// import amqp from "amqplib";

// let channel;

// export async function connectQueue() {
//   const amqpServer = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq:5672";
//   const connection = await amqp.connect(amqpServer);
//   channel = await connection.createChannel();
//   console.log("✅ Connected to RabbitMQ");
//   return channel;
// }

// export function getChannel() {
//   if (!channel) throw new Error("RabbitMQ channel not initialized");
//   return channel;
// }
// src/messageQueue.js
// import amqplib from "amqplib";

// let channel;

// export const connectQueue = async () => {
//   try {
//     const connection = await amqplib.connect(process.env.RABBITMQ_URL);
//     channel = await connection.createChannel();
//     await channel.assertQueue("transaction_events", { durable: true });

//     console.log("✅ Connected to RabbitMQ");
//   } catch (err) {
//     console.error("❌ RabbitMQ connection failed. Retrying in 5s...", err.message);
//     setTimeout(connectQueue, 5000);
//   }
// };

// export const getChannel = () => channel;

// export const publishToQueue = async (queue, message) => {
//   if (!channel) {
//     console.error("RabbitMQ publish error: RabbitMQ channel not initialized");
//     return;
//   }
//   await channel.assertQueue(queue);
//   channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
//   console.log(`📤 Message published to queue [${queue}]`);
// };


import amqplib from "amqplib";

let channel;

export const connectQueue = async () => {
  try {
    const connection = await amqplib.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // 🟢 Declare the queue with persistence options
    await channel.assertQueue("transaction_events", {
      durable: true,      // survive RabbitMQ restarts
      autoDelete: false,  // don’t remove when empty
    });

    console.log("✅ Connected to RabbitMQ and ensured durable queue");
  } catch (err) {
    console.error("❌ RabbitMQ connection failed. Retrying in 5s...", err.message);
    setTimeout(connectQueue, 5000);
  }
};

export const getChannel = () => channel;

export const publishToQueue = async (queue, message) => {
  if (!channel) {
    console.error("❌ RabbitMQ publish error: channel not initialized");
    return;
  }

  // 🟢 Reassert queue (in case publisher runs before consumer)
  await channel.assertQueue(queue, {
    durable: true,
    autoDelete: false,
  });

  // 🟢 Send persistent message
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });

  console.log(`📤 Message published to queue [${queue}]`);
};
