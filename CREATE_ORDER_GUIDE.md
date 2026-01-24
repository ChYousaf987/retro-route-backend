# Create Order with Stripe Payment - Complete Testing Guide

## 📋 Quick Reference

| Property            | Value                          |
| ------------------- | ------------------------------ |
| **Endpoint**        | `POST /api/v1/payment/process` |
| **Authentication**  | Required (Bearer Token)        |
| **Content-Type**    | `application/json`             |
| **Base URL**        | `http://localhost:5000`        |
| **Payment Gateway** | Stripe (Test Keys Provided)    |

---

## 🔐 Prerequisites - Before Testing

You MUST complete these steps in order:

### **Step 1: Register & Login**

Get an authentication token:

```
POST http://localhost:5000/api/v1/user/register
Body:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Then verify OTP sent to email:

```
POST http://localhost:5000/api/v1/user/verify-registration-otp
Body:
{
  "email": "john@example.com",
  "otp": "123456"
}
```

Then login:

```
POST http://localhost:5000/api/v1/user/login
Body:
{
  "email": "john@example.com",
  "password": "password123"
}
Response includes: accessToken
Save this token! You'll need it.
```

### **Step 2: Add Products to Cart**

```
POST http://localhost:5000/api/v1/cart/add
Headers: Authorization: Bearer {{accessToken}}
Body:
{
  "productId": "product_mongo_id",
  "quantity": 2
}
```

Repeat for multiple products if needed.

### **Step 3: Create/Get a Delivery Address**

```
POST http://localhost:5000/api/v1/address/create-address
Headers: Authorization: Bearer {{accessToken}}
Body:
{
  "street": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "USA",
  "phone": "+1234567890",
  "isDefault": true
}
Response includes: _id (addressId)
Save this address ID!
```

Or get existing address:

```
GET http://localhost:5000/api/v1/address/get-addresses
Headers: Authorization: Bearer {{accessToken}}
Response: List of addresses with IDs
```

---

## 💳 Stripe Payment Configuration

### **Test Keys (Already Configured)**

```
Publishable Key: pk_test_xxxxxxxxxxxxxxxx

Secret Key: sk_test_xxxxxxxxxxxx
```

### **Test Card Numbers**

Use these for testing:

| Card Type        | Number              | CVC          | Exp Date        |
| ---------------- | ------------------- | ------------ | --------------- |
| Visa (Success)   | 4242 4242 4242 4242 | Any 3 digits | Any future date |
| Visa (Decline)   | 4000 0000 0000 0002 | Any 3 digits | Any future date |
| Visa (3D Secure) | 4000 0025 0000 3155 | Any 3 digits | Any future date |
| Amex             | 3782 822463 10005   | Any 4 digits | Any future date |
| Discover         | 6011 1111 1111 1117 | Any 3 digits | Any future date |

---

## 🎯 Create Order with Stripe Payment

### **Step 1: Create Payment Intent (Get Client Secret)**

First, create a payment intent to get the client secret:

**Request:**

```
POST http://localhost:5000/api/v1/payment/create-intent
Headers: Authorization: Bearer {{accessToken}}
Content-Type: application/json
Body:
{
  "addressId": "address_mongo_id",
  "deliveryCharges": 50
}
```

**Response:**

```json
{
  "statusCode": 200,
  "message": "Payment intent created",
  "data": {
    "clientSecret": "pi_1QaZkMHxqEkEAwMA_secret_key...",
    "amount": 100.5,
    "currency": "usd"
  }
}
```

**Save the clientSecret!** You'll use it in the next step.

---

### **Step 2: Confirm Payment with Card Details**

In your frontend (or Postman), use the `clientSecret` to confirm the payment with card details.

For testing in Postman, you need to:

1. Use the `clientSecret` from Step 1
2. Create a Payment Method via Stripe API
3. Confirm the Payment Intent

**Alternative: Use Direct Payment Processing**

You can skip the frontend complexity by sending card details directly to the backend:

### **Direct Payment Processing Endpoint**

**Request:**

```
POST http://localhost:5000/api/v1/payment/process
Headers:
  Authorization: Bearer {{accessToken}}
  Content-Type: application/json

