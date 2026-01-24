import { User } from '../models/user.model.js';
import { apiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import jwt from 'jsonwebtoken';

// Role-based authorization middleware
export const authorizeRoles = (...allowedRoles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(new apiError(401, 'Unauthorized access'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json(
          new apiError(
            403,
            `Access denied. Required roles: ${allowedRoles.join(', ')}`
          )
        );
    }

    next();
  });
};

export const authVerify = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json(new apiError(401, 'Unauthorized access'));
    }
    const verifyKey = process.env.ACCESS_TOKEN_SECRET;
    const decodedToken = jwt.verify(token, verifyKey);

    if (!decodedToken) {
      return res
        .status(401)
        .json(
          new apiError(401, 'Invalid or Expired token! Please login again')
        );
    }

    const user = await User.findById(decodedToken._id).select('-password');

    if (!user) {
      return res
        .status(401)
        .json(new apiError(401, 'User not found. Please login again'));
    }

    req.user = user;

    next();
  } catch (error) {
    console.log('Error in auth middleware', error);
    if (error.name === 'JsonWebTokenError') {
      return res
        .status(401)
        .json(new apiError(401, 'Invalid token! Please login again'));
    }
    if (error.name === 'TokenExpiredError') {
      return res
        .status(401)
        .json(new apiError(401, 'Token expired! Please login again'));
    }
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});
