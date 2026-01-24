# Flutter & Node.js Stripe Payment Integration

## 🏗️ Architecture Flow

```
Flutter Cart (Mobile App)
     ↓
Send cart items → Node API (/payment/process)
     ↓
Node calculates total (subtotal + delivery charges)
     ↓
Node creates Stripe PaymentIntent
     ↓
Flutter displays Stripe Payment Sheet
     ↓
User completes payment
     ↓
Stripe webhook confirms payment
     ↓
Order confirmed in database
     ↓
Success response returned to Flutter
```

---

## 📱 Flutter Integration Steps

### **Step 1: Install Stripe Dependencies**

```bash
flutter pub add flutter_stripe
flutter pub add stripe_android
flutter pub add stripe_ios
```

### **Step 2: Initialize Stripe in Flutter**

```dart
import 'package:flutter_stripe/flutter_stripe.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Stripe
  Stripe.publishableKey = 'pk_test_xxxxxxxxxxxxx';
  await Stripe.instance.applySettings();

  runApp(MyApp());
}
```

### **Step 3: Create Cart Data Model**

```dart
class CartItem {
  final String productId;
  final String productName;
  final double price;
  final int quantity;
  final String image;

  CartItem({
    required this.productId,
    required this.productName,
    required this.price,
    required this.quantity,
    required this.image,
  });

  Map<String, dynamic> toJson() {
    return {
      'productId': productId,
      'quantity': quantity,
    };
  }
}

class OrderRequest {
  final String addressId;
  final double deliveryCharges;
  final String scheduledDeliveryDate;
  final String customerNote;
  final String paymentMethodId;

  OrderRequest({
    required this.addressId,
    required this.deliveryCharges,
    required this.scheduledDeliveryDate,
    required this.customerNote,
    required this.paymentMethodId,
  });

  Map<String, dynamic> toJson() {
    return {
      'addressId': addressId,
      'deliveryCharges': deliveryCharges,
      'scheduledDeliveryDate': scheduledDeliveryDate,
      'customerNote': customerNote,
      'paymentMethodId': paymentMethodId,
    };
  }
}
```

### **Step 4: Create Payment Service**

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_stripe/flutter_stripe.dart';

class PaymentService {
  final String baseUrl = 'http://localhost:5000/api/v1';
  late String accessToken;

  PaymentService({required this.accessToken});

