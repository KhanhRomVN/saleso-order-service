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
        let createdOrderIds;
        await session.withTransaction(async () => {
          // 1. Process orders and update stock
          const processedOrders = await Promise.all(
            orderItems.map(async (item) => {
              const product = await getProductById(item.product_id, session);
              if (!product) {
                throw new Error(`Product not found: ${item.product_id}`);
              }

              await updateStockProduct(
                item.product_id,
                -item.quantity,
                item.sku,
                session
              );

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
                amount: order.total_amount, // Assuming total_amount is available in the order object
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

          // 5. Update Product Analytic
          await Promise.all(
            processedOrders.map(async (item) => {
              await updateValueAnalyticProduct(
                item.product_id,
                "orders_placed",
                1
              );
            })
          );

          // 6. Create order log
          await Promise.all(
            createdOrderIds.map(async (order) => {
              const orderLogData = {
                order_id: order.order_id,
                title: "Order created",
                content: "Order created successfully",
                created_at: new Date(),
              };
              await OrderLogModel.newOrderLog(orderLogData);
            })
          );

          // 7. get allowed notification preference
          const allowedNotificationPreference =
            await sendGetAllowNotificationPreference(customer_id);

          // 8. create notification
          if (allowedNotificationPreference.order_created) {
            await Promise.all(
              createdOrderIds.map(async (order) => {
                const notificationData = {
                  title: "Order created",
                  content: `You have a new order from ${order.customer_id}`,
                  notification_type: "order_notification",
                  target_type: "individual",
                  target_ids: [order.seller_id],
                  can_delete: false,
                  can_mark_as_read: true,
                  is_read: false,
                  created_at: new Date(),
                };
                await sendCreateNewNotification(notificationData);
              })
            );
          }

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
      const customer_id = req.user._id.toString();
      const order = await OrderModel.getOrderById(order_id);
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
        "orders_cancelled",
        1
      );
      return { message: "Order cancelled successfully" };
    }),

  acceptOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const seller_id = req.user._id.toString();
      const orderData = await OrderModel.getOrder(order_id);
      if (!orderData) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      await OrderModel.acceptOrder(order_id, seller_id);

      // get allowed notification preference
      const allowedNotificationPreference =
        await sendGetAllowNotificationPreference(customer_id);

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
        "orders_accepted",
        1
      );
    }),

  refuseOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const seller_id = req.user._id.toString();
      const orderData = await OrderModel.getOrder(order_id);
      if (!orderData) {
        throw createError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      await OrderModel.refuseOrder(order_id, seller_id);

      // get allowed notification preference
      const allowedNotificationPreference =
        await sendGetAllowNotificationPreference(customer_id);

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
      await updateValueAnalyticProduct(
        orderData.product_id,
        "orders_refused",
        1
      );
    }),
};

module.exports = OrderController;
