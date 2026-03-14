import mongoose from 'mongoose';

const monthlyApiUsageSchema = new mongoose.Schema(
  {
    monthKey: { type: String, required: true, unique: true, index: true },
    creditLimitUsd: { type: Number, required: true, default: 200 },
    estimatedCostUsd: { type: Number, required: true, default: 0 },
    blocked: { type: Boolean, default: false, index: true },
    blockedAt: { type: Date, default: null },
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const MonthlyApiUsage = mongoose.model('MonthlyApiUsage', monthlyApiUsageSchema);

export default MonthlyApiUsage;


