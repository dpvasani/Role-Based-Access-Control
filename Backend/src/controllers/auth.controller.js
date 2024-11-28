import bcryptjs from "bcryptjs";
import crypto from "crypto";

import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import {
	sendPasswordResetEmail,
	sendResetSuccessEmail,
	sendVerificationEmail,
	sendWelcomeEmail,
} from "../mailtrap/emails.js";
import { User } from "../models/user.model.js";

// export const signup = async (req, res) => {
// 	const { email, password, name } = req.body;

// 	try {
// 		if (!email || !password || !name) {
// 			throw new Error("All fields are required");
// 		}

// 		const userAlreadyExists = await User.findOne({ email });
// 		// console.log("userAlreadyExists", userAlreadyExists);

// 		if (userAlreadyExists) {
// 			return res.status(400).json({ success: false, message: "User already exists" });
// 		}

// 		const hashedPassword = await bcryptjs.hash(password, 10);
// 		const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

// 		const user = new User({
// 			email,
// 			password: hashedPassword,
// 			name,
// 			verificationToken,
// 			verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
// 		});

// 		await user.save();

// 		// jwt
// 		generateTokenAndSetCookie(res, user._id);

// 		await sendVerificationEmail(user.email, verificationToken);

// 		res.status(201).json({
// 			success: true,
// 			message: "User created successfully",
// 			user: {
// 				...user._doc,
// 				password: undefined,
// 			},
// 		});
// 	} catch (error) {
// 		res.status(400).json({ success: false, message: error.message });
// 	}
// };

export const signup = async (req, res) => {
	const { email, password, name, role } = req.body;

	try {
		// Validate required fields
		if (!email || !password || !name || !role) {
			throw new Error("All fields, including role, are required");
		}

		// Validate role
		const validRoles = ["Admin", "User", "Moderator"]; // Define valid roles
		if (!validRoles.includes(role)) {
			return res.status(400).json({
				success: false,
				message: `Invalid role. Valid roles are: ${validRoles.join(", ")}`,
			});
		}

		// Check if the user already exists
		const userAlreadyExists = await User.findOne({ email });
		if (userAlreadyExists) {
			return res.status(400).json({ success: false, message: "User already exists" });
		}

		// Hash the password
		const hashedPassword = await bcryptjs.hash(password, 10);

		// Generate a verification token
		const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

		// Create the user
		const user = new User({
			email,
			password: hashedPassword,
			name,
			role, // Save the role
			verificationToken,
			verificationTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
		});

		await user.save();

		// Generate JWT and set it as a cookie
		generateTokenAndSetCookie(res, user._id);

		// Send verification email
		await sendVerificationEmail(user.email, verificationToken);

		// Respond with success
		res.status(201).json({
			success: true,
			message: "User created successfully",
			user: {
				...user._doc,
				password: undefined, // Omit the password in the response
			},
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};

export const verifyEmail = async (req, res) => {
	const { code } = req.body;
	try {
		const user = await User.findOne({
			verificationToken: code,
			verificationTokenExpiresAt: { $gt: Date.now() },
		});

		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
		}

		user.isVerified = true;
		user.verificationToken = undefined;
		user.verificationTokenExpiresAt = undefined;
		await user.save();

		await sendWelcomeEmail(user.email, user.name);

		res.status(200).json({
			success: true,
			message: "Email verified successfully",
			user: {
				...user._doc,
				password: undefined,
			},
		});
	} catch (error) {
		console.log("error in verifyEmail ", error);
		res.status(500).json({ success: false, message: "Server error" });
	}
};

// export const login = async (req, res) => {
// 	const { email, password } = req.body;
// 	try {
// 		const user = await User.findOne({ email });
// 		if (!user) {
// 			return res.status(400).json({ success: false, message: "Invalid credentials" });
// 		}
// 		const isPasswordValid = await bcryptjs.compare(password, user.password);
// 		if (!isPasswordValid) {
// 			return res.status(400).json({ success: false, message: "Invalid credentials" });
// 		}

// 		generateTokenAndSetCookie(res, user._id);

// 		user.lastLogin = new Date();
// 		await user.save();

// 		res.status(200).json({
// 			success: true,
// 			message: "Logged in successfully",
// 			user: {
// 				...user._doc,
// 				password: undefined,
// 			},
// 		});
// 	} catch (error) {
// 		console.log("Error in login ", error);
// 		res.status(400).json({ success: false, message: error.message });
// 	}
// };

export const login = async (req, res) => {
	const { email, password } = req.body;

	try {
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid credentials" });
		}

		// Check if the user is locked out
		if (user.lockUntil && user.lockUntil > Date.now()) {
			return res.status(403).json({
				success: false,
				message: `Account locked. Try again after ${new Date(user.lockUntil).toLocaleTimeString()}.`,
			});
		}

		// Verify password
		const isPasswordValid = await bcryptjs.compare(password, user.password);

		if (!isPasswordValid) {
			// Increment failed login count
			user.failedLoginCount += 1;
			user.loginHistory.push({ success: false });

			// Lock account if failed attempts exceed 3
			if (user.failedLoginCount >= 3) {
				user.lockUntil = Date.now() + 15 * 60 * 1000; // 15-minute cooldown
				user.failedLoginCount = 0; // Reset failed login count after lock
			}

			await user.save();

			return res.status(400).json({ success: false, message: "Invalid credentials" });
		}

		// Reset failed login count on successful login
		user.failedLoginCount = 0;
		user.lockUntil = undefined;

		// Add login attempt to history
		user.loginHistory.push({ success: true });

		// Update last login timestamp
		user.lastLogin = new Date();

		await user.save();

		// Generate JWT and set it as a cookie
		generateTokenAndSetCookie(res, user._id);

		res.status(200).json({
			success: true,
			message: "Logged in successfully",
			user: {
				...user._doc,
				password: undefined,
			},
		});
	} catch (error) {
		console.log("Error in login ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};


export const logout = async (req, res) => {
	res.clearCookie("token");
	res.status(200).json({ success: true, message: "Logged out successfully" });
};

export const forgotPassword = async (req, res) => {
	const { email } = req.body;
	try {
		const user = await User.findOne({ email });

		if (!user) {
			return res.status(400).json({ success: false, message: "User not found" });
		}

		// Generate reset token
		const resetToken = crypto.randomBytes(20).toString("hex");
		const resetTokenExpiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

		user.resetPasswordToken = resetToken;
		user.resetPasswordExpiresAt = resetTokenExpiresAt;

		await user.save();

		// send email
		await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);

		res.status(200).json({ success: true, message: "Password reset link sent to your email" });
	} catch (error) {
		console.log("Error in forgotPassword ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};

export const resetPassword = async (req, res) => {
	try {
		const { token } = req.params;
		const { password } = req.body;

		const user = await User.findOne({
			resetPasswordToken: token,
			resetPasswordExpiresAt: { $gt: Date.now() },
		});

		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
		}

		// update password
		const hashedPassword = await bcryptjs.hash(password, 10);

		user.password = hashedPassword;
		user.resetPasswordToken = undefined;
		user.resetPasswordExpiresAt = undefined;
		await user.save();

		await sendResetSuccessEmail(user.email);

		res.status(200).json({ success: true, message: "Password reset successful" });
	} catch (error) {
		console.log("Error in resetPassword ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};

export const checkAuth = async (req, res) => {
	try {
		const user = await User.findById(req.userId).select("-password");
		if (!user) {
			return res.status(400).json({ success: false, message: "User not found" });
		}

		res.status(200).json({ success: true, user });
	} catch (error) {
		console.log("Error in checkAuth ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};