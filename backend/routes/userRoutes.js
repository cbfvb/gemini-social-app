import express from "express";
import {
	followUnFollowUser,
	getUserProfile,
	loginUser,
	logoutUser,
	signupUser,
	updateUser,
	getSuggestedUsers,
	freezeAccount,
} from "../controllers/userController.js";
import protectRoute from "../middlewares/protectRoute.js";

const router = express.Router();
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 5, 
	message: 'Too many login attempts from this IP, please try again after 15 minutes'
  });
  
  const messageLimiter = rateLimit({
	windowMs: 1 * 60 * 1000, 
	max: 20,           //figuring out how to use with socket
	message: 'Too many messages sent from this IP, please try again after a minute'
  });
  
  const accountCreationLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, 
	max: 3, 
	message: 'Too many accounts created from this IP, please try again after an hour'
  });


router.get("/profile/:query", getUserProfile);
router.get("/suggested", protectRoute, getSuggestedUsers);
router.post("/signup",accountCreationLimiter, signupUser);
router.post("/login",authLimiter, loginUser);
router.post("/logout", logoutUser);
router.post("/follow/:id", protectRoute, followUnFollowUser);
router.put("/update/:id", protectRoute, updateUser);
router.put("/freeze", protectRoute, freezeAccount);

export default router;
