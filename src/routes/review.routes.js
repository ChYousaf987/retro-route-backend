import express from 'express';
import { authVerify } from '../middlewares/auth.middleware.js';
import {
  createReview,
  getProductReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  markHelpful,
} from '../controllers/review.controller.js';

const router = express.Router();

// Public routes
router.get('/product/:productId', getProductReviews);

// Protected routes
router.post('/create', authVerify, createReview);
router.get('/user/my-reviews', authVerify, getUserReviews);
router.put('/update/:reviewId', authVerify, updateReview);
router.delete('/delete/:reviewId', authVerify, deleteReview);
router.patch('/helpful/:reviewId', authVerify, markHelpful);

export default router;
