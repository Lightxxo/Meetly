
import { Router } from 'express';
import controller from './controllers';
import upload from './multerconfig';
import authMiddleware from './authMiddleware';

const router = Router();

router.get('/test-db', controller.testDbConnectionController);
router.get('/test-server-up', controller.testServerUpController);
router.post('/signup', controller.signupController);
router.post('/login', controller.loginController);
router.post('/user-token-verify', controller.userTokenVerifyController);
router.post("/create-event", authMiddleware, upload.array("images", 10), controller.createEventController);
router.get('/events', controller.getEvents);
router.get('/event/:eventID', controller.getEventDetails);
router.get('/rsvp-status', authMiddleware, controller.getUserRSVPStatus)
router.post('/rsvp-status', authMiddleware, controller.postUserRSVPStatus)
router.post('/event-comment', authMiddleware, controller.postComment)
router.delete('/delete-comment', authMiddleware, controller.deleteComment)
router.put('/update-comment', authMiddleware, controller.updateComment)
router.get('/user', authMiddleware, controller.getUserEvents)
router.get('/user/my', authMiddleware, controller.getMyEvents)
router.get('/user/interested', authMiddleware, controller.getInterestedEvents)
router.get('/user/attending', authMiddleware, controller.getAttendingEvents)
router.get('/event-edit/:eventID', authMiddleware, controller.getEditEventDetails)
router.put('/edit-event/:eventID', upload.array("newImages"), controller.updateEventController)
router.delete('/delete-event/:eventID', authMiddleware, controller.deleteEventController);
router.get("/search", controller.searchEvents);
router.post("/sample-data", controller.insertSampleData)
router.post("/sample-create", upload.array("images", 10), controller.createSampleEventController)
router.get('/search-event-type', controller.getEventTypes)
router.get('/elastic', controller.getElasticIndex)
export default router;  
