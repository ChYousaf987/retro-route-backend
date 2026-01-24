import { Router } from "express";
import { addCategory, deleteCategory, getAllCategories, updateCategory } from "../controllers/category.controller.js";
import { authVerify } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const categoryRouter = Router();

categoryRouter.route('/add-category').post(authVerify, upload.single('image'), addCategory)
categoryRouter.route('/get-all-categories').get(getAllCategories)
categoryRouter.route('/update-category/:categoryId').put(authVerify, upload.single('image'), updateCategory)
categoryRouter.route('/delete-category/:categoryId').delete(authVerify, deleteCategory)

export { categoryRouter }