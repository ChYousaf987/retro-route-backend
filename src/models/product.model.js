import mongoose from "mongoose";
import mongoosePaginate from 'mongoose-paginate-v2';


const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    images: [
        {
            type: String,
            required: true
        }
    ],
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    unit: {
        type: String,
        required: true,
        default: null
    },
    status: {
        type: String,
        enum: ['Low Stock', 'In Stock', 'Out of Stock'],
        default: 'In Stock'
    },
    stock: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    brand: {
        type: String,
    },
    keyFeatures: [
        {
            type: String,
            trim: true
        }
    ],
}, { timestamps: true })


productSchema.plugin(mongoosePaginate);


export const Product = mongoose.model("Product", productSchema);