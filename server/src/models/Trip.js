import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: '' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    source: { type: String, trim: true, default: '' },
    accuracy: { type: Number, default: null },
  },
  { _id: false }
);

const recommendationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['restaurant', 'atm', 'washroom', 'medical'], required: true },
    reason: { type: String, trim: true, default: '' },
    place: {
      id: { type: String, trim: true, default: '' },
      label: { type: String, trim: true, default: '' },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      imageUrl: { type: String, trim: true, default: '' },
    },
  },
  { _id: false }
);

const stopSchema = new mongoose.Schema(
  {
    sequence: { type: Number, required: true },
    id: { type: String, trim: true, default: '' },
    label: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: 'attraction' },
    imageUrl: { type: String, trim: true, default: '' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    travelMinutesFromPrevious: { type: Number, default: 0 },
    travelDistanceKmFromPrevious: { type: Number, default: 0 },
    visitMinutes: { type: Number, default: 0 },
    recommendations: { type: [recommendationSchema], default: [] },
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    date: { type: String, required: true },
    stops: { type: [stopSchema], default: [] },
    totalMinutes: { type: Number, default: 0 },
    totalDistanceKm: { type: Number, default: 0 },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, trim: true, required: true },
    coverImageUrl: { type: String, trim: true, default: '' },
    createdAtIso: { type: String, required: true },
    startDate: { type: String, required: true, index: true },
    endDate: { type: String, required: true, index: true },
    durationDays: { type: Number, required: true },
    budget: { type: String, enum: ['$', '$$', '$$$'], required: true },
    from: { type: locationSchema, required: true },
    status: {
      type: String,
      enum: ['planned', 'ongoing', 'upcoming', 'completed'],
      default: 'planned',
      index: true,
    },
    optimization: {
      routeOptimized: { type: Boolean, default: true },
      timeOptimized: { type: Boolean, default: true },
      costOptimized: { type: Boolean, default: true },
      algorithm: { type: String, trim: true, default: '' },
    },
    stats: {
      totalStops: { type: Number, default: 0 },
      totalDistanceKm: { type: Number, default: 0 },
    },
    likesCount: { type: Number, default: 0 },
    isLiked: { type: Boolean, default: false },
    days: { type: [daySchema], default: [] },
  },
  {
    timestamps: true,
  }
);

tripSchema.index({ userId: 1, startDate: -1 });

const Trip = mongoose.model('Trip', tripSchema);

export default Trip;


