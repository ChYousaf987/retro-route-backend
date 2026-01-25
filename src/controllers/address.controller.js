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

  await User.findByIdAndUpdate(
    userId,
    { $push: { addressDetails: address._id } },
    { new: true }
  );

  return res
    .status(201)
    .json(new apiResponse(201, 'Address added successfully', address));
});

export const getAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, 'Unauthorized - user not found');
  }

  const address = await Address.findOne({ userId });

  if (!address) {
    return res.status(404).json(new apiResponse(404, 'No address found'));
  }

  return res
    .status(200)
    .json(new apiResponse(200, 'Address fetched successfully', address));
});

export const updateAddress = asyncHandler(async (req, res) => {
  const { fullName, addressLine, city, state, pinCode, country, mobile } =
    req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, 'Unauthorized - user not found');
  }

  const address = await Address.findOne({ userId });

  if (!address) {
    return res.status(404).json(new apiResponse(404, 'Address not found'));
  }

  // Update fields (only provided ones will change)
  if (fullName) address.fullName = fullName;
  if (addressLine) address.addressLine = addressLine;
  if (city) address.city = city;
  if (state) address.state = state;
  if (pinCode) address.pinCode = pinCode;
  if (country) address.country = country;
  if (mobile) address.mobile = mobile;

  await address.save();

  return res
    .status(200)
    .json(new apiResponse(200, 'Address updated successfully', address));
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new apiError(401, 'Unauthorized - user not found');
  }

  const address = await Address.findOne({ userId });

  if (!address) {
    return res.status(404).json(new apiResponse(404, 'No address to delete'));
  }

  // Remove reference from User
  await User.findByIdAndUpdate(
    userId,
    { $pull: { addressDetails: address._id } },
    { new: true }
  );

  // Delete the address document
  await Address.findByIdAndDelete(address._id);

  return res
    .status(200)
    .json(new apiResponse(200, 'Address deleted successfully'));
});
