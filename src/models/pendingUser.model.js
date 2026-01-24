import mongoose from 'mongoose';

const pendingUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
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
    role: {
      type: String,
      enum: ['User', 'Admin', 'SuperAdmin', 'Driver'],
      default: 'User',
    },
    permissions: {
      type: [String],
      default: [],
    },
    otp: {
      type: String,
      required: true,
    },
    otpExpires: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-delete expired pending users after 24 hours
pendingUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const PendingUser = mongoose.model('PendingUser', pendingUserSchema);
