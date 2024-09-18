const {
  ReturnModel,
  OrderModel,
  UserModel,
  ReversalModel,
  ProductModel,
  RefundModel,
} = require("../models");
const logger = require("../config/logger");

const handleRequest = async (req, res, operation) => {
  try {
    const result = await operation(req);
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error in ${operation.name}: ${error}`);
    res
      .status(error.status || 500)
      .json({ error: error.message || "Internal Server Error" });
  }
};

const ReversalController = {
  reversalOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const { order_id } = req.params;
      const { reason } = req.body;
      const order = await OrderModel.getOrderById(order_id);
      if (order.customer_id !== customer_id) {
        return { error: "You do not have authority to return this order" };
      }
      const reversalData = {
        order_id,
        customer_id,
        seller_id: order.seller_id,
        reason,
        status: "pending",
      };
      await ReversalModel.reversalOrder(reversalData);
      return { message: "Your return request has been successful" };
    }),

  getListReversal: (req, res) =>
    handleRequest(req, res, async (req) => {
      const seller_id = req.user._id.toString();
      const { status } = req.params;
      return await ReversalModel.getListReversal(seller_id, status);
    }),

  getReversal: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { reversal_id } = req.params;
      const seller_id = req.user._id.toString();
      const reversal = await ReversalModel.getReversalById(reversal_id);
      if (reversal.seller_id !== seller_id) {
        return { error: "You do not have authority to view this return" };
      }
      return reversal;
    }),

  acceptReversal: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const seller_id = req.user._id.toString();
      const reversal = await ReversalModel.getReversalByOrderId(order_id);
      if (reversal.seller_id !== seller_id) {
        return { error: "You do not have authority to accept this return" };
      }
      return await ReversalModel.acceptReversal(order_id);
    }),

  refuseReversal: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const seller_id = req.user._id.toString();
      const reversal = await ReversalModel.getReversalByOrderId(order_id);
      if (reversal.seller_id !== seller_id) {
        return { error: "You do not have authority to refuse this return" };
      }
      return await ReversalModel.refuseReversal(order_id);
    }),
};

module.exports = ReversalController;
