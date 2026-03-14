import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true, trim: true, index: true },
    scope: { type: String, trim: true, default: '', index: true },
    requestKey: { type: String, trim: true, default: '', index: true },
    ip: { type: String, trim: true, default: '', index: true },
    userId: { type: String, trim: true, default: '' },
    method: { type: String, trim: true, default: '' },
    path: { type: String, trim: true, default: '', index: true },
    userAgent: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

securityEventSchema.index({ createdAt: -1, eventType: 1, scope: 1 });

const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);

export default SecurityEvent;


