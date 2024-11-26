import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import authRoutes from "./routes/auth.route.js";

dotenv.config(); // Load environment variables

const app = express();
const __dirname = path.resolve();



// Middleware setup
app.use(cors({
    origin: true, // This will allow requests from any origin
    credentials: true // This will allow cookies and credentials to be included
}));
app.use(express.json()); // Parse incoming JSON requests
app.use(cookieParser()); // Parse incoming cookies

// Routes
app.use("/api/auth", authRoutes);

// Serve static files in production
// if (process.env.NODE_ENV === "production") {
//     app.use(express.static(path.join(__dirname, "Frontend", "dist")));
//     app.get("*", (req, res) => {
//         res.sendFile(path.resolve(__dirname, "Frontend", "dist", "index.html"));
//     });
// }

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`⚙️  Server is running on port ${PORT}`);
});

export default app; // Export the app for use in index.js
