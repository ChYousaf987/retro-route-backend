# 🔄 Stripe Payment Flow - Visual Guide

## 📱 Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    USER STARTS HERE                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │   Register & Login        │
        │  GET: accessToken         │
        └──────────────┬────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Browse Products          │
        │  GET: /api/v1/product     │
        └──────────────┬────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Add to Shopping Cart     │
        │  POST: /api/v1/cart/add   │
        │  { productId, quantity }  │
        └──────────────┬────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Select Delivery Address  │
        │  GET: /api/v1/address     │
        └──────────────┬────────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Click "PROCEED TO PAY"   │
        │  (Frontend collects card) │
        └──────────────┬────────────┘
                       │
                       ▼
        ╔══════════════════════════╗
        ║   STRIPE PAYMENT START   ║
        ╚═════════┬════════════════╝
                  │
    ┌─────────────┴──────────────┐
    │                            │
    ▼                            ▼
┌─────────────────┐        ┌──────────────────┐
│ Create Payment  │        │  Collect Card    │
│   Intent (opt)  │        │   Details        │
│ POST: /payment/ │        │  (Stripe.js)     │
│ create-intent   │        │                  │
└────────┬────────┘        └────────┬─────────┘
         │                          │
         └──────────────┬───────────┘
                        │
                        ▼
        ╔═════════════════════════════════╗
        ║  POST /api/v1/payment/process   ║
        ║  {                              ║
        ║    addressId,                   ║
        ║    deliveryCharges,             ║
        ║    scheduledDeliveryDate,       ║
        ║    paymentMethodId (from card), ║
        ║    customerNote                 ║
        ║  }                              ║
        ╚═════════┬═══════════════════════╝
                  │
                  ▼
        ┌─────────────────────────────┐
        │  Backend Validation          │
        │  ✓ Address exists?           │
        │  ✓ Date is future?           │
        │  ✓ Cart has items?           │
        │  ✓ PaymentMethod valid?      │
        └──────────┬────────────────────┘
                   │
                   ▼
        ┌─────────────────────────────┐
        │  Calculate Payment Amount    │
        │  Subtotal: $100             │
        │  + Delivery: $50            │
        │  = Total: $150              │
        └──────────┬────────────────────┘
                   │
                   ▼
        ╔═════════════════════════════╗
        ║    SEND TO STRIPE API       ║
        ║    Create Payment Intent    ║
        ║    Amount: $150 (15000 cts) ║
        ║    Currency: USD            ║
        ║    Method: Card             ║
        ╚═════════┬═══════════════════╝
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
┌──────────────────┐    ┌──────────────────┐
│  PAYMENT         │    │  PAYMENT         │
│  SUCCEEDED ✅    │    │  FAILED ❌       │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       ▼
    ┌────────────────┐    ┌───────────────┐
    │ CREATE ORDER   │    │ RETURN ERROR  │
    │ in Database    │    │ message       │
    │ with fields:   │    │               │
    │ - orderId      │    │ Cart remains  │
    │ - products     │    │ unchanged     │
    │ - subtotal     │    │               │
    │ - total        │    │ No order      │
    │ - address      │    │ created       │
    │ - payment_id   │    └───────────────┘
    │ - payment_     │            │
    │   status:      │            │
    │   "Completed"  │            ▼
    │ - delivery_    │    ┌─────────────┐
    │   status:      │    │ User sees   │
    │   "Pending"    │    │ error msg   │
    │                │    │ Card was    │
    │ UPDATE User    │    │ declined    │
    │ orderHistory   │    │             │
    │ with order_id  │    │ Can retry   │
    │                │    │ with new    │
    │ CLEAR CART     │    │ card        │
    │ items = []     │    └─────────────┘
    │                │
    │ RETURN SUCCESS │
    │ with order     │
    │ details        │
    └────────┬───────┘
             │
             ▼
    ┌──────────────────────┐
    │  RESPONSE 201        │
    │  {                   │
    │    order: {          │
    │      orderId: "#...", │
    │      products: [...], │
    │      subtotal: 100,   │
    │      total: 150,      │
    │      paymentStatus:   │
    │        "Completed",   │
    │      deliveryStatus:  │
    │        "Pending"      │
    │    },                 │
    │    payment: {         │
    │      id: "pi_...",    │
    │      status:          │
    │        "succeeded"    │
    │    }                  │
    │  }                    │
    └────────┬─────────────┘
             │
             ▼
    ┌──────────────────────┐
    │  ORDER CONFIRMATION  │
    │  ✅ ORDER CREATED    │
    │  ✅ PAYMENT DONE     │
    │  ✅ CART CLEARED     │
    │  ✅ READY TO SHIP    │
    └──────────────────────┘
