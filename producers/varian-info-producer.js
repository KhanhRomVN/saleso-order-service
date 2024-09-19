const amqp = require("amqplib");
require("dotenv").config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const VARIANT_INFO_QUEUE = "variant_info_queue";

async function getVariantInfo(sku) {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(VARIANT_INFO_QUEUE, { durable: false });

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

      channel.sendToQueue(VARIANT_INFO_QUEUE, Buffer.from(sku), {
        correlationId: correlationId,
        replyTo: "amq.rabbitmq.reply-to",
      });
    });
  } catch (error) {
    console.error("Error in getVariantInfo:", error);
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

module.exports = { getVariantInfo };
