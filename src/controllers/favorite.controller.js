import { Favorite } from '../models/favorite.model.js';
import { Product } from '../models/product.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Add product to favorites
export const addToFavorite = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json(new apiError(400, 'Product ID is required'));
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json(new apiError(404, 'Product not found'));
    }

    // Check if already in favorites
    const existingFavorite = await Favorite.findOne({ userId, productId });
    if (existingFavorite) {
      return res
        .status(400)
        .json(new apiError(400, 'Product already in favorites'));
    }

    const favorite = await Favorite.create({ userId, productId });

    const populatedFavorite = await Favorite.findById(favorite._id)
      .populate('productId')
      .populate('userId', 'name email');

    res
      .status(201)
      .json(
        new apiResponse(201, 'Product added to favorites', populatedFavorite)
      );
  } catch (error) {
    console.log('Error in add to favorite: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Remove product from favorites
export const removeFromFavorite = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json(new apiError(400, 'Product ID is required'));
    }

    const favorite = await Favorite.findOneAndDelete({ userId, productId });

    if (!favorite) {
      return res
        .status(404)
        .json(new apiError(404, 'Product not found in favorites'));
    }

    res
      .status(200)
      .json(new apiResponse(200, 'Product removed from favorites'));
  } catch (error) {
    console.log('Error in remove from favorite: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get user's favorite products
export const getUserFavorites = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const favorites = await Favorite.find({ userId })
      .populate('productId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalFavorites = await Favorite.countDocuments({ userId });

    res.status(200).json(
      new apiResponse(200, 'Favorites fetched successfully', {
        favorites,
        totalFavorites,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalFavorites / limit),
      })
    );
  } catch (error) {
    console.log('Error in get user favorites: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Check if product is in favorites
export const isFavorite = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { productId } = req.params;

    const favorite = await Favorite.findOne({ userId, productId });

    res.status(200).json(
      new apiResponse(200, 'Favorite status fetched', {
        isFavorite: !!favorite,
      })
    );
  } catch (error) {
    console.log('Error in check favorite: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Get all product statistics (total favorites count)
export const getProductFavoriteCount = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    const count = await Favorite.countDocuments({ productId });

    res.status(200).json(
      new apiResponse(200, 'Favorite count fetched', {
        productId,
        favoriteCount: count,
      })
    );
  } catch (error) {
    console.log('Error in get product favorite count: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});
