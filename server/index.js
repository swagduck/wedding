const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

// Environment variable validation
const requiredEnvVars = ['MONGO_URI', 'CLOUDINARY_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'ADMIN_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please set these environment variables and restart the server');
  process.exit(1);
}

console.log('✅ Environment variables validated');

const app = express();
const PORT = process.env.PORT || 5000;

// 2. Middleware
app.use(cors()); // Cho phép Frontend truy cập API
app.use(express.json()); // Đọc dữ liệu JSON từ request body

// Multer error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Multer error:', {
      field: error.field,
      message: error.message,
      code: error.code,
      limit: error.limit
    });
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File quá lớn. Tối đa 100MB được cho phép.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Quá nhiều file được tải lên.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'File không được mong đợi.' });
    }
    
    return res.status(400).json({ message: `Lỗi upload: ${error.message}` });
  }
  
  if (error.message.includes('Chỉ chấp nhận ảnh')) {
    console.error('❌ File type error:', error.message);
    return res.status(400).json({ message: error.message });
  }
  
  // Handle Cloudinary video processing errors
  if (error.message.includes('Video is too large to process synchronously')) {
    console.error('❌ Video processing error:', error.message);
    return res.status(413).json({ 
      message: 'Video quá lớn để xử lý. Vui lòng thử lại với video nhỏ hơn hoặc đợi xử lý hoàn tất.' 
    });
  }
  
  if (error.message.includes('Cloudinary')) {
    console.error('❌ Cloudinary error:', error.message);
    return res.status(503).json({ 
      message: 'Lỗi xử lý file trên Cloudinary. Vui lòng thử lại sau.' 
    });
  }
  
  next(error);
});

// Set timeout for requests
app.use((req, res, next) => {
  // Longer timeout for upload endpoints
  if (req.path.includes('/upload')) {
    res.setTimeout(120000, () => { // 2 minutes for uploads
      console.log('Upload request timeout');
      res.status(408).send('Upload timeout - file quá lớn hoặc mất quá nhiều thời gian để xử lý');
    });
  } else {
    res.setTimeout(10000, () => { // 10 seconds for other requests
      console.log('Request timeout');
      res.status(408).send('Request timeout');
    });
  }
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
    const defaultCategories = ['ảnh check-in', 'ảnh từng bàn', 'Videos'];
    for (const catName of defaultCategories) {
      const exists = await Category.findOne({ name: catName });
      if (!exists) {
        await Category.create({ name: catName });
      }
    }
    
    // Migration: Chuyển data từ collection photos sang media
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const hasPhotosCollection = collections.some(c => c.name === 'photos');
    
    if (hasPhotosCollection) {
      const photosCount = await db.collection('photos').countDocuments();
      const mediaCount = await Media.countDocuments();
      
      if (photosCount > 0 && mediaCount === 0) {
        console.log(`🔄 Migration: Chuyển ${photosCount} photos sang media collection...`);
        
        const photos = await db.collection('photos').find({}).toArray();
        const mediaDocs = photos.map(photo => ({
          url: photo.url,
          public_id: photo.public_id,
          type: 'image', // Tất cả photos cũ là image
          category: photo.category,
          likes: photo.likes || 0,
          createdAt: photo.createdAt || new Date()
        }));
        
        if (mediaDocs.length > 0) {
          await Media.insertMany(mediaDocs);
          console.log(`✅ Đã chuyển ${mediaDocs.length} photos sang media collection`);
        }
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
    
    // Thêm media mẫu nếu database vẫn trống sau migration
    const finalMediaCount = await Media.countDocuments();
    if (finalMediaCount === 0) {
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
    } else {
      console.log(`✅ Database có ${finalMediaCount} media items`);
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
console.log('☁️ Configuring Cloudinary...');
try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Force HTTPS URLs
  });
  console.log('✅ Cloudinary configured successfully');
} catch (error) {
  console.error('❌ Cloudinary configuration error:', error.message);
  process.exit(1);
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    console.log(`🎬 Cloudinary: Processing ${isVideo ? 'video' : 'image'} - ${file.originalname}`);
    
    if (isVideo) {
      // For videos, use memory storage to allow manual upload
      return null; // This will trigger manual handling
    }
    
    // For images, use normal Cloudinary storage
    return {
      folder: "wedding_album",
      resource_type: 'image',
      allowed_formats: ["jpg", "png", "jpeg", "webp"],
      quality: "auto:good",
      fetch_format: "auto",
      transformation: [
        { width: 1920, height: 1920, crop: "limit", quality: "auto:good" }
      ],
      public_id: `${Date.now()}_${file.originalname.split('.')[0]}`
    };
  },
});

