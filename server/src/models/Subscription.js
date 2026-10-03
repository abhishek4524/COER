import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'team'],
      default: 'free',
      required: true,
    },
    interval: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    status: {
      type: String,
      enum: ['created', 'active', 'past_due', 'cancelled', 'expired'],
      default: 'active',
      required: true,
    },
    razorpaySubscriptionId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Subscription = mongoose.model('Subscription', SubscriptionSchema);
export default Subscription;
