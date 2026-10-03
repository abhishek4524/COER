import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'team'],
      default: 'free',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      default: null,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
    },
    settings: {
      theme: { type: String, default: 'dark' },
      defaultDevice: { type: String, default: 'desktop' },
      defaultPersonaCount: { type: Number, default: 5 },
    },
    apiKeys: [
      {
        keyHash: { type: String, required: true },
        keyPrefix: { type: String, required: true },
        name: { type: String, default: 'Default API Key' },
        createdAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date, default: null },
      },
    ],
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Never expose password hashes or reset tokens in JSON responses
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  if (obj.apiKeys) {
    obj.apiKeys = obj.apiKeys.map((k) => {
      const { keyHash, ...rest } = k;
      return rest;
    });
  }
  return obj;
};

export const User = mongoose.model('User', UserSchema);
export default User;
