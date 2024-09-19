const amqp = require("amqplib");
require("dotenv").config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const PRODUCT_INFO_QUEUE = "product_info_queue";

async function getProductInfo(productId) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(PRODUCT_INFO_QUEUE, { durable: false });

    const correlationId = generateUuid();

    return new Promise((resolve, reject) => {
      channel.consume(
        "amq.rabbitmq.reply-to",
        (msg) => {
          if (msg.properties.correlationId === correlationId) {
            resolve(JSON.parse(msg.content.toString()));
            setTimeout(() => {
              connection.close();
            }, 500);
          }
        },
        { noAck: true }
      );

      channel.sendToQueue(PRODUCT_INFO_QUEUE, Buffer.from(productId), {
        correlationId: correlationId,
        replyTo: "amq.rabbitmq.reply-to",
      });
    });
  } catch (error) {
    console.error("Error in getProductInfo:", error);
    throw error;
  }
}

function generateUuid() {
  return (
    Math.random().toString() +
    Math.random().toString() +
    Math.random().toString()
  );
}

module.exports = { getProductInfo };
