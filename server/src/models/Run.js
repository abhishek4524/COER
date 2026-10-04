import mongoose from 'mongoose';
import crypto from 'crypto';

const RunSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: [true, 'URL is required'],
      trim: true,
    },
    goal: {
      type: String,
      required: [true, 'Testing goal is required'],
      trim: true,
      default: 'Complete checkout flow',
    },
    personaCount: {
      type: Number,
      required: true,
      default: 20,
      min: 1,
      max: 50,
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'slow'],
      default: 'desktop',
    },
    status: {
      type: String,
      enum: ['pending_verification', 'queued', 'running', 'completed', 'failed'],
      default: 'pending_verification',
    },
    ownershipVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      default: () => `personify_verify_${crypto.randomBytes(16).toString('hex')}`,
    },
    verificationMethod: {
      type: String,
      enum: ['meta_tag', 'txt_file', 'file', 'dev_bypass', 'localhost_bypass', null],
      default: null,
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        totalSessions: 0,
        completed: 0,
        abandoned: 0,
        confused: 0,
        avgFrustration: 0,
        avgDurationSec: 0,
        ctaMissRate: 0,
      }),
    },
    scores: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        taskSuccessRate: 0,
        usabilityScore: 0,
        frictionIndex: 0,
        accessibilityScore: 0,
      }),
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    shareToken: {
      type: String,
      default: null,
      index: true,
    },
    shareExpiresAt: {
      type: Date,
      default: null,
    },

    // ─── Fix Emulator: child run fields ──────────────────────────────────────
    parentRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Run',
      default: null,
      index: true,
    },
    mode: {
      type: String,
      enum: ['normal', 'patched'],
      default: 'normal',
    },
    simulated: {
      type: Boolean,
      default: false,
    },
    enabledFixIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for fast query
RunSchema.index({ createdAt: -1 });

export const Run = mongoose.model('Run', RunSchema);
export default Run;
