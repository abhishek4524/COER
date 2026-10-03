import mongoose from 'mongoose';

const UsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    runsUsed: {
      type: Number,
      default: 0,
    },
    personasUsed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

UsageSchema.index({ userId: 1, periodStart: 1, periodEnd: 1 });

export const Usage = mongoose.model('Usage', UsageSchema);
export default Usage;