// For videos, use memory storage and manual Cloudinary upload
const videoUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
    console.log(`🔍 File type check: ${file.mimetype} (allowed: ${allowedTypes.includes(file.mimetype)})`);
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`❌ Rejected file type: ${file.mimetype}`);
      cb(new Error('Chỉ chấp nhận ảnh (JPG, PNG, WebP) và video (MP4, MOV, AVI)'), false);
    }
  }
});

console.log('✅ Multer storage configured');

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
 * @route   DELETE /api/categories/:name
 * @desc    Xóa category (Chỉ admin)
 */
app.delete("/api/categories/:name", authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    
    // Kiểm tra category có tồn tại không
    const category = await Category.findOne({ name });
    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục này." });
    }

    // Kiểm tra category có media nào không
    const mediaCount = await Media.countDocuments({ category: name });
    if (mediaCount > 0) {
      return res.status(400).json({ 
        message: `Không thể xóa danh mục này vì còn ${mediaCount} media đang sử dụng. Vui lòng xóa hết media trước.` 
      });
    }

    // Xóa category
    await Category.findOneAndDelete({ name });

    // Lấy lại danh sách categories
    const categories = await Category.find().sort({ createdAt: 1 });
    res.status(200).json(categories.map(cat => cat.name));
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa category", error });
  }
});

/**
 * @route   POST /api/upload
 * @desc    Nhận media từ admin, đẩy lên Cloudinary, lưu URL vào MongoDB (Chỉ admin)
 */
app.post("/api/upload", authenticateAdmin, (req, res, next) => {
  // Use a universal upload handler that can handle both images and videos
  console.log('📤 Upload request received');
  return videoUpload.single("media")(req, res, next);
}, async (req, res) => {
  console.log('📤 Upload request received');
  console.log('📁 File info:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    filename: req.file.filename,
    path: req.file.path
  } : 'No file received');
  console.log('📂 Category:', req.body.category);
  
  try {
    if (!req.file) {
      console.log('❌ No file in request');
      return res
        .status(400)
        .json({ message: "Không có file nào được tải lên." });
    }

    const { category = 'ảnh check-in' } = req.body;
    const isVideo = req.file.mimetype.startsWith('video/');
    // Auto-assign videos to Videos category
    const finalCategory = isVideo ? 'Videos' : category;
    let cloudinaryResult;

    if (isVideo) {
      // Manual Cloudinary upload for videos
      console.log('🎬 Processing video upload manually...');
      
      cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "wedding_album",
            resource_type: "video",
            public_id: `${Date.now()}_${req.file.originalname.split('.')[0]}`,
            quality: "auto",
            fetch_format: "auto",
            secure: true // Force HTTPS URL
          },
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary video upload error:', error);
              reject(error);
            } else {
              console.log('✅ Cloudinary video upload successful:', result.public_id);
              resolve(result);
            }
          }
        );
        
        uploadStream.end(req.file.buffer);
      });
    } else {
      // For images, upload to Cloudinary manually as well
      console.log('🖼️ Processing image upload manually...');
      
      cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "wedding_album",
            resource_type: "image",
            public_id: `${Date.now()}_${req.file.originalname.split('.')[0]}`,
            quality: "auto:good",
            fetch_format: "auto",
            transformation: [
              { width: 1920, height: 1920, crop: "limit", quality: "auto:good" }
            ],
            secure: true // Force HTTPS URL
          },
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary image upload error:', error);
              reject(error);
            } else {
              console.log('✅ Cloudinary image upload successful:', result.public_id);
              resolve(result);
            }
          }
        );
        
        uploadStream.end(req.file.buffer);
      });
    }

    const newMedia = new Media({
      url: cloudinaryResult.secure_url || cloudinaryResult.url, // Prefer secure_url
      public_id: cloudinaryResult.public_id,
      type: isVideo ? 'video' : 'image',
      category: finalCategory,
    });

    console.log('💾 Saving to database...');
    await newMedia.save();
    console.log('✅ Media saved successfully:', newMedia._id);
    
    res.status(201).json(newMedia);
  } catch (error) {
    console.error('❌ Upload error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      console.log('❌ Database validation error');
      return res.status(400).json({ message: "Dữ liệu không hợp lệ", error: error.message });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      console.log('❌ Database connection error');
      return res.status(503).json({ message: "Lỗi kết nối database", error: error.message });
    }
    
    console.log('❌ General upload error');
    res.status(500).json({ message: "Lỗi trong quá trình upload", error: error.message });
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
