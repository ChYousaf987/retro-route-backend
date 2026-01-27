import { Product } from '../models/product.model.js';
import { fileUploadOnCloudinary } from '../services/cloudinary.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { deleteFromCloudinary } from '../utils/deleteFromCloudinary.js';
import { getPublicIdFromUrl } from '../utils/getPublicIdFromUrl.js';

export const addProduct = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    unit,
    status,
    stock,
    price,
    discount,
    description,
    quantity,
    brand,
    keyFeatures = [],
  } = req.body;

  if (
    !name ||
    !category ||
    !unit ||
    !status ||
    stock === undefined ||
    stock === '' ||
    price === undefined ||
    price === '' ||
    discount === undefined ||
    discount === '' ||
    !description ||
    quantity === undefined ||
    quantity === '' ||
    !brand
  ) {
    return res
      .status(400)
      .json(new apiError(400, 'Please fill all the required fields'));
  }

  // check existing product
  const existingProduct = await Product.findOne({ name });

  if (existingProduct) {
    return res.status(400).json(new apiError(400, 'Product already exists'));
  }

  let uploadedImages = [];

  if (req.files && req.files.length > 0) {
    const imagePaths = req.files.map(file => file.path);

    const uploadPromises = imagePaths.map(path => fileUploadOnCloudinary(path));

    const results = await Promise.all(uploadPromises);

    // Check if any upload failed
    results.forEach((result, index) => {
      if (!result || !result.secure_url) {
        throw new apiError(500, `Failed to upload image ${index + 1}`);
      }
    });

    uploadedImages = results.map(result => result.secure_url);
  } else {
    return res
      .status(400)
      .json(new apiError(400, 'Please upload at least one image'));
  }

  // Parse keyFeatures if it's a string (from form-data)
  let parsedKeyFeatures = [];
  if (typeof keyFeatures === 'string') {
    try {
      parsedKeyFeatures = JSON.parse(keyFeatures);
    } catch {
      parsedKeyFeatures = keyFeatures
        .split(',')
        .map(f => f.trim())
        .filter(f => f);
    }
  } else if (Array.isArray(keyFeatures)) {
    parsedKeyFeatures = keyFeatures;
  }

  const newProduct = await Product.create({
    name,
    images: uploadedImages,
    category,
    unit,
    status,
    stock: Number(stock),
    price: Number(price),
    discount: Number(discount),
    description,
    quantity: Number(quantity),
    brand,
    keyFeatures: parsedKeyFeatures,
  });

  return res
    .status(201)
    .json(new apiResponse(201, 'Product added successfully', newProduct));
});

export const getAllProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const options = {
    page,
    limit,
    sort: { createdAt: -1 }, // newest first default
    lean: true, // faster
    collation: { locale: 'en' }, // optional – better sorting
    populate: { path: 'category', select: 'name' },
  };

  // Recently added filter
  let query = {};
  if (req.query.recent === 'true') {
    const days = parseInt(req.query.days) || 30;
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    query.createdAt = { $gte: dateThreshold };
  }

  const result = await Product.paginate(query, options);

  return res.status(200).json(
    new apiResponse(200, 'Products fetched successfully', {
      products: result.docs,
      pagination: {
        totalDocs: result.totalDocs,
        limit: result.limit,
        totalPages: result.totalPages,
        page: result.page,
        pagingCounter: result.pagingCounter,
        hasPrevPage: result.hasPrevPage,
        hasNextPage: result.hasNextPage,
        prevPage: result.prevPage,
        nextPage: result.nextPage,
      },
    })
  );
});

