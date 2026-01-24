import { Router } from 'express';
import {
  deleteAdmin,
  forgotPassword,
  forgotPasswordOTPVerification,
  getAllAdmins,
  getAllUsers,
  getUserDetails,
  login,
  logout,
  register,
  resetPassword,
  updateAdminDetails,
  updateUserDetails,
  verifyRegistrationOTP,
  resendRegistrationOTP,
} from '../controllers/user.controller.js';
import { authVerify } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';

const userRouter = Router();

userRouter.route('/register').post(register);
userRouter.route('/verify-registration-otp').post(verifyRegistrationOTP);
userRouter.route('/resend-registration-otp').post(resendRegistrationOTP);
userRouter.route('/login').post(login);
userRouter.route('/get-all-users').get(getAllUsers);

// secure routes
userRouter.route('/logout').post(authVerify, logout);
userRouter.route('/get-user-details').get(authVerify, getUserDetails);
userRouter
  .route('/update-user-details')
  .put(authVerify, upload.single('avatar'), updateUserDetails);

userRouter.route('/forgot-password').put(forgotPassword);
userRouter
  .route('/forgot-password-otp-verify')
  .put(forgotPasswordOTPVerification);
userRouter.route('/reset-password').put(resetPassword);

// admin routes
userRouter.route('/get-all-admins').get(authVerify, getAllAdmins);
userRouter
  .route('/update-admin-details/:adminId')
  .put(authVerify, updateAdminDetails);
userRouter.route('/delete-admin/:adminId').delete(authVerify, deleteAdmin);

export { userRouter };
