const {
  WishlistModel,
  ProductAnalyticModel,
  ProductModel,
} = require("../models");
const logger = require("../config/logger");

const handleRequest = async (req, res, operation) => {
  try {
    const result = await operation(req);
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error in ${operation.name}: ${error}`);
    res
      .status(error.status || 500)
      .json({ error: error.message || "Internal Server Error" });
  }
};

const WishlistController = {
  getWishlist: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const wishlistItems = await WishlistModel.getWishlist(customer_id);

      const detailedWishlist = await Promise.all(
        wishlistItems.map(async (product_id) => {
          const product = await ProductModel.getProductById(product_id);

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

      return detailedWishlist;
    }),

  addToWishlist: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const { product_id } = req.params;
      await WishlistModel.addToWishlist(customer_id, product_id);
      // await ProductAnalyticModel.updateValueAnalyticProduct(
      //   product_id,
      //   "wishlist",
      //   1
      // );
      return { success: "Added product to wishlist successfully" };
    }),

  removeFromWishlist: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const { product_id } = req.params;
      logger.info(`Removing product ${product_id} from wishlist`);
      return await WishlistModel.removeFromWishlist(customer_id, product_id);
    }),

  clearWishlist: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      return await WishlistModel.clearWishlist(customer_id);
    }),
};

module.exports = WishlistController;
