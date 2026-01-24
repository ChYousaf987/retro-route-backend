import Stripe from 'stripe';
import { Cart } from '../models/cart.model.js';
import { Order } from '../models/order.model.js';
import { User } from '../models/user.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Lazy-load Stripe instance to ensure environment variables are loaded
const getStripeInstance = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is not defined in environment variables'
    );
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Process payment using Stripe
export const processPayment = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const {
      addressId,
      deliveryCharges = 0,
      scheduledDeliveryDate,
      customerNote = '',
      paymentMethodId, // Stripe payment method ID from frontend
    } = req.body;

    // Validation
    if (!addressId) {
      return res.status(400).json(new apiError(400, 'Address ID is required'));
    }

    if (!scheduledDeliveryDate) {
      return res
        .status(400)
        .json(new apiError(400, 'Scheduled delivery date is required'));
    }

    if (!paymentMethodId) {
      return res
        .status(400)
        .json(new apiError(400, 'Payment method ID is required'));
    }

    // Validate delivery date
    const deliveryDate = new Date(scheduledDeliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (deliveryDate < today) {
      return res
        .status(400)
        .json(
          new apiError(
            400,
            'Scheduled delivery date must be today or in the future'
          )
        );
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json(new apiError(400, 'Cart is empty'));
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = cart.items.map(item => {
      const itemTotal = item.product.price * item.quantity;
      subtotal += itemTotal;

      return {
        productId: item.product._id,
        quantity: item.quantity,
        priceAtPurchase: item.product.price,
      };
    });

    const total = subtotal + deliveryCharges;
    const amountInCents = Math.round(total * 100); // Stripe requires amount in cents

    // Get customer email
    const user = await User.findById(userId);

    // Create payment intent with Stripe
    const stripe = getStripeInstance();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        userId: userId.toString(),
        addressId,
        orderDate: new Date().toISOString(),
      },
      receipt_email: user.email,
      description: `Order payment for user ${user.email}`,
    });

    // Check payment status
    if (paymentIntent.status === 'succeeded') {
      // Payment successful - Create order
      const randomId = `#${Math.floor(100000 + Math.random() * 900000)}`;
      const order = await Order.create({
        userId,
        orderId: randomId,
        products: orderItems,
        deliveryAddress: addressId,
        scheduledDeliveryDate: deliveryDate,
        customerNote,
        deliveryCharges,
        subtotal,
        total,
        paymentStatus: 'Completed',
        paymentId: paymentIntent.id, // Store Stripe payment intent ID
      });

      // Update user's order history
      await User.findByIdAndUpdate(
        userId,
        { $push: { orderHistory: order._id } },
        { new: true }
      );

      // Clear cart
      cart.items = [];
      await cart.save();

      // Get populated order with full product details
      const populateOrder = await Order.findById(order._id)
        .populate({
          path: 'products.productId',
          select: '_id name price images category description stock',
        })
        .populate('deliveryAddress userId');

      return res.status(201).json(
        new apiResponse(201, 'Payment successful! Order created.', {
          order: populateOrder,
          payment: {
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
          },
        })
      );
    } else if (paymentIntent.status === 'requires_action') {
      // Requires additional action (e.g., 3D Secure)
      return res.status(400).json(
        new apiError(400, 'Payment requires additional authentication', false, {
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
        })
      );
    } else {
      // Payment failed
      return res
        .status(400)
        .json(new apiError(400, `Payment failed: ${paymentIntent.status}`));
    }
  } catch (error) {
    console.log('Error in process payment: ', error);

    if (error.type === 'StripeCardError') {
      return res
        .status(400)
        .json(new apiError(400, `Card error: ${error.message}`));
    }

    if (error.type === 'StripeRateLimitError') {
      return res
        .status(429)
        .json(new apiError(429, 'Too many requests. Please try again later.'));
    }

    if (error.type === 'StripeInvalidRequestError') {
      return res
        .status(400)
        .json(new apiError(400, `Invalid request: ${error.message}`));
    }

    throw new apiError(500, 'Payment processing failed', false, error.message);
  }
});

// Create payment intent (for frontend to initialize payment)
export const createPaymentIntent = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { addressId, deliveryCharges = 0 } = req.body;

    // Get user's cart to calculate amount
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json(new apiError(400, 'Cart is empty'));
    }

    let subtotal = 0;
    cart.items.forEach(item => {
      subtotal += item.product.price * item.quantity;
    });

    const total = subtotal + deliveryCharges;
    const amountInCents = Math.round(total * 100);

    // Create payment intent
    const stripe = getStripeInstance();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId.toString(),
        addressId,
      },
    });

    res.status(200).json(
      new apiResponse(200, 'Payment intent created', {
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      })
    );
  } catch (error) {
    console.log('Error in create payment intent: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Webhook for Stripe events
export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const stripe = getStripeInstance();
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('Payment succeeded:', event.data.object);
      break;

    case 'payment_intent.payment_failed':
      console.log('Payment failed:', event.data.object);
      break;

    case 'charge.refunded':
      console.log('Charge refunded:', event.data.object);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});
