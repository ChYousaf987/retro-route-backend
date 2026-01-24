// utils/cloudinaryUtils.js  (ya jahan aap chahein wahan rakh lo)

export const getPublicIdFromUrl = (cloudinaryUrl) => {
    if (!cloudinaryUrl || typeof cloudinaryUrl !== 'string') {
        return null;
    }

    try {
        // Example URL: https://res.cloudinary.com/yourcloudname/image/upload/v1234567890/zafgoal/abc123.jpg
        const parts = cloudinaryUrl.split('/upload/');
        if (parts.length < 2) return null;

        const afterUpload = parts[1];
        const versionAndPath = afterUpload.split('/').slice(1).join('/'); // v1234567890/zafgoal/abc123.jpg → zafgoal/abc123.jpg
        const withoutExtension = versionAndPath.replace(/\.[^.]+$/, ''); // .jpg ya .png remove kar do

        return withoutExtension; // → zafgoal/abc123
    } catch (error) {
        console.log("Error extracting public_id from URL:", error);
        return null;
    }
};