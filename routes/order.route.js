const express = require("express");
const { OrderController } = require("../controllers");
const {
  authCustomerToken,
  authToken,
  authSellerToken,
} = require("../middleware/authToken");
const { rateLimiter } = require("../middleware/rateLimiter");
const router = express.Router();

const routes = [
  {
    method: "post",
    path: "/",
    middleware: [authCustomerToken, rateLimiter],
    handler: OrderController.createOrder,
  },
  {
    method: "get",
    path: "/:status",
    middleware: [authToken],
    handler: OrderController.getListOrder,
  },
  {
    method: "get",
    path: "/get/:order_id",
    middleware: [authSellerToken, rateLimiter],
    handler: OrderController.getOrder,
  },
  {
    method: "delete",
    path: "/cancel/:order_id",
    middleware: [authCustomerToken, rateLimiter],
    handler: OrderController.cancelOrder,
  },
  {
    method: "put",
    path: "/accept/:order_id",
    middleware: [authSellerToken, rateLimiter],
    handler: OrderController.acceptOrder,
  },
  {
    method: "put",
    path: "/refuse/:order_id",
    middleware: [authSellerToken, rateLimiter],
    handler: OrderController.refuseOrder,
  },
];

routes.forEach(({ method, path, middleware = [], handler }) => {
  router[method](path, ...middleware, handler);
});

module.exports = router;
