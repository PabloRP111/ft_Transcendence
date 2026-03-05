
/*load environment variables
import the express app
start listening on a port*/

import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT ?? 3003;

const server = app.listen(PORT, () => {
  console.log(`chat-service listening on port ${PORT}`);
});

export { server };
