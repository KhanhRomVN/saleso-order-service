const { OrderLogModel } = require("../models");
const { handleRequest } = require("../services/responseHandler");

const OrderLogController = {
  getOrderLogByOrderId: async (req, res) => {
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const orderLog = await OrderLogModel.getOrderLogByOrderId(order_id);
      return orderLog;
    });
  },
};

module.exports = OrderLogController;
