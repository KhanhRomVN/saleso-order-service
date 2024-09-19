const express = require("express");
const {
  authCustomerToken,
  authSellerToken,
} = require("../middleware/authToken");
const { ReversalController } = require("../controllers");

const router = express.Router();

const routes = [];

routes.forEach(({ method, path, middleware = [], handler }) => {
  router[method](path, ...middleware, handler);
});

module.exports = router;
