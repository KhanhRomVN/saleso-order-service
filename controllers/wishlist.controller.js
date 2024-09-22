const { WishlistModel } = require("../models");
const { getProductById } = require("../queue/producers/product-producer");
const {
  updateValueAnalyticProduct,
} = require("../queue/producers/product-analytic-producer");
const logger = require("../config/logger");
const { handleRequest, createError } = require("../services/responseHandler");

const WishlistController = {
  getWishlist: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const wishlistItems = await WishlistModel.getWishlist(customer_id);

      if (!wishlistItems || wishlistItems.length === 0) {
        return []; // Return an empty array if the wishlist is empty
      }

      const detailedWishlist = await Promise.all(
        wishlistItems.map(async (product_id) => {
          const product = await getProductById(product_id);
          if (!product) {
            logger.warn(`Product ${product_id} not found for wishlist item`);
            return null; // Skip this item if the product is not found
          }

          const totalStock = product.variants.reduce(
            (sum, variant) => sum + variant.stock,
            0
          );
          const minPrice = Math.min(
            ...product.variants.map((variant) => variant.price)
          );

          return {
            _id: product._id,
            name: product.name,
            image: product.images[0],
            address: product.address,
            origin: product.origin,
            variants: product.variants,
            price_min: minPrice,
            total_stock: totalStock,
          };
        })
      );

      return detailedWishlist.filter((item) => item !== null); // Remove any null items
    }),

  addToWishlist: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const { product_id } = req.params;

      if (!product_id) {
        throw createError("Product ID is required", 400, "MISSING_PRODUCT_ID");
      }

      const product = await getProductById(product_id);
      if (!product) {
        throw createError("Product not found", 404, "PRODUCT_NOT_FOUND");
      }

      await WishlistModel.addToWishlist(customer_id, product_id);
      await updateValueAnalyticProduct(product_id, "wishlist_added", 1);
      return { success: "Added product to wishlist successfully" };
    }),

  removeFromWishlist: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const { product_id } = req.params;

      if (!product_id) {
        throw createError("Product ID is required", 400, "MISSING_PRODUCT_ID");
      }

      logger.info(`Removing product ${product_id} from wishlist`);
      const result = await WishlistModel.removeFromWishlist(
        customer_id,
        product_id
      );
      if (!result) {
        throw createError(
          "Product not found in wishlist",
          404,
          "PRODUCT_NOT_IN_WISHLIST"
        );
      }
      await updateValueAnalyticProduct(product_id, "wishlist_removed", 1);
      return { success: "Removed product from wishlist successfully" };
    }),

  clearWishlist: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const result = await WishlistModel.clearWishlist(customer_id);
      if (!result) {
        throw createError(
          "Failed to clear wishlist",
          500,
          "CLEAR_WISHLIST_FAILED"
        );
      }
      return { success: "Wishlist cleared successfully" };
    }),
};

module.exports = WishlistController;
