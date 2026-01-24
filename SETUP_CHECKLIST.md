# ✅ Stripe Payment Integration - Setup Checklist

## 🎯 Pre-Flight Checklist

### **Code Implementation**

- [x] Payment controller created (`payment.controller.js`)
- [x] Payment routes created (`payment.routes.js`)
- [x] Routes added to `app.js`
- [x] Stripe package installed (`npm install stripe`)
- [x] All error handling implemented
- [x] Order model compatible with payments

### **Documentation**

- [x] CREATE_ORDER_GUIDE.md - Updated with payment flow
- [x] STRIPE_SETUP.md - Configuration guide
- [x] POSTMAN_QUICK_REFERENCE.md - Copy-paste requests
- [x] PAYMENT_FLOW_VISUAL.md - Diagrams
- [x] PAYMENT_INTEGRATION_SUMMARY.md - Architecture
- [x] IMPLEMENTATION_COMPLETE.md - Overview
- [x] README_STRIPE_INTEGRATION.md - Quick summary

---

## 🛠️ Before You Start Testing

### **Step 1: Add Environment Variables**

```bash
# Open .env file and add:
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
```

- [ ] Open `.env` file
- [ ] Add STRIPE_SECRET_KEY
- [ ] Add STRIPE_PUBLISHABLE_KEY
- [ ] Save file

### **Step 2: Verify Installation**

```bash
# Check if stripe is installed
npm list stripe

# Should show: stripe@<version>
```

- [ ] Run `npm list stripe`
- [ ] Verify stripe package is installed

### **Step 3: Restart Server**

```bash
# Stop current server (Ctrl+C)
# Restart with:
npm start
# or
npm run dev
```

- [ ] Stop Node server
- [ ] Restart with npm start
- [ ] Verify no errors in console

---

## 🧪 Testing Checklist

### **Test 1: Successful Payment**

```bash
Card: 4242 4242 4242 4242
CVC: 123
Exp: 12/25
```

Steps:

1. [ ] Register & Login
2. [ ] Add product to cart
3. [ ] Get address
4. [ ] POST `/payment/process` with above card
5. [ ] Verify response: `statusCode: 201`
6. [ ] Verify `paymentStatus: "Completed"`
7. [ ] Verify `paymentId` in response
8. [ ] GET `/order` verify order exists

**Expected Result:** ✅ Order created with completed payment

---

### **Test 2: Declined Card**

```bash
Card: 4000 0000 0000 0002
CVC: 123
Exp: 12/25
```

Steps:

1. [ ] Add product to cart
2. [ ] POST `/payment/process` with above card
3. [ ] Verify response: `statusCode: 400`
4. [ ] Verify error message: "Card declined"
5. [ ] GET `/cart` verify items still there
6. [ ] GET `/order` verify NO new order created

**Expected Result:** ✅ Payment failed, order not created

---

### **Test 3: Empty Cart**

```bash
Clear cart before testing
```

Steps:

1. [ ] Empty shopping cart
2. [ ] POST `/payment/process`
3. [ ] Verify error: "Cart is empty"
4. [ ] Verify response: `statusCode: 400`

**Expected Result:** ✅ Error returned, no payment attempted

---

### **Test 4: Missing Address**

```bash
Don't include addressId in request
```

Steps:

1. [ ] Add products to cart
2. [ ] POST `/payment/process` WITHOUT addressId
3. [ ] Verify error: "Address ID is required"
4. [ ] Verify response: `statusCode: 400`

**Expected Result:** ✅ Error returned before Stripe call

---

### **Test 5: Invalid Date**

```bash
Use date in the past: "2025-01-01"
```

Steps:

1. [ ] Add products to cart
2. [ ] POST `/payment/process` with past date
3. [ ] Verify error: "Scheduled delivery date must be today or in the future"
4. [ ] Verify response: `statusCode: 400`

**Expected Result:** ✅ Error returned before Stripe call

---

### **Test 6: 3D Secure (Optional)**

```bash
Card: 4000 0025 0000 3155
CVC: 123
Exp: 12/25
```

Steps:

1. [ ] POST `/payment/process` with above card
2. [ ] Verify response contains: `requires_action`
3. [ ] Frontend would complete 3D Secure
4. [ ] Retry with confirmed payment

**Expected Result:** ✅ 3D Secure handled properly

---

### **Test 7: Cart Clearing**

```bash
Successful payment
```

Steps:

1. [ ] Add 3 different products to cart
2. [ ] POST `/payment/process` with valid card
3. [ ] Verify order created
4. [ ] GET `/cart` verify items = []
5. [ ] Verify cart is completely empty

