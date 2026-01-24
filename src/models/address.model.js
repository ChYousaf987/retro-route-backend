import mongoose from "mongoose";


const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    addressLine: {
        type: String,
        required: true,
        trim: true
    },
    city: {
        type: String,
        required: true,
        trim: true
    },
    state: {
        type: String,
        required: true,
        trim: true
    },
    pinCode: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^\d{5,6}$/.test(v);  // 5-6 digits (India 6, Pakistan 5)
            },
            message: "Pin code must be 5 or 6 digits"
        }
    },
    country: {
        type: String,
        required: true,
        default: "Pakistan",
        trim: true
    },
    mobile: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function (v) {
                // Pakistani numbers: 03xx-xxxxxxx ya +923xx-xxxxxxx
                // Indian: similar ya 10 digits
                return /^(\+92|92|0)?3[0-9]{9}$/.test(v.replace(/\s/g, ''));
            },
            message: "Invalid mobile number format"
        }
    },
}, { timestamps: true })


export const Address = mongoose.model("Address", addressSchema);