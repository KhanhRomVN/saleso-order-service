const { getDB } = require("../config/mongoDB");
const { ObjectId } = require("mongodb");
const Joi = require("joi");

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
    throw error;
  }
};

const ReversalModel = {
  reversalOrder: async (reversalData) => {
    return handleDBOperation(async (collection) => {
      const { error } = COLLECTION_SCHEMA.validate(reversalData);
      if (error) throw new Error(error.details[0].message);
      await collection.insertOne(reversalData);
    });
  },

  getListReversal: async (seller_id, status) => {
    return handleDBOperation(async (collection) => {
      return await collection.find({ seller_id, status }).toArray();
    });
  },

  getReversalById: async (reversal_id) => {
    return handleDBOperation(async (collection) => {
      return await collection.findOne({ _id: new ObjectId(reversal_id) });
    });
  },

  getReversalByOrderId: async (order_id) => {
    return handleDBOperation(async (collection) => {
      return await collection.findOne({ order_id });
    });
  },

  acceptReversal: async (order_id) => {
    return handleDBOperation(async (collection) => {
      await collection.updateOne(
        { order_id },
        { $set: { status: "accepted" } }
      );
    });
  },

  refuseReversal: async (order_id) => {
    return handleDBOperation(async (collection) => {
      await collection.updateOne({ order_id }, { $set: { status: "refused" } });
    });
  },
};

module.exports = ReversalModel;