**Expected Result:** ✅ Cart cleared after successful payment

---

### **Test 8: Order History**

```bash
After successful payment
```

Steps:

1. [ ] POST `/payment/process` successful
2. [ ] GET `/user/profile` or check orderHistory
3. [ ] Verify newly created order in user's orderHistory
4. [ ] Verify order has correct details

**Expected Result:** ✅ Order added to user's orderHistory

---

## 📊 Verification Checklist

After successful payment, verify all fields:

```json
Order should contain:
- [ ] orderId (e.g., "#123456")
- [ ] userId (current user)
- [ ] products[] (all cart items)
- [ ] subtotal (sum of products)
- [ ] total (subtotal + deliveryCharges)
- [ ] deliveryAddress (full address object)
- [ ] scheduledDeliveryDate (user input)
- [ ] paymentStatus: "Completed" ⭐
- [ ] paymentId: "pi_..." (from Stripe) ⭐
- [ ] deliveryStatus: "Pending" (initial state)
- [ ] customerNote (if provided)
- [ ] deliveryCharges (if provided)
- [ ] createdAt (timestamp)

Payment object should contain:
- [ ] id (Stripe payment intent ID)
- [ ] status: "succeeded"
- [ ] amount (in dollars)
- [ ] currency: "usd"
```

---

## 🔍 Debugging Checklist

If tests fail:

### **Server Won't Start**

- [ ] Check `.env` file has Stripe keys
- [ ] Run `npm install stripe` again
- [ ] Check for syntax errors in payment.controller.js
- [ ] Check for import/export issues
- [ ] Review server console for error messages

### **Payment Not Processing**

- [ ] Verify payment method ID is correct
- [ ] Verify Stripe keys in .env are correct
- [ ] Check network request in Postman
- [ ] Review server console logs
- [ ] Verify card number is correct

### **Order Not Created**

- [ ] Check if payment succeeded (status in response)
- [ ] Verify addressId is valid
- [ ] Verify cart has items
- [ ] Check server console for database errors
- [ ] Verify user is authenticated

### **Cart Not Cleared**

- [ ] Check if payment was successful
- [ ] Verify order was created
- [ ] GET `/cart` after payment
- [ ] Check server console for save errors
- [ ] Verify user authentication

---

## 📱 Postman Setup Checklist

- [ ] Import Postman collection (if available)
- [ ] Set `baseUrl` environment variable: `http://localhost:5000/api/v1`
- [ ] Set `accessToken` variable (will be filled after login)
- [ ] Create folder: "Payment Flow"
- [ ] Create requests in correct order
- [ ] Add script to save accessToken after login
- [ ] Use `{{baseUrl}}` and `{{accessToken}}` in URLs
- [ ] Test each endpoint in sequence

---

## ✨ Final Verification

### **Endpoint Status Check**

```bash
# Should all work:
POST http://localhost:5000/api/v1/payment/create-intent
POST http://localhost:5000/api/v1/payment/process
POST http://localhost:5000/api/v1/payment/webhook
```

- [ ] All endpoints accessible
- [ ] Authentication working
- [ ] Request body validation working
- [ ] Error handling working

### **Integration Check**

- [ ] Cart → Payment flow works
- [ ] Order creation after payment works
- [ ] Order in orderHistory works
- [ ] Cart clearing works
- [ ] Error cases handled

### **Data Check**

- [ ] Order has payment info
- [ ] PaymentStatus is "Completed" on success
- [ ] PaymentId stored correctly
- [ ] User orderHistory updated
- [ ] Cart items cleared

---

## 🎊 Launch Checklist

When everything passes:

- [ ] All tests pass
- [ ] Error handling verified
- [ ] Documentation reviewed
- [ ] Stripe keys configured
- [ ] Server running without errors
- [ ] Postman collection ready
- [ ] Ready for frontend integration

---

## 📞 Quick Support

**Issue:** Can't start server
**Solution:** Check `.env` has Stripe keys, restart npm

**Issue:** Payment always fails
**Solution:** Use test card 4242 4242 4242 4242

**Issue:** Order not created
**Solution:** Verify payment succeeded (status: "succeeded")

**Issue:** Cart not cleared
**Solution:** Verify paymentStatus is "Completed"

---

## 🚀 You're Ready!

All systems are go for testing!

**Next Step:** Open `POSTMAN_QUICK_REFERENCE.md` and start testing! 🎉

---

**Checklist Version:** 1.0
**Last Updated:** January 24, 2026
**Status:** ✅ Ready for Testing
