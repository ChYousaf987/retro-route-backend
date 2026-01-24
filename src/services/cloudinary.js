import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import { apiError } from '../utils/apiError.js';

// Configuration function - called before each upload to ensure env vars are loaded
const configureCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

export const fileUploadOnCloudinary = async localFilePath => {
  try {
    if (!localFilePath) {
      return new apiError(400, 'File not found');
    }

    // Ensure cloudinary is configured with current env vars
    configureCloudinary();

    const response = await cloudinary.uploader.upload(localFilePath, {
      folder: 'zafgoal',
      resource_type: 'image',
    });

    console.log('File uploaded successfully:', response.secure_url);

    await fs
      .unlink(localFilePath)
      .catch(err =>
        console.log(
          'Warning: Failed to delete local file:',
          localFilePath,
          err.message
        )
      );

    return response;
  } catch (error) {
    if (localFilePath) {
      await fs.unlink(localFilePath).catch(err => {
        console.log('Warning: Cleanup failed for:', localFilePath, err.message);
      });
    }

    console.error('Error in fileUploadOnCloudinary:', error.message || error);

    throw new apiError(
      error.http_code || 500,
      error.message || 'Failed to upload file on Cloudinary'
    );
  }
};
