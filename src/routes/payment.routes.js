import express from 'express';
import { authVerify } from '../middlewares/auth.middleware.js';
import {
  processPayment,
  createPaymentIntent,
  handleStripeWebhook,
} from '../controllers/payment.controller.js';

const router = express.Router();

// Create payment intent (get client secret for frontend)
router.post('/create-intent', authVerify, createPaymentIntent);

// Process payment (confirm payment and create order)
router.post('/process', authVerify, processPayment);

// Stripe webhook
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

export default router;
