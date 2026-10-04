/**
 * server/src/models/FixCache.js
 *
 * Mongoose model for caching generated fixes and preview screenshots per run.
 * Keyed by (runId, pagePath, enabledFixIds hash).
 * Simulated = true marks results that must never mix with real run data.
 */

import mongoose from 'mongoose';

const PatchOpSchema = new mongoose.Schema({
  type: { type: String, required: true },
  selector: { type: String, required: true },
  cssProps: { type: mongoose.Schema.Types.Mixed },
  text: { type: String },
  name: { type: String },
  value: { type: String },
  html: { type: String },
}, { _id: false });

const BboxSchema = new mongoose.Schema({
  fixId: String,
  fixTitle: String,
  selector: String,
  bbox: {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
  },
}, { _id: false });

const EvidenceSchema = new mongoose.Schema({
  page: String,
  element: String,
  personasAffected: Number,
  metric: String,
}, { _id: false });

const FixSchema = new mongoose.Schema({
  id: { type: String, required: true },
  runId: { type: String, required: true },
  pagePath: { type: String, required: true },
  title: { type: String, required: true },
  problem: { type: String },
  evidence: EvidenceSchema,
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium',
  },
  patchOps: [PatchOpSchema],
  codeSnippet: { type: String },
  confidence: { type: Number, min: 0, max: 1, default: 0.8 },
  effort: { type: String, enum: ['low', 'med', 'high'], default: 'low' },
  expectedImpact: { type: String },
  source: { type: String, enum: ['deterministic', 'llm'], default: 'deterministic' },
  previewAvailable: { type: Boolean, default: true },
}, { _id: false });

const PreviewResultSchema = new mongoose.Schema({
  pagePath: { type: String, required: true },
  pageUrl: { type: String },
  cacheKey: { type: String },
  beforeUrl: { type: String },
  afterUrl: { type: String },
  bboxes: [BboxSchema],
  feasible: { type: Boolean, default: true },
  reason: { type: String },
  generatedAt: { type: Date, default: Date.now },
}, { _id: false });

const FixCacheSchema = new mongoose.Schema(
  {
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Run',
      required: true,
    },

    // Generated fix objects for this run
    fixes: [FixSchema],

    // Preview results keyed by enabledFixIds hash
    previews: {
      type: Map,
      of: PreviewResultSchema,
    },

    // Patched child run reference (if re-test was run)
    childRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Run',
      default: null,
    },

    // Generation metadata
    generatedAt: { type: Date, default: Date.now },
    fixCount: { type: Number, default: 0 },
    simulated: { type: Boolean, default: true }, // always true for fix emulator results
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

FixCacheSchema.index({ runId: 1 }, { unique: true });

export const FixCache = mongoose.model('FixCache', FixCacheSchema);
export default FixCache;
