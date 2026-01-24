import { Cart } from "../models/cart.model.js";
import { User } from "../models/user.model.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const addToCart = asyncHandler(async (req, res) => {
    try {
        const { productId, quantity } = req.body
        const userId = req.user?._id

        if (!productId || !quantity) {
            return res.status(400).json(new apiError(400, 'Product ID and quantity are required'))
        }

        let cart = await Cart.findOne({ user: userId })

        if (!cart) {
            cart = await Cart.create({
                user: userId,
                items: [
                    {
                        product: productId,
                        quantity
                    }
                ]
            })
        } else {
            const itemIndex = cart.items.findIndex(item => item.product.toString() === productId)

            if (itemIndex !== -1) {
                cart.items[itemIndex].quantity += quantity
            } else {
                cart.items.push({
                    product: productId,
                    quantity
                })
            }
        }


        await User.findByIdAndUpdate(userId, { $push: { shoppingCart: cart._id } }, { new: true })

        await cart.save()

        return res.status(200).json(new apiResponse(200, 'Product added to cart successfully'))
    } catch (error) {
        console.log("Error in add to cart: ", error)
        throw new apiError(500, 'Internal Server Error', false, error.message);
    }
})


export const getCart = asyncHandler(async (req, res) => {
    try {
        const userId = req.user?._id

        const cart = await Cart.findOne({ user: userId }).populate('items.product')

        if (!cart || cart.items.length === 0) {
            return res.status(200).json(new apiError(200, 'Cart is empty'))
        }

        return res.status(200).json(new apiResponse(200, 'Cart fetched successfully', cart))
    } catch (error) {
        console.log("Error in get cart: ", error)
        throw new apiError(500, 'Internal Server Error', false, error.message);
    }
})

export const clearCart = asyncHandler(async (req, res) => {
    try {
        const userId = req.user?._id

        const cart = await Cart.findOne({ user: userId })

        if (!cart || cart.items.length === 0) {
            return res.status(200).json(new apiError(200, 'Cart is empty'))
        }

        cart.items = []

        await User.findByIdAndUpdate(userId, { $pull: { shoppingCart: cart._id } }, { new: true })

        await cart.save()

        return res.status(200).json(new apiResponse(200, 'Cart cleared successfully'))

    } catch (error) {
        console.log("Error in clear cart: ", error)
        throw new apiError(500, 'Internal Server Error', false, error.message);
    }
})