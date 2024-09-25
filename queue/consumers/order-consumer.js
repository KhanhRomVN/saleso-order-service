const amqp = require("amqplib");
const { OrderModel } = require("../../models");

const startGetTop5CustomerAnalytic = async () => {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  const queue = "top5_customer_analytic_queue";

  await channel.assertQueue(queue, { durable: false });

  channel.consume(queue, async (msg) => {
    const seller_id = msg.content.toString();

    try {
      const result = await OrderModel.getTop5CustomerAnalytic(seller_id);

      channel.sendToQueue(
        msg.properties.replyTo,
        Buffer.from(JSON.stringify(result)),
        {
          correlationId: msg.properties.correlationId,
        }
      );

      channel.ack(msg);
    } catch (error) {
      console.error("Error processing message:", error);
      channel.nack(msg);
    }
  });
};

module.exports = {
  startGetTop5CustomerAnalytic,
};
