const {
  OrderModel,
  PaymentModel,
  CartModel,
  ReversalModel,
} = require("../models");
const { getProductInfo } = require("../producers/product-info-producer");
const { getUserInfo } = require("../producers/user-info-producer");
const { getVariantInfo } = require("../producers/varian-info-producer");
const logger = require("../config/logger");
const { startSession } = require("../config/mongoDB");
const { handleRequest, createError } = require("../services/responseHandler");

const OrderController = {
  createOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const { orderItems, payment_method, payment_status } = req.body;

      if (!Array.isArray(orderItems) || orderItems.length === 0) {
        throw createError("Invalid order items", 400, "INVALID_ORDER_ITEMS");
      }

      const session = await startSession();

      try {
        let createdOrderIds;

        await session.withTransaction(async () => {
          // 1. Process orders and update stock
          const processedOrders = await Promise.all(
            orderItems.map(async (item) => {
              const product = await getProductInfo(item.product_id);
              if (!product) {
                throw createError(
                  `Product not found: ${item.product_id}`,
                  404,
                  "PRODUCT_NOT_FOUND"
                );
              }

              // Update stock logic should be moved to product service
              // and called via RabbitMQ

              return {
                ...item,
                customer_id,
                seller_id: product.seller_id,
                order_status: "pending",
              };
            })
          );

          // 2. Create orders
          createdOrderIds = await OrderModel.createOrders(
            processedOrders,
            customer_id,
            session
          );

          // 3. Create payments
          await Promise.all(
            createdOrderIds.map(async (order) => {
              const paymentData = {
                order_id: order.order_id,
                customer_id,
                seller_id: order.seller_id,
                method: payment_method,
                status: payment_status,
              };
              await PaymentModel.createPayment(paymentData, session);
            })
          );

          // 4. Remove items from cart
          await Promise.all(
            orderItems.map(async (item) => {
              await CartModel.removeItem(customer_id, item.product_id, session);
            })
          );

          logger.info(
            `Orders created successfully for customer ${customer_id}`
          );
        });

        return {
          message: "Order created successfully",
          orderIds: createdOrderIds.map((order) => order.order_id),
        };
      } catch (error) {
        logger.error(
          `Error creating order for customer ${customer_id}: ${error.message}`
        );
        throw createError(
          error.message,
          error.status || 500,
          error.code || "ORDER_CREATION_FAILED"
        );
      } finally {
        await session.endSession();
      }
    }),

  getListOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { status } = req.params;
      const user_id = req.user._id.toString();
      const role = req.user.role;
      const orders = await OrderModel.getListOrder(user_id, role, status);

      if (!orders || orders.length === 0) {
        throw createError("No orders found", 404, "NO_ORDERS_FOUND");
      }

      return await Promise.all(
        orders.map(async (order) => {
          let orderData = {};

          if (role === "seller") {
            const {
              _id,
              product_id,
              customer_id,
              quantity,
              shipping_address,
              order_status,
            } = order;
            const product = await getProductInfo(product_id);
            const customer = await getUserInfo(customer_id, "customer");
            orderData = {
              _id,
              product_id,
              product_name: product ? product.name : null,
              product_image: product ? product.images[0] || null : null,
              customer_id,
              customer_username: customer ? customer.username : null,
              total_amount: order.total_amount,
              quantity,
              shipping_address,
              order_status,
            };
          } else {
            // Customer role: return all fields except applied_discount and updated_at
            const { applied_discount, updated_at, ...cleanedOrder } = order;
            orderData = cleanedOrder;

            const variant = await getVariantInfo(order.sku);
            orderData.sku_name = variant ? variant.variant : null;

            const product = await getProductInfo(order.product_id);
            if (product) {
              orderData.product_name = product.name;
              orderData.product_image = product.images[0] || null;
              orderData.product_address = product.address;
            }
          }

          // Add reversal information if status is "reversed"
          if (status === "reversed") {
            const reversal = await ReversalModel.getReversalByOrderId(
              order._id.toString()
            );
            if (reversal) {
              orderData.reversal_reason = reversal.reason;
              orderData.reversal_status = reversal.status;
            }
          }

          return orderData;
        })
      );
    }),

  getOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const order = await OrderModel.getOrder(order_id);
      if (!order) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      return order;
    }),

  cancelOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { order_id } = req.params;
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const customer_id = req.user._id.toString();
      const orderData = await OrderModel.getOrder(order_id);
      if (!orderData) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      if (customer_id !== orderData.customer_id) {
        throw createError("You cannot cancel this order", 403, "FORBIDDEN");
      }
      await OrderModel.cancelOrder(order_id, customer_id);
      return { message: "Order cancelled successfully" };
    }),

  acceptOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { order_id } = req.params;
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const seller_id = req.user._id.toString();
      await OrderModel.acceptOrder(order_id, seller_id);
      return { message: "Order accepted successfully" };
    }),

  refuseOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { order_id } = req.params;
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const seller_id = req.user._id.toString();
      await OrderModel.refuseOrder(order_id, seller_id);
      return { message: "Order refused successfully" };
    }),
};

module.exports = OrderController;
