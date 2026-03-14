import mongoose from 'mongoose';

const userActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    activityDate: {
      type: Date,
      required: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

userActivitySchema.index({ userId: 1, activityDate: 1 }, { unique: true });
userActivitySchema.index({ activityDate: 1, userId: 1 });

const UserActivity = mongoose.model('UserActivity', userActivitySchema);

export default UserActivity;

