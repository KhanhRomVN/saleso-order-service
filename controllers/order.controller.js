const {
  OrderModel,
  PaymentModel,
  CartModel,
  ReversalModel,
} = require("../models");
const { getProductById } = require("../queue/producers/product-producer");
const { getUserById } = require("../queue/producers/user-producer");
const logger = require("../config/logger");
const { startSession } = require("../config/mongoDB");
const { handleRequest, createError } = require("../services/responseHandler");
const {
  updateVariantStock,
  getVariantBySku,
} = require("../queue/producers/variant-producer");

const OrderController = {
  createOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const { orderItems, payment_method, payment_status } = req.body;
      console.log(req.body);

      if (!Array.isArray(orderItems) || orderItems.length === 0) {
        throw createError("Invalid order items", 400, "INVALID_ORDER_ITEMS");
      }

      const session = await startSession();

      try {
        session.startTransaction();

        const orderItemsWithDetails = await Promise.all(
          orderItems.map(async (item) => {
            const product = await getProductById(item.product_id);
            if (!product) {
              throw createError(
                `Product not found: ${item.product_id}`,
                404,
                "PRODUCT_NOT_FOUND"
              );
            }

            const variant = product.variants.find(
              (v) => v._id.toString() === item.variant_id
            );
            if (!variant) {
              throw createError(
                `Variant not found: ${item.variant_id}`,
                404,
                "VARIANT_NOT_FOUND"
              );
            }

            if (variant.stock < item.quantity) {
              throw createError(
                `Insufficient stock for variant: ${item.variant_id}`,
                400,
                "INSUFFICIENT_STOCK"
              );
            }

            return {
              ...item,
              product_name: product.name,
              variant_name: variant.name,
              price: variant.price,
            };
          })
        );

        const totalAmount = orderItemsWithDetails.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );

        const newOrder = await OrderModel.createOrder(
          {
            customer_id,
            orderItems: orderItemsWithDetails,
            totalAmount,
            payment_method,
            payment_status,
          },
          { session }
        );

        await Promise.all(
          orderItemsWithDetails.map(async (item) => {
            await updateVariantStock(
              item.product_id,
              item.variant_id,
              -item.quantity,
              { session }
            );
          })
        );

        await CartModel.clearCart(customer_id, { session });

        await session.commitTransaction();
        return newOrder;
      } catch (error) {
        await session.abortTransaction();
        logger.error(
          `Error creating order for customer ${customer_id}: ${error.message}`
        );
        throw createError(
          "Failed to create order",
          500,
          "ORDER_CREATION_FAILED"
        );
      } finally {
        await session.endSession();
      }
    }),

  getListOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { status } = req.params;
      const user_id = req.user._id.toString();
      const role = req.user.role;
      const orders = await OrderModel.getListOrder(user_id, role, status);

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
            const product = await ProductMode.getProductById(product_id);
            const customer = await getUserById(customer_id, "customer");
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

            const variant = await getVariantBySku(order.sku);
            orderData.sku_name = variant ? variant.variant : null;

            const product = await getProductById(order.product_id);
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
      const customer_id = req.user._id.toString();
      const order = await OrderModel.getOrder(order_id);
      if (!order) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      if (order.customer_id !== customer_id) {
        throw createError(
          "Unauthorized access to order",
          403,
          "UNAUTHORIZED_ACCESS"
        );
      }
      return order;
    }),

  cancelOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const customer_id = req.user._id.toString();
      const orderData = await OrderModel.getOrder(order_id);
      if (!orderData) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      if (customer_id !== orderData.customer_id) {
        throw createError(
          "You cannot cancel this order",
          403,
          "UNAUTHORIZED_CANCEL"
        );
      }
      await OrderModel.cancelOrder(order_id, customer_id);
      return { message: "Order cancelled successfully" };
    }),

  updateOrderStatus: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const { status } = req.body;
      const updatedOrder = await OrderModel.updateOrderStatus(order_id, status);
      if (!updatedOrder) {
        throw createError(
          "Order not found or status update failed",
          404,
          "ORDER_UPDATE_FAILED"
        );
      }
      return updatedOrder;
    }),

  getOrdersByStatus: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { status } = req.params;
      const orders = await OrderModel.getOrdersByStatus(status);
      return orders;
    }),

  refundOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const { refund_amount, refund_reason } = req.body;

      const order = await OrderModel.getOrder(order_id);
      if (!order) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      if (order.status !== "completed") {
        throw createError(
          "Only completed orders can be refunded",
          400,
          "INVALID_ORDER_STATUS"
        );
      }

      if (refund_amount > order.totalAmount) {
        throw createError(
          "Refund amount cannot exceed the order total",
          400,
          "INVALID_REFUND_AMOUNT"
        );
      }

      const session = await startSession();
      try {
        session.startTransaction();

        const refund = await PaymentModel.createRefund(
          order_id,
          refund_amount,
          refund_reason,
          { session }
        );

        await OrderModel.updateOrderStatus(order_id, "refunded", { session });

        await session.commitTransaction();
        return refund;
      } catch (error) {
        await session.abortTransaction();
        logger.error(`Error refunding order ${order_id}: ${error.message}`);
        throw createError(
          "Failed to process refund",
          500,
          "REFUND_PROCESSING_FAILED"
        );
      } finally {
        await session.endSession();
      }
    }),

  getOrderAnalytics: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { startDate, endDate } = req.query;
      const analytics = await OrderModel.getOrderAnalytics(startDate, endDate);
      return analytics;
    }),

  getReversals: (req, res) =>
    handleRequest(req, res, async (req) => {
      const reversals = await ReversalModel.getReversals();
      return reversals;
    }),

  createReversal: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id, reason } = req.body;
      const order = await OrderModel.getOrder(order_id);
      if (!order) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      const session = await startSession();
      try {
        session.startTransaction();

        const reversal = await ReversalModel.createReversal(order_id, reason, {
          session,
        });

        await OrderModel.updateOrderStatus(order_id, "reversed", { session });

        await Promise.all(
          order.orderItems.map(async (item) => {
            await updateVariantStock(
              item.product_id,
              item.variant_id,
              item.quantity,
              { session }
            );
          })
        );

        await session.commitTransaction();
        return reversal;
      } catch (error) {
        await session.abortTransaction();
        logger.error(
          `Error creating reversal for order ${order_id}: ${error.message}`
        );
        throw createError(
          "Failed to create reversal",
          500,
          "REVERSAL_CREATION_FAILED"
        );
      } finally {
        await session.endSession();
      }
    }),
};

module.exports = OrderController;
