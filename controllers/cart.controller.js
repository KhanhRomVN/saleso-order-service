const { CartModel } = require("../models");
const { getProductById } = require("../queue/producers/product-producer");
const { handleRequest, createError } = require("../services/responseHandler");

const CartController = {
  getCart: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const cart = await CartModel.getCart(customer_id);

      if (!cart || !cart.items) {
        throw createError("Cart not found", 404, "CART_NOT_FOUND");
      }

      // Map over the items array to add product details
      const itemsWithDetails = await Promise.all(
        cart.items.map(async (item) => {
          const product = await getProductById(item.product_id);
          if (!product) {
            throw createError(
              `Product not found: ${item.product_id}`,
              404,
              "PRODUCT_NOT_FOUND"
            );
          }
          return {
            ...item,
            product_id: product._id,
            image: product.images[0],
            name: product.name,
            variants: product.variants,
          };
        })
      );

      // Return the updated cart object
      return {
        ...cart,
        items: itemsWithDetails,
      };
    }),

  getCartItemByProductId: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { product_id } = req.params;
      if (!product_id) {
        throw createError("Product ID is required", 400, "MISSING_PRODUCT_ID");
      }
      const item = await CartModel.getCartItemByProductId(
        req.user._id.toString(),
        product_id
      );
      if (!item) {
        throw createError("Cart item not found", 404, "CART_ITEM_NOT_FOUND");
      }
      return item;
    }),

  addItem: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      if (!req.body || !req.body.product_id) {
        throw createError("Product ID is required", 400, "MISSING_PRODUCT_ID");
      }
      await CartModel.addItem(customer_id, req.body);
      return { message: "Item added to cart successfully" };
    }),

  removeItem: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { product_id } = req.params;
      if (!product_id) {
        throw createError("Product ID is required", 400, "MISSING_PRODUCT_ID");
      }
      const customer_id = req.user._id.toString();
      await CartModel.removeItem(customer_id, product_id);
      return { message: "Item removed from cart successfully" };
    }),

  updateQuantity: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const { product_id, quantity } = req.body;
      if (!product_id || quantity === undefined) {
        throw createError(
          "Product ID and quantity are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      await CartModel.updateQuantity(customer_id, product_id, quantity);
      return { message: "Updated quantity successfully" };
    }),

  updateSku: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const { product_id, sku } = req.body;
      if (!product_id || !sku) {
        throw createError(
          "Product ID and SKU are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      await CartModel.updateSku(customer_id, product_id, sku);
      return { message: "Updated SKU successfully" };
    }),

  clearCart: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      await CartModel.clearCart(customer_id);
      return { message: "Cart cleared successfully" };
    }),
};

module.exports = CartController;
