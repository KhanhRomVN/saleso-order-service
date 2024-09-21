const amqp = require("amqplib");

const getVariantBySku = async (sku) => {
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

const updateVariantStock = async (sku, quantity) => {
  let connection;
  let channel;
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    const queue = "update_variant_stock_queue";

    await channel.assertQueue(queue, { durable: true });

    channel.sendToQueue(queue, Buffer.from(JSON.stringify({ sku, quantity })), {
      persistent: true,
    });

    console.log(
      `Sent update stock request for SKU: ${sku}, Quantity: ${quantity}`
    );
  } catch (error) {
    console.error("Error in updateVariantStock producer:", error);
    throw error;
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
};

function generateUuid() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

module.exports = { getVariantBySku, updateVariantStock };
