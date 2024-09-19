const { PaymentModel } = require("../models");
const { handleRequest, createError } = require("../services/responseHandler");

const PaymentController = {
  createPayment: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { order_id, method, status } = req.body;
      if (!order_id || !method || !status) {
        throw createError(
          "Missing required fields",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const paymentData = {
        order_id,
        customer_id: req.user._id.toString(),
        method,
        status,
      };
      const result = await PaymentModel.createPayment(paymentData);
      if (!result) {
        throw createError(
          "Failed to create payment",
          500,
          "PAYMENT_CREATION_FAILED"
        );
      }
      return {
        message: "Payment created successfully",
        payment_id: result._id,
      };
    }),

  getPayment: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { payment_id } = req.params;
      if (!payment_id) {
        throw createError("Payment ID is required", 400, "MISSING_PAYMENT_ID");
      }
      const payment = await PaymentModel.getPaymentById(payment_id);
      if (!payment) {
        throw createError("Payment not found", 404, "PAYMENT_NOT_FOUND");
      }
      return payment;
    }),

  updatePaymentStatus: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const { payment_id } = req.params;
      const { status } = req.body;
      if (!payment_id || !status) {
        throw createError(
          "Payment ID and status are required",
          400,
          "MISSING_REQUIRED_FIELDS"
        );
      }
      const result = await PaymentModel.updatePaymentStatus(payment_id, status);
      if (!result) {
        throw createError(
          "Failed to update payment status",
          500,
          "PAYMENT_UPDATE_FAILED"
        );
      }
      return { message: "Payment status updated successfully" };
    }),

  getPaymentsByOrder: (req, res) =>
    handleRequest(req, res, async (req) => {
      const { order_id } = req.params;
      if (!order_id) {
        throw createError("Order ID is required", 400, "MISSING_ORDER_ID");
      }
      const payments = await PaymentModel.getPaymentsByOrderId(order_id);
      if (!payments || payments.length === 0) {
        throw createError(
          "No payments found for this order",
          404,
          "NO_PAYMENTS_FOUND"
        );
      }
      return payments;
    }),

  getPaymentsByCustomer: (req, res) =>
    handleRequest(req, res, async (req) => {
      if (!req.user || !req.user._id) {
        throw createError("User not authenticated", 401, "UNAUTHORIZED");
      }
      const customer_id = req.user._id.toString();
      const payments = await PaymentModel.getPaymentsByCustomerId(customer_id);
      if (!payments || payments.length === 0) {
        throw createError(
          "No payments found for this customer",
          404,
          "NO_PAYMENTS_FOUND"
        );
      }
      return payments;
    }),
};

module.exports = PaymentController;
