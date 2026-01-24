import { Router } from "express";
import { addAddress, deleteAddress, updateAddress } from "../controllers/address.controller.js";
import { authVerify } from "../middlewares/auth.middleware.js";

const addressRouter = Router();

addressRouter.route('/add-address').post(authVerify, addAddress)
addressRouter.route('/update-address').put(authVerify, updateAddress)
addressRouter.route('/delete-address').delete(authVerify, deleteAddress)

export { addressRouter }