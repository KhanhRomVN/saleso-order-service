const express = require("express");
const {
  authCustomerToken,
  authSellerToken,
} = require("../middleware/authToken");
const { ReversalController } = require("../controllers");

const router = express.Router();

const routes = [
  {
    method: "post",
    path: "/:order_id",
    middleware: [authCustomerToken],
    handler: ReversalController.createReversal,
  },
  {
    method: "put",
    path: "/accept/:order_id",
    middleware: [authSellerToken],
    handler: ReversalController.acceptReversal,
  },
  {
    method: "put",
    path: "/refuse/:order_id",
    middleware: [authSellerToken],
    handler: ReversalController.refuseReversal,
  },
];

routes.forEach(({ method, path, middleware = [], handler }) => {
  router[method](path, ...middleware, handler);
});

module.exports = router;
