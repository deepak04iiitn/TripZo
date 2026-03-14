import mongoose from 'mongoose';

const itineraryCacheSchema = new mongoose.Schema(
  {
    fromLocation: { type: String, trim: true, default: '' },
    normalizedFromLocation: { type: String, trim: true, default: '', index: true },
    toLocation: { type: String, trim: true, default: '' },
    normalizedToLocation: { type: String, trim: true, default: '' },
    fromLatitudeRounded: { type: Number, default: null },
    fromLongitudeRounded: { type: Number, default: null },
    durationDays: { type: Number, required: true, index: true },
    budget: { type: String, enum: ['$', '$$', '$$$'], required: true, index: true },
    itineraryData: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

itineraryCacheSchema.index({ normalizedFromLocation: 1, durationDays: 1, budget: 1 });
itineraryCacheSchema.index({ fromLatitudeRounded: 1, fromLongitudeRounded: 1, durationDays: 1, budget: 1 });

const ItineraryCache = mongoose.model('ItineraryCache', itineraryCacheSchema);

export default ItineraryCache;


