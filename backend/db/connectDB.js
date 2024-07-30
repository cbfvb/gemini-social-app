import mongoose from "mongoose";



const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/code');
    console.log('MongoDB connected ');
  } catch (err) {
    console.error('MongoDB  error:', err);
 
  }
};


export default connectDB;

