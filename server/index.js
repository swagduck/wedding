const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

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
  .then(async () => {
    console.log("✅ Đã kết nối MongoDB thành công!");
    
    // Khởi tạo default categories nếu chưa có
    const defaultCategories = ['ảnh check-in', 'ảnh từng bàn'];
    for (const catName of defaultCategories) {
      const exists = await Category.findOne({ name: catName });
      if (!exists) {
        await Category.create({ name: catName });
      }
    }
    
    // Chỉ xóa dummy media (có url chứa 'dummy' hoặc 'placeholder')
    const dummyMedia = await Media.find({ 
      $or: [
        { url: { $regex: /dummy|placeholder/ } },
        { public_id: { $regex: /^dummy_/ } }
      ]
    });
    
    if (dummyMedia.length > 0) {
      await Media.deleteMany({ 
        $or: [
          { url: { $regex: /dummy|placeholder/ } },
          { public_id: { $regex: /^dummy_/ } }
        ]
      });
      console.log(`🧹 Đã xóa ${dummyMedia.length} dummy media`);
    } else {
      console.log("✅ Không có dummy media nào cần xóa");
    }
    
    // Thêm media mẫu nếu database trống
    const mediaCount = await Media.countDocuments();
    if (mediaCount === 0) {
      console.log("📸 Thêm media mẫu để test...");
      await Media.create([
        {
          url: "https://images.unsplash.com/photo-1519225421984-9dc30b022cbe?w=800&h=600&fit=crop",
          public_id: "sample_wedding_1",
          type: "image",
          category: "ảnh check-in",
          likes: 5
        },
        {
          url: "https://images.unsplash.com/photo-1519741497674-611821869e9a?w=800&h=600&fit=crop",
          public_id: "sample_wedding_2", 
          type: "image",
          category: "ảnh từng bàn",
          likes: 3
        },
        {
          url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
          public_id: "sample_video_1",
          type: "video", 
          category: "ảnh check-in",
          likes: 8
        }
      ]);
      console.log("✅ Đã thêm 3 media mẫu");
    }
  })
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

// 4. Định nghĩa Schema & Model
// Categories Schema
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const Category = mongoose.model("Category", categorySchema);

// Media Schema (ảnh/video)
const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  public_id: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['image', 'video'],
    default: 'image'
  },
  category: { 
    type: String, 
    required: true, 
    default: 'ảnh check-in'
  },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Media = mongoose.model("Media", mediaSchema);

// Create indexes for better performance
Media.createIndexes([
  { _id: 1 }, // Default index but ensure it exists
  { createdAt: -1 }, // For sorting
  { type: 1, category: 1 }, // For filtering
]);

// 5. Cấu hình Cloudinary & Multer (Xử lý file ảnh)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      folder: "wedding_album",
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: isVideo ? ['mp4', 'mov', 'avi', 'webm'] : ["jpg", "png", "jpeg", "webp"],
      quality: isVideo ? "auto:good" : "auto:good",
      fetch_format: "auto",
      transformation: isVideo ? [] : [
        { width: 1920, height: 1920, crop: "limit", quality: "auto:good" }
      ]
    };
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận ảnh (JPG, PNG, WebP) và video (MP4, MOV, AVI)'), false);
    }
  }
});

// 6. Định nghĩa các API Endpoints

/**
 * @route   GET /api/media
 * @desc    Lấy danh sách toàn bộ media, mới nhất xếp trên đầu
 */
app.get("/api/media", async (req, res) => {
  try {
    const { type, category } = req.query;
    let filter = {};
    
    if (type) filter.type = type;
    if (category) filter.category = category;
    
    const media = await Media.find(filter).sort({ createdAt: -1 });
    res.status(200).json(media);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách media", error });
  }
});

/**
 * @route   GET /api/categories
 * @desc    Lấy danh sách tất cả categories
 */
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: 1 });
    res.status(200).json(categories.map(cat => cat.name));
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách categories", error });
  }
});

/**
 * @route   POST /api/categories
 * @desc    Tạo category mới (Chỉ admin)
 */
app.post("/api/categories", authenticateAdmin, async (req, res) => {
  try {
    const { category } = req.body;
    
    if (!category || category.trim() === '') {
      return res.status(400).json({ message: "Tên category không được rỗng" });
    }

    // Kiểm tra category đã tồn tại chưa
    const existingCategory = await Category.findOne({ name: category.trim() });
    if (existingCategory) {
      return res.status(400).json({ message: "Category đã tồn tại" });
    }

    // Tạo category mới
    const newCategory = new Category({
      name: category.trim()
    });

    await newCategory.save();

    // Lấy lại danh sách categories
    const categories = await Category.find().sort({ createdAt: 1 });
    res.status(201).json(categories.map(cat => cat.name));
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi tạo category", error });
  }
});

/**
 * @route   POST /api/upload
 * @desc    Nhận media từ admin, đẩy lên Cloudinary, lưu URL vào MongoDB (Chỉ admin)
 */
app.post("/api/upload", authenticateAdmin, upload.single("media"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Không có file nào được tải lên." });
    }

    const { category = 'ảnh check-in' } = req.body;
    const isVideo = req.file.mimetype.startsWith('video/');

    const newMedia = new Media({
      url: req.file.path,
      public_id: req.file.filename,
      type: isVideo ? 'video' : 'image',
      category: category,
    });

    await newMedia.save();
    res.status(201).json(newMedia);
  } catch (error) {
    res.status(500).json({ message: "Lỗi trong quá trình upload", error });
  }
});

/**
 * @route   PATCH /api/media/:id/like
 * @desc    Tăng số lượt thả tim cho một media
 */
app.patch("/api/media/:id/like", async (req, res) => {
  try {
    const { id } = req.params;
    
    const media = await Media.findOneAndUpdate(
      { _id: id },
      { $inc: { likes: 1 } },
      { 
        new: true, 
        lean: true,
        upsert: false 
      }
    ).select('_id url public_id type category likes createdAt');

    if (!media) {
      return res.status(404).json({ message: "Không tìm thấy media này." });
    }

    res.status(200).json(media);
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: "Lỗi khi thả tim" });
  }
});

/**
 * @route   DELETE /api/media/:id
 * @desc    Xóa media khỏi MongoDB và Cloudinary (Chỉ admin)
 */
app.delete("/api/media/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ message: "Không tìm thấy media này." });
    }

    // Xóa media khỏi Cloudinary
    const resourceType = media.type === 'video' ? 'video' : 'image';
    await cloudinary.uploader.destroy(media.public_id, { resource_type: resourceType });

    // Xóa media khỏi MongoDB
    await Media.findByIdAndDelete(id);

    res.status(200).json({ message: "Đã xóa media thành công." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa media", error });
  }
});

// 7. Khởi chạy Server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});
