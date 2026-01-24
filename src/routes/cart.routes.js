import { Router } from "express";
import { addToCart, clearCart, getCart } from "../controllers/cart.controller.js";
import { authVerify } from "../middlewares/auth.middleware.js";

const cartRouter = Router()

cartRouter.route('/add-to-cart').post(authVerify, addToCart)
cartRouter.route('/get-cart').get(authVerify, getCart)
cartRouter.route('/clear-cart').delete(authVerify, clearCart)

export { cartRouter }