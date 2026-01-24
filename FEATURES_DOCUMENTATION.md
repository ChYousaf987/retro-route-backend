# Order Management System - Complete Documentation

## 1. CREATE ORDER - Product Information Included

### Where Product Info is Stored:

The `createOrder` controller in [src/controllers/order.controller.js](src/controllers/order.controller.js) captures:

```javascript
const orderItems = cart.items.map(item => {
  const itemTotal = item.product.price * item.quantity;
  subtotal += itemTotal;

  return {
    productId: item.product._id, // Product reference
    quantity: item.quantity, // How many units ordered
    priceAtPurchase: item.product.price, // Price at time of order
  };
});
```

### Order Schema ([src/models/order.model.js](src/models/order.model.js)):

- **products**: Array of ordered items, each containing:
  - `productId`: Reference to Product document
  - `quantity`: Number of units ordered
  - `priceAtPurchase`: Price captured at purchase time
- **subtotal**: Total price of products only
- **total**: Subtotal + delivery charges
- **deliveryAddress**: Address reference
- **scheduledDeliveryDate**: When to deliver
- **paymentStatus**: Pending/Completed/Failed
- **deliveryStatus**: Pending/On My Way/Delivered

---

## 2. PRODUCT REVIEWS - NEW FEATURE

### Model: [src/models/review.model.js](src/models/review.model.js)

```javascript
{
  productId: Reference to Product,
  userId: Reference to User,
  rating: 1-5 scale,
  title: Short title for review,
  comment: Detailed review text,
  images: Array of review images,
  helpful: Count of helpful votes,
  unhelpful: Count of unhelpful votes,
  verified: Boolean (true if user purchased product)
}
```

### Endpoints:

#### Create Review (Protected)

```
POST /api/v1/review/create
Headers: Authorization token required
Body: {
  productId: "...",
  rating: 4,
  title: "Great product!",
  comment: "Very satisfied with this purchase",
  images: ["url1", "url2"]  // optional
}
```

✅ Validates user has purchased the product
✅ Prevents duplicate reviews from same user

#### Get Product Reviews (Public)

```
GET /api/v1/review/product/:productId?page=1&limit=10&sortBy=createdAt
Response includes: reviews, averageRating, totalReviews
```

#### Get User's Reviews (Protected)

```
GET /api/v1/review/user/my-reviews
Headers: Authorization token required
```

#### Update Review (Protected)

```
PUT /api/v1/review/update/:reviewId
Headers: Authorization token required
Body: { rating, title, comment, images }
```

#### Delete Review (Protected)

```
DELETE /api/v1/review/delete/:reviewId
Headers: Authorization token required
```

#### Mark as Helpful (Public)

```
PATCH /api/v1/review/helpful/:reviewId
Body: { helpful: true }  // or false for unhelpful
```

---

## 3. ADD TO FAVORITES - NEW FEATURE

### Model: [src/models/favorite.model.js](src/models/favorite.model.js)

```javascript
{
  userId: Reference to User,
  productId: Reference to Product
}
// Unique constraint: user can't favorite same product twice
```

### Endpoints:

#### Add to Favorites (Protected)

```
POST /api/v1/favorite/add
Headers: Authorization token required
Body: { productId: "..." }
Response: Favorite object with product details
```

✅ Prevents duplicate favorites

#### Remove from Favorites (Protected)

```
POST /api/v1/favorite/remove
Headers: Authorization token required
Body: { productId: "..." }
```

#### Get User's Favorites (Protected)

```
GET /api/v1/favorite/my-favorites?page=1&limit=10
Headers: Authorization token required
Response: Array of favorite products with pagination
```

#### Check if Product is Favorite (Protected)

```
GET /api/v1/favorite/check/:productId
Headers: Authorization token required
Response: { isFavorite: true/false }
```

#### Get Favorite Count for Product (Public)

```
GET /api/v1/favorite/count/:productId
Response: { productId, favoriteCount: 50 }
```

---

## 4. COMPLETE FLOW EXAMPLE

### Order with all features:

1. **User browses products**
   - GET `/api/v1/product`

2. **Add to Favorites**
   - POST `/api/v1/favorite/add` → `{ productId }`

3. **Read Reviews before purchase**
   - GET `/api/v1/review/product/:productId`
   - Shows rating, comments, verified purchases

4. **Add to Cart & Create Order**
   - POST `/api/v1/cart/add`
   - POST `/api/v1/order` → Creates order with product info

5. **After receiving product, leave review**
   - POST `/api/v1/review/create` with rating, title, comment
   - Marked as verified since user purchased it

6. **Manage favorites & reviews**
   - GET `/api/v1/favorite/my-favorites` - See saved items
   - GET `/api/v1/review/user/my-reviews` - See your reviews
   - PUT `/api/v1/review/update/:reviewId` - Edit review
   - DELETE `/api/v1/review/delete/:reviewId` - Remove review

---

## 5. NEW FILES CREATED

- ✅ [src/models/review.model.js](src/models/review.model.js)
- ✅ [src/models/favorite.model.js](src/models/favorite.model.js)
- ✅ [src/controllers/review.controller.js](src/controllers/review.controller.js)
- ✅ [src/controllers/favorite.controller.js](src/controllers/favorite.controller.js)
- ✅ [src/routes/review.routes.js](src/routes/review.routes.js)
- ✅ [src/routes/favorite.routes.js](src/routes/favorite.routes.js)

## 6. UPDATED FILES

- ✅ [src/app.js](src/app.js) - Added review and favorite route imports

---

## Key Features Summary

| Feature                | Status      | Details                                            |
| ---------------------- | ----------- | -------------------------------------------------- |
| Order Creation         | ✅ Existing | Captures productId, quantity, priceAtPurchase      |
| Reviews                | ✅ NEW      | 5-star ratings, verified purchases, helpful votes  |
| Favorites              | ✅ NEW      | Save products, count favorites, check if favorited |
| Product Info in Orders | ✅ Existing | Available via populate in order queries            |
