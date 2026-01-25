import express from 'express';
import { authVerify } from '../middlewares/auth.middleware.js';
import {
  processPayment,
  createPaymentIntent,
  createOrder,
  handleStripeWebhook,
} from '../controllers/payment.controller.js';

const router = express.Router();

// ===== CREATE ORDER API (NEW) =====
// POST /api/v1/payment/create-order
// Accepts: productId, quantity, notes, addressId, totalPrice, scheduledDeliveryDate
// Returns: clientSecret for Stripe Payment Sheet
router.post('/create-order', authVerify, createOrder);

// Create payment intent (get client secret for frontend)
router.post('/create-intent', authVerify, createPaymentIntent);

// Process payment (confirm payment and create order)
router.post('/process', authVerify, processPayment);

// Stripe webhook - handles payment success/failure

export default router;
