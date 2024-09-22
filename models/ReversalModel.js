const { getDB } = require("../config/mongoDB");
const { ObjectId } = require("mongodb");
const Joi = require("joi");
const { createError } = require("../services/responseHandler");

const COLLECTION_NAME = "reversals";
const COLLECTION_SCHEMA = Joi.object({
  order_id: Joi.string().required(),
  customer_id: Joi.string().required(),
  seller_id: Joi.string().required(),
  reason: Joi.string().required(),
  status: Joi.string().valid("pending", "accepted", "refused").required(),
  created_at: Joi.date().default(Date.now),
  updated_at: Joi.date().default(Date.now),
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

const ReversalModel = {
  createReversal: async (order_id, reason, customer_id, seller_id) => {
    return handleDBOperation(async (collection) => {
      const newReversal = {
        order_id,
        customer_id,
        seller_id,
        reason,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      };
      await collection.insertOne(newReversal);
      return { message: "Reversal created successfully", data: newReversal };
    });
  },

  getReversalByOrderId: async (order_id) => {
    return handleDBOperation(async (collection) => {
      const reversal = await collection.findOne({ order_id });
      return { data: reversal };
    });
  },

  acceptReversal: async (order_id, seller_id) => {
    return handleDBOperation(async (collection) => {
      const result = await collection.findOneAndUpdate(
        { order_id, seller_id, status: "pending" },
        { $set: { status: "accepted", updated_at: new Date() } },
        { returnDocument: "after" }
      );
      if (!result.value) {
        throw createError(
          "Reversal not found or already processed",
          404,
          "REVERSAL_UPDATE_FAILED"
        );
      }
      return { message: "Reversal accepted successfully", data: result.value };
    });
  },

  refuseReversal: async (order_id, seller_id) => {
    return handleDBOperation(async (collection) => {
      const result = await collection.findOneAndUpdate(
        { order_id, seller_id, status: "pending" },
        { $set: { status: "refused", updated_at: new Date() } },
        { returnDocument: "after" }
      );
      if (!result.value) {
        throw createError(
          "Reversal not found or already processed",
          404,
          "REVERSAL_UPDATE_FAILED"
        );
      }
      return { message: "Reversal refused successfully", data: result.value };
    });
  },
};

module.exports = ReversalModel;