export const updateProduct = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    unit,
    status,
    stock,
    price,
    discount,
    description,
    quantity,
    brand,
    keyFeatures = [],
  } = req.body;

  const productId = req.params.productId;

  const product = await Product.findById(productId);

  if (!product) {
    return res.status(404).json(new apiError(404, 'Product not found'));
  }

  // Simple text/number fields update
  if (name?.trim()) product.name = name.trim();
  if (category?.trim()) product.category = category.trim();
  if (unit?.trim()) product.unit = unit.trim();
  if (stock !== undefined && stock !== '') product.stock = Number(stock);
  if (price !== undefined && price !== '') product.price = Number(price);
  if (discount !== undefined && discount !== '')
    product.discount = Number(discount);
  if (description?.trim()) product.description = description.trim();
  if (quantity !== undefined && quantity !== '')
    product.quantity = Number(quantity);
  if (brand?.trim()) product.brand = brand.trim();

  // Status (enum validation)
  if (status !== undefined && status !== null && status !== '') {
    const validStatuses = ['Low Stock', 'In Stock', 'Out of Stock'];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json(
          new apiError(
            400,
            `Status must be one of: ${validStatuses.join(', ')}`
          )
        );
    }
    product.status = status.trim();
  }

  // Parse keyFeatures if it's a string (from form-data)
  let parsedKeyFeatures = [];
  if (typeof keyFeatures === 'string') {
    try {
      parsedKeyFeatures = JSON.parse(keyFeatures);
    } catch {
      parsedKeyFeatures = keyFeatures
        .split(',')
        .map(f => f.trim())
        .filter(f => f);
    }
  } else if (Array.isArray(keyFeatures)) {
    parsedKeyFeatures = keyFeatures;
  }

  if (parsedKeyFeatures.length > 0) {
    product.keyFeatures = parsedKeyFeatures.map(f => f.trim()).filter(f => f);
  }

  if (req.files && req.files.length > 0) {
    const oldImagePublicIds = product.images
      .map(imgUrl => getPublicIdFromUrl(imgUrl))
      .filter(id => id !== null);

    if (oldImagePublicIds.length > 0) {
      await Promise.all(
        oldImagePublicIds.map(publicId => deleteFromCloudinary(publicId))
      );
    }

    // new images upload
    const imagePaths = req.files.map(file => file.path);
    const uploadPromises = imagePaths.map(path => fileUploadOnCloudinary(path));
    const results = await Promise.all(uploadPromises);

    results.forEach((result, index) => {
      if (!result || !result.secure_url) {
        throw new apiError(500, `Failed to upload new image ${index + 1}`);
      }
    });

    const newImageUrls = results.map(result => result.secure_url);

    product.images = newImageUrls;
  }

  await product.save({ validateBeforeSave: true });

  return res
    .status(200)
    .json(new apiResponse(200, 'Product updated successfully', product));
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const productId = req.params.productId;

  const product = await Product.findById(productId);

  if (!product) {
    return res.status(404).json(new apiError(404, 'Product not found'));
  }

  const oldImagePublicIds = product.images
    .map(imgUrl => getPublicIdFromUrl(imgUrl))
    .filter(id => id !== null);

  if (oldImagePublicIds.length > 0) {
    await Promise.all(
      oldImagePublicIds.map(publicId => deleteFromCloudinary(publicId))
    );
  }

  await Product.findByIdAndDelete(productId);

  return res
    .status(200)
    .json(new apiResponse(200, 'Product deleted successfully'));
});

export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  if (!categoryId) {
    return res.status(400).json(new apiError(400, 'Category ID is required'));
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const options = {
    page,
    limit,
    sort: { createdAt: -1 },
    lean: true,
    collation: { locale: 'en' },
    populate: { path: 'category', select: 'name image' },
  };

  const query = { category: categoryId };

  const result = await Product.paginate(query, options);

  if (result.totalDocs === 0) {
    return res.status(200).json(
      new apiResponse(200, 'No products found for this category', {
        products: [],
        pagination: {
          totalDocs: 0,
          limit: result.limit,
          totalPages: 0,
          page: result.page,
          pagingCounter: result.pagingCounter,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
      })
    );
  }

  return res.status(200).json(
    new apiResponse(200, 'Products fetched successfully by category', {
      products: result.docs,
      pagination: {
        totalDocs: result.totalDocs,
        limit: result.limit,
        totalPages: result.totalPages,
        page: result.page,
        pagingCounter: result.pagingCounter,
        hasPrevPage: result.hasPrevPage,
        hasNextPage: result.hasNextPage,
        prevPage: result.prevPage,
        nextPage: result.nextPage,
      },
    })
  );
});

export const getProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findById(productId).populate(
    'category',
    'name'
  );

  if (!product) {
    return res.status(404).json(new apiError(404, 'Product not found'));
  }

  return res
    .status(200)
    .json(new apiResponse(200, 'Product fetched successfully', product));
});