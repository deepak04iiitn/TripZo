import User from '../models/User.js';

const DAILY_ITINERARY_LIMIT = 10;

/**
 * Checks if a user has exceeded their daily itinerary creation limit
 * and increments the counter if not.
 * 
 * @param {string} userId - The ID of the authenticated user
 * @throws {Error} - 429 Error if limit is exceeded
 */
export async function checkAndIncrementItineraryLimit(userId) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if it's a new day
  if (user.lastItineraryDate !== todayStr) {
    user.itineraryCountToday = 1;
    user.lastItineraryDate = todayStr;
    await user.save();
    return;
  }

  // Check if limit exceeded
  if (user.itineraryCountToday >= DAILY_ITINERARY_LIMIT) {
    const error = new Error(`You have reached your daily limit of ${DAILY_ITINERARY_LIMIT} itineraries. Please try again tomorrow.`);
    error.statusCode = 429;
    throw error;
  }

  // Increment and save
  user.itineraryCountToday += 1;
  await user.save();
}
