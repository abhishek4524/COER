import mongoose from 'mongoose';

const StepSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Run',
      index: true,
    },
    stepIndex: {
      type: Number,
      default: 1,
    },
    action: {
      type: String,
      required: true,
      default: 'click', // 'click', 'scroll', 'input', 'hover', 'rage_click', 'navigate'
    },
    target: {
      type: String,
      default: 'window', // CSS selector or description
    },
    x: {
      type: Number,
      default: 0,
    },
    y: {
      type: Number,
      default: 0,
    },
    viewport: {
      width: { type: Number, default: 1440 },
      height: { type: Number, default: 900 },
    },
    thought: {
      type: String,
      default: '',
    },
    emotion: {
      type: String,
      enum: ['neutral', 'curious', 'focused', 'confused', 'frustrated', 'happy', 'satisfied', 'angry', 'gave_up'],
      default: 'neutral',
    },
    frustration: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    screenshotUrl: {
      type: String,
      default: null,
    },
    personaName: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      default: null,
    },
    pageTitle: {
      type: String,
      default: null,
    },
    domChanged: {
      type: Boolean,
      default: false,
    },
    isDeadClick: {
      type: Boolean,
      default: false,
    },
    ts: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

StepSchema.index({ sessionId: 1, stepIndex: 1 });

export const Step = mongoose.model('Step', StepSchema);
export default Step;