```

---

## 💳 Card Test Scenarios

### **Scenario 1: ✅ Successful Payment**

```
Card: 4242 4242 4242 4242
CVC: Any 3 digits
Exp: Any future date (MM/YY)

Result:
✅ Payment succeeds
✅ Order created
✅ paymentStatus = "Completed"
✅ Cart cleared
✅ Response: 201 Created
```

### **Scenario 2: ❌ Card Declined**

```
Card: 4000 0000 0000 0002
CVC: Any 3 digits
Exp: Any future date (MM/YY)

Result:
❌ Payment fails
❌ Order NOT created
❌ Cart unchanged
❌ Response: 400 Bad Request
❌ Message: "Card declined"
```

### **Scenario 3: 🔒 3D Secure Required**

```
Card: 4000 0025 0000 3155
CVC: Any 3 digits
Exp: Any future date (MM/YY)

Result:
⚠️ Payment requires authentication
❌ Status: "requires_action"
📱 Frontend must complete 3D Secure
🔄 Then retry with confirmed payment
```

---

## 📊 Database State Changes

### **Before Payment**

```
User:
  orderHistory: [order_1, order_2]

Cart:
  items: [
    { product: product_1, quantity: 2 },
    { product: product_2, quantity: 1 }
  ]

Order: (not yet created)
```

### **During Payment**

```
Stripe (External):
  Creating paymentIntent...
  Validating card details...
  Processing charge...
```

### **After Successful Payment ✅**

```
User:
  orderHistory: [order_1, order_2, NEW_ORDER_3]

Cart:
  items: [] (CLEARED)

Order (NEW_ORDER_3):
  {
    orderId: "#123456",
    userId: user_id,
    products: [...],
    paymentStatus: "Completed",
    paymentId: "pi_...",
    deliveryStatus: "Pending"
  }
```

### **After Failed Payment ❌**

```
User:
  orderHistory: [order_1, order_2] (unchanged)

Cart:
  items: [...] (still there)

Order: (not created)

Response: {
  "message": "Card declined...",
  "success": false
}
```

---

## 🔐 Security Flow

```
Frontend                          Backend                    Stripe
   │                                 │                         │
   │─ User enters card details ─────>│                         │
   │   (Stripe.js handles it)        │                         │
   │                                 │                         │
   │<─ Stripe returns paymentMethodId─│                         │
   │   (NOT card details)            │                         │
   │                                 │                         │
   │─ Send paymentMethodId ─────────>│                         │
   │   (safe to send)                │                         │
   │                                 │─ Process payment ──────>│
   │                                 │                         │
   │                                 │<─ Payment confirmed ────│
   │                                 │                         │
   │<──── Return order details ──────│                         │
   │      (paymentStatus: succeeded) │                         │

✅ Card details NEVER reach backend
✅ Only payment method ID transmitted
✅ Stripe handles all sensitive data
```

---

## ⏱️ Timing Breakdown

```
1. Create Payment Intent (optional)   → 100ms
2. Collect card details               → User interaction
3. Send payment to Stripe             → 200-500ms
4. Stripe processes card              → 1-2 seconds
5. Stripe returns result              → 100ms
6. Backend creates order              → 50-100ms
7. Clear cart                         → 20ms
8. Return response to frontend        → 50ms
                                      ___________
Total: 1.5-2.5 seconds                (excluding user input)
```

---

## 📈 Success Metrics

| Metric             | Target          | Status |
| ------------------ | --------------- | ------ |
| Payment Processing | <2s             | ✅     |
| Order Creation     | <100ms          | ✅     |
| Cart Clear         | <50ms           | ✅     |
| Error Handling     | All cases       | ✅     |
| Test Mode          | No real charges | ✅     |
| Security           | PCI compliant   | ✅     |

---

## 🎯 Quick Start (30 Seconds)

```
1. Login
   POST /user/login

2. Add product
   POST /cart/add

3. Get address
   GET /address

4. PAY & ORDER ✅
   POST /payment/process

5. Done! Order created with payment confirmed.
```

---

**Ready to test?** Use Postman with the quick reference guide! 🚀
