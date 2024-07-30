import jwt from "jsonwebtoken";

const generateTokenAndSetCookie = (userId, res) => {
	const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
		expiresIn: "7d",
	});

	res.cookie("jwt", token, {
		httpOnly: true,
		maxAge: 7 * 24 * 60 * 60 * 1000, 
	});

	return token;
};

export default generateTokenAndSetCookie;
