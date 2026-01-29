import { Router } from 'express';
import { authVerify } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import {
  addProduct,
  deleteProduct,
  getAllProducts,
  getProduct,
  getProductsByCategory,
  updateProduct,
} from '../controllers/product.controller.js';

const productRouter = Router();

productRouter
  .route('/add-product')
  .post(authVerify, upload.array('images', 4), addProduct);
productRouter.route('/get-all-products').get(getAllProducts);
productRouter.route('/category/:categoryId').get(getProductsByCategory);
productRouter.route('/get-product/:productId').get(getProduct);
productRouter
  .route('/update-product/:productId')
  .put(authVerify, upload.array('images', 4), updateProduct);
productRouter
  .route('/delete-product/:productId')
  .delete(authVerify, deleteProduct);

export { productRouter };
