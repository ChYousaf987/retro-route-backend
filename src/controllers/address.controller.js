// src/controllers/address.controller.js

import { Address } from '../models/address.model.js';
import { User } from '../models/user.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const addAddress = asyncHandler(async (req, res) => {
  const { fullName, addressLine, city, state, pinCode, country, mobile } =
    req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, 'User not authenticated');
  }

  const address = await Address.create({
    userId,
    fullName,
    addressLine,
    city,
    state,
    pinCode,
    country,
    mobile,
  });

  // Add address reference to user
  await User.findByIdAndUpdate(
    userId,
    { $push: { addressDetails: address._id } },
    { new: true }
  );

  return res
    .status(201)
    .json(new apiResponse(201, 'Address added successfully', address));
});

export const getAddresses = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, 'User not authenticated');
  }

  let addresses = await Address.find({ userId }).lean();

  // Map 'mobile' to 'phone' and remove 'mobile' from each address
  addresses = addresses.map(addr => {
    const { mobile, ...rest } = addr;

    return {
      ...rest,
      phone: mobile,
    };
  });

  return res
    .status(200)
    .json(new apiResponse(200, 'Addresses fetched successfully', addresses));
});

export const updateAddress = asyncHandler(async (req, res) => {
  const { fullName, addressLine, city, state, pinCode, country, mobile } =
    req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, 'User not authenticated');
  }

  const address = await Address.findOne({ userId });

  if (!address) {
    throw new apiError(404, 'No address found for this user');
  }

  // Update only provided fields
  if (fullName !== undefined) address.fullName = fullName;
  if (addressLine !== undefined) address.addressLine = addressLine;
  if (city !== undefined) address.city = city;
  if (state !== undefined) address.state = state;
  if (pinCode !== undefined) address.pinCode = pinCode;
  if (country !== undefined) address.country = country;
  if (mobile !== undefined) address.mobile = mobile;

  await address.save();

  return res
    .status(200)
    .json(new apiResponse(200, 'Address updated successfully', address));
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, 'User not authenticated');
  }

  const address = await Address.findOne({ userId });

  if (!address) {
    return res
      .status(404)
      .json(new apiResponse(404, 'No address found to delete'));
  }

  // Remove reference from User
  await User.findByIdAndUpdate(
    userId,
    { $pull: { addressDetails: address._id } },
    { new: true }
  );

  // Delete the address
  await Address.findByIdAndDelete(address._id);

  return res
    .status(200)
    .json(new apiResponse(200, 'Address deleted successfully'));
});
