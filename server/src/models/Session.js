import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Run',
      required: true,
      index: true,
    },
    personaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Persona',
      required: true,
    },
    personaSnapshot: {
      name: String,
      age: Number,
      tag: String,
      device: String,
      avatar: String,
      altAvatar: String,
      patience: Number,
      techSavviness: Number,
      traits: mongoose.Schema.Types.Mixed,
      avatarSet: mongoose.Schema.Types.Mixed,
    },
    outcome: {
      type: String,
      enum: ['in_progress', 'completed', 'gave_up', 'abandoned', 'confused', 'stuck'],
      default: 'in_progress',
    },
    totalTime: {
      type: Number,
      default: 0, // seconds
    },
    frustrationScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    finalFeedback: {
      type: String,
      default: '',
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    rageClickCount: {
      type: Number,
      default: 0,
    },
    missedCTA: {
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

SessionSchema.index({ runId: 1, outcome: 1 });

export const Session = mongoose.model('Session', SessionSchema);
export default Session;
