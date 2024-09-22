const cart = require("./routes/cart.route");
const order = require("./routes/order.route");
const order_log = require("./routes/order_log.route");
const reversal = require("./routes/reversal.route");
const wishlist = require("./routes/wishlist.route");

module.exports = {
  cart,
  order,
  order_log,
  reversal,
  wishlist,
};
