import express, { urlencoded } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

// middlewares configuration
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);

app.use(express.json({ limit: '16kb' }));
app.use(urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// import routes
import { userRouter } from './routes/user.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import { productRouter } from './routes/product.routes.js';
import { addressRouter } from './routes/address.routes.js';
import { cartRouter } from './routes/cart.routes.js';
import { orderRouter } from './routes/order.routes.js';
import reviewRouter from './routes/review.routes.js';
import favoriteRouter from './routes/favorite.routes.js';
import paymentRouter from './routes/payment.routes.js';

// use routes
app.use('/api/v1/user', userRouter);
app.use('/api/v1/category', categoryRouter);
app.use('/api/v1/product', productRouter);
app.use('/api/v1/address', addressRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/order', orderRouter);
app.use('/api/v1/review', reviewRouter);
app.use('/api/v1/favorite', favoriteRouter);
app.use('/api/v1/payment', paymentRouter);

// test api
app.get('/', (req, res) => {
  res.send("Zafgoal Api's Working Successfully");
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    statusCode,
    message,
    success: false,
    error: err.error || null,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export { app };