Body:
{
  "addressId": "address_mongo_id",
  "deliveryCharges": 50,
  "scheduledDeliveryDate": "2026-01-26",
  "customerNote": "Please ring the bell twice",
  "paymentMethodId": "pm_card_visa"  // From Stripe or from card tokenization
}
```

---

## 🎯 Complete Payment Flow Endpoint

### **Request**

**Method:** `POST`

**URL:**

```
http://localhost:5000/api/v1/payment/process
```

**Headers:**

```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "addressId": "address_mongo_id_here",
  "deliveryCharges": 50,
  "scheduledDeliveryDate": "2026-01-26",
  "customerNote": "Please ring the bell twice",
  "paymentMethodId": "pm_card_visa_or_stripe_payment_method_id"
}
```

---

## 📝 Request Parameters

### **Required Fields:**

| Field                   | Type                | Description              | Example                    |
| ----------------------- | ------------------- | ------------------------ | -------------------------- |
| `addressId`             | String (MongoDB ID) | Delivery address ID      | `507f1f77bcf86cd799439011` |
| `scheduledDeliveryDate` | String (YYYY-MM-DD) | When to deliver          | `2026-01-25`               |
| `paymentMethodId`       | String              | Stripe payment method ID | `pm_card_visa`             |

### **Optional Fields:**

| Field             | Type   | Default | Description          |
| ----------------- | ------ | ------- | -------------------- |
| `deliveryCharges` | Number | 0       | Extra delivery fee   |
| `customerNote`    | String | ""      | Special instructions |

---

## ✅ Success Response (201 Created - Payment + Order)

```json
{
  "statusCode": 201,
  "message": "Payment successful! Order created.",
  "data": {
    "order": {
      "_id": "67a8f4c2b5c9d1e2f3g4h5i6",
      "orderId": "#123456",
      "userId": "user_mongo_id",
      "products": [
        {
          "productId": {
            "_id": "prod_id_1",
            "name": "Laptop",
            "price": 50000,
            "images": ["url1"],
            "category": "Electronics"
          },
          "quantity": 2,
          "priceAtPurchase": 50000
        }
      ],
      "subtotal": 100000,
      "total": 100050,
      "deliveryAddress": {
        "_id": "addr_id",
        "street": "123 Main Street",
        "city": "New York"
      },
      "scheduledDeliveryDate": "2026-01-26T00:00:00.000Z",
      "paymentStatus": "Completed",
      "deliveryStatus": "Pending",
      "customerNote": "Please ring the bell twice",
      "deliveryCharges": 50,
      "createdAt": "2026-01-24T10:30:00.000Z"
    },
    "payment": {
      "id": "pi_1QaZkMHxqEkEAwMA...",
      "status": "succeeded",
      "amount": 100.5,
      "currency": "usd"
    }
  }
}
```

---

## ❌ Error Responses

### **400 - Payment Failed**

```json
{
  "statusCode": 400,
  "message": "Card declined. Your card was declined.",
  "success": false
}
```

**Fix:** Use a valid test card (4242 4242 4242 4242)

---

### **400 - Missing Payment Method**

```json
{
  "statusCode": 400,
  "message": "Payment method ID is required",
  "success": false
}
```

**Fix:** Include `paymentMethodId` in request body

---

### **400 - 3D Secure Required**

```json
{
  "statusCode": 400,
  "message": "Payment requires additional authentication",
  "data": {
    "clientSecret": "pi_..._secret_...",
    "status": "requires_action"
  }
}
```

**Fix:** Complete 3D Secure authentication on frontend

---

### **401 - Unauthorized**

```json
{
  "statusCode": 401,
  "message": "Unauthorized access",
  "success": false
}
```

**Fix:** Add valid Authorization bearer token

---

## 🧪 Postman Testing Workflow - With Payment

### **Step 1: Set Up Environment Variables**

Add to Postman environment:

```
baseUrl: http://localhost:5000/api/v1
accessToken: (filled after login)
clientSecret: (filled after creating payment intent)
paymentMethodId: pm_card_visa (for testing)
```

### **Step 2: Login**

```
POST {{baseUrl}}/user/login
Body: { "email": "john@example.com", "password": "password123" }
```

Save token in Tests tab:

```javascript
pm.environment.set('accessToken', pm.response.json().data.accessToken);
```

### **Step 3: Add Product to Cart**

```
POST {{baseUrl}}/cart/add
Headers: Authorization: Bearer {{accessToken}}
Body: { "productId": "product_id", "quantity": 2 }
```

### **Step 4: Get Address**

```
GET {{baseUrl}}/address/get-addresses
Headers: Authorization: Bearer {{accessToken}}
```

Copy address `_id`

### **Step 5: Create Payment Intent**

```
POST {{baseUrl}}/payment/create-intent
Headers: Authorization: Bearer {{accessToken}}
Body:
{
  "addressId": "your_address_id",
  "deliveryCharges": 50
}
```

Save clientSecret in Tests:

```javascript
pm.environment.set('clientSecret', pm.response.json().data.clientSecret);
```

### **Step 6: Process Payment & Create Order ✅**

```
POST {{baseUrl}}/payment/process
Headers:
  Authorization: Bearer {{accessToken}}
  Content-Type: application/json