  /// Step 1: Initiate payment by sending cart to Node API
  Future<String?> initiatePayment({
    required String addressId,
    required double deliveryCharges,
    required String scheduledDeliveryDate,
    required String customerNote,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/payment/create-intent'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'addressId': addressId,
          'deliveryCharges': deliveryCharges,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['data']['clientSecret']; // clientSecret for Payment Sheet
      } else {
        print('Error: ${response.statusCode}');
        return null;
      }
    } catch (e) {
      print('Error initiating payment: $e');
      return null;
    }
  }

  /// Step 2: Present Stripe Payment Sheet to user
  Future<bool> presentPaymentSheet({
    required String clientSecret,
  }) async {
    try {
      await Stripe.instance.presentPaymentSheet(
        parameters: PresentPaymentSheetParameters(
          clientSecret: clientSecret,
          merchantDisplayName: 'Retro Route',
        ),
      );
      return true; // Payment successful
    } catch (e) {
      if (e is StripeException) {
        print('Stripe Error: ${e.error.localizedMessage}');
      } else {
        print('Error presenting payment sheet: $e');
      }
      return false; // Payment failed
    }
  }

  /// Step 3: Create order after successful payment
  Future<Map<String, dynamic>?> createOrder({
    required String addressId,
    required double deliveryCharges,
    required String scheduledDeliveryDate,
    required String customerNote,
    required String paymentMethodId,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/payment/process'),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'addressId': addressId,
          'deliveryCharges': deliveryCharges,
          'scheduledDeliveryDate': scheduledDeliveryDate,
          'customerNote': customerNote,
          'paymentMethodId': paymentMethodId,
        }),
      );

      if (response.statusCode == 201) {
        return jsonDecode(response.body)['data'];
      } else {
        print('Error creating order: ${response.statusCode}');
        return null;
      }
    } catch (e) {
      print('Error creating order: $e');
      return null;
    }
  }
}
```

### **Step 5: Checkout UI Widget**

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CheckoutPage extends StatefulWidget {
  final String accessToken;
  final String userId;
  final double cartTotal;
  final List<CartItem> cartItems;

  const CheckoutPage({
    required this.accessToken,
    required this.userId,
    required this.cartTotal,
    required this.cartItems,
  });

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  late PaymentService paymentService;

  String? selectedAddressId;
  String? deliveryDate;
  String customerNote = '';
  double deliveryCharges = 50.0;
  bool isProcessing = false;

  List<Address> userAddresses = [];

  @override
  void initState() {
    super.initState();
    paymentService = PaymentService(accessToken: widget.accessToken);
    loadAddresses();
  }

  Future<void> loadAddresses() async {
    // Load user addresses from API
    // This calls GET /address/get-addresses
  }

  Future<void> processPayment() async {
    if (selectedAddressId == null || deliveryDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Please select address and delivery date')),
      );
      return;
    }

    setState(() => isProcessing = true);

    try {
      // Step 1: Get Stripe Payment Intent clientSecret
      final clientSecret = await paymentService.initiatePayment(
        addressId: selectedAddressId!,
        deliveryCharges: deliveryCharges,
        scheduledDeliveryDate: deliveryDate!,
        customerNote: customerNote,
      );

      if (clientSecret == null) {
        throw Exception('Failed to create payment intent');
      }

      // Step 2: Present Stripe Payment Sheet to user
      final paymentSuccess = await paymentService.presentPaymentSheet(
        clientSecret: clientSecret,
      );

      if (!paymentSuccess) {
        throw Exception('Payment was cancelled or failed');
      }

      // Step 3: Create order in Node API
      final orderData = await paymentService.createOrder(
        addressId: selectedAddressId!,
        deliveryCharges: deliveryCharges,
        scheduledDeliveryDate: deliveryDate!,
        customerNote: customerNote,
        paymentMethodId: 'pm_card_visa', // From Stripe Payment Sheet
      );

      if (orderData != null) {
        // Order created successfully
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order confirmed! Order ID: ${orderData['order']['orderId']}')),
        );

        // Navigate to order confirmation
        Navigator.of(context).pushReplacementNamed('/order-confirmation', arguments: orderData);
      } else {
        throw Exception('Failed to create order');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Payment failed: $e')),
      );
    } finally {
      setState(() => isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Checkout')),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Order Summary
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Order Summary', style: Theme.of(context).textTheme.titleLarge),
                    SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Subtotal'),
                        Text('Rs. ${widget.cartTotal.toStringAsFixed(2)}'),
                      ],
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Delivery Charges'),
                        Text('Rs. ${deliveryCharges.toStringAsFixed(2)}'),
                      ],
                    ),
                    Divider(),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Total', style: TextStyle(fontWeight: FontWeight.bold)),
                        Text(
                          'Rs. ${(widget.cartTotal + deliveryCharges).toStringAsFixed(2)}',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 16),

            // Select Address
            Text('Delivery Address', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: 8),
            DropdownButton<String>(
              isExpanded: true,
              value: selectedAddressId,
              hint: Text('Select address'),
              items: userAddresses.map((address) {
                return DropdownMenuItem(
                  value: address.id,
                  child: Text('${address.street}, ${address.city}'),
                );
              }).toList(),
              onChanged: (value) => setState(() => selectedAddressId = value),
            ),
            SizedBox(height: 16),

            // Select Delivery Date
            Text('Delivery Date', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: 8),
            InkWell(
              onTap: () async {
                final date = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now().add(Duration(days: 1)),
                  firstDate: DateTime.now().add(Duration(days: 1)),
                  lastDate: DateTime.now().add(Duration(days: 30)),
                );
                if (date != null) {
                  setState(() => deliveryDate = DateFormat('yyyy-MM-dd').format(date));
                }
              },
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                decoration: BoxDecoration(border: Border.all()),
                child: Text(deliveryDate ?? 'Select date'),
              ),
            ),
            SizedBox(height: 16),

            // Customer Notes
            Text('Special Instructions', style: Theme.of(context).textTheme.titleMedium),
            SizedBox(height: 8),
            TextField(
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Any special instructions?',
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() => customerNote = value),
            ),
            SizedBox(height: 24),

            // Proceed to Payment Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: isProcessing ? null : processPayment,
                child: isProcessing
                    ? SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text('Proceed to Payment'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 🔄 Complete Payment Flow

### **1. User Views Cart (Flutter)**

```dart
// Cart shows items with total
List<CartItem> items = [
  CartItem(productId: 'prod1', productName: 'Laptop', price: 50000, quantity: 1),
  CartItem(productId: 'prod2', productName: 'Mouse', price: 500, quantity: 2),
];
double total = 51000; // 50000 + 1000
```

### **2. Flutter Sends Order Data to Node API**

```
POST /api/v1/payment/create-intent
Body: {
  "addressId": "addr123",
  "deliveryCharges": 50
}
```

### **3. Node Calculates Total & Creates PaymentIntent**

```javascript
// Node Backend
const cart = await Cart.findOne({ user: userId });
let subtotal = 0;
cart.items.forEach(item => {
  subtotal += item.product.price * item.quantity;
});
const total = subtotal + 50; // deliveryCharges
const amountInCents = total * 100;

