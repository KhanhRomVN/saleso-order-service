const amqp = require("amqplib");

const sendGetVariantBySku = async (sku) => {
  let connection;
  let channel;
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    const queue = "get_variant_by_sku_queue";
    const correlationId = generateUuid();

    return new Promise((resolve, reject) => {
      const replyQueue = "amq.rabbitmq.reply-to";

      channel.consume(
        replyQueue,
        (msg) => {
          if (msg.properties.correlationId === correlationId) {
            const content = JSON.parse(msg.content.toString());
            if (content.error) {
              reject(new Error(content.error));
            } else {
              resolve(content);
            }
            channel.close();
            connection.close();
          }
        },
        { noAck: true }
      );

      channel.sendToQueue(queue, Buffer.from(JSON.stringify({ sku })), {
        correlationId: correlationId,
        replyTo: replyQueue,
      });
    });
  } catch (error) {
    console.error("Error in getVariantBySku producer:", error);
    if (channel) await channel.close();
    if (connection) await connection.close();
    throw error;
  }
};

function generateUuid() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

module.exports = { sendGetVariantBySku };