Body:
{
  "addressId": "your_address_id",
  "deliveryCharges": 50,
  "scheduledDeliveryDate": "2026-01-26",
  "customerNote": "Please ring the bell twice",
  "paymentMethodId": "pm_card_visa"
}
```

**Expected Result:** 201 Created with order details

---

## 📊 What Happens During Payment & Order Creation

```
1. ✅ Validate user is authenticated
2. ✅ Validate all required fields
3. ✅ Validate delivery date is in future
4. ✅ Fetch user's cart with products
5. ✅ Calculate subtotal and total
6. ✅ Send payment request to Stripe
7. ✅ Verify payment method is valid
8. ✅ Process payment (charge card)
9. ✅ IF payment succeeds:
   a. ✅ Generate unique order ID
   b. ✅ Create order in database
   c. ✅ Set paymentStatus = "Completed"
   d. ✅ Add order to user's orderHistory
   e. ✅ Clear user's shopping cart
   f. ✅ Return order with payment details
10. ❌ IF payment fails:
    a. ❌ Return error message
    b. ❌ Cart remains unchanged
    c. ❌ No order created
```

---

## 💾 After Successful Payment

### **What's Stored:**

```
User Document:
  orderHistory: [..., new_order_id]

Order Document:
  paymentStatus: "Completed"
  paymentId: "stripe_payment_intent_id"
  All products with locked prices
  Delivery details

Cart Document:
  items: [] (cleared)
```

### **What's NOT Stored:**

```
❌ Card numbers (handled securely by Stripe)
❌ Full card details (only last 4 digits stored by Stripe)
✅ Only Stripe payment intent ID stored
```

---

## 📌 Important Notes

1. **No Card Data on Backend:** Stripe handles all sensitive payment data
2. **Payment Intent Required:** Order ONLY created after successful payment
3. **Immediate Cart Clear:** Cart emptied after successful payment
4. **Order ID Locked:** Order cannot be modified after creation
5. **Test Mode Only:** Using test keys - no real charges
6. **Webhooks Available:** Stripe sends events for payment status changes

---

## 🔍 Debugging Checklist

| Issue                           | Solution                           |
| ------------------------------- | ---------------------------------- |
| "Card declined"                 | Use test card 4242 4242 4242 4242  |
| "Payment method ID is required" | Include paymentMethodId in request |
| "Invalid payment method"        | Use valid Stripe payment method    |
| "Unauthorized access"           | Login and copy accessToken         |
| "Cart is empty"                 | Add products to cart first         |
| Order not created               | Check if payment succeeded first   |

---

## 📞 Example Full Test Sequence with Payment

```bash
# 1. Register & Login
POST http://localhost:5000/api/v1/user/login
{
  "email": "john@example.com",
  "password": "password123"
}
# Save: accessToken

# 2. Get Products
GET http://localhost:5000/api/v1/product
# Copy: first product _id

# 3. Add to Cart
POST http://localhost:5000/api/v1/cart/add
Headers: Authorization: Bearer {accessToken}
{
  "productId": "{productId}",
  "quantity": 2
}

# 4. Get Address
GET http://localhost:5000/api/v1/address/get-addresses
Headers: Authorization: Bearer {accessToken}
# Copy: first address _id

# 5. Create Payment Intent
POST http://localhost:5000/api/v1/payment/create-intent
Headers: Authorization: Bearer {accessToken}
{
  "addressId": "{addressId}",
  "deliveryCharges": 50
}
# Save: clientSecret (optional if using paymentMethodId)

# 6. Process Payment & Create Order ✅
POST http://localhost:5000/api/v1/payment/process
Headers: Authorization: Bearer {accessToken}
{
  "addressId": "{addressId}",
  "deliveryCharges": 50,
  "scheduledDeliveryDate": "2026-01-26",
  "customerNote": "Please ring the bell twice",
  "paymentMethodId": "pm_card_visa"
}
# Response: Order created with payment confirmed!

# 7. Verify Order
GET http://localhost:5000/api/v1/order
Headers: Authorization: Bearer {accessToken}
# See: Order with paymentStatus = "Completed"
```

---

## 🚀 Next Steps

1. **Frontend Integration:** Use Stripe.js to tokenize card on frontend
2. **Webhook Implementation:** Handle Stripe webhook events for payment updates
3. **Refund Processing:** Implement refund functionality for canceled orders
4. **Invoice Generation:** Create and send order invoices via email
5. **Payment History:** Track all payments in user dashboard

---

Happy Testing! 🎉
