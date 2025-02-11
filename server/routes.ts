
import { Router } from 'express';
import controller from './controllers'; 

const router = Router();

router.get('/test-db', controller.testDbConnectionController);
router.get('/test-server-up', controller.testServerUpController);
router.post('/signup', controller.signupController)

export default router;  
