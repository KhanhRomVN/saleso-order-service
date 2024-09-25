const amqp = require("amqplib");

const getProductById = async (productId) => {
  let connection;
  let channel;
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    const queue = "get_product_by_id_queue";
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

      channel.sendToQueue(queue, Buffer.from(JSON.stringify({ productId })), {
        correlationId: correlationId,
        replyTo: replyQueue,
      });
    });
  } catch (error) {
    console.error("Error in getProductByIdProducer:", error);
    if (channel) await channel.close();
    if (connection) await connection.close();
    throw error;
  }
};

const updateStockProduct = async (productId, stockValue, sku) => {
  let connection;
  let channel;
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    const queue = "update_stock_queue";
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

      channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify({ productId, stockValue, sku })),
        {
          correlationId: correlationId,
          replyTo: replyQueue,
        }
      );
    });
  } catch (error) {
    console.error("Error in updateStockProductProducer:", error);
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

module.exports = { getProductById, updateStockProduct };
