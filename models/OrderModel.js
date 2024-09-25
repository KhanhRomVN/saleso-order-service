const { getDB } = require("../config/mongoDB");
const Joi = require("joi");
const { ObjectId } = require("mongodb");
const { createError } = require("../services/responseHandler");

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
    .valid("pending", "accepted", "refused", "reversed", "cancelled")
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
    throw createError(
      `Database operation failed: ${error.message}`,
      500,
      "DB_OPERATION_FAILED"
    );
  }
};

const OrderModel = {
  createOrders: async (orderItems, customer_id) => {
    return handleDBOperation(async (collection) => {
      if (!Array.isArray(orderItems) || orderItems.length === 0) {
        throw createError("Invalid order items", 400, "INVALID_ORDER_ITEMS");
      }
      if (!customer_id) {
        throw createError(
          "Customer ID is required",
          400,
          "MISSING_CUSTOMER_ID"
        );
      }

      const orders = orderItems.map((item) => ({
        ...item,
        customer_id,
        order_status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      }));

      const result = await collection.insertMany(orders);

      if (result.insertedCount === 0) {
        throw createError(
          "Failed to create orders",
          500,
          "ORDER_CREATION_FAILED"
        );
      }

      return Object.keys(result.insertedIds).map((key) => ({
        seller_id: orders[key].seller_id,
        order_id: result.insertedIds[key].toString(),
      }));
    });
  },

  getListOrder: async (user_id, role, status) => {
    return handleDBOperation(async (collection) => {
      if (!user_id || !role || !status) {
        throw createError(
          "User ID, role, and status are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }

      const query = { order_status: status };
      query[role === "customer" ? "customer_id" : "seller_id"] = user_id;

      const orders = await collection.find(query).toArray();
      if (orders.length === 0) {
        return []; // Return an empty array if no orders found
      }
      return orders;
    });
  },

  getOrderById: async (order_id) => {
    return handleDBOperation(async (collection) => {
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const order = await collection.findOne({ _id: new ObjectId(order_id) });
      if (!order) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      return order;
    });
  },

  cancelOrder: async (order_id, customer_id) => {
    return handleDBOperation(async (collection) => {
      if (!order_id || !customer_id) {
        throw createError(
          "Order ID and Customer ID are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      await collection.updateOne(
        { _id: new ObjectId(order_id), customer_id: customer_id },
        { $set: { order_status: "cancelled", updated_at: new Date() } }
      );
    });
  },

  acceptOrder: async (order_id, seller_id) => {
    return handleDBOperation(async (collection) => {
      if (!order_id || !seller_id) {
        throw createError(
          "Order ID and Seller ID are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const result = await collection.updateOne(
        { _id: new ObjectId(order_id), seller_id: seller_id },
        { $set: { order_status: "accepted", updated_at: new Date() } }
      );
      if (result.modifiedCount === 0) {
        throw createError(
          "Order not found or already accepted",
          404,
          "ORDER_UPDATE_FAILED"
        );
      }
      return { message: "Order accepted successfully" };
    });
  },

  refuseOrder: async (order_id, seller_id) => {
    return handleDBOperation(async (collection) => {
      if (!order_id || !seller_id) {
        throw createError(
          "Order ID and Seller ID are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const result = await collection.updateOne(
        { _id: new ObjectId(order_id), seller_id: seller_id },
        { $set: { order_status: "refused", updated_at: new Date() } }
      );
      if (result.modifiedCount === 0) {
        throw createError(
          "Order not found or already refused",
          404,
          "ORDER_UPDATE_FAILED"
        );
      }
      return { message: "Order refused successfully" };
    });
  },

  getTop5CustomerAnalytic: async (seller_id) => {
    return handleDBOperation(async (collection) => {
      if (!seller_id) {
        throw createError("Seller ID is required", 400, "MISSING_SELLER_ID");
      }

      const pipeline = [
        {
          $match: {
            seller_id: seller_id,
            order_status: "accepted",
          },
        },
        {
          $group: {
            _id: "$customer_id",
            total_amount: { $sum: "$total_amount" },
          },
        },
        {
          $sort: { total_amount: -1 },
        },
        {
          $limit: 5,
        },
        {
          $project: {
            customer_id: "$_id",
            total_amount: 1,
            _id: 0,
          },
        },
      ];

      const result = await collection.aggregate(pipeline).toArray();
      return result;
    });
  },
};

module.exports = OrderModel;
