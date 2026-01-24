# Environment Variables Setup for Stripe Payment

Add these variables to your `.env` file:

```env
# Stripe Payment Gateway
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxx

# Stripe Webhook Secret (Optional - for webhook handling)
STRIPE_WEBHOOK_SECRET=whsec_test_... (get from Stripe dashboard)
```

## How to Get Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Login to your account
3. Navigate to **Developers** → **API Keys**
4. Copy **Publishable Key** and **Secret Key**
5. Copy from test mode (keys starting with `pk_test_` and `sk_test_`)

## Test Cards Available

| Card Type        | Number              | CVC   | Exp        |
| ---------------- | ------------------- | ----- | ---------- |
| Visa (Success)   | 4242 4242 4242 4242 | Any 3 | Any Future |
| Visa (Decline)   | 4000 0000 0000 0002 | Any 3 | Any Future |
| Visa (3D Secure) | 4000 0025 0000 3155 | Any 3 | Any Future |
| Amex             | 3782 822463 10005   | Any 4 | Any Future |
| Discover         | 6011 1111 1111 1117 | Any 3 | Any Future |

## Payment Flow Summary

```
1. User adds products to cart
2. User clicks "Checkout" → Creates Payment Intent
3. Frontend collects card details
4. Backend processes payment with Stripe
5. If payment succeeds → Order is created
6. If payment fails → Error message, order NOT created
7. Cart cleared only after successful payment
```

## API Endpoints

### Create Payment Intent

```
POST /api/v1/payment/create-intent
Headers: Authorization: Bearer {token}
Body: { addressId, deliveryCharges }
Returns: { clientSecret, amount, currency }
```

### Process Payment & Create Order

```
POST /api/v1/payment/process
Headers: Authorization: Bearer {token}
Body: { addressId, deliveryCharges, scheduledDeliveryDate, customerNote, paymentMethodId }
Returns: { order, payment }
```

### Stripe Webhook (Optional)

```
POST /api/v1/payment/webhook
Used for: Payment status updates, refunds, etc.
```
