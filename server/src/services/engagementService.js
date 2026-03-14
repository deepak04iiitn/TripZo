import User from '../models/User.js';
import UserActivity from '../models/UserActivity.js';

function startOfUtcDay(inputDate = new Date()) {
  return new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), inputDate.getUTCDate()));
}

export async function touchUserActivity(userId) {
  if (!userId) {
    return;
  }

  const now = new Date();
  const activityDate = startOfUtcDay(now);

  await Promise.all([
    UserActivity.findOneAndUpdate(
      { userId, activityDate },
      {
        $set: { lastSeenAt: now },
        $setOnInsert: { userId, activityDate },
      },
      { upsert: true }
    ),
    User.updateOne({ _id: userId }, { $set: { lastActiveAt: now } }),
  ]);
}


