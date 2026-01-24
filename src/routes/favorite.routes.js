import express from 'express';
import { authVerify } from '../middlewares/auth.middleware.js';
import {
  addToFavorite,
  removeFromFavorite,
  getUserFavorites,
  isFavorite,
  getProductFavoriteCount,
} from '../controllers/favorite.controller.js';

const router = express.Router();

// Protected routes
router.post('/add', authVerify, addToFavorite);
router.post('/remove', authVerify, removeFromFavorite);
router.get('/my-favorites', authVerify, getUserFavorites);
router.get('/check/:productId', authVerify, isFavorite);

// Public routes
router.get('/count/:productId', getProductFavoriteCount);

export default router;
