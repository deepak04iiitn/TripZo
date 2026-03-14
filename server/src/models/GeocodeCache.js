import mongoose from 'mongoose';

const geocodeCacheSchema = new mongoose.Schema(
  {
    locationName: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, index: true },
    aliases: { type: [String], default: [] },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    latitudeRounded: { type: Number, required: true },
    longitudeRounded: { type: Number, required: true },
    formattedAddress: { type: String, trim: true, default: '' },
    source: { type: String, trim: true, default: 'google' },
  },
  { timestamps: true }
);

geocodeCacheSchema.index({ normalizedName: 1 }, { unique: true });
geocodeCacheSchema.index({ aliases: 1 });
geocodeCacheSchema.index({ latitudeRounded: 1, longitudeRounded: 1 });

const GeocodeCache = mongoose.model('GeocodeCache', geocodeCacheSchema);

export default GeocodeCache;


