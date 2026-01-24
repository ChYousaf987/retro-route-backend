import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { app } from './app.js';
import { DBConnect } from './db/DBConnect.js';

const port = process.env.PORT || 3000;

await DBConnect();

app.listen(port, () => {
  console.log(`Server is Running at http://localhost:${port}`);
});
