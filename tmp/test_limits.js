import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../server/src/models/User.js';
import { checkAndIncrementItineraryLimit } from '../server/src/services/userLimitService.js';

dotenv.config({ path: './server/.env' });

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create a dummy user
    const dummyUser = await User.create({
      username: 'testuser_limits',
      email: 'test_limits@example.com',
      password: 'Password123!',
      authProvider: 'local'
    });
    console.log('Created dummy user:', dummyUser._id);

    // Test 1: First increment
    await checkAndIncrementItineraryLimit(dummyUser._id);
    let user = await User.findById(dummyUser._id);
    console.log('Test 1 (First increment): count =', user.itineraryCountToday, 'date =', user.lastItineraryDate);

    // Test 2: Increment up to limit (10)
    for (let i = 0; i < 9; i++) {
        await checkAndIncrementItineraryLimit(dummyUser._id);
    }
    user = await User.findById(dummyUser._id);
    console.log('Test 2 (Reached limit): count =', user.itineraryCountToday);

    // Test 3: Exceed limit
    try {
        await checkAndIncrementItineraryLimit(dummyUser._id);
        console.error('Test 3 Failed: Should have thrown an error');
    } catch (err) {
        console.log('Test 3 (Exceed limit): Caught expected error -', err.message);
    }

    // Test 4: Reset on new day
    user.lastItineraryDate = '2000-01-01';
    await user.save();
    console.log('Simulated yesterday date');
    await checkAndIncrementItineraryLimit(dummyUser._id);
    user = await User.findById(dummyUser._id);
    console.log('Test 4 (New day reset): count =', user.itineraryCountToday, 'date =', user.lastItineraryDate);

    // Cleanup
    await User.deleteOne({ _id: dummyUser._id });
    console.log('Deleted dummy user');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();
