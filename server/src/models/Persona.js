import mongoose from 'mongoose';

const TraitsSchema = new mongoose.Schema(
  {
    patience: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50,
    },
    techSavviness: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50,
    },
    device: {
      type: String,
      required: true,
      default: 'Desktop Chrome',
    },
    language: {
      type: String,
      required: true,
      default: 'en',
    },
    accessibility: {
      type: String,
      enum: ['none', 'screen_reader', 'low_vision', 'motor_impairment', 'cognitive_load', 'color_blind'],
      default: 'none',
    },
    ageGroup: {
      type: String,
      enum: ['teen', 'young-adult', 'adult', 'senior', null],
      default: 'adult',
    },
  },
  { _id: false }
);

const AvatarSetSchema = new mongoose.Schema(
  {
    default: { type: String, required: true },
    hover: { type: String, default: null },
    confused: { type: String, default: null },
    happy: { type: String, default: null },
    frustrated: { type: String, default: null },
  },
  { _id: false }
);

const PersonaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Persona name is required'],
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 10,
      max: 100,
    },
    traits: {
      type: TraitsSchema,
      required: true,
    },
    backstory: {
      type: String,
      default: '',
    },
    avatarSet: {
      type: AvatarSetSchema,
      required: false,
      default: () => ({ default: '/assets/personas/default.png' }),
    },
    systemPrompt: {
      type: String,
      required: true,
    },
    isCustom: {
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

PersonaSchema.index({ 'traits.patience': 1, 'traits.techSavviness': 1 });

export const Persona = mongoose.model('Persona', PersonaSchema);
export default Persona;
