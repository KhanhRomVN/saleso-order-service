const express = require("express");
const { PaymentController } = require("../controllers");
const { authSellerToken } = require("../middleware/authToken");
const router = express.Router();

const routes = [
  //   {
  //     method: "get",
  //     path: "/",
  //     middleware: [authSellerToken],
  //     handler: PaymentController.getListPendingOrder,
  //   },
];

routes.forEach(({ method, path, middleware = [], handler }) => {
  router[method](path, ...middleware, handler);
});

module.exports = router;
