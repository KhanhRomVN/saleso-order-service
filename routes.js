const cart = require("./routes/cart.route");
const order = require("./routes/order.route");
const payment = require("./routes/payment.route");
const reversal = require("./routes/reversal.route");
const wishlist = require("./routes/wishlist.route");

module.exports = {
  cart,
  order,
  payment,
  reversal,
  wishlist,
};
