import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// 1. Cấu hình Biến môi trường từ file .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 2. Middleware
app.use(cors()); // Cho phép Frontend truy cập API
app.use(express.json()); // Đọc dữ liệu JSON từ request body

// Set timeout for requests
app.use((req, res, next) => {
  res.setTimeout(10000, () => {
    console.log('Request timeout');
    res.status(408).send('Request timeout');
  });
  next();
});

// Authentication middleware
const authenticateAdmin = (req, res, next) => {
  const { authorization } = req.headers;
  
  if (!authorization || authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ message: "Không có quyền truy cập!" });
  }
  
  next();
};

// 3. Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Đã kết nối MongoDB thành công!"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

// 4. Định nghĩa Schema & Model cho Hình ảnh
const photoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String, required: true },
  category: { 
    type: String, 
    required: true, 
    enum: ['ảnh check-in', 'ảnh từng bàn'],
    default: 'ảnh check-in'
  },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Photo = mongoose.model("Photo", photoSchema);

// Create indexes for better performance
Photo.createIndexes([
  { _id: 1 }, // Default index but ensure it exists
  { createdAt: -1 }, // For sorting
]);

// 5. Cấu hình Cloudinary & Multer (Xử lý file ảnh)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "wedding_album", // Tên thư mục lưu ảnh trên Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    quality: "auto:good", // Tự động tối ưu chất lượng
    fetch_format: "auto", // Tự động chọn định dạng tốt nhất
    transformation: [
      { width: 1920, height: 1920, crop: "limit", quality: "auto:good" }
    ]
  },
});

const upload = multer({ storage });

// 6. Định nghĩa các API Endpoints

/**
 * @route   GET /api/photos
 * @desc    Lấy danh sách toàn bộ ảnh, ảnh mới nhất xếp trên đầu
 */
app.get("/api/photos", async (req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 });
    res.status(200).json(photos);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách ảnh", error });
  }
});

/**
 * @route   POST /api/upload
 * @desc    Nhận ảnh từ admin, đẩy lên Cloudinary, lưu URL vào MongoDB (Chỉ admin)
 */
app.post("/api/upload", authenticateAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Không có file nào được tải lên." });
    }

    const { category = 'ảnh check-in' } = req.body; // Get category from request body, default to 'ảnh check-in'

    const newPhoto = new Photo({
      url: req.file.path, // URL ảnh từ Cloudinary
      public_id: req.file.filename, // ID ảnh trên Cloudinary
      category: category, // Danh mục ảnh
    });

    await newPhoto.save();
    res.status(201).json(newPhoto);
  } catch (error) {
    res.status(500).json({ message: "Lỗi trong quá trình upload", error });
  }
});

/**
 * @route   PATCH /api/photos/:id/like
 * @desc    Tăng số lượt thả tim cho một tấm ảnh
 */
app.patch("/api/photos/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use findOneAndUpdate with lean() for better performance
    const photo = await Photo.findOneAndUpdate(
      { _id: id },
      { $inc: { likes: 1 } },
      { 
        new: true, 
        lean: true, // Return plain JavaScript object for faster response
        upsert: false 
      }
    ).select('_id url public_id category likes createdAt'); // Only select needed fields

    if (!photo) {
      return res.status(404).json({ message: "Không tìm thấy ảnh này." });
    }

    res.status(200).json(photo);
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: "Lỗi khi thả tim" });
  }
});

/**
 * @route   DELETE /api/photos/:id
 * @desc    Xóa ảnh khỏi MongoDB và Cloudinary (Chỉ admin)
 */
app.delete("/api/photos/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tìm ảnh trong MongoDB
    const photo = await Photo.findById(id);
    if (!photo) {
      return res.status(404).json({ message: "Không tìm thấy ảnh này." });
    }

    // Xóa ảnh khỏi Cloudinary
    await cloudinary.uploader.destroy(photo.public_id);

    // Xóa ảnh khỏi MongoDB
    await Photo.findByIdAndDelete(id);

    res.status(200).json({ message: "Đã xóa ảnh thành công." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa ảnh", error });
  }
});

// 7. Khởi chạy Server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});
