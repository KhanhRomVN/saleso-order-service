const { startGetTop5CustomerAnalytic } = require("./consumers/order-consumer");

const runAllConsumers = async () => {
  await startGetTop5CustomerAnalytic();
};

module.exports = {
  runAllConsumers,
};
