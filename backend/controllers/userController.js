import User from "../models/userschema.js";
import Post from "../models/postschema.js";
import bcrypt from "bcryptjs";
import generateTokenAndSetCookie from "../utils/helpers/jwtcookie.js";
import AWS from "aws-sdk";
import mongoose from "mongoose";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const uploadToS3 = (fileContent, fileName) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ACL: "public-read",
  };
  return s3.upload(params).promise();
};

const getUserProfile = async (req, res) => {
  const { query } = req.params;

  try {
    let user;

    if (mongoose.Types.ObjectId.isValid(query)) {
      user = await User.findOne({ _id: query }).select("-password").select("-updatedAt");
    } else {
      user = await User.findOne({ username: query }).select("-password").select("-updatedAt");
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in getUserProfile: ", err.message);
  }
};

const signupUser = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    const user = await User.findOne({ $or: [{ email }, { username }] });

    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
    });
    await newUser.save();

    if (newUser) {
      generateTokenAndSetCookie(newUser._id, res);

      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        bio: newUser.bio,
        profilePic: newUser.profilePic,
      });
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in signupUser: ", err.message);
  }
};

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    const isPasswordCorrect = await bcrypt.compare(password, user?.password || "");

    if (!user || !isPasswordCorrect) return res.status(400).json({ error: "Invalid username or password" });

    if (user.isFrozen) {
      user.isFrozen = false;
      await user.save();
    }

    generateTokenAndSetCookie(user._id, res);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio,
      profilePic: user.profilePic,
    });
  } catch (error) {
    res.json({ error: error.message });
    console.log("Error in loginUser: ", error.message);
  }
};

const logoutUser = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 1 });
    res.json({ message: "User logged out successfully" });
  } catch (err) {
    res.json({ error: err.message });
    console.log("Error in signupUser: ", err.message);
  }
};

const followUnFollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userToModify = await User.findById(id);
    const currentUser = await User.findById(req.user._id);

    if (id === req.user._id.toString())
      return res.json({ error: "You cannot follow/unfollow yourself" });

    if (!userToModify || !currentUser) return res.json({ error: "User not found" });

    const isFollowing = currentUser.following.includes(id);

    if (isFollowing) {
      await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });
      await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });
      res.json({ message: "User unfollowed successfully" });
    } else {
      await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
      await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });
      res.json({ message: "User followed successfully" });
    }
  } catch (err) {
    res.json({ error: err.message });
    console.log("Error in followUnFollowUser: ", err.message);
  }
};
const updateUser = async (req, res) => {
	const { name, email, username, password, bio } = req.body;
	let { profilePic } = req.body;
  
	const userId = req.user._id;
	try {
	  let user = await User.findById(userId);
	  if (!user) return res.json({ error: "User not found" });
  
	  if (req.params.id !== userId.toString())
		return res.json({ error: "You cannot update other user's profile" });
  
	  if (password) {
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);
		user.password = hashedPassword;
	  }
  
	  if (profilePic) {
		if (user.profilePic) {
		  const key = user.profilePic.split("/").pop();
		  await s3.deleteObject({
			Bucket: process.env.AWS_BUCKET_NAME,
			Key: key,
		  }).promise();
		}
  
		const buffer = Buffer.from(profilePic, "base64");
		const fileName = `${userId}_${Date.now()}.jpg`;
		const uploadedResponse = await uploadToS3(buffer, fileName);
		profilePic = uploadedResponse.Location;
	  }
  
	  user.name = name || user.name;
	  user.email = email || user.email;
	  user.username = username || user.username;
	  user.profilePic = profilePic || user.profilePic;
	  user.bio = bio || user.bio;
  
	  user = await user.save();
  
	  await Post.updateMany(
		{ "replies.userId": userId },
		{
		  $set: {
			"replies.$[reply].username": user.username,
			"replies.$[reply].userProfilePic": user.profilePic,
		  },
		},
		{ arrayFilters: [{ "reply.userId": userId }] }
	  );
  
	  user.password = null;
  
	  res.status(200).json(user);
	} catch (err) {
	  res.status(500).json({ error: err.message });
	  console.log("Error in updateUser: ", err.message);
	}
  };
const freezeAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    user.isFrozen = true;
    await user.save();

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const getSuggestedUsers = async (req, res) => {
	try {
	  const userId = req.user._id;
  
	  const usersFollowedByYou = await User.findById(userId).select("following");
  
	  const users = await User.aggregate([
		{
		  $match: {
			_id: { $ne: userId },
		  },
		},
		{
		  $sample: { size: 10 },
		},
	  ]);
	  const filteredUsers = users.filter((user) => !usersFollowedByYou.following.includes(user._id));
	  const suggestedUsers = filteredUsers.slice(0, 4);
  
	  suggestedUsers.forEach((user) => (user.password = null));
  
	  res.status(200).json(suggestedUsers);
	} catch (error) {
	  res.status(500).json({ error: error.message });
	}
  };
export {
  signupUser,
  loginUser,
  logoutUser,
  followUnFollowUser,
  updateUser,
  getUserProfile,
  getSuggestedUsers,
  freezeAccount,
};
