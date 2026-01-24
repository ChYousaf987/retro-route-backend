// utils/cloudinaryUtils.js  (same file mein rakh sakte ho)

import { v2 as cloudinary } from 'cloudinary';
import { apiError } from '../utils/apiError.js';

// Configuration function - called before each operation to ensure env vars are loaded
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

export const deleteFromCloudinary = async publicId => {
  if (!publicId) {
    console.log('No publicId provided for deletion');
    return;
  }

  try {
    // Ensure cloudinary is configured with current env vars
    configureCloudinary();

    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true, // CDN cache bhi clear ho jayega
      resource_type: 'image',
    });

    if (result.result === 'ok') {
      console.log(`Successfully deleted from Cloudinary: ${publicId}`);
    } else if (result.result === 'not found') {
      console.log(
        `Image not found on Cloudinary (already deleted?): ${publicId}`
      );
    } else {
      console.log(
        `Cloudinary deletion result: ${result.result} for ${publicId}`
      );
    }
  } catch (error) {
    console.log('Error deleting from Cloudinary:', publicId, error.message);
  }
};
