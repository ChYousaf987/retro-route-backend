import Stripe from 'stripe';
import { Cart } from '../models/cart.model.js';
import { Order } from '../models/order.model.js';
import { User } from '../models/user.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

// Lazy-load Stripe instance to ensure environment variables are loaded
const getStripeInstance = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is not defined in environment variables'
    );
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

/**
 * UNIFIED CREATE ORDER API
 * Handles: Order Creation + Payment Processing + Payment Status Checking
 *
 * This endpoint:
 * 1. Validates user cart/products and delivery details
 * 2. Creates order with PENDING status
 * 3. Creates Stripe Payment Intent
 * 4. Returns clientSecret for frontend payment completion
 * 5. Webhook handles payment success/failure and updates order status
 */
export const createOrder = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const {
      addressId,
      deliveryCharges = 0,
      scheduledDeliveryDate,
      customerNote = '',
    } = req.body;

    // ===== VALIDATION =====
    if (!addressId) {
      return res.status(400).json(new apiError(400, 'Address ID is required'));
    }

    if (!scheduledDeliveryDate) {
      return res
        .status(400)
        .json(new apiError(400, 'Scheduled delivery date is required'));
    }

    // Validate that the delivery date is in the future
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

    // Get user's cart with populated products
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json(new apiError(400, 'Cart is empty'));
    }

    let subtotal = 0;

    // Prepare order items from cart
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

    // ===== STEP 1: CREATE ORDER IN DATABASE (PENDING STATUS) =====
    const randomId = `#${Math.floor(100000 + Math.random() * 900000)}`;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json(new apiError(404, 'User not found'));
    }

    // Create order with Pending payment status
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
      paymentStatus: 'Pending', // Initial status - waiting for payment
      deliveryStatus: 'Pending',
    });

    // Add order to user's order history
    await User.findByIdAndUpdate(
      userId,
      { $push: { orderHistory: order._id } },
      { new: true }
    );

    // ===== STEP 2: CREATE STRIPE PAYMENT INTENT =====
    const amountInCents = Math.round(total * 100); // Stripe uses cents
    const stripe = getStripeInstance();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId.toString(),
        orderId: order._id.toString(),
        orderNumber: randomId,
        addressId: addressId.toString(),
        totalAmount: total.toString(),
      },
      receipt_email: user.email,
      description: `Order ${randomId} for ${user.email} - ${orderItems.length} item(s)`,
    });

    // ===== STEP 3: SAVE STRIPE PAYMENT INTENT ID TO ORDER =====
    order.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    // ===== STEP 4: RETURN PAYMENT INTENT TO FRONTEND =====
    // Frontend will use clientSecret to complete payment via Stripe Payment Sheet
    return res.status(201).json(
      new apiResponse(201, 'Order created. Complete payment to confirm.', {
        orderId: order._id,
        orderNumber: randomId,
        stripePaymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret, // Frontend uses this for payment
        paymentAmount: total,
        paymentCurrency: paymentIntent.currency.toUpperCase(),
        paymentStatus: 'Pending', // Waiting for payment
        deliveryAddress: order.deliveryAddress,
        scheduledDeliveryDate: order.scheduledDeliveryDate,
        items: orderItems.length,
        subtotal,
        deliveryCharges,
        total,
        message:
          'Payment is pending. Use the clientSecret to complete payment on the mobile app.',
      })
    );
  } catch (error) {
    console.log('Error in create order: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

/**
 * CHECK ORDER PAYMENT STATUS
 * Allows frontend to check if payment is successful or not
 *
 * Returns: Payment status and order details
 */
export const checkPaymentStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json(new apiError(400, 'Order ID is required'));
    }

    // Fetch order from database
    const order = await Order.findById(orderId).populate(
      'products.productId deliveryAddress'
    );

    if (!order) {
      return res.status(404).json(new apiError(404, 'Order not found'));
    }

    // Verify user owns this order
    if (order.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json(new apiError(403, 'Unauthorized access'));
    }

    // If payment is already completed, return success
    if (order.paymentStatus === 'Completed') {
      // Clear user's cart since payment is successful
      await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

      return res.status(200).json(
        new apiResponse(200, 'Payment successful! Order confirmed.', {
          orderId: order._id,
          orderNumber: order.orderId,
          paymentStatus: 'Completed',
          deliveryStatus: order.deliveryStatus,
          orderDetails: {
            items: order.products.length,
            subtotal: order.subtotal,
            deliveryCharges: order.deliveryCharges,
            total: order.total,
            scheduledDeliveryDate: order.scheduledDeliveryDate,
            customerNote: order.customerNote,
          },
          order,
        })
      );
    }

    // If payment is still pending, check with Stripe
    if (order.paymentStatus === 'Pending' && order.stripePaymentIntentId) {
      try {
        const stripe = getStripeInstance();
        const paymentIntent = await stripe.paymentIntents.retrieve(
          order.stripePaymentIntentId
        );

        // Check current payment status from Stripe
        if (paymentIntent.status === 'succeeded') {
          // Payment succeeded, update order status
          order.paymentStatus = 'Completed';
          await order.save();

          // Clear user's cart
          await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });

          return res.status(200).json(
            new apiResponse(200, 'Payment successful! Order confirmed.', {
              orderId: order._id,
              orderNumber: order.orderId,
              paymentStatus: 'Completed',
              deliveryStatus: order.deliveryStatus,
              orderDetails: {
                items: order.products.length,
                subtotal: order.subtotal,
                deliveryCharges: order.deliveryCharges,
                total: order.total,
                scheduledDeliveryDate: order.scheduledDeliveryDate,
                customerNote: order.customerNote,
              },
              order,
            })
          );
        } else if (paymentIntent.status === 'processing') {
          return res.status(202).json(
            new apiResponse(202, 'Payment is still being processed', {
              orderId: order._id,
              orderNumber: order.orderId,
              paymentStatus: 'Processing',
              message: 'Your payment is being processed. Please wait.',
            })
          );
        } else if (paymentIntent.status === 'requires_payment_method') {
          return res.status(400).json(
            new apiError(400, 'Payment method failed. Please try again.', {
              orderId: order._id,
              paymentStatus: 'Failed',
            })
          );
        } else if (paymentIntent.status === 'canceled') {
          order.paymentStatus = 'Failed';
          await order.save();

          return res.status(400).json(
            new apiError(400, 'Payment was canceled', {
              orderId: order._id,
              paymentStatus: 'Failed',
            })
          );
        } else {
          return res.status(400).json(
            new apiError(400, `Payment status: ${paymentIntent.status}`, {
              orderId: order._id,
              paymentStatus: paymentIntent.status,
            })
          );
        }
      } catch (stripeError) {
        console.log('Error checking Stripe payment intent:', stripeError);
        return res
          .status(500)
          .json(
            new apiError(
              500,
              'Error checking payment status',
              false,
              stripeError.message
            )
          );
      }
    }

    // If payment failed
    if (order.paymentStatus === 'Failed') {
      return res.status(400).json(
        new apiError(400, 'Payment failed. Please try again.', {
          orderId: order._id,
          orderNumber: order.orderId,
          paymentStatus: 'Failed',
        })
      );
    }

    // Default response
    return res.status(200).json(
      new apiResponse(200, 'Order payment status retrieved', {
        orderId: order._id,
        orderNumber: order.orderId,
        paymentStatus: order.paymentStatus,
        deliveryStatus: order.deliveryStatus,
      })
    );
  } catch (error) {
    console.log('Error checking payment status: ', error);
    throw new apiError(
      500,
      'Error checking payment status',
      false,
      error.message
    );
  }
});

