const { getDB } = require("../config/mongoDB");
const { ObjectId } = require("mongodb");
const Joi = require("joi");

const COLLECTION_NAME = "wishlists";
const COLLECTION_SCHEMA = Joi.object({
  customer_id: Joi.string().required(),
  wishlist: Joi.array().items(Joi.string()),
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

const WishlistModel = {
  getWishlist: async (customer_id) => {
    return handleDBOperation(async (collection) => {
      const wishlist = await collection.findOne({ customer_id: customer_id });
      if (!wishlist || !wishlist.wishlist) return [];
      return wishlist.wishlist;
    });
  },

  addToWishlist: async (customer_id, product_id) => {
    return handleDBOperation(async (collection) => {
      await collection.updateOne(
        { customer_id: customer_id },
        {
          $addToSet: { wishlist: product_id },
          $setOnInsert: { created_at: new Date() },
          $set: { updated_at: new Date() },
        },
        { upsert: true }
      );
    });
  },

  removeFromWishlist: async (customer_id, product_id) => {
    return handleDBOperation(async (collection) => {
      await collection.updateOne(
        { customer_id: customer_id },
        {
          $pull: { wishlist: product_id },
          $set: { updated_at: new Date() },
        }
      );
    });
  },

  clearWishlist: async (customer_id) => {
    return handleDBOperation(async (collection) => {
      await collection.updateOne(
        { customer_id: customer_id },
        {
          $set: { wishlist: [], updated_at: new Date() },
        }
      );
    });
  },
};

module.exports = WishlistModel;
