const { getDB } = require("../config/mongoDB");
const Joi = require("joi");
const { ObjectId } = require("mongodb");

const COLLECTION_NAME = "payments";
const COLLECTION_SCHEMA = Joi.object({
  order_id: Joi.string().required(),
  method: Joi.string().valid("prepaid", "postpaid").required(),
  status: Joi.string().valid("pending", "completed", "failed").required(),
  created_at: Joi.date().default(Date.now),
  updated_at: Joi.date().default(Date.now),
}).options({ abortEarly: false });

const validateInvoice = (invoiceData) => {
  const { error } = COLLECTION_SCHEMA.validate(invoiceData);
  if (error) throw error;
};

const handleDBOperation = async (operation) => {
  const db = getDB();
  try {
    return await operation(db.collection(COLLECTION_NAME));
  } catch (error) {
    console.error(`Error in ${operation.name}: `, error);
    throw error;
  }
};

const PaymentModel = {
  // when customer create order
  createPayment: async (paymentData, session) => {
    return handleDBOperation(async (collection) => {
      console.log(paymentData);
      const payment = {
        order_id: new ObjectId(paymentData.order_id),
        customer_id: new ObjectId(paymentData.customer_id),
        seller_id: new ObjectId(paymentData.seller_id),
        method: paymentData.method || "prepaid",
        status: paymentData.status || "pending",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await collection.insertOne(payment, { session });

      return {
        message: "Payment created successfully",
        payment_id: result.insertedId.toString(),
      };
    });
  },

  getPayment: async (order_id) => {
    return handleDBOperation(async (collection) => {
      return await collection.findOne({ order_id: order_id });
    });
  },

  // when seller accepted order or refused order
  updateStatus: async (payment_id, newStatus) => {
    return handleDBOperation(async (collection) => {
      const result = await collection.updateOne(
        { _id: new ObjectId(payment_id) },
        { $set: { payment_status: newStatus, updated_at: new Date() } }
      );
      if (result.modifiedCount === 0) {
        throw new Error("Payment not found or status not changed");
      }
      return { message: "Payment status updated successfully" };
    });
  },
};

module.exports = PaymentModel;
