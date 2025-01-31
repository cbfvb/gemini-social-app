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
} from "../controllers/user.Controller.js";
import protectRoute from "../middlewares/auth.middleware.js";

const router = express.Router();
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 5, 
	message: 'Too many attempts from this IP, please try again after 15 minutes'
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


router.get("/profile/:query",authLimiter, getUserProfile);
router.get("/suggested",authLimiter, protectRoute, getSuggestedUsers);
router.post("/signup",accountCreationLimiter, signupUser);
router.post("/login",authLimiter, loginUser);
router.post("/logout", authLimiter,logoutUser);
router.post("/follow/:id",authLimiter, protectRoute, followUnFollowUser);
router.put("/update/:id",authLimiter, protectRoute, updateUser);
router.put("/freeze",authLimiter, protectRoute, freezeAccount);

export default router;
