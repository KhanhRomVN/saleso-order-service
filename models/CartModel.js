const { getDB } = require("../config/mongoDB");
const { ObjectId } = require("mongodb");
const cron = require("node-cron");
const Joi = require("joi");
const { createError } = require("../services/responseHandler");

const COLLECTION_NAME = "carts";
const CART_ITEM_SCHEMA = Joi.object({
  product_id: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  selected_sku: Joi.string().required(),
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

const CartModel = {
  getCart: async (customer_id) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id) {
        throw createError(
          "Customer ID is required",
          400,
          "MISSING_CUSTOMER_ID"
        );
      }
      const cart = await collection.findOne({
        customer_id: customer_id,
      });
      return cart || { customer_id, items: [] };
    });
  },

  getCartItemByProductId: async (customer_id, product_id) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id || !product_id) {
        throw createError(
          "Customer ID and Product ID are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const cart = await collection.findOne(
        {
          customer_id: customer_id,
          "items.product_id": product_id,
        },
        { projection: { "items.$": 1 } }
      );

      if (cart && cart.items && cart.items.length > 0) {
        const { product_id, selected_sku, quantity } = cart.items[0];
        return { product_id, selected_sku, quantity };
      }

      return null;
    });
  },

  addItem: async (customer_id, cartData) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id) {
        throw createError(
          "Customer ID is required",
          400,
          "MISSING_CUSTOMER_ID"
        );
      }
      const { error } = CART_ITEM_SCHEMA.validate(cartData);
      if (error)
        throw createError(error.details[0].message, 400, "VALIDATION_ERROR");

      // Check if product_id already exists in the cart
      const existingItem = await collection.findOne(
        {
          customer_id: customer_id,
          "items.product_id": cartData.product_id,
        },
        { projection: { "items.$": 1 } }
      );

      if (existingItem) {
        throw createError(
          "Product already exists in the cart",
          400,
          "PRODUCT_ALREADY_IN_CART"
        );
      }

      const result = await collection.updateOne(
        { customer_id: customer_id },
        {
          $push: { items: cartData },
          $setOnInsert: { created_at: new Date() },
        },
        { upsert: true }
      );
      if (result.modifiedCount === 0 && result.upsertedCount === 0) {
        throw createError(
          "Failed to add item to cart",
          500,
          "CART_UPDATE_FAILED"
        );
      }
    });
  },

  removeItem: async (customer_id, product_id) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id || !product_id) {
        throw createError(
          "Customer ID and Product ID are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const result = await collection.updateOne(
        { customer_id: new ObjectId(customer_id) },
        {
          $pull: { items: { product_id: new ObjectId(product_id) } },
        }
      );
      if (result.modifiedCount === 0) {
        throw createError("Item not found in cart", 404, "ITEM_NOT_FOUND");
      }
      return { message: "Item removed from cart successfully" };
    });
  },

  updateQuantity: async (customer_id, product_id, quantity) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id || !product_id || quantity === undefined) {
        throw createError(
          "Customer ID, Product ID, and quantity are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const result = await collection.updateOne(
        {
          customer_id: customer_id,
          "items.product_id": product_id,
        },
        {
          $set: { "items.$.quantity": quantity },
        }
      );
      if (result.modifiedCount === 0) {
        throw createError("Item not found in cart", 404, "ITEM_NOT_FOUND");
      }
    });
  },

  updateSku: async (customer_id, product_id, sku) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id || !product_id || !sku) {
        throw createError(
          "Customer ID, Product ID, and SKU are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const result = await collection.updateOne(
        {
          customer_id: customer_id,
          "items.product_id": product_id,
        },
        {
          $set: { "items.$.selected_sku": sku },
        }
      );
      if (result.modifiedCount === 0) {
        throw createError("Item not found in cart", 404, "ITEM_NOT_FOUND");
      }
    });
  },

  clearCart: async (customer_id) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id) {
        throw createError(
          "Customer ID is required",
          400,
          "MISSING_CUSTOMER_ID"
        );
      }
      const result = await collection.updateOne(
        { customer_id: customer_id },
        { $set: { items: [] } }
      );
      if (result.modifiedCount === 0) {
        throw createError(
          "Cart not found or already empty",
          404,
          "CART_NOT_FOUND"
        );
      }
    });
  },
};

cron.schedule("* * * * *", () => {
  console.log("[Order-service] - Node-cron has started!");
});

module.exports = CartModel;
