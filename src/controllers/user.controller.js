import { User } from '../models/user.model.js';
import { PendingUser } from '../models/pendingUser.model.js';
import { fileUploadOnCloudinary } from '../services/cloudinary.js';
import { sendEmail } from '../services/VerifyEmail.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import bcrypt from 'bcrypt';
import { getPublicIdFromUrl } from '../utils/getPublicIdFromUrl.js';
import { deleteFromCloudinary } from '../utils/deleteFromCloudinary.js';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
} from 'date-fns';

// tokens
const generateAccessAndRefreshTokens = async userId => {
  try {
    const user = await User.findById(userId);

    const accessToken = await user.generateAccessToken();

    return { accessToken };
  } catch (error) {
    console.error('Error generating tokens:', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
};

// Generate OTP helper function
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// register Api - Step 1: Send OTP
export const register = asyncHandler(async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json(new apiError(400, 'name, email and password are required'));
    }

    // Check if user already exists in registered users
    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res
        .status(400)
        .json(new apiError(400, 'User already exists with this email'));
    }

    // Generate OTP and expiry (10 minutes)
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    const otpExpiryTime = new Date(otpExpiry).toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if there's already a pending registration for this email
    const existingPending = await PendingUser.findOne({ email });

    if (existingPending) {
      // Update existing pending user with new OTP
      existingPending.name = name;
      existingPending.password = hashedPassword;
      existingPending.role = role || 'User';
      existingPending.permissions = permissions || [];
      existingPending.otp = otp;
      existingPending.otpExpires = otpExpiry;
      await existingPending.save();
    } else {
      // Create new pending user
      await PendingUser.create({
        name,
        email,
        password: hashedPassword,
        role: role || 'User',
        permissions: permissions || [],
        otp,
        otpExpires: otpExpiry,
      });
    }

    // Send OTP email
    await sendEmail({
      sendTo: email,
      subject: 'Email Verification OTP - Retro Route',
      html: `<h2>Dear ${name},</h2>
      <p>Your OTP for email verification is <strong>${otp}</strong>.</p>
      <p>This OTP is valid for 10 minutes and will expire at ${otpExpiryTime}.</p>
      <p>Please use this OTP to complete your registration.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Developed by CodesVista.</p>`,
    });

    return res.status(200).json(
      new apiResponse(
        200,
        'OTP sent to your email. Please verify to complete registration.',
        {
          email,
          otpExpiryTime,
        }
      )
    );
  } catch (error) {
    console.log('Error in Register: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Verify Registration OTP - Step 2: Verify OTP and create user
export const verifyRegistrationOTP = asyncHandler(async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json(new apiError(400, 'email and otp are required'));
    }

    // Check if user already registered
    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res
        .status(400)
        .json(new apiError(400, 'User already registered with this email'));
    }

    // Find pending user
    const pendingUser = await PendingUser.findOne({ email });
    if (!pendingUser) {
      return res
        .status(404)
        .json(
          new apiError(
            404,
            'No pending registration found. Please register first.'
          )
        );
    }

    // Verify OTP
    if (pendingUser.otp !== otp) {
      return res.status(400).json(new apiError(400, 'Invalid OTP'));
    }

    // Check OTP expiry
    if (pendingUser.otpExpires < Date.now()) {
      return res
        .status(400)
        .json(new apiError(400, 'OTP has expired. Please request a new one.'));
    }

    // Create the actual user (password is already hashed)
    const newUser = new User({
      name: pendingUser.name,
      email: pendingUser.email,
      password: pendingUser.password,
      role: pendingUser.role,
      permissions: pendingUser.permissions,
      verifyEmail: true,
    });

    // Skip password hashing since it's already hashed
    newUser.$skipPasswordHash = true;
    await newUser.save();

    // Delete the pending user
    await PendingUser.deleteOne({ email });

    const user = await User.findById(newUser._id).select('-password');

    return res
      .status(201)
      .json(
        new apiResponse(
          201,
          "Email verified! You've registered successfully.",
          user
        )
      );
  } catch (error) {
    console.log('Error in verifyRegistrationOTP: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// Resend Registration OTP
export const resendRegistrationOTP = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(new apiError(400, 'email is required'));
    }

    // Check if user already registered
    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res
        .status(400)
        .json(new apiError(400, 'User already registered with this email'));
    }

    // Find pending user
    const pendingUser = await PendingUser.findOne({ email });
    if (!pendingUser) {
      return res
        .status(404)
        .json(
          new apiError(
            404,
            'No pending registration found. Please register first.'
          )
        );
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    const otpExpiryTime = new Date(otpExpiry).toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // Update pending user with new OTP
    pendingUser.otp = otp;
    pendingUser.otpExpires = otpExpiry;
    await pendingUser.save();

    // Send OTP email
    await sendEmail({
      sendTo: email,
      subject: 'Email Verification OTP (Resend) - Retro Route',
      html: `<h2>Dear ${pendingUser.name},</h2>
      <p>Your new OTP for email verification is <strong>${otp}</strong>.</p>
      <p>This OTP is valid for 10 minutes and will expire at ${otpExpiryTime}.</p>
      <p>Please use this OTP to complete your registration.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Developed by CodesVista.</p>`,
    });

    return res.status(200).json(
      new apiResponse(200, 'OTP resent to your email successfully.', {
        email,
        otpExpiryTime,
      })
    );
  } catch (error) {
    console.log('Error in resendRegistrationOTP: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// login Api
export const login = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json(new apiError(400, 'email and password are required'));
    }

    const checkExistedUser = await User.findOne({ email });

    if (!checkExistedUser) {
      return res
        .status(400)
        .json(
          new apiError(400, "Your credentials doesn't match in our system")
        );
    }

    const isPasswordMatch = await checkExistedUser.isCorrectPassword(password);
    if (!isPasswordMatch) {
      return res
        .status(400)
        .json(
          new apiError(
            400,
            'Your password is not correct! Please enter the correct password'
          )
        );
    }

    if (checkExistedUser.status !== 'Active') {
      return res
        .status(403)
        .json(
          new apiError(
            403,
            'Your account is not active. Please contact support team. or admin to activate your account'
          )
        );
    }

    const { accessToken } = await generateAccessAndRefreshTokens(
      checkExistedUser._id
    );

    const cookieOptions = {
      httpOnly: true,
      secure: true,
    };

    const loginUser = await User.findById(checkExistedUser._id).select(
      '-password'
    );

    return res
      .status(200)
      .cookie('accessToken', accessToken, cookieOptions)
      .json(
        new apiResponse(200, "You've logged in successfully", {
          user: loginUser,
          token: accessToken,
        })
      );
  } catch (error) {
    console.log('Error in login: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// logout Api
export const logout = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(400).json(new apiError(400, 'User ID is required'));
    }

    await User.findByIdAndUpdate(
      userId,
      { $unset: { refreshToken: '' } },
      {
        new: true,
      }
    );

    const cookieOptions = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .clearCookie('accessToken', cookieOptions)
      .clearCookie('refreshToken', cookieOptions)
      .json(new apiResponse(200, "You've logged out successfully"));
  } catch (error) {
    console.log('Error in logout: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// forgot password Api
export const forgotPassword = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(new apiError(400, 'email is required'));
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json(new apiError(404, 'Email not found'));
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 60 * 60 * 1000;

    const otpStandardTime = new Date(otpExpiry).toLocaleString('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const updateUser = await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          forgotPasswordOTP: otp,
          forgotPasswordOTPExpires: otpExpiry,
          isOTPVerified: false,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    await sendEmail({
      sendTo: user.email,
      subject: 'Forgot Password OTP',
      html: `<h2>Dear ${user.name},</h2>
      <p> Your OTP for resetting password is <strong>${otp}</strong>. It is valid for 1 hour. Please use it to reset your password. </p>
      <p>OTP will expire at ${otpStandardTime}. OTP sent from Zafgoal App.</p> 
      <p>Developed by CodesVista.</p>`,
    });

    return res.status(200).json(
      new apiResponse(200, 'OTP sent to your email successfully', {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
        otp: otp,
        otpExpiryTime: otpStandardTime,
      })
    );
  } catch (error) {
    console.log('Error in forgotPassword: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// forgot password OTP verification Api
export const forgotPasswordOTPVerification = asyncHandler(async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json(new apiError(400, 'email and otp is required'));
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json(new apiError(404, 'Email not found'));
    }

    if (user.forgotPasswordOTP !== otp.toString()) {
      return res.status(400).json(new apiError(400, 'Invalid OTP'));
    }

    if (user.forgotPasswordOTPExpires < Date.now()) {
      return res.status(400).json(new apiError(400, 'OTP is expired'));
    }

    // Mark OTP as verified so user can reset password
    await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          isOTPVerified: true,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json(
      new apiResponse(
        200,
        'OTP verified successfully. You can now reset your password.',
        {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        }
      )
    );
  } catch (error) {
    console.log('Error in forgotPasswordOTPVerification: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// reset password Api
export const resetPassword = asyncHandler(async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res
        .status(400)
        .json(
          new apiError(
            400,
            'email, newPassword and confirmPassword are required'
          )
        );
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json(
          new apiError(400, 'newPassword and confirmPassword do not match')
        );
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json(new apiError(400, 'Password must be at least 6 characters long'));
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json(new apiError(404, 'Email not found'));
    }

    // Check if OTP was verified
    if (!user.isOTPVerified) {
      return res
        .status(400)
        .json(
          new apiError(400, 'Please verify OTP first before resetting password')
        );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          password: hashedPassword,
          forgotPasswordOTP: null,
          forgotPasswordOTPExpires: null,
          isOTPVerified: false,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    return res
      .status(200)
      .json(new apiResponse(200, 'Password reset successfully', {}));
  } catch (error) {
    console.log('Error in resetPassword: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// get user details Api
export const getUserDetails = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('addressDetails shoppingCart orderHistory');

    if (!user) {
      return res.status(404).json(new apiError(404, 'User not found'));
    }

    return res
      .status(200)
      .json(new apiResponse(200, 'User details fetched successfully', user));
  } catch (error) {
    console.log('Error in getUserDetails: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// update user details Api
export const updateUserDetails = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const { name, email, password } = req.body;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json(new apiError(404, 'User not found'));
    }

    if (name?.trim()) user.name = name.trim();

    if (email?.trim() && email.trim() !== user.email) {
      const existingUser = await User.findOne({ email: email.trim() });
      if (existingUser) {
        return res.status(400).json(new apiError(400, 'Email already in use'));
      }
      user.email = email.trim();
    }

    if (password?.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10);
    }

    if (req.file) {
      const localFilePath = req.file?.path;

      const uploadResult = await fileUploadOnCloudinary(localFilePath);

      if (uploadResult && uploadResult.secure_url) {
        const oldImageUrl = user.avatar;

        if (oldImageUrl) {
          const oldPublicId = getPublicIdFromUrl(oldImageUrl);

          if (oldPublicId) {
            await deleteFromCloudinary(oldPublicId);
          }
        }

        user.avatar = uploadResult.secure_url;
      }
    }

    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new apiResponse(200, 'User details updated successfully', user));
  } catch (error) {
    console.log('Error in updateUserDetails: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// get all users Api
export const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const users = await User.find().select('createdAt');

    const today = new Date();

    // Today
    const startToday = startOfDay(today);
    const endToday = endOfDay(today);

    // Yesterday
    const yesterday = subDays(today, 1);
    const startYesterday = startOfDay(yesterday);
    const endYesterday = endOfDay(yesterday);

    // This Week
    const startThisWeek = startOfWeek(today);
    const endThisWeek = endOfWeek(today);

    // Last Week
    const lastWeek = subWeeks(today, 1);
    const startLastWeek = startOfWeek(lastWeek);
    const endLastWeek = endOfWeek(lastWeek);

    let totalUsers = 0;
    let todayUsers = 0;
    let yesterdayUsers = 0;
    let thisWeekUsers = 0;
    let lastWeekUsers = 0;

    for (const user of users) {
      const date = user.createdAt;

      totalUsers++;

      if (date >= startToday && date <= endToday) todayUsers++;
      if (date >= startYesterday && date <= endYesterday) yesterdayUsers++;
      if (date >= startThisWeek && date <= endThisWeek) thisWeekUsers++;
      if (date >= startLastWeek && date <= endLastWeek) lastWeekUsers++;
    }

    // Today %
    let todayPercentage = 0;
    if (yesterdayUsers > 0) {
      todayPercentage = ((todayUsers - yesterdayUsers) / yesterdayUsers) * 100;
    } else if (todayUsers > 0) {
      todayPercentage = 100;
    }

    // Total %
    let totalPercentage = 0;
    if (lastWeekUsers > 0) {
      totalPercentage = ((thisWeekUsers - lastWeekUsers) / lastWeekUsers) * 100;
    }

    const responseData = {
      totalUsers,
      todayUsers,
      todayPercentage: Number(todayPercentage.toFixed(2)),
      totalPercentage: Number(totalPercentage.toFixed(2)),
    };

    return res
      .status(200)
      .json(
        new apiResponse(200, 'All users fetched successfully', responseData)
      );
  } catch (error) {
    console.log('Error in getAllUsers: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// get all admins Api
export const getAllAdmins = asyncHandler(async (req, res) => {
  try {
    const admins = await User.find({ role: 'Admin' }).select(
      '-password -addressDetails -shoppingCart -orderHistory'
    );

    return res
      .status(200)
      .json(new apiResponse(200, 'All admins fetched successfully', admins));
  } catch (error) {
    console.log('Error in getAllAdmins: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// update admin details Api
export const updateAdminDetails = asyncHandler(async (req, res) => {
  try {
    const adminId = req.params.adminId;

    const {
      name,
      email,
      password,
      addPermissions = [],
      removePermissions = [],
    } = req.body;

    const admin = await User.findById(adminId).select(
      '-password -addressDetails -shoppingCart -orderHistory'
    );

    if (!admin) {
      throw new apiError(404, 'Admin not found');
    }

    // ---------------- NAME ----------------
    if (name?.trim()) {
      admin.name = name.trim();
    }

    // ---------------- EMAIL ----------------
    if (email?.trim() && email.trim() !== admin.email) {
      const existingAdmin = await User.findOne({ email: email.trim() });
      if (existingAdmin) {
        return res.status(400).json(new apiError(400, 'Email already in use'));
      }
      admin.email = email.trim();
    }

    // ---------------- PASSWORD ----------------
    if (password?.trim()) {
      admin.password = await bcrypt.hash(password.trim(), 10);
    }

    // ---------------- PERMISSIONS (SMART UPDATE) ----------------

    // ADD permissions
    if (Array.isArray(addPermissions) && addPermissions.length > 0) {
      addPermissions.forEach(perm => {
        if (!admin.permissions.includes(perm)) {
          admin.permissions.push(perm);
        }
      });
    }

    // REMOVE permissions
    if (Array.isArray(removePermissions) && removePermissions.length > 0) {
      admin.permissions = admin.permissions.filter(
        perm => !removePermissions.includes(perm)
      );
    }

    await admin.save();

    return res
      .status(200)
      .json(new apiResponse(200, 'Admin details updated successfully', admin));
  } catch (error) {
    console.log('Error in updateAdminDetails: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

// delete admin Api
export const deleteAdmin = asyncHandler(async (req, res) => {
  try {
    const adminId = req.params.adminId;
    const admin = await User.findById(adminId);

    if (!admin) {
      throw new apiError(404, 'Admin not found');
    }

    await User.findByIdAndDelete(adminId);

    return res
      .status(200)
      .json(new apiResponse(200, 'Admin deleted successfully'));
  } catch (error) {
    console.log('Error in deleteAdmin: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});
