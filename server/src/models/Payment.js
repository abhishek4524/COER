import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['created', 'captured', 'failed'],
      default: 'created',
    },
    invoiceUrl: {
      type: String,
      default: null,
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'team'],
      default: 'pro',
    },
    interval: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Payment = mongoose.model('Payment', PaymentSchema);
export default Payment;
