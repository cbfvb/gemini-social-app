import Conversation from "../models/conversation.schema.js";
import Message from "../models/message.schema.js";
import { getRecipientSocketId, io } from "../socket/socket.js";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid"; 

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

async function sendMessage(req, res) {
	try {
		const { recipientId, message } = req.body;
		let { img } = req.body;
		const senderId = req.user._id;

		let conversation = await Conversation.findOne({
			participants: { $all: [senderId, recipientId] },
		});

		if (!conversation) {
			conversation = new Conversation({
				participants: [senderId, recipientId],
				lastMessage: {
					text: message,
					sender: senderId,
				},
			});
			await conversation.save();
		}

		if (img) {
			const base64Data = Buffer.from(
				img.replace(/^data:image\/\w+;base64,/, ""),
				"base64"
			);
			const type = img.split(";")[0].split("/")[1];
			const params = {
				Bucket: bucketName,
				Key: `${uuidv4()}.${type}`,
				Body: base64Data,
				ACL: "public-read",
				ContentEncoding: "base64", 
				ContentType: `image/${type}`
			};

			const { Location } = await s3.upload(params).promise();
			img = Location;
		}

		const newMessage = new Message({
			conversationId: conversation._id,
			sender: senderId,
			text: message,
			img: img || "",
		});

		await Promise.all([
			newMessage.save(),
			conversation.updateOne({
				lastMessage: {
					text: message,
					sender: senderId,
				},
			}),
		]);

		const recipientSocketId = getRecipientSocketId(recipientId);
		if (recipientSocketId) {
			io.to(recipientSocketId).emit("newMessage", newMessage);
		}

		res.json(newMessage);
	} catch (error) {
		res.json({ error: error.message });
	}
}
async function getConversations(req, res) {
	const userId = req.user._id;
	try {
		const conversations = await Conversation.find({ participants: userId }).populate({
			path: "participants",
			select: "username profilePic",
		});

		conversations.forEach((conversation) => {
			conversation.participants = conversation.participants.filter(
				(participant) => participant._id.toString() !== userId.toString()
			);
		});
		res.json(conversations);
	} catch (error) {
		res.json({ error: error.message });
	}
}
async function getMessages(req, res) {
	const { otherUserId } = req.params;
	const userId = req.user._id;
	try {
		const conversation = await Conversation.findOne({
			participants: { $all: [userId, otherUserId] },
		});

		if (!conversation) {
			return res.json({ error: "Conversation not found" });
		}

		const messages = await Message.find({
			conversationId: conversation._id,
		}).sort({ createdAt: 1 });

		res.json(messages);
	} catch (error) {
		res.json({ error: error.message });
	}
}



export { sendMessage, getMessages, getConversations };

