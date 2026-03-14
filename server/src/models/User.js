import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 32,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required() {
        return this.authProvider === 'local';
      },
      minlength: 8,
      select: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true,
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    profileImageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    profileImagePath: {
      type: String,
      trim: true,
      default: '',
      select: false,
    },
    securityQuestion: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    securityAnswerHash: {
      type: String,
      select: false,
      default: '',
    },
    lastActiveAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.setSecurityAnswer = async function setSecurityAnswer(answer) {
  if (!answer) {
    this.securityAnswerHash = '';
    return;
  }

  this.securityAnswerHash = await bcrypt.hash(answer.trim().toLowerCase(), 12);
};

userSchema.methods.compareSecurityAnswer = async function compareSecurityAnswer(candidateAnswer) {
  if (!this.securityAnswerHash) {
    return false;
  }
  return bcrypt.compare(candidateAnswer.trim().toLowerCase(), this.securityAnswerHash);
};

const User = mongoose.model('User', userSchema);

export default User;

