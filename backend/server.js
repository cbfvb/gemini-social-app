
import express from "express";
import dotenv from "dotenv";
import connectDB from "./db/connectDB.js";
import cookieParser from "cookie-parser";
import userRoutes from "./routes/user.Routes.js";
import postRoutes from "./routes/post.Routes.js";
import messageRoutes from "./routes/message.Routes.js";
import { app, server } from "./socket/socket.js";
import AWS from "aws-sdk";

dotenv.config();
connectDB();
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const PORT = process.env.PORT || 5000;
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser());


app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/messages", messageRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
  
    const statusCode = 500;
    const message =  "Internal Server Error";
  
    res.status(statusCode).json({
      success: false,
      error: message,
    });
  });

server.listen(PORT, () => console.log(`Server listening at http://localhost:${PORT}`));

