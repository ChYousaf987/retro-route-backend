import mongoose from "mongoose";
import { apiError } from "../utils/apiError.js";


export const DBConnect = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("MongoDB Connected Successfully");
    } catch (error) {
        console.log("Error in DB Connection: ", error)
        throw new apiError(500, 'Internal Server Error', false, error.message);
    }
}