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
  reversalOrder: async (reversalData) => {
    return handleDBOperation(async (collection) => {
      const { error } = COLLECTION_SCHEMA.validate(reversalData);
      if (error)
        throw createError(error.details[0].message, 400, "VALIDATION_ERROR");

      const result = await collection.insertOne(reversalData);
      if (!result.insertedId) {
        throw createError(
          "Failed to create reversal",
          500,
          "REVERSAL_CREATION_FAILED"
        );
      }
      return {
        message: "Reversal created successfully",
        reversal_id: result.insertedId,
      };
    });
  },

  getListReversal: async (seller_id, status) => {
    return handleDBOperation(async (collection) => {
      if (!seller_id || !status) {
        throw createError(
          "Seller ID and status are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const reversals = await collection.find({ seller_id, status }).toArray();
      if (reversals.length === 0) {
        return []; // Return an empty array if no reversals found
      }
      return reversals;
    });
  },

  getReversalById: async (reversal_id) => {
    return handleDBOperation(async (collection) => {
      if (!reversal_id) {
        throw createError(
          "Reversal ID is required",
          400,
          "MISSING_REVERSAL_ID"
        );
      }
      const reversal = await collection.findOne({
        _id: new ObjectId(reversal_id),
      });
      if (!reversal) {
        throw createError("Reversal not found", 404, "REVERSAL_NOT_FOUND");
      }
      return reversal;
    });
  },

  getReversalByOrderId: async (order_id) => {
    return handleDBOperation(async (collection) => {
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const reversal = await collection.findOne({ order_id });
      if (!reversal) {
        throw createError(
          "Reversal not found for this order",
          404,
          "REVERSAL_NOT_FOUND"
        );
      }
      return reversal;
    });
  },

  acceptReversal: async (order_id) => {
    return handleDBOperation(async (collection) => {
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const result = await collection.updateOne(
        { order_id },
        { $set: { status: "accepted", updated_at: new Date() } }
      );
      if (result.modifiedCount === 0) {
        throw createError(
          "Reversal not found or already accepted",
          404,
          "REVERSAL_UPDATE_FAILED"
        );
      }
      return { message: "Reversal accepted successfully" };
    });
  },

  refuseReversal: async (order_id) => {
    return handleDBOperation(async (collection) => {
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const result = await collection.updateOne(
        { order_id },
        { $set: { status: "refused", updated_at: new Date() } }
      );
      if (result.modifiedCount === 0) {
        throw createError(
          "Reversal not found or already refused",
          404,
          "REVERSAL_UPDATE_FAILED"
        );
      }
      return { message: "Reversal refused successfully" };
    });
  },
};

module.exports = ReversalModel;
