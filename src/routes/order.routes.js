import { Router } from 'express';
import {
  createOrder,
  checkPaymentStatus,
  getAllOrders,
  getMonthlySales,
  getOrderSales,
  getWeeklySales,
  paymentStatus,
  updateOrderStatus,
  // Driver related controllers
  assignDeliveryToDriver,
  getAllDrivers,
  getMyDeliveries,
  updateDeliveryStatusByDriver,
  getUnassignedOrders,
  updateDriverAvailability,
  unassignDriverFromOrder,
  getDriverDeliveryStats,
  getAllOrdersAdmin,
  getDriverStatsByAdmin,
} from '../controllers/order.controller.js';
import { authVerify, authorizeRoles } from '../middlewares/auth.middleware.js';

const orderRouter = Router();

// Customer routes
orderRouter.route('/create-order').post(authVerify, createOrder);
orderRouter.route('/check-payment-status').post(authVerify, checkPaymentStatus);
orderRouter.route('/get-all-orders').get(authVerify, getAllOrders);

// Admin routes
orderRouter
  .route('/update-order-status')
  .put(authVerify, authorizeRoles('Admin', 'SuperAdmin'), updateOrderStatus);
orderRouter
  .route('/update-order-payment-status')
  .put(authVerify, authorizeRoles('Admin', 'SuperAdmin'), paymentStatus);
orderRouter
  .route('/total-sales')
  .get(authVerify, authorizeRoles('Admin', 'SuperAdmin'), getOrderSales);
orderRouter
  .route('/weekly-sales-stats')
  .get(authVerify, authorizeRoles('Admin', 'SuperAdmin'), getWeeklySales);
orderRouter
  .route('/monthly-sales-stats')
  .get(authVerify, authorizeRoles('Admin', 'SuperAdmin'), getMonthlySales);

// ==================== DRIVER RELATED ROUTES ====================

// Admin routes for driver management
orderRouter
  .route('/assign-driver')
  .post(
    authVerify,
    authorizeRoles('Admin', 'SuperAdmin'),
    assignDeliveryToDriver
  );
orderRouter
  .route('/unassign-driver')
  .put(
    authVerify,
    authorizeRoles('Admin', 'SuperAdmin'),
    unassignDriverFromOrder
  );
orderRouter
  .route('/get-all-drivers')
  .get(authVerify, authorizeRoles('Admin', 'SuperAdmin'), getAllDrivers);
orderRouter
  .route('/unassigned-orders')
  .get(authVerify, authorizeRoles('Admin', 'SuperAdmin'), getUnassignedOrders);
orderRouter
  .route('/all-orders-admin')
  .get(authVerify, authorizeRoles('Admin', 'SuperAdmin'), getAllOrdersAdmin);
orderRouter
  .route('/driver-stats-admin/:driverId')
  .get(
    authVerify,
    authorizeRoles('Admin', 'SuperAdmin'),
    getDriverStatsByAdmin
  );

// Driver routes
orderRouter
  .route('/my-deliveries')
  .get(authVerify, authorizeRoles('Driver'), getMyDeliveries);
orderRouter
  .route('/update-delivery-status')
  .put(authVerify, authorizeRoles('Driver'), updateDeliveryStatusByDriver);
orderRouter
  .route('/update-availability')
  .put(authVerify, authorizeRoles('Driver'), updateDriverAvailability);
orderRouter
  .route('/driver-stats')
  .get(authVerify, authorizeRoles('Driver'), getDriverDeliveryStats);

export { orderRouter };
