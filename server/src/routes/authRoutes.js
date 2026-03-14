import { Router } from 'express';
import {
  deleteAccount,
  getForgotPasswordQuestion,
  getMe,
  googleAuth,
  logout,
  resetPasswordWithSecurityAnswer,
  signin,
  signup,
  updateProfile,
  uploadProfileImage,
} from '../controllers/authController.js';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware.js';
import { authFloodLimiter } from '../middleware/securityMiddleware.js';
import { uploadProfileImageMiddleware } from '../middleware/uploadMiddleware.js';

const router = Router();

router.post('/signup', authFloodLimiter, signup);
router.post('/signin', authFloodLimiter, signin);
router.post('/google', authFloodLimiter, googleAuth);
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);
router.post('/profile/image', requireAuth, uploadProfileImageMiddleware, uploadProfileImage);
router.delete('/account', requireAuth, deleteAccount);
router.post('/forgot-password/question', authFloodLimiter, getForgotPasswordQuestion);
router.post('/forgot-password/reset', authFloodLimiter, resetPasswordWithSecurityAnswer);
router.post('/logout', requireAuth, logout);
router.get('/admin/check', requireAuth, requireAdmin, (_req, res) => {
  res.json({ message: 'Admin access granted.' });
});

export default router;

