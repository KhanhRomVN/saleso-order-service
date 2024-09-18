const { CartModel, ProductModel, ProductAnalyticModel } = require("../models");
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

const CartController = {
  getCart: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const cart = await CartModel.getCart(customer_id);

      // Map over the items array to add product details
      const itemsWithDetails = await Promise.all(
        cart.items.map(async (item) => {
          const product = await ProductModel.getProductById(item.product_id);
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
      const { product_id } = req.params;
      return await CartModel.getCartItemByProductId(
        req.user._id.toString(),
        product_id
      );
    }),

  addItem: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      await CartModel.addItem(customer_id, req.body);
      // await ProductAnalyticModel.updateCartProduct(req.body.product_id);
      return { message: "Item added to cart successfully" };
    }),

  removeItem: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { product_id } = req.params;
      const customer_id = req.user._id.toString();
      await CartModel.removeItem(customer_id, product_id);
      return { message: "Item removed from cart successfully" };
    }),

  updateQuantity: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const { product_id, quantity } = req.body;
      await CartModel.updateQuantity(customer_id, product_id, quantity);
      return { message: "Updated quanity successfully" };
    }),

  updateSku: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const { product_id, sku } = req.body;
      await CartModel.updateSku(customer_id, product_id, sku);
      return { message: "Updated sku successfully" };
    }),

  clearCart: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      await CartModel.clearCart(customer_id);
      return { message: "Cart cleared successfully" };
    }),
};

module.exports = CartController;
