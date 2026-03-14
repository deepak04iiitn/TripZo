import mongoose from 'mongoose';

const placeEntrySchema = new mongoose.Schema(
  {
    placeId: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    types: { type: [String], default: [] },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    rating: { type: Number, default: null },
    userRatingsTotal: { type: Number, default: null },
    priceLevel: { type: Number, default: null },
    photoReference: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const placeCacheSchema = new mongoose.Schema(
  {
    locationKey: { type: String, required: true, trim: true },
    normalizedLocationName: { type: String, trim: true, default: '' },
    latitudeRounded: { type: Number, required: true },
    longitudeRounded: { type: Number, required: true },
    radiusMeters: { type: Number, required: true },
    type: { type: String, trim: true, default: '' },
    keyword: { type: String, trim: true, default: '' },
    maxPages: { type: Number, default: 1 },
    places: { type: [placeEntrySchema], default: [] },
    source: { type: String, trim: true, default: 'google_places' },
  },
  { timestamps: true }
);

placeCacheSchema.index(
  { locationKey: 1, radiusMeters: 1, type: 1, keyword: 1, maxPages: 1 },
  { unique: true, name: 'unique_places_query_cache' }
);
placeCacheSchema.index({ normalizedLocationName: 1, type: 1 });

const PlaceCache = mongoose.model('PlaceCache', placeCacheSchema);

export default PlaceCache;


