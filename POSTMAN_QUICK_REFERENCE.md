# Stripe Payment - Postman Quick Reference

## 📋 Copy-Paste Ready Requests

### **1. Login to Get Token**

```
POST http://localhost:5000/api/v1/user/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

✅ **Save accessToken from response**

---

### **2. Get Products**

```
GET http://localhost:5000/api/v1/product
```

✅ **Copy first product \_id**

---

### **3. Add to Cart**

```
POST http://localhost:5000/api/v1/cart/add
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "productId": "PASTE_PRODUCT_ID_HERE",
  "quantity": 2
}
```

---

### **4. Get Delivery Address**

```
GET http://localhost:5000/api/v1/address/get-addresses
Authorization: Bearer {{accessToken}}
```

✅ **Copy first address \_id**

---

### **5. Create Payment Intent** (OPTIONAL - for frontend)

```
POST http://localhost:5000/api/v1/payment/create-intent
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "addressId": "PASTE_ADDRESS_ID_HERE",
  "deliveryCharges": 50
}
```

Response includes: `clientSecret` (for frontend Stripe.js)

---

### **6. Process Payment & Create Order** ✅ (MAIN REQUEST)

```
POST http://localhost:5000/api/v1/payment/process
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "addressId": "PASTE_ADDRESS_ID_HERE",
  "deliveryCharges": 50,
  "scheduledDeliveryDate": "2026-01-26",
  "customerNote": "Please ring the bell twice",
  "paymentMethodId": "pm_card_visa"
}
```

**Expected Response (201):**

```json
{
  "statusCode": 201,
  "message": "Payment successful! Order created.",
  "data": {
    "order": {
      /* full order details */
    },
    "payment": {
      "id": "pi_...",
      "status": "succeeded",
      "amount": 100.5,
      "currency": "usd"
    }
  }
}
```

---

### **7. Verify Order Created**

```
GET http://localhost:5000/api/v1/order
Authorization: Bearer {{accessToken}}
```

✅ You should see your order with `paymentStatus: "Completed"`

---

## 💳 Test Cards

| Scenario              | Card                | CVC | Exp   | Result           |
| --------------------- | ------------------- | --- | ----- | ---------------- |
| ✅ Successful Payment | 4242 4242 4242 4242 | 123 | 12/25 | Order created    |
| ❌ Card Declined      | 4000 0000 0000 0002 | 123 | 12/25 | Payment rejected |
| 🔒 3D Secure          | 4000 0025 0000 3155 | 123 | 12/25 | Auth required    |

---

## 📊 Success vs Failure

### ✅ SUCCESS (201)

```
POST /api/v1/payment/process
Response: {
  "order": { /* created order */ },
  "payment": { "status": "succeeded" }
}
```

- Order created
- Cart cleared
- Payment marked as "Completed"

### ❌ FAILURE (400)

```
POST /api/v1/payment/process
Response: {
  "message": "Card declined...",
  "success": false
}
```

- Order NOT created
- Cart unchanged
- User can try again

---

## 🧪 Common Test Scenarios

### **Scenario 1: Successful Order**

1. Use card: `4242 4242 4242 4242`
2. POST `/payment/process`
3. ✅ Order created
4. ✅ GET `/order` shows payment status: "Completed"

### **Scenario 2: Failed Payment**

1. Use card: `4000 0000 0000 0002`
2. POST `/payment/process`
3. ❌ Returns error
4. ❌ Cart still has items
5. Try again with valid card

### **Scenario 3: 3D Secure**

1. Use card: `4000 0025 0000 3155`
2. POST `/payment/process`
3. ❌ Returns: `requires_action`
4. Frontend completes 3D Secure
5. Retry with confirmed status

---

## 🚨 Error Messages & Fixes

| Error                                 | Fix                                                 |
| ------------------------------------- | --------------------------------------------------- |
| "Address ID is required"              | Include `addressId` in body                         |
| "Scheduled delivery date is required" | Include `scheduledDeliveryDate`                     |
| "Payment method ID is required"       | Include `paymentMethodId`                           |
| "Cart is empty"                       | Add products first via `/cart/add`                  |
| "Card declined"                       | Use test card 4242 4242 4242 4242                   |
| "Unauthorized access"                 | Add header: `Authorization: Bearer {{accessToken}}` |
| "Invalid payment method"              | Use valid Stripe payment method format              |

---

## 🔑 Stripe Test Keys (Environment Variables)

Add to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
```

---

## ✅ Complete 60-Second Test Flow

```bash
# 1. GET TOKEN (copy accessToken)
POST /api/v1/user/login

# 2. GET PRODUCT ID
GET /api/v1/product

# 3. ADD TO CART
POST /api/v1/cart/add
Body: { "productId": "...", "quantity": 1 }

# 4. GET ADDRESS ID
GET /api/v1/address/get-addresses

# 5. PAY & CREATE ORDER ✅
POST /api/v1/payment/process
Body: {
  "addressId": "...",
  "deliveryCharges": 50,
  "scheduledDeliveryDate": "2026-01-26",
  "customerNote": "test",
  "paymentMethodId": "pm_card_visa"
}

# 6. VERIFY
GET /api/v1/order
→ See order with paymentStatus: "Completed" ✅
```

---

## 📞 Testing Workflow

1. **Create account** → Register & Login
2. **Browse & Add** → Get products & add to cart
3. **Set delivery** → Get address
4. **Pay & Order** → POST `/payment/process`
5. **Confirm** → Check order status

All in Postman with test data! 🚀

---

## 🎯 Endpoints Summary

| Endpoint                 | Method | Body                                                                 | Auth | Purpose                        |
| ------------------------ | ------ | -------------------------------------------------------------------- | ---- | ------------------------------ |
| `/payment/create-intent` | POST   | {addressId, deliveryCharges}                                         | ✅   | Get clientSecret               |
| `/payment/process`       | POST   | {addressId, deliveryCharges, scheduledDeliveryDate, paymentMethodId} | ✅   | Process payment & create order |
| `/payment/webhook`       | POST   | Stripe event                                                         | ❌   | Handle Stripe events           |

---

**Ready to test?** Start with request #6 above! 🎉
