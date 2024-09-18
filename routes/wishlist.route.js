const express = require("express");
const { WishlistController } = require("../controllers");
const { authCustomerToken } = require("../middleware/authToken");
const router = express.Router();

const routes = [
  {
    method: "post",
    path: "/items/:product_id",
    middleware: [authCustomerToken],
    handler: WishlistController.addToWishlist,
  },
  {
    method: "get",
    path: "/",
    middleware: [authCustomerToken],
    handler: WishlistController.getWishlist,
  },
  {
    method: "delete",
    path: "/items/:product_id",
    middleware: [authCustomerToken],
    handler: WishlistController.removeFromWishlist,
  },
  {
    method: "delete",
    path: "/",
    middleware: [authCustomerToken],
    handler: WishlistController.clearWishlist,
  },
];

routes.forEach(({ method, path, middleware = [], handler }) => {
  router[method](path, ...middleware, handler);
});

module.exports = router;
