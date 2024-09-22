const { ReversalModel, OrderModel, OrderLogModel } = require("../models");
const { handleRequest } = require("../services/responseHandler");
const {
  updateValueAnalyticProduct,
} = require("../queue/producers/product-analytic-producer");

const ReversalController = {
  createReversal: async (req, res) => {
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const { seller_id } = await OrderModel.getOrderById(order_id);
      const { reason } = req.body;
      const { customer_id } = req.user._id.toString();
      await ReversalModel.createReversal(
        order_id,
        reason,
        customer_id,
        seller_id
      );
      await updateValueAnalyticProduct(seller_id, "reversal_requested", 1);

      // get allowed notification preference
      const allowedNotificationPreference =
        await sendGetAllowNotificationPreference(customer_id);

      // create notification
      if (allowedNotificationPreference.order_notification) {
        const notificationData = {
          title: "Reversal requested",
          content: `Customer ${customer_id} has requested a reversal for order ${order_id}`,
          notification_type: "order_notification",
          target_type: "individual",
          target_ids: [seller_id],
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
        title: "Reversal created",
        content: "Reversal created successfully",
        created_at: new Date(),
      };
      await OrderLogModel.newOrderLog(orderLogData);

      return { message: "Reversal created successfully" };
    });
  },

  acceptReversal: async (req, res) => {
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const seller_id = req.user._id.toString();
      await ReversalModel.acceptReversal(order_id, seller_id);
      await updateValueAnalyticProduct(seller_id, "reversal_accepted", 1);

      // get allowed notification preference
      const allowedNotificationPreference =
        await sendGetAllowNotificationPreference(seller_id);

      // create notification
      if (allowedNotificationPreference.order_notification) {
        const notificationData = {
          title: "Reversal accepted",
          content: `Seller ${seller_id} has accepted the reversal for order ${order_id}`,
          notification_type: "order_notification",
          target_type: "individual",
          target_ids: [customer_id],
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
        title: "Reversal accepted",
        content: "Reversal accepted successfully",
        created_at: new Date(),
      };
      await OrderLogModel.newOrderLog(orderLogData);

      return { message: "Reversal accepted successfully" };
    });
  },

  refuseReversal: async (req, res) => {
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      const seller_id = req.user._id.toString();
      await ReversalModel.refuseReversal(order_id, seller_id);
      await updateValueAnalyticProduct(seller_id, "reversal_refused", 1);

      // get allowed notification preference
      const allowedNotificationPreference =
        await sendGetAllowNotificationPreference(seller_id);

      // create notification
      if (allowedNotificationPreference.order_notification) {
        const notificationData = {
          title: "Reversal refused",
          content: `Seller ${seller_id} has refused the reversal for order ${order_id}`,
          notification_type: "order_notification",
          target_type: "individual",
          target_ids: [customer_id],
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
        title: "Reversal refused",
        content: "Reversal refused successfully",
        created_at: new Date(),
      };
      await OrderLogModel.newOrderLog(orderLogData);

      return { message: "Reversal refused successfully" };
    });
  },
};

module.exports = ReversalController;