const paymentIntent = await stripe.paymentIntents.create({
  amount: amountInCents,
  currency: 'usd',
  automatic_payment_methods: { enabled: true },
});

return { clientSecret: paymentIntent.client_secret };
```

### **4. Flutter Shows Stripe Payment Sheet**

```dart
await Stripe.instance.presentPaymentSheet(
  parameters: PresentPaymentSheetParameters(
    clientSecret: clientSecret,
    merchantDisplayName: 'Retro Route',
  ),
);
```

### **5. User Completes Payment in Payment Sheet**

- User selects card or other payment method
- Authenticates with card details
- Stripe processes payment
- Returns to Flutter app

### **6. Stripe Sends Webhook Notification**

```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_...",
      "status": "succeeded",
      "amount": 5105000
    }
  }
}
```

### **7. Node Creates Order in Database**

```
POST /api/v1/payment/process
Body: {
  "addressId": "addr123",
  "deliveryCharges": 50,
  "scheduledDeliveryDate": "2026-01-26",
  "customerNote": "Please ring twice",
  "paymentMethodId": "pm_card_visa"
}

Response: {
  "statusCode": 201,
  "message": "Payment successful! Order created.",
  "data": {
    "order": {
      "_id": "order123",
      "orderId": "#123456",
      "products": [
        {
          "productId": {
            "_id": "prod1",
            "name": "Laptop",
            "price": 50000,
            "images": ["url"],
            "category": "Electronics"
          },
          "quantity": 1,
          "priceAtPurchase": 50000
        }
      ],
      "paymentStatus": "Completed"
    }
  }
}
```

### **8. Flutter Shows Order Confirmation**

```dart
// Order confirmed screen
OrderConfirmationPage(
  order: orderData['order'],
  payment: orderData['payment'],
)
```

---

## 📲 API Endpoints for Flutter

| Endpoint                        | Method | Purpose                    |
| ------------------------------- | ------ | -------------------------- |
| `/user/register`                | POST   | Register new user          |
| `/user/verify-registration-otp` | POST   | Verify OTP                 |
| `/user/login`                   | POST   | Login & get accessToken    |
| `/product`                      | GET    | Get all products           |
| `/cart/add`                     | POST   | Add product to cart        |
| `/cart/view`                    | GET    | View cart items            |
| `/address/create-address`       | POST   | Create delivery address    |
| `/address/get-addresses`        | GET    | Get all addresses          |
| `/payment/create-intent`        | POST   | Get Stripe clientSecret    |
| `/payment/process`              | POST   | Create order after payment |
| `/order`                        | GET    | Get user orders            |

---

## 🛡️ Security Best Practices

### **1. Never expose Secret Key in Flutter**

```dart
// ❌ WRONG - Don't do this
const String stripesecretKey = 'sk_test_...'; // This is exposed!

