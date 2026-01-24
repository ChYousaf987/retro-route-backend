import { Category } from "../models/category.model.js";
import { Product } from "../models/product.model.js";
import { fileUploadOnCloudinary } from "../services/cloudinary.js";
import { apiError } from "../utils/apiError.js";
import { apiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFromCloudinary } from "../utils/deleteFromCloudinary.js";
import { getPublicIdFromUrl } from "../utils/getPublicIdFromUrl.js";

export const addCategory = asyncHandler(async (req, res) => {
    try {
        const { name } = req.body

        if (!name) {
            return res.status(400).json(new apiError(400, 'Category name is required'))
        }

        const imageUrl = req.file?.path

        if (!imageUrl) {
            return res.status(400).json(new apiError(400, 'Category image is required'))
        }

        const image = await fileUploadOnCloudinary(imageUrl)

        const category = await Category.create({
            name,
            image: image.secure_url
        })

        return res.status(201).json(new apiResponse(201, 'Category added successfully', category))

    } catch (error) {
        console.log("Error in add category: ", error)
        throw new apiError(500, 'Internal Server Error', false, error.message);
    }
})


export const getAllCategories = asyncHandler(async (req, res) => {
    try {
        const categories = await Category.find()

        return res.status(200).json(new apiResponse(200, 'Categories fetched successfully', categories))

    } catch (error) {
        console.log("Error in get all categories: ", error)
        throw new apiError(500, 'Internal Server Error', false, error.message);
    }
})


export const updateCategory = asyncHandler(async (req, res) => {
    try {
        const { name } = req.body

        const categoryId = req.params.categoryId

        const category = await Category.findById(categoryId)

        if (!category) {
            return res.status(404).json(new apiError(404, 'Category not found'))
        }

        if (name !== undefined && name !== '') {
            category.name = name.trim()
        }

        if (req.file) {
            const localFilePath = req.file.path

            const uploadResult = await fileUploadOnCloudinary(localFilePath)

            if (uploadResult?.secure_url) {
                const oldImageUrl = category.image

                if (oldImageUrl) {
                    const oldPublicId = getPublicIdFromUrl(oldImageUrl)

                    if (oldPublicId) {
                        await deleteFromCloudinary(oldPublicId)
                    }
                }

                category.image = uploadResult.secure_url
            }
        }


        await category.save({ validateModifiedOnly: true })

        return res.status(200).json(new apiResponse(200, 'Category updated successfully', category))
    } catch (error) {
        console.log("Error in update category: ", error)
        throw new apiError(500, 'Internal Server Error', false, error.message);
    }
})


export const deleteCategory = asyncHandler(async (req, res) => {
    try {
        const categoryId = req.params.categoryId

        const category = await Category.findById(categoryId)

        if (!category) {
            return res.status(404).json(new apiError(404, 'Category not found'))
        }

        const oldImageUrl = category.image

        if (oldImageUrl) {
            const oldPublicId = getPublicIdFromUrl(oldImageUrl)

            if (oldPublicId) {
                await deleteFromCloudinary(oldPublicId)
            }
        }

        const linkedProducts = await Product.find({ category: categoryId }).select('images')

        // Delete images from cloudinary of selected category products
        for (const product of linkedProducts) {
            if (product.images && product.images.length > 0) {
                for (const image of product.images) {
                    const publicId = getPublicIdFromUrl(image)
                    if (publicId) {
                        await deleteFromCloudinary(publicId)
                    }
                }
            }

        }

        const deletedProducts = await Product.deleteMany({ category: categoryId })

        await category.deleteOne()

        return res.status(200).json(
            new apiResponse(200, 'Category and all linked products deleted successfully', {
                deletedCategoryId: categoryId,
                deletedProductsCount: deletedProducts.deletedCount
            })
        )
    } catch (error) {
        console.log("Error in delete category: ", error)
        throw new apiError(500, 'Internal Server Error', false, error.message);
    }
})
