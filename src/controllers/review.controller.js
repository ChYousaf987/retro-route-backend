import { Review } from '../models/review.model.js';
import { Product } from '../models/product.model.js';
import { Order } from '../models/order.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

// Create a review for a product
export const createReview = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId, rating, title, comment, images = [] } = req.body;

    if (!productId || !rating || !title || !comment) {
      throw new apiError(
        400,
        'Product ID, rating, title, and comment are required'
      );
    }

    if (rating < 1 || rating > 5) {
      throw new apiError(400, 'Rating must be between 1 and 5');
    }

    // Verify user has purchased this product
    const userOrder = await Order.findOne({
      userId,
      'products.productId': productId,
    });

    if (!userOrder) {
      throw new apiError(400, 'You can only review products you have purchased');
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ userId, productId });
    if (existingReview) {
      throw new apiError(400, 'You have already reviewed this product');
    }

    const review = await Review.create({
      userId,
      productId,
      rating,
      title,
      comment,
      images,
      verified: true, // Mark as verified since user purchased the product
    });

    const populatedReview = await Review.findById(review._id)
      .populate('userId', 'name avatar email')
      .populate('productId', 'name');

    res
      .status(201)
      .json(
        new apiResponse(201, populatedReview, 'Review created successfully')
      );
  } catch (error) {
    console.log('Error in create review: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get product reviews
export const getProductReviews = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt' } = req.query;

    const skip = (page - 1) * limit;

    const reviews = await Review.find({ productId })
      .populate('userId', 'name avatar email')
      .sort({ [sortBy]: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalReviews = await Review.countDocuments({ productId });

    // Calculate average rating
    const avgRating = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]);

    res.status(200).json(
      new apiResponse(200, {
        reviews,
        totalReviews,
        averageRating: avgRating[0]?.avgRating || 0,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalReviews / limit),
      }, 'Reviews fetched successfully')
    );
  } catch (error) {
    console.log('Error in get product reviews: ', error);
    throw new apiError(500, error.message);
  }
});

// Get user's reviews
export const getUserReviews = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;

    const reviews = await Review.find({ userId })
      .populate('productId', 'name images')
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json(new apiResponse(200, reviews, 'User reviews fetched successfully'));
  } catch (error) {
    console.log('Error in get user reviews: ', error);
    throw new apiError(500, error.message);
  }
});

// Update review
export const updateReview = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { reviewId } = req.params;
    const { rating, title, comment, images } = req.body;

    const review = await Review.findById(reviewId);

    if (!review) {
      throw new apiError(404, 'Review not found');
    }

    if (review.userId.toString() !== userId.toString()) {
      throw new apiError(403, 'You are not authorized to update this review');
    }

    if (rating && (rating < 1 || rating > 5)) {
      throw new apiError(400, 'Rating must be between 1 and 5');
    }

    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      {
        rating: rating || review.rating,
        title: title || review.title,
        comment: comment || review.comment,
        images: images || review.images,
      },
      { new: true }
    )
      .populate('userId', 'name avatar email')
      .populate('productId', 'name');

    res
      .status(200)
      .json(new apiResponse(200, updatedReview, 'Review updated successfully'));
  } catch (error) {
    console.log('Error in update review: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Delete review
export const deleteReview = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review) {
      throw new apiError(404, 'Review not found');
    }

    if (review.userId.toString() !== userId.toString()) {
      throw new apiError(403, 'You are not authorized to delete this review');
    }

    await Review.findByIdAndDelete(reviewId);

    res.status(200).json(new apiResponse(200, null, 'Review deleted successfully'));
  } catch (error) {
    console.log('Error in delete review: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Mark review as helpful or unhelpful
export const markHelpful = asyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { helpful = true } = req.body;

    const review = await Review.findById(reviewId);

    if (!review) {
      throw new apiError(404, 'Review not found');
    }

    if (helpful) {
      review.helpful += 1;
    } else {
      review.unhelpful += 1;
    }

    await review.save();

    res
      .status(200)
      .json(new apiResponse(200, review, 'Review marked successfully'));
  } catch (error) {
    console.log('Error in mark helpful: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});