export const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;

    const orders = await Order.find({ userId }).populate(
      'products.productId deliveryAddress'
    );

    return res
      .status(200)
      .json(new apiResponse(200, 'Orders fetched successfully', orders));
  } catch (error) {
    console.log('Error in get all orders: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res
        .status(400)
        .json(new apiError(400, 'Order ID and status are required'));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json(new apiError(404, 'Order not found'));
    }

    if (status !== undefined && status !== null && status !== '') {
      const validStatuses = ['Pending', 'On My Way', 'Delivered'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        });
      }

      order.deliveryStatus = status;

      // If delivered, set the delivered timestamp
      if (status === 'Delivered') {
        order.deliveredAt = new Date();
      }
    }

    await order.save();

    return res
      .status(200)
      .json(new apiResponse(200, 'Order status updated successfully', order));
  } catch (error) {
    console.log('Error in update order status: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

export const paymentStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId, paymentStatus } = req.body;

    if (!orderId || !paymentStatus) {
      return res
        .status(400)
        .json(new apiError(400, 'Order ID and payment status are required'));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json(new apiError(404, 'Order not found'));
    }

    if (
      paymentStatus !== undefined &&
      paymentStatus !== null &&
      paymentStatus !== ''
    ) {
      const validStatuses = ['Pending', 'Completed', 'Failed'];
      if (!validStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: `Payment status must be one of: ${validStatuses.join(', ')}`,
        });
      }

      order.paymentStatus = paymentStatus;
    }

    await order.save();

    return res
      .status(200)
      .json(new apiResponse(200, 'Payment status updated successfully', order));
  } catch (error) {
    console.log('Error in update payment status: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

export const getOrderSales = asyncHandler(async (req, res) => {
  try {
    const orders = await Order.find().select('total createdAt');

    const today = new Date();

    // today
    const startToday = startOfDay(today);
    const endToday = endOfDay(today);

    // yesterday
    const yesterday = subDays(today, 1);
    const startYesterday = startOfDay(yesterday);
    const endYesterday = endOfDay(yesterday);

    // this week
    const startThisWeek = startOfWeek(today);
    const endThisWeek = endOfWeek(today);

    // last week
    const lastWeek = subWeeks(today, 1);
    const startLastWeek = startOfWeek(lastWeek);
    const endLastWeek = endOfWeek(lastWeek);

    let todaySales = 0;
    let yesterdaySales = 0;
    let thisWeekSales = 0;
    let lastWeekSales = 0;
    let totalSales = 0;

    for (const order of orders) {
      const amount = order.total || 0;
      const date = order.createdAt;

      totalSales += amount;

      if (date >= startToday && date <= endToday) todaySales += amount;
      if (date >= startYesterday && date <= endYesterday)
        yesterdaySales += amount;
      if (date >= startThisWeek && date <= endThisWeek) thisWeekSales += amount;
      if (date >= startLastWeek && date <= endLastWeek) lastWeekSales += amount;
    }

    // today %
    let todayPercentage = 0;
    if (yesterdaySales > 0) {
      todayPercentage = ((todaySales - yesterdaySales) / yesterdaySales) * 100;
    }

    // total %
    let totalPercentage = 0;
    if (lastWeekSales > 0) {
      totalPercentage = ((thisWeekSales - lastWeekSales) / lastWeekSales) * 100;
    }

    const responseData = {
      totalSales,
      todaySales,
      todayPercentage: Number(todayPercentage.toFixed(2)),
      totalPercentage: Number(totalPercentage.toFixed(2)),
    };

    return res
      .status(200)
      .json(
        new apiResponse(200, 'Order sales fetched successfully', responseData)
      );
  } catch (error) {
    console.log('Error in get order sales: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

export const getWeeklySales = asyncHandler(async (req, res) => {
  try {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });

    const data = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: '$createdAt' },
          total: { $sum: '$total' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // MongoDB: 1=Sunday, 2=Monday...
    const weekMap = {
      1: 'Sun',
      2: 'Mon',
      3: 'Tue',
      4: 'Wed',
      5: 'Thu',
      6: 'Fri',
      7: 'Sat',
    };

    const result = Object.values(weekMap).map(day => ({
      day,
      total: 0,
    }));

    data.forEach(item => {
      const dayName = weekMap[item._id];
      const index = result.findIndex(d => d.day === dayName);
      if (index !== -1) result[index].total = item.total;
    });

    return res
      .status(200)
      .json(new apiResponse(200, 'Weekly sales fetched', result));
  } catch (error) {
    console.log('Error in getWeeklySales', error);
    throw new apiError(500, 'Internal Server Error');
  }
});

export const getMonthlySales = asyncHandler(async (req, res) => {
  try {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());

    const data = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: '$createdAt' },
          total: { $sum: '$total' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const daysInMonth = end.getDate();
    const result = [];

    for (let i = 1; i <= daysInMonth; i++) {
      const found = data.find(d => d._id === i);
      result.push({
        day: i,
        total: found ? found.total : 0,
      });
    }

    return res
      .status(200)
      .json(new apiResponse(200, 'Monthly sales fetched', result));
  } catch (error) {
    console.log('Error in getMonthlySales', error);
    throw new apiError(500, 'Internal Server Error');
  }
});

// ==================== DRIVER RELATED CONTROLLERS ====================

// Assign a delivery to a driver (Admin only)
export const assignDeliveryToDriver = asyncHandler(async (req, res) => {
  try {
    const { orderId, driverId } = req.body;

    if (!orderId || !driverId) {
      return res
        .status(400)
        .json(new apiError(400, 'Order ID and Driver ID are required'));
    }

    // Check if driver exists and has driver role
    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json(new apiError(404, 'Driver not found'));
    }

    if (driver.role !== 'Driver') {
      return res
        .status(400)
        .json(new apiError(400, 'Selected user is not a driver'));
    }

    if (!driver.isAvailable) {
      return res
        .status(400)
        .json(new apiError(400, 'Driver is currently not available'));
    }

    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json(new apiError(404, 'Order not found'));
    }

    if (order.deliveryStatus === 'Delivered') {
      return res
        .status(400)
        .json(
          new apiError(
            400,
            `Cannot assign driver to ${order.deliveryStatus.toLowerCase()} order`
          )
        );
    }

    // Assign driver to order (status remains Pending until driver starts delivery)
    order.assignedDriver = driverId;
    order.driverAssignedAt = new Date();
    await order.save();

    // Add order to driver's assigned deliveries
    await User.findByIdAndUpdate(
      driverId,
      { $addToSet: { assignedDeliveries: orderId } },
      { new: true }
    );

    const populatedOrder = await Order.findById(orderId)
      .populate(
        'products.productId deliveryAddress assignedDriver',
        '-password'
      )
      .populate('userId', 'name email');

    return res
      .status(200)
      .json(
        new apiResponse(200, 'Driver assigned successfully', populatedOrder)
      );
  } catch (error) {
    console.log('Error in assignDeliveryToDriver: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get all available drivers (Admin only)
export const getAllDrivers = asyncHandler(async (req, res) => {
  try {
    const { available } = req.query;

    let query = { role: 'Driver' };

    if (available === 'true') {
      query.isAvailable = true;
    } else if (available === 'false') {
      query.isAvailable = false;
    }

    const drivers = await User.find(query)
      .select('-password -forgotPasswordOTP -forgotPasswordOTPExpires')
      .populate('assignedDeliveries');

    return res
      .status(200)
      .json(new apiResponse(200, 'Drivers fetched successfully', drivers));
  } catch (error) {
    console.log('Error in getAllDrivers: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get driver's assigned deliveries (Driver only)
export const getMyDeliveries = asyncHandler(async (req, res) => {
  try {
    const driverId = req.user?._id;
    const { status, date } = req.query;

    let query = { assignedDriver: driverId };

    if (status) {
      query.deliveryStatus = status;
    }

    // Filter by scheduled delivery date
    if (date) {
      const filterDate = new Date(date);
      const startOfFilterDay = startOfDay(filterDate);
      const endOfFilterDay = endOfDay(filterDate);
      query.scheduledDeliveryDate = {
        $gte: startOfFilterDay,
        $lte: endOfFilterDay,
      };
    }

    const deliveries = await Order.find(query)
      .populate('products.productId', 'name price image')
      .populate('deliveryAddress')
      .populate('userId', 'name email')
      .sort({ scheduledDeliveryDate: 1 });

    return res
      .status(200)
      .json(
        new apiResponse(200, 'Deliveries fetched successfully', deliveries)
      );
  } catch (error) {
    console.log('Error in getMyDeliveries: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Update delivery status by driver
export const updateDeliveryStatusByDriver = asyncHandler(async (req, res) => {
  try {
    const driverId = req.user?._id;
    const { orderId, status, notes } = req.body;

    if (!orderId || !status) {
      return res
        .status(400)
        .json(new apiError(400, 'Order ID and status are required'));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json(new apiError(404, 'Order not found'));
    }

    // Check if driver is assigned to this order
    if (order.assignedDriver?.toString() !== driverId.toString()) {
      return res
        .status(403)
        .json(new apiError(403, 'You are not assigned to this delivery'));
    }

    const validDriverStatuses = ['On My Way', 'Delivered'];
    if (!validDriverStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validDriverStatuses.join(', ')}`,
      });
    }

    order.deliveryStatus = status;

    if (notes) {
      order.driverNotes = notes;
    }

    // If delivered, set the delivered timestamp
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    const populatedOrder = await Order.findById(orderId)
      .populate('products.productId deliveryAddress')
      .populate('userId', 'name email');

    return res
      .status(200)
      .json(
        new apiResponse(
          200,
          'Delivery status updated successfully',
          populatedOrder
        )
      );
  } catch (error) {
    console.log('Error in updateDeliveryStatusByDriver: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get orders pending assignment (Admin only)
export const getUnassignedOrders = asyncHandler(async (req, res) => {
  try {
    const { date } = req.query;

    let query = {
      assignedDriver: null,
      deliveryStatus: { $nin: ['Delivered', 'Cancelled'] },
    };

    // Filter by scheduled delivery date
    if (date) {
      const filterDate = new Date(date);
      const startOfFilterDay = startOfDay(filterDate);
      const endOfFilterDay = endOfDay(filterDate);
      query.scheduledDeliveryDate = {
        $gte: startOfFilterDay,
        $lte: endOfFilterDay,
      };
    }

    const orders = await Order.find(query)
      .populate('products.productId', 'name price image')
      .populate('deliveryAddress')
      .populate('userId', 'name email')
      .sort({ scheduledDeliveryDate: 1 });

    return res
      .status(200)
      .json(
        new apiResponse(200, 'Unassigned orders fetched successfully', orders)
      );
  } catch (error) {
    console.log('Error in getUnassignedOrders: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Update driver availability (Driver only)
export const updateDriverAvailability = asyncHandler(async (req, res) => {
  try {
    const driverId = req.user?._id;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res
        .status(400)
        .json(new apiError(400, 'isAvailable must be a boolean value'));
    }

    const driver = await User.findByIdAndUpdate(
      driverId,
      { isAvailable },
      { new: true }
    ).select('-password -forgotPasswordOTP -forgotPasswordOTPExpires');

    return res
      .status(200)
      .json(new apiResponse(200, 'Availability updated successfully', driver));
  } catch (error) {
    console.log('Error in updateDriverAvailability: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Unassign driver from an order (Admin only)
export const unassignDriverFromOrder = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json(new apiError(400, 'Order ID is required'));
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json(new apiError(404, 'Order not found'));
    }

    if (!order.assignedDriver) {
      return res
        .status(400)
        .json(new apiError(400, 'No driver is assigned to this order'));
    }

    if (order.deliveryStatus === 'Delivered') {
      return res
        .status(400)
        .json(new apiError(400, 'Cannot unassign driver from delivered order'));
    }

    const previousDriverId = order.assignedDriver;

    // Remove order from driver's assigned deliveries
    await User.findByIdAndUpdate(previousDriverId, {
      $pull: { assignedDeliveries: orderId },
    });

    // Unassign driver from order
    order.assignedDriver = null;
    order.driverAssignedAt = null;
    order.deliveryStatus = 'Pending';
    await order.save();

    const populatedOrder = await Order.findById(orderId)
      .populate('products.productId deliveryAddress')
      .populate('userId', 'name email');

    return res
      .status(200)
      .json(
        new apiResponse(200, 'Driver unassigned successfully', populatedOrder)
      );
  } catch (error) {
    console.log('Error in unassignDriverFromOrder: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get delivery statistics for a driver
export const getDriverDeliveryStats = asyncHandler(async (req, res) => {
  try {
    const driverId = req.user?._id;

    const today = new Date();
    const startToday = startOfDay(today);
    const endToday = endOfDay(today);

    // Total deliveries
    const totalDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
    });

    // Completed deliveries
    const completedDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      deliveryStatus: 'Delivered',
    });

    // Pending deliveries
    const pendingDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      deliveryStatus: 'Pending',
    });

    // On My Way deliveries
    const onMyWayDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      deliveryStatus: 'On My Way',
    });

    // Today's deliveries
    const todayDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      scheduledDeliveryDate: { $gte: startToday, $lte: endToday },
    });

    // Today's completed deliveries
    const todayCompletedDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      scheduledDeliveryDate: { $gte: startToday, $lte: endToday },
      deliveryStatus: 'Delivered',
    });

    const stats = {
      totalDeliveries,
      completedDeliveries,
      pendingDeliveries,
      onMyWayDeliveries,
      todayDeliveries,
      todayCompletedDeliveries,
      completionRate:
        totalDeliveries > 0
          ? Number(((completedDeliveries / totalDeliveries) * 100).toFixed(2))
          : 0,
    };

    return res
      .status(200)
      .json(new apiResponse(200, 'Driver stats fetched successfully', stats));
  } catch (error) {
    console.log('Error in getDriverDeliveryStats: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get all orders with driver info (Admin only)
export const getAllOrdersAdmin = asyncHandler(async (req, res) => {
  try {
    const { status, driverId, date, page = 1, limit = 20 } = req.query;

    let query = {};

    if (status) {
      query.deliveryStatus = status;
    }

    if (driverId) {
      query.assignedDriver = driverId;
    }

    if (date) {
      const filterDate = new Date(date);
      const startOfFilterDay = startOfDay(filterDate);
      const endOfFilterDay = endOfDay(filterDate);
      query.scheduledDeliveryDate = {
        $gte: startOfFilterDay,
        $lte: endOfFilterDay,
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(query)
      .populate('products.productId', 'name price image')
      .populate('deliveryAddress')
      .populate('userId', 'name email')
      .populate('assignedDriver', 'name email isAvailable')
      .sort({ scheduledDeliveryDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalOrders = await Order.countDocuments(query);

    return res.status(200).json(
      new apiResponse(200, 'Orders fetched successfully', {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalOrders / parseInt(limit)),
          totalOrders,
          hasNextPage: skip + orders.length < totalOrders,
          hasPrevPage: parseInt(page) > 1,
        },
      })
    );
  } catch (error) {
    console.log('Error in getAllOrdersAdmin: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get driver stats by driverId (Admin only)
export const getDriverStatsByAdmin = asyncHandler(async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!driverId) {
      return res.status(400).json(new apiError(400, 'Driver ID is required'));
    }

    // Check if driver exists
    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json(new apiError(404, 'Driver not found'));
    }

    if (driver.role !== 'Driver') {
      return res.status(400).json(new apiError(400, 'User is not a driver'));
    }

    const today = new Date();
    const startToday = startOfDay(today);
    const endToday = endOfDay(today);

    // Total assigned deliveries
    const totalDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
    });

    // Completed deliveries (Delivered)
    const completedDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      deliveryStatus: 'Delivered',
    });

    // Pending deliveries
    const pendingDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      deliveryStatus: 'Pending',
    });

    // On My Way deliveries
    const onMyWayDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      deliveryStatus: 'On My Way',
    });

    // Today's scheduled deliveries
    const todayDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      scheduledDeliveryDate: { $gte: startToday, $lte: endToday },
    });

    // Today's completed deliveries
    const todayCompletedDeliveries = await Order.countDocuments({
      assignedDriver: driverId,
      scheduledDeliveryDate: { $gte: startToday, $lte: endToday },
      deliveryStatus: 'Delivered',
    });

    // Get recent deliveries for this driver
    const recentDeliveries = await Order.find({ assignedDriver: driverId })
      .populate('products.productId', 'name price image')
      .populate('deliveryAddress')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    const stats = {
      driverInfo: {
        _id: driver._id,
        name: driver.name,
        email: driver.email,
        isAvailable: driver.isAvailable,
      },
      totalDeliveries,
      completedDeliveries,
      pendingDeliveries,
      onMyWayDeliveries,
      todayDeliveries,
      todayCompletedDeliveries,
      completionRate:
        totalDeliveries > 0
          ? Number(((completedDeliveries / totalDeliveries) * 100).toFixed(2))
          : 0,
      recentDeliveries,
    };

    return res
      .status(200)
      .json(new apiResponse(200, 'Driver stats fetched successfully', stats));
  } catch (error) {
    console.log('Error in getDriverStatsByAdmin: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});
