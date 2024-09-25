const { getDB } = require("../config/mongoDB");
const Joi = require("joi");
const { ObjectId } = require("mongodb");
const { createError } = require("../services/responseHandler");

const COLLECTION_NAME = "payments";
const COLLECTION_SCHEMA = Joi.object({
  order_id: Joi.string().required(),
  customer_id: Joi.string().required(),
  seller_id: Joi.string().required(),
  method: Joi.string().valid("prepaid", "postpaid").required(),
  status: Joi.string().valid("unpaid", "paid").required(),
  created_at: Joi.date().default(Date.now),
  updated_at: Joi.date().default(Date.now),
}).options({ abortEarly: false });

const validatePayment = (paymentData) => {
  const { error } = COLLECTION_SCHEMA.validate(paymentData);
  if (error)
    throw createError(error.details[0].message, 400, "VALIDATION_ERROR");
};

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

const PaymentModel = {
  // when customer create order
  createPayment: async (paymentData) => {
    return handleDBOperation(async (collection) => {
      const payment = {
        order_id: paymentData.order_id,
        customer_id: paymentData.customer_id,
        seller_id: paymentData.seller_id,
        method: paymentData.method,
        status: paymentData.status,
        created_at: new Date(),
        updated_at: new Date(),
      };

      validatePayment(payment);
      await collection.insertOne(payment);
    });
  },

  getPayment: async (order_id) => {
    return handleDBOperation(async (collection) => {
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }

      const payment = await collection.findOne({
        order_id,
      });

      if (!payment) {
        throw createError("Payment not found", 404, "PAYMENT_NOT_FOUND");
      }

      return payment;
    });
  },

  // when seller accepted order or refused order
  updateStatus: async (payment_id, newStatus) => {
    return handleDBOperation(async (collection) => {
      if (!payment_id || !newStatus) {
        throw createError(
          "Payment ID and new status are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(payment_id) },
        { $set: { status: newStatus, updated_at: new Date() } }
      );

      if (result.modifiedCount === 0) {
        throw createError(
          "Payment not found or status not changed",
          404,
          "PAYMENT_UPDATE_FAILED"
        );
      }

      return { message: "Payment status updated successfully" };
    });
  },
};

module.exports = PaymentModel;
