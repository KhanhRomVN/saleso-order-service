const { getDB } = require("../config/mongoDB");
const { ObjectId } = require("mongodb");
const Joi = require("joi");
const { createError } = require("../services/responseHandler");

const COLLECTION_NAME = "order_log";
const COLLECTION_SCHEMA = Joi.object({
  order_id: Joi.string().required(),
  title: Joi.string().required(),
  content: Joi.string().required(),
  created_at: Joi.date().required(),
});

const handleDBOperation = async (operation) => {
  const db = getDB();
  try {
    return await operation(db.collection(COLLECTION_NAME));
  } catch (error) {
    console.error(`Error in ${operation.name}: `, error);
    throw createError(
      `Database operation failed: ${error.message}`,
      500,
      "DB_OPERATION_FAILED"
    );
  }
};

const OrderLogModel = {
  newOrderLog: async (orderLogData) => {
    return handleDBOperation(async (collection) => {
      const { error } = COLLECTION_SCHEMA.validate(orderLogData);

      if (error) {
        throw createError(
          `Invalid order log data: ${error.message}`,
          400,
          "INVALID_ORDER_LOG_DATA"
        );
      }
      await collection.insertOne(orderLogData, { session });
    });
  },

  getOrderLogByOrderId: async (order_id) => {
    return handleDBOperation(async (collection) => {
      const orderLog = await collection.find({ order_id }).toArray();
      return orderLog;
    });
  },
};

module.exports = OrderLogModel;
