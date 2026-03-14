import { Router } from 'express';
import {
  createTrip,
  deleteTrip,
  generateTripDraft,
  getTripById,
  listExploreTrips,
  listSavedTrips,
  listTrips,
  removeSavedTripForUser,
  saveTripForUser,
  updateTripLike,
  updateTripStatus,
} from '../controllers/tripController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/generate', requireAuth, generateTripDraft);
router.post('/', requireAuth, createTrip);
router.get('/explore', requireAuth, listExploreTrips);
router.get('/saved', requireAuth, listSavedTrips);
router.get('/', requireAuth, listTrips);
router.post('/:tripId/save', requireAuth, saveTripForUser);
router.delete('/:tripId/save', requireAuth, removeSavedTripForUser);
router.get('/:tripId', requireAuth, getTripById);
router.patch('/:tripId/status', requireAuth, updateTripStatus);
router.patch('/:tripId/like', requireAuth, updateTripLike);
router.delete('/:tripId', requireAuth, deleteTrip);

export default router;


