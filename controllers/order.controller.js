const {
  OrderModel,
  PaymentModel,
  CartModel,
  OrderLogModel,
  ReversalModel,
} = require("../models");

const {
  getProductById,
  updateStockProduct,
} = require("../queue/producers/product-producer");
const { getUserById } = require("../queue/producers/user-producer");
const {
  updateValueAnalyticProduct,
} = require("../queue/producers/product-analytic-producer");
const logger = require("../config/logger");
const { startSession } = require("../config/mongoDB");
const { handleRequest, createError } = require("../services/responseHandler");
const { sendGetVariantBySku } = require("../queue/producers/variant-producer");
const {
  sendCreateNewNotification,
} = require("../queue/producers/notification-producer");
const {
  sendGetAllowNotificationPreference,
} = require("../queue/producers/notification-preference-producer");

const OrderController = {
  createOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const customer_id = req.user._id.toString();
      const { orderItems, payment_method, payment_status } = req.body;

      if (!Array.isArray(orderItems) || orderItems.length === 0) {
        throw new Error("Invalid order items");
      }

      const session = await startSession();

      try {
        await session.withTransaction(async () => {
          // 1. Process orders and update stock
          const productPromises = orderItems.map((item) =>
            getProductById(item.product_id)
          );
          const products = await Promise.all(productPromises);

          const processedOrders = orderItems.map((item, index) => {
            const product = products[index];
            if (!product) {
              throw new Error(`Product not found: ${item.product_id}`);
            }

            return {
              ...item,
              customer_id,
              seller_id: product.seller_id,
              order_status: "pending",
            };
          });

          const updateStockPromises = processedOrders.map((item) =>
            updateStockProduct(item.product_id, -item.quantity, item.sku)
          );
          await Promise.all(updateStockPromises);

          // 2. Create orders
          const createdOrderIds = await OrderModel.createOrders(
            processedOrders,
            customer_id
          );

          // 3. Create payments
          const paymentPromises = createdOrderIds.map((order) => {
            const paymentData = {
              order_id: order.order_id.toString(),
              customer_id,
              seller_id: order.seller_id,
              method: payment_method,
              status: payment_status,
            };
            return PaymentModel.createPayment(paymentData);
          });
          await Promise.all(paymentPromises);

          // 4. Remove items from cart
          const removeCartPromises = orderItems.map((item) =>
            CartModel.removeItem(customer_id, item.product_id)
          );
          await Promise.all(removeCartPromises);

          // 5. Update Product Analytic
          const updateAnalyticPromises = processedOrders.map((item) =>
            updateValueAnalyticProduct(item.product_id, "orders_placed", 1)
          );
          await Promise.all(updateAnalyticPromises);

          // 6. Create order log
          const orderLogPromises = createdOrderIds.map((order) => {
            const orderLogData = {
              order_id: order.order_id.toString(),
              title: "Order created",
              content: "Order created successfully",
              created_at: new Date(),
            };
            return OrderLogModel.newOrderLog(orderLogData);
          });
          await Promise.all(orderLogPromises);

          // 7. Create notification
          const notificationPromises = createdOrderIds.map((order) => {
            const notificationData = {
              title: "You have new order",
              content: `You have new order with order id ${order.order_id}`,
              notification_type: "order_notification",
              target_type: "individual",
              target_ids: [order.seller_id],
              can_delete: false,
              can_mark_as_read: true,
              is_read: false,
              created_at: new Date(),
            };
            return sendCreateNewNotification(notificationData);
          });
          await Promise.all(notificationPromises);
        });

        return {
          message: "Order created successfully",
        };
      } catch (error) {
        throw error;
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
            const product = await getProductById(product_id);
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

            const variant = await sendGetVariantBySku(order.sku);
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
      const orderData = await OrderModel.getOrderById(order_id);
      const orderLogData = await OrderLogModel.getOrderLogByOrderId(order_id);
      const productData = await getProductById(orderData.product_id);
      const customerData = await getUserById(orderData.customer_id, "customer");
      const paymentData = await PaymentModel.getPayment(order_id);
      return {
        orderData,
        orderLogData,
        productData,
        customerData,
        paymentData,
      };
    }),

  cancelOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const customer_id = req.user._id.toString();
      const orderData = await OrderModel.getOrderById(order_id);
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

      // get allowed notification preference
      const allowedNotificationPreference =
        await sendGetAllowNotificationPreference(customer_id);

      // create notification
      if (allowedNotificationPreference.order_cancelled) {
        const notificationData = {
          title: "Order cancelled",
          content: `Customer ${customer_id} has cancelled the order`,
          notification_type: "order_notification",
          target_type: "individual",
          target_ids: [orderData.seller_id],
          can_delete: false,
          can_mark_as_read: true,
          is_read: false,
        };
        await sendCreateNewNotification(notificationData);
      }

      // Create order log
      const orderLogData = {
        order_id,
        title: "Order cancelled",
        content: "Order cancelled successfully",
        created_at: new Date(),
      };

      await OrderLogModel.newOrderLog(orderLogData);

      // Product analytic
      await updateValueAnalyticProduct(
        orderData.product_id,
        "order_refused",
        1
      );
      return { message: "Order cancelled successfully" };
    }),

  acceptOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const seller_id = req.user._id.toString();
      const orderData = await OrderModel.getOrderById(order_id);
      if (!orderData) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      await OrderModel.acceptOrder(order_id, seller_id);

      // get allowed notification preference
      const allowedNotificationPreference =
        await sendGetAllowNotificationPreference(orderData.customer_id);

      // create notification
      if (allowedNotificationPreference.order_accepted) {
        const notificationData = {
          title: "Order accepted",
          content: `Order ${order_id} has been accepted by ${seller_id}`,
          notification_type: "order_notification",
          target_type: "individual",
          target_ids: [orderData.customer_id],
          can_delete: false,
          can_mark_as_read: true,
          is_read: false,
          created_at: new Date(),
        };
        await sendCreateNewNotification(notificationData);
      }

      // Create order log
      const orderLogData = {
        order_id,
        title: "Order accepted",
        content: "Order accepted successfully",
        created_at: new Date(),
      };
      await OrderLogModel.newOrderLog(orderLogData);

      // Product analytic
      await updateValueAnalyticProduct(
        orderData.product_id,
        "order_successful",
        1
      );
      await updateValueAnalyticProduct(
        orderData.product_id,
        "revenue",
        orderData.total_amount
      );
    }),

  refuseOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const seller_id = req.user._id.toString();
      const orderData = await OrderModel.getOrderById(order_id);
      if (!orderData) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      await OrderModel.refuseOrder(order_id, seller_id);

      // get allowed notification preference
      const allowedNotificationPreference =
        await sendGetAllowNotificationPreference(orderData.customer_id);

      // create notification
      if (allowedNotificationPreference.order_refused) {
        const notificationData = {
          title: "Order refused",
          content: `Order ${order_id} has been refused by seller`,
          notification_type: "order_notification",
          target_type: "individual",
          target_ids: [orderData.customer_id],
          can_delete: false,
          can_mark_as_read: true,
          is_read: false,
          created_at: new Date(),
        };
        await sendCreateNewNotification(notificationData);
      }

      // Create order log
      const orderLogData = {
        order_id,
        title: "Order refused",
        content: "Order refused successfully",
        created_at: new Date(),
      };
      await OrderLogModel.newOrderLog(orderLogData);

      // Product analytic
      await updateValueAnalyticProduct(orderData.product_id, "order_failed", 1);
    }),
};

module.exports = OrderController;
