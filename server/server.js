import 'dotenv/config';
import app from './src/app.js';
import { connectToDatabase, disconnectFromDatabase } from './src/config/database.js';
import dotenv from 'dotenv';
import { startMonthlyCreditMonitor } from './src/services/creditGuardService.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectToDatabase();
    const creditMonitor = startMonthlyCreditMonitor();

    const server = app.listen(PORT, () => {
      console.log(`TripZo server running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received. Closing server...`);
      creditMonitor.stop();
      server.close(async () => {
        await disconnectFromDatabase();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
