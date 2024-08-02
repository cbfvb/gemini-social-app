import Post from "../models/postschema.js";
import User from "../models/userschema.js";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid"; 
import Follow from "../models/followingschema.js";

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

const createPost = async (req, res) => {
	try {
		const { postedBy, text } = req.body;
		let { img } = req.body;

		if (!postedBy || !text) {
			return res.json({ error: "Postedby and text fields are required" });
		}

		const user = await User.findById(postedBy);
		if (!user) {
			return res.json({ error: "User not found" });
		}

		if (user._id.toString() !== req.user._id.toString()) {
			return res.json({ error: "Unauthorized to create post" });
		}

		const maxLength = 500;
		if (text.length > maxLength) {
			return res.json({ error: `Text must be less than ${maxLength} characters` });
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
				ContentType: `image/${type}`,
			};

			const { Location } = await s3.upload(params).promise();
			img = Location;
		}

		const newPost = new Post({ postedBy, text, img });
		await newPost.save();

		res.json(newPost);
	} catch (err) {
		res.json({ error: err.message });
		console.log(err);
	}
};



const deletePost = async (req, res) => {
	try {
		const post = await Post.findById(req.params.id);
		if (!post) {
			return res.json({ error: "Post not found" });
		}

		if (post.postedBy.toString() !== req.user._id.toString()) {
			return res.json({ error: "Unauthorized to delete post" });
		}

		if (post.img) {
			const imgKey = post.img.split("/").pop();
			await s3
				.deleteObject({
					Bucket: bucketName,
					Key: imgKey,
				})
				.promise();
		}

		await Post.findByIdAndDelete(req.params.id);

		res.json({ message: "Post deleted successfully" });
	} catch (err) {
		res.json({ error: err.message });
	}
};
const getPost = async (req, res) => {
	try {
		const post = await Post.findById(req.params.id);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		res.json(post);
	} catch (err) {
		res.json({ error: err.message });
	}
};


const replyToPost = async (req, res) => {
	try {
		const { text } = req.body;
		const postId = req.params.id;
		const userId = req.user._id;
		const userProfilePic = req.user.profilePic;
		const username = req.user.username;

		if (!text) {
			return res.json({ error: "Text field is required" });
		}

		const post = await Post.findById(postId);
		if (!post) {
			return res.json({ error: "Post not found" });
		}

		const reply = { userId, text, userProfilePic, username };

		post.replies.push(reply);
		await post.save();

		res.json(reply);
	} catch (err) {
		res.json({ error: err.message });
	}
};
const likeUnlikePost = async (req, res) => {
	try {
		const { id: postId } = req.params;
		const userId = req.user._id;

		const post = await Post.findById(postId);

		if (!post) {
			return res.json({ error: "Post not found" });
		}

		const userLikedPost = post.likes.includes(userId);

		if (userLikedPost) {
		
			await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
			res.json({ message: "Post unliked successfully" });
		} else {
		
			post.likes.push(userId);
			await post.save();
			res.json({ message: "Post liked successfully" });
		}
	} catch (err) {
		res.json({ error: err.message });
	}
};

const getFeedPosts = async (req, res) => {
	try {
	  const userId = req.user._id;
	  const user = await User.findById(userId);
	  if (!user) {
		return res.json({ error: "User not found" });
	  }
  
	  const following = await Follow.find({ follower: userId }).select('following');
  
	  const followingIds = following.map(follow => follow.following);
  
	  const feedPosts = await Post.find({ postedBy: { $in: followingIds } }).sort({ createdAt: -1 });
  
	  res.json(feedPosts);
	} catch (err) {
	  res.json({ error: err.message });
	}
  };
const getUserPosts = async (req, res) => {
	const { username } = req.params;
	try {
		const user = await User.findOne({ username });
		if (!user) {
			return res.json({ error: "User not found" });
		}

		const posts = await Post.find({ postedBy: user._id }).sort({ createdAt: -1 });

		res.json(posts);
	} catch (error) {
		res.json({ error: error.message });
	}
};

export { createPost, getPost, deletePost, likeUnlikePost, replyToPost, getFeedPosts, getUserPosts };
