const { getDB } = require("../config/mongoDB");
const Joi = require("joi");
const { createError } = require("../services/responseHandler");

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
    throw createError(
      `Database operation failed: ${error.message}`,
      500,
      "DB_OPERATION_FAILED"
    );
  }
};

const WishlistModel = {
  getWishlist: async (customer_id) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id) {
        throw createError(
          "Customer ID is required",
          400,
          "MISSING_CUSTOMER_ID"
        );
      }
      const wishlist = await collection.findOne({ customer_id: customer_id });
      if (!wishlist || !wishlist.wishlist) return [];
      return wishlist.wishlist;
    });
  },

  addToWishlist: async (customer_id, product_id) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id || !product_id) {
        throw createError(
          "Customer ID and Product ID are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const result = await collection.updateOne(
        { customer_id: customer_id },
        {
          $addToSet: { wishlist: product_id },
          $setOnInsert: { created_at: new Date() },
          $set: { updated_at: new Date() },
        },
        { upsert: true }
      );
      if (result.modifiedCount === 0 && result.upsertedCount === 0) {
        throw createError(
          "Failed to add product to wishlist",
          500,
          "WISHLIST_UPDATE_FAILED"
        );
      }
      return { message: "Product added to wishlist successfully" };
    });
  },

  removeFromWishlist: async (customer_id, product_id) => {
    return handleDBOperation(async (collection) => {
      if (!customer_id || !product_id) {
        throw createError(
          "Customer ID and Product ID are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const result = await collection.updateOne(
        { customer_id: customer_id },
        {
          $pull: { wishlist: product_id },
          $set: { updated_at: new Date() },
        }
      );
      if (result.modifiedCount === 0) {
        throw createError(
          "Product not found in wishlist",
          404,
          "PRODUCT_NOT_IN_WISHLIST"
        );
      }
      return { message: "Product removed from wishlist successfully" };
    });
  },

  clearWishlist: async (customer_id) => {
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
        {
          $set: { wishlist: [], updated_at: new Date() },
        }
      );
      if (result.modifiedCount === 0) {
        throw createError(
          "Wishlist not found or already empty",
          404,
          "WISHLIST_NOT_FOUND"
        );
      }
      return { message: "Wishlist cleared successfully" };
    });
  },
};

module.exports = WishlistModel;
