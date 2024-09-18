const express = require("express");
const { CartController } = require("../controllers");
const { authCustomerToken } = require("../middleware/authToken");
const router = express.Router();

const routes = [
  {
    method: "get",
    path: "/",
    middleware: [authCustomerToken],
    handler: CartController.getCart,
  },
  {
    method: "get",
    path: "/by-product/:product_id",
    middleware: [authCustomerToken],
    handler: CartController.getCartItemByProductId,
  },
  {
    method: "post",
    path: "/",
    middleware: [authCustomerToken],
    handler: CartController.addItem,
  },
  {
    method: "delete",
    path: "/:product_id",
    middleware: [authCustomerToken],
    handler: CartController.removeItem,
  },
  {
    method: "put",
    path: "/quantity",
    middleware: [authCustomerToken],
    handler: CartController.updateQuantity,
  },
  {
    method: "put",
    path: "/sku",
    middleware: [authCustomerToken],
    handler: CartController.updateSku,
  },
  {
    method: "delete",
    path: "/",
    middleware: [authCustomerToken],
    handler: CartController.clearCart,
  },
];

routes.forEach(({ method, path, middleware = [], handler }) => {
  router[method](path, ...middleware, handler);
});

module.exports = router;
