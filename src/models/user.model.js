import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    verifyEmail: {
      type: Boolean,
      default: false,
    },
    lastLoginDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Active', 'InActive', 'Suspended'],
      default: 'Active',
    },
    role: {
      type: String,
      enum: ['User', 'Admin', 'SuperAdmin', 'Driver'],
      default: 'User',
    },
    // Driver specific fields
    isAvailable: {
      type: Boolean,
      default: true,
    },
    assignedDeliveries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
    ],
    forgotPasswordOTP: {
      type: String,
      default: null,
    },
    forgotPasswordOTPExpires: {
      type: Date,
      default: null,
    },
    isOTPVerified: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: [String],
      default: [],
    },
    addressDetails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address',
      },
    ],
    shoppingCart: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
      },
    ],
    orderHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  // Skip if password not modified or if it's already hashed (from pending user)
  if (!this.isModified('password')) return;
  if (this.$skipPasswordHash) return;

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.isCorrectPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      name: this.name,
      email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model('User', userSchema);
