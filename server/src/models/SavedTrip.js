import mongoose from 'mongoose';

const savedTripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

savedTripSchema.index({ userId: 1, tripId: 1 }, { unique: true });

const SavedTrip = mongoose.model('SavedTrip', savedTripSchema);

export default SavedTrip;

