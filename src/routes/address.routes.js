// address.routes.js  (recommended style)

import { Router } from 'express';
import {
  addAddress,
  getAddresses,       // ← plural — gets all addresses of the user
  updateAddress,
  deleteAddress,
} from '../controllers/address.controller.js';

import { authVerify } from '../middlewares/auth.middleware.js';

const router = Router();

// Collection routes
router.route('/addresses')
  .post(authVerify, addAddress)       // POST   /addresses       → create
  .get(authVerify, getAddresses);     // GET    /addresses       → list all

// Individual resource routes
// (You'll need to modify controller to accept :id param if you want true per-address update/delete)
router.route('/addresses/:addressId')
  .patch(authVerify, updateAddress)   // PATCH  /addresses/:id   → update one
  .delete(authVerify, deleteAddress); // DELETE /addresses/:id   → delete one

export { router as addressRouter };