// ✅ CORRECT - Use Node API
// Call Node API which has secret key in environment
```

### **2. Validate on Backend**

```javascript
// Node Backend
if (!paymentIntent.succeeded) {
  throw new Error('Payment verification failed');
}
```

### **3. Verify Webhook Signature**

```javascript
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### **4. Use HTTPS in Production**

```dart
// Flutter
const String baseUrl = 'https://api.retroroute.com/api/v1'; // Production
// const String baseUrl = 'http://localhost:5000/api/v1'; // Development
```

---

## 🧪 Testing Checklist

- [ ] User can register and login
- [ ] User can add products to cart
- [ ] User can create delivery address
- [ ] Flutter sends request to `/payment/create-intent`
- [ ] Node returns clientSecret
- [ ] Stripe Payment Sheet opens
- [ ] Test with card `4242 4242 4242 4242` (success)
- [ ] Test with card `4000 0000 0000 0002` (decline)
- [ ] Payment succeeds and order is created
- [ ] Order contains full product information
- [ ] Cart is cleared after successful payment
- [ ] User can view order confirmation
- [ ] Order appears in user's order history

---

## 🚀 Production Deployment

### **Switch to Production Keys**

1. Get production Stripe keys from Stripe Dashboard
2. Update Node `.env`:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

3. Update Flutter code:

```dart
Stripe.publishableKey = 'pk_live_...'; // Production key
```

4. Set correct API base URL:

```dart
const String baseUrl = 'https://api.yourserver.com/api/v1';
```

5. Enable Stripe webhook in production dashboard

---

## 📞 Complete Flutter Example

```dart
// main.dart
import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  Stripe.publishableKey = 'pk_test_xxxxxxxxxxx';
  await Stripe.instance.applySettings();

  runApp(RetroRouteApp());
}

class RetroRouteApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Retro Route',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: LoginPage(),
      routes: {
        '/checkout': (context) => CheckoutPage(
          accessToken: '',
          userId: '',
          cartTotal: 0,
          cartItems: [],
        ),
      },
    );
  }
}

class LoginPage extends StatefulWidget {
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  late TextEditingController emailController;
  late TextEditingController passwordController;

  @override
  void initState() {
    super.initState();
    emailController = TextEditingController();
    passwordController = TextEditingController();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Retro Route - Login')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: emailController,
              decoration: InputDecoration(labelText: 'Email'),
            ),
            TextField(
              controller: passwordController,
              decoration: InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                // Call login API and navigate to home
                // Store accessToken
              },
              child: Text('Login'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }
}
```

---

## 💡 Common Issues & Solutions

| Issue                             | Solution                                             |
| --------------------------------- | ---------------------------------------------------- |
| "PaymentIntent not found"         | Ensure clientSecret is valid and recent              |
| "Invalid Publishable Key"         | Check Flutter Stripe initialization                  |
| "Payment Sheet not opening"       | Verify Stripe.instance.applySettings() is called     |
| "Order not created after payment" | Check webhook is configured in Stripe                |
| "Cart not clearing"               | Verify cart clearing happens only on payment success |
| "Product info missing in order"   | Check populate paths in Node API                     |

---

Congratulations! Your Flutter + Stripe integration is ready! 🎉
