const { getDB } = require("../config/mongoDB");
const { ObjectId } = require("mongodb");
const Joi = require("joi");

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
    throw error;
  }
};

const CartModel = {
  getCart: async (customer_id) => {
    return handleDBOperation(async (collection) => {
      const cart = await collection.findOne({
        customer_id: customer_id,
      });
      return cart || { customer_id, items: [] };
    });
  },

  getCartItemByProductId: async (customer_id, product_id) => {
    return handleDBOperation(async (collection) => {
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
      const { error } = CART_ITEM_SCHEMA.validate(cartData);
      if (error) throw new Error(error.details[0].message);
      await collection.updateOne(
        { customer_id: customer_id },
        {
          $push: { items: cartData },
          $setOnInsert: { created_at: new Date() },
        },
        { upsert: true }
      );
    });
  },

  removeItem: async (customer_id, product_id) => {
    return handleDBOperation(async (collection) => {
      const result = await collection.updateOne(
        { customer_id: new ObjectId(customer_id) },
        {
          $pull: { items: { product_id: new ObjectId(product_id) } },
        }
      );

      return { message: "Item removed from cart successfully" };
    });
  },

  updateQuantity: async (customer_id, product_id, quantity) => {
    return handleDBOperation(async (collection) => {
      await collection.updateOne(
        {
          customer_id: customer_id,
          "items.product_id": product_id,
        },
        {
          $set: { "items.$.quantity": quantity },
        }
      );
    });
  },

  updateSku: async (customer_id, product_id, sku) => {
    return handleDBOperation(async (collection) => {
      console.log(customer_id);
      console.log(product_id);
      console.log(sku);
      await collection.updateOne(
        {
          customer_id: customer_id,
          "items.product_id": product_id,
        },
        {
          $set: { "items.$.selected_sku": sku },
        }
      );
    });
  },

  clearCart: async (customer_id) => {
    return handleDBOperation(async (collection) => {
      await collection.updateOne(
        { customer_id: customer_id },
        { $set: { items: [] } }
      );
    });
  },
};

module.exports = CartModel;
