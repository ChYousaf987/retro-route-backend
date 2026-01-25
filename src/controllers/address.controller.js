export const getAddress = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;
    const address = await Address.findOne({ userId });
    if (!address) {
      return res.status(404).json(new apiResponse(404, 'Address not found'));
    }
    return res
      .status(200)
      .json(new apiResponse(200, 'Address fetched successfully', address));
  } catch (error) {
    console.log('Error in get address: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});
import { Address } from '../models/address.model.js';
import { User } from '../models/user.model.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const addAddress = asyncHandler(async (req, res) => {
  try {
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
      .status(200)
      .json(new apiResponse(200, 'Address added successfully', address));
  } catch (error) {
    console.log('Error in add address: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

export const updateAddress = asyncHandler(async (req, res) => {
  try {
    const { fullName, addressLine, city, state, pinCode, country, mobile } =
      req.body;
    const userId = req.user?._id;

    const address = await Address.findOne({ userId });

    if (!address) {
      return res.status(404).json(new apiResponse(404, 'Address not found'));
    }

    address.fullName = fullName;
    address.addressLine = addressLine;
    address.city = city;
    address.state = state;
    address.pinCode = pinCode;
    address.country = country;
    address.mobile = mobile;

    await address.save();

    return res
      .status(200)
      .json(new apiResponse(200, 'Address updated successfully', address));
  } catch (error) {
    console.log('Error in update address: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});

export const deleteAddress = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id;

    const address = await Address.findOne({ userId });

    if (!address) {
      return res.status(404).json(new apiResponse(404, 'Address not found'));
    }

    await User.findByIdAndUpdate(
      userId,
      { $pull: { addressDetails: address._id } },
      { new: true }
    );

    await Address.findByIdAndDelete(address._id);

    return res
      .status(200)
      .json(new apiResponse(200, 'Address deleted successfully'));
  } catch (error) {
    console.log('Error in delete address: ', error);
    throw new apiError(500, 'Internal Server Error', false, error.message);
  }
});
