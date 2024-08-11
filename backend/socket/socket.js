import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.schema.js";
import Conversation from "../models/conversation.schema.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: "http://localhost:3000",
		methods: ["GET", "POST"],
	},
});

export const getRecipientSocketId = (recipientId) => {
	return userSocketMap[recipientId];
};

const userSocketMap = {}; // userId: socketId


const uniqueRecipientRateLimiter = (limit, timeWindow) => {
  const userRecipientMap = {};

  return (socket, next) => {
    const userId = socket.handshake.query.userId;

    if (!userRecipientMap[userId]) {
      userRecipientMap[userId] = { recipients: new Set(), lastReset: Date.now() };
    }

    socket.checkRateLimit = (recipientId) => {
      const now = Date.now();
      const userRateLimit = userRecipientMap[userId];

      // Reset the recipient set if the time window has passed
      if (now - userRateLimit.lastReset > timeWindow) {
        userRateLimit.recipients.clear();
        userRateLimit.lastReset = now;
      }

      // Add recipient to the set
      userRateLimit.recipients.add(recipientId);

      // Check if the number of unique recipients exceeds the limit
      if (userRateLimit.recipients.size > limit) {
        socket.emit('rateLimit', { message: 'You are messaging too many different accounts. Please slow down.' });
        return false;
      }

      return true;
    };

    next();
  };
};

io.use(uniqueRecipientRateLimiter(10, 60 * 1000)); // Limit to 10 unique recipients per minute

io.on("connection", (socket) => {
	console.log("user connected", socket.id);
	const userId = socket.handshake.query.userId;

	if (userId != "undefined") userSocketMap[userId] = socket.id;
	io.emit("getOnlineUsers", Object.keys(userSocketMap));

	socket.on("markMessagesAsSeen", async ({ conversationId, userId }) => {
		try {
			await Message.updateMany({ conversationId: conversationId, seen: false }, { $set: { seen: true } });
			await Conversation.updateOne({ _id: conversationId }, { $set: { "lastMessage.seen": true } });
			io.to(userSocketMap[userId]).emit("messagesSeen", { conversationId });
		} catch (error) {
			console.log(error);
		}
	});

	socket.on("disconnect", () => {
		console.log("user disconnected");
		delete userSocketMap[userId];
		io.emit("getOnlineUsers", Object.keys(userSocketMap));
	});
});

export { io, server, app };
