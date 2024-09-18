const { getDB } = require("../config/mongoDB");
const Joi = require("joi");
const { ObjectId } = require("mongodb");

const COLLECTION_NAME = "orders";
const COLLECTION_SCHEMA = Joi.object({
  product_id: Joi.string().required(),
  seller_id: Joi.string().required(),
  customer_id: Joi.string().required(),
  sku: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  shipping_fee: Joi.number().min(0).required(),
  shipping_address: Joi.string().required(),
  applied_discount: Joi.string(),
  total_amount: Joi.number().required(),
  order_status: Joi.string()
    .valid("pending", "accepted", "refused", "reversed")
    .required(),
  create_at: Joi.date().default(Date.now),
  update_at: Joi.date().default(Date.now),
}).options({ abortEarly: false });

const handleDBOperation = async (operation) => {
  const db = getDB();
  try {
    return await operation(db.collection(COLLECTION_NAME));
  } catch (error) {
    console.error(`Error in ${operation.name}: `, error);
    throw error;
  }
};

const OrderModel = {
  createOrders: async (orderItems, customer_id) => {
    return handleDBOperation(async (collection) => {
      const orders = orderItems.map((item) => ({
        ...item,
        customer_id,
        order_status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      }));

      const result = await collection.insertMany(orders);

      return Object.keys(result.insertedIds).map((key) => ({
        seller_id: orders[key].seller_id,
        order_id: result.insertedIds[key].toString(),
      }));
    });
  },

  getListOrder: async (user_id, role, status) => {
    return handleDBOperation(async (collection) => {
      const query = { order_status: status };
      query[role === "customer" ? "customer_id" : "seller_id"] = user_id;

      return await collection.find(query).toArray();
    });
  },

  getOrder: async (order_id) => {
    return handleDBOperation(async (collection) => {
      return await collection.findOne({ _id: new ObjectId(order_id) });
    });
  },

  cancelOrder: async (order_id, customer_id) => {
    return handleDBOperation(async (collection) => {
      await collection.deleteOne({
        _id: new ObjectId(order_id),
        customer_id: customer_id,
      });
      return { message: "Order cancelled successfully" };
    });
  },

  updateOrderStatus: async (order_id, newStatus) => {
    return handleDBOperation(async (collection) => {
      const result = await collection.updateOne(
        { _id: new ObjectId(order_id) },
        { $set: { order_status: newStatus, updated_at: new Date() } }
      );
      if (result.modifiedCount === 0) {
        throw new Error("Order not found or status not changed");
      }
      return { message: "Order status updated successfully" };
    });
  },

  getOrderById: async (order_id) => {
    return handleDBOperation(async (collection) => {
      return await collection.findOne({ _id: new ObjectId(order_id) });
    });
  },

  acceptOrder: async (order_id, seller_id) => {
    return handleDBOperation(async (collection) => {
      const result = await collection.updateOne(
        { _id: new ObjectId(order_id), seller_id: seller_id },
        { $set: { order_status: "accepted", updated_at: new Date() } }
      );
      if (result.modifiedCount === 0) {
        throw new Error("Order not found or status not changed");
      }
      return { message: "Order accepted successfully" };
    });
  },

  refuseOrder: async (order_id, seller_id) => {
    return handleDBOperation(async (collection) => {
      const result = await collection.updateOne(
        { _id: new ObjectId(order_id), seller_id: seller_id },
        { $set: { order_status: "refused", updated_at: new Date() } }
      );
      if (result.modifiedCount === 0) {
        throw new Error("Order not found or status not changed");
      }
      return { message: "Order refused successfully" };
    });
  },
};

module.exports = OrderModel;
