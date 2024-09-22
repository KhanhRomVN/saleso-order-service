const express = require("express");
const { OrderLogController } = require("../controllers");
const { authSellerToken } = require("../middleware/authToken");
const router = express.Router();

const routes = [
  {
    method: "get",
    path: "/",
    middleware: [authSellerToken],
    handler: OrderLogController.getOrderLogByOrderId,
  },
];

routes.forEach(({ method, path, middleware = [], handler }) => {
  router[method](path, ...middleware, handler);
});

module.exports = router;
