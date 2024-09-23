const amqp = require("amqplib");

const updateValueAnalyticProduct = async (product_id, key, value) => {
  let connection;
  let channel;
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    const queue = "update_product_analytic_queue";

    await channel.assertQueue(queue, { durable: true });

    channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify({ product_id, key, value })),
      { persistent: true }
    );
  } catch (error) {
    console.error("Error in updateValueAnalyticProduct producer:", error);
    throw error;
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
};

module.exports = { updateValueAnalyticProduct };
