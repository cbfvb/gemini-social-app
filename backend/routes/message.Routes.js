import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import { getMessages, sendMessage, getConversations } from "../controllers/message.Controller.js";

const router = express.Router();

router.get("/conversations", protectRoute, getConversations);
router.get("/:otherUserId", protectRoute, getMessages);
router.post("/", protectRoute, sendMessage);

export default router;
