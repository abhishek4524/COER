import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
      trim: true,
    },
    defaultGoal: {
      type: String,
      default: 'Test overall user experience and find conversion friction',
    },
    defaultPersonaGroup: {
      type: String,
      default: 'all',
    },
    defaultDevice: {
      type: String,
      default: 'desktop',
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    bestSuccessRate: {
      type: Number,
      default: 0,
    },
    latestFrictionScore: {
      type: Number,
      default: 0,
    },
    runCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Project = mongoose.model('Project', ProjectSchema);
export default Project;
