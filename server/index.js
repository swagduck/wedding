const express = require('express');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
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

// Initialize cache
const cache = new NodeCache({ stdTTL: 300, checkperiod: 120 }); // 5 minutes cache
console.log('✅ Cache initialized');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for reverse proxy deployments (Render, Heroku, etc.)
app.set('trust proxy', 1);

// 2. Middleware
app.use(cors()); // Cho phép Frontend truy cập API
app.use(compression()); // Compress responses
app.use(express.json()); // Đọc dữ liệu JSON từ request body

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Quá nhiều request, vui lòng thử lại sau!' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

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
      if (!res.headersSent) {
        res.status(408).send('Upload timeout - file quá lớn hoặc mất quá nhiều thời gian để xử lý');
      }
    });
  } else {
    res.setTimeout(30000, () => { // 30 seconds for other requests to prevent race with 10s mongoose timeout
      console.log('Request timeout (30s)');
      if (!res.headersSent) {
        res.status(408).send('Request timeout');
      }
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

// 3. Kết nối MongoDB với connection pooling
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // How long to try selecting a new connection before throwing error
    socketTimeoutMS: 45000, // How long a send or receive on a socket can take before timing out
  })
  .then(async () => {
    console.log("✅ Đã kết nối MongoDB thành công với connection pooling!");
    
    // Create indexes after successful connection
    try {
      await Media.createIndexes([
        { _id: 1 }, // Default index but ensure it exists
        { createdAt: -1 }, // For sorting by newest
        { likes: 1 }, // For like operations
        { type: 1, createdAt: -1 }, // For filtering by type and sorting
        { category: 1, createdAt: -1 }, // For filtering by category and sorting
        { type: 1, category: 1, createdAt: -1 }, // Composite index for both filters
      ]);

      await Category.createIndexes([
        { name: 1 }, // For unique category names
        { createdAt: 1 }, // For sorting
      ]);

      await Slideshow.createIndexes([{ slug: 1 }]);

      console.log('✅ Database indexes created/verified');
    } catch (indexError) {
      console.error('⚠️ Error creating indexes:', indexError.message);
    }
    
    // Khởi tạo default categories nếu chưa có
    const defaultCategories = ['ảnh check-in', 'ảnh từng bàn', 'Videos'];
    for (const catName of defaultCategories) {
      const exists = await Category.findOne({ name: catName });
      if (!exists) {
        await Category.create({ name: catName });
      }
    }

    // Ensure default slideshow document exists
    await Slideshow.findOneAndUpdate(
      { slug: 'main' },
      { $setOnInsert: { slug: 'main', items: [], updatedAt: new Date() } },
      { upsert: true }
    );
    
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

    // Seed LoveStory timeline if empty
    const loveStoryCount = await LoveStory.countDocuments();
    if (loveStoryCount === 0) {
      console.log("📖 Thêm dữ liệu Câu Chuyện Tình Yêu mẫu...");
      const initialTimeline = [
        {
          title: "Lần Đầu Gặp Gỡ",
          date: "15.08.2023",
          description: "Ánh mắt ta chạm nhau giữa biển người mênh mông, và khoảnh khắc đó, thế giới như ngừng lại. Anh biết rằng, mình đã tìm thấy một nửa của đời mình.",
          icon: "Camera",
          image: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80",
          order: 1
        },
        {
          title: "Lời Yêu Đầu Tiên",
          date: "20.10.2023",
          description: "Dưới cơn mưa thu dịu dàng, tiếng yêu ngập ngừng được cất lên. Cái nắm tay thật chặt thay cho bao lời muốn nói.",
          icon: "Heart",
          image: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&q=80",
          order: 2
        },
        {
          title: "Kỷ Niệm Khó Quên",
          date: "14.02.2024",
          description: "Valentine đầu tiên bên nhau với những món quà nhỏ xinh nhưng đong đầy tình cảm. Cùng nhau hứa hẹn về một tương lai xa hơn.",
          icon: "Wine",
          image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&q=80",
          order: 3
        },
        {
          title: "Anh Đồng Ý Không?",
          date: "24.12.2025",
          description: "Trong không khí ấm áp của đêm Giáng sinh, chiếc nhẫn lấp lánh được trao tay. Nước mắt rơi, và câu 'Em đồng ý' được thốt lên.",
          icon: "CalendarHeart",
          image: "https://images.unsplash.com/photo-1549416878-b9ca95e1ccf7?w=800&q=80",
          order: 4
        },
        {
          title: "Ngày Hạnh Phúc Trọn Vẹn",
          date: "May 2026",
          description: "Ngày chúng ta chính thức gọi nhau bằng tiếng 'Vợ - Chồng'. Hành trình mới chỉ vừa bắt đầu, với trọn vẹn yêu thương.",
          icon: "Sparkles",
          image: "https://images.unsplash.com/photo-1519741497674-611821869e9a?w=800&q=80",
          order: 5
        }
      ];
      await LoveStory.insertMany(initialTimeline);
      console.log("✅ Đã thêm 5 mốc thời gian mẫu");
    } else {
      console.log(`✅ Database có ${loveStoryCount} mốc thời gian LoveStory`);
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

// Comment Schema
const commentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

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
  comments: { type: [commentSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const Media = mongoose.model("Media", mediaSchema);

// Slideshow Schema (admin-curated list of images for wedding slideshow)
const slideshowItemSchema = new mongoose.Schema({
  mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", required: true },
  order: { type: Number, required: true },
}, { _id: false });

const slideshowSchema = new mongoose.Schema({
  slug: { type: String, default: "main", unique: true },
  items: [slideshowItemSchema],
  updatedAt: { type: Date, default: Date.now },
});

const Slideshow = mongoose.model("Slideshow", slideshowSchema);

// Settings Schema (global configuration like background audio)
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const Setting = mongoose.model("Setting", settingSchema);

// Guestbook Schema
const guestbookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Guestbook = mongoose.model("Guestbook", guestbookSchema);

// LoveStory Schema
const loveStorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, required: true, default: "Heart" },
  image: { type: String, required: true },
  order: { type: Number, required: true, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const LoveStory = mongoose.model("LoveStory", loveStorySchema);

console.log('✅ Database models initialized');

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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'audio/mpeg', 'audio/mp3', 'audio/wav'];
    console.log(`🔍 File type check: ${file.mimetype} (allowed: ${allowedTypes.includes(file.mimetype)})`);
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`❌ Rejected file type: ${file.mimetype}`);
      cb(new Error('Chỉ chấp nhận ảnh (JPG, PNG, WebP), video (MP4, MOV, AVI) và nhạc (MP3, WAV)'), false);
    }
  }
});

console.log('✅ Multer storage configured');

const isCloudinaryUrl = (url) =>
  typeof url === 'string' && url.includes('res.cloudinary.com/');

const buildCloudinaryImageUrl = (publicId, { size } = {}) => {
  if (!publicId) return null;
  const s = size || 640;
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: 'image',
    transformation: [
      {
        width: s,
        height: s,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto:good',
        fetch_format: 'auto',
        dpr: 'auto',
      },
    ],
  });
};

const buildCloudinaryImageSrcSet = (publicId) => {
  if (!publicId) return null;
  const widths = [240, 320, 480, 640, 800, 1024];
  return widths
    .map((w) => `${buildCloudinaryImageUrl(publicId, { size: w })} ${w}w`)
    .join(', ');
};

const buildCloudinaryVideoPosterUrl = (publicId, { size } = {}) => {
  if (!publicId) return null;
  const s = size || 640;
  // Cloudinary will extract a frame for the poster image.
  return cloudinary.url(publicId, {
    secure: true,
    resource_type: 'video',
    format: 'jpg',
    transformation: [
      {
        start_offset: 0,
        width: s,
        height: s,
        crop: 'fill',
        gravity: 'auto',
        quality: 'auto:good',
        fetch_format: 'auto',
        dpr: 'auto',
      },
    ],
  });
};

// 6. Định nghĩa các API Endpoints

/**
 * @route   GET /api/media
 * @desc    Lấy danh sách media với pagination và caching
 */
app.get("/api/media", async (req, res) => {
  try {
    const { type, category, page = 1, limit = 20 } = req.query;
    
    // Create cache key
    const cacheKey = `media_${type || 'all'}_${category || 'all'}_${page}_${limit}`;
    
    // Try to get from cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log('📋 Cache hit for:', cacheKey);
      return res.status(200).json(cachedData);
    }
    
    // Build filter
    let filter = {};
    if (type && type !== 'tất cả') filter.type = type;
    if (category && category !== 'tất cả') filter.category = category;
    
    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Execute queries in parallel
    const [media, totalCount] = await Promise.all([
      Media.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean for better performance
      Media.countDocuments(filter)
    ]);

    const enhancedMedia = media.map((m) => {
      const base = m;

      if (base.type === 'image' && isCloudinaryUrl(base.url) && base.public_id) {
        return {
          ...base,
          thumbUrl: buildCloudinaryImageUrl(base.public_id, { size: 640 }),
          srcSet: buildCloudinaryImageSrcSet(base.public_id),
        };
      }

      if (base.type === 'video' && isCloudinaryUrl(base.url) && base.public_id) {
        return {
          ...base,
          posterUrl: buildCloudinaryVideoPosterUrl(base.public_id, { size: 640 }),
        };
      }

      return base;
    });
    
    const result = {
      media: enhancedMedia,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
        hasPrevPage: pageNum > 1
      }
    };
    
    // Cache the result
    cache.set(cacheKey, result);
    console.log('💾 Cached data for:', cacheKey);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error fetching media:', error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách media", error: error.message });
  }
});

/**
 * @route   POST /api/media/:id/comment
 * @desc    Thêm bình luận vào media
 */
app.post("/api/media/:id/comment", async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name || !content) {
      return res.status(400).json({ message: "Vui lòng nhập tên và nội dung!" });
    }
    const media = await Media.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { name, content } } },
      { new: true }
    );
    
    if (!media) {
      return res.status(404).json({ message: "Không tìm thấy media!" });
    }
    
    // Clear media caches
    const keys = cache.keys();
    keys.forEach(k => { if(k.startsWith('media_')) cache.del(k) });
    
    res.json(media);
  } catch (error) {
    console.error("Lỗi thêm bình luận:", error);
    res.status(500).json({ message: "Lỗi thêm bình luận", error: error.message });
  }
});

/**
 * @route   DELETE /api/media/:id/comment/:commentId
 * @desc    Xóa bình luận khỏi media (Chỉ admin)
 */
app.delete("/api/media/:id/comment/:commentId", authenticateAdmin, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) {
      return res.status(404).json({ message: "Không tìm thấy media!" });
    }
    
    media.comments.pull(req.params.commentId);
    await media.save();
    
    // Clear media caches
    const keys = cache.keys();
    keys.forEach(k => { if(k.startsWith('media_')) cache.del(k) });
    
    res.json(media);
  } catch (error) {
    console.error("Lỗi xóa bình luận:", error);
    res.status(500).json({ message: "Lỗi xóa bình luận", error: error.message });
  }
});

/**
 * @route   GET /api/categories
 * @desc    Lấy danh sách tất cả categories với caching
 */
app.get("/api/categories", async (req, res) => {
  try {
    // Try cache first
    const cacheKey = 'categories_all';
    const cachedCategories = cache.get(cacheKey);
    
    if (cachedCategories) {
      console.log('📋 Cache hit for categories');
      return res.status(200).json(cachedCategories);
    }
    
    const categories = await Category.find().sort({ createdAt: 1 }).lean();
    const result = categories.map(cat => cat.name);
    
    // Cache for 10 minutes (categories don't change often)
    cache.set(cacheKey, result, 600);
    console.log('💾 Cached categories');
    
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách categories", error: error.message });
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

    // Clear categories cache
    cache.del('categories_all');
    console.log('🗑️ Cleared categories cache');

    // Lấy lại danh sách categories
    const categories = await Category.find().sort({ createdAt: 1 }).lean();
    const result = categories.map(cat => cat.name);
    
    // Update cache
    cache.set('categories_all', result, 600);
    
    res.status(201).json(result);
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

    // Clear categories cache
    cache.del('categories_all');
    console.log('🗑️ Cleared categories cache');

    // Lấy lại danh sách categories
    const categories = await Category.find().sort({ createdAt: 1 }).lean();
    const result = categories.map(cat => cat.name);
    
    // Update cache
    cache.set('categories_all', result, 600);
    
    res.status(200).json(result);
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
    
    // Clear all media cache
    const keys = cache.keys();
    const mediaKeys = keys.filter(key => key.startsWith('media_'));
    cache.del(mediaKeys);
    console.log('🗑️ Cleared media cache keys:', mediaKeys.length);
    
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

    // Clear only relevant cache keys that might contain this media item
    const keys = cache.keys();
    const relevantKeys = keys.filter(key => 
      key.startsWith('media_') && 
      (key.includes('all') || key.includes('tất_cả') || key.includes('image') || key.includes('video'))
    );
    cache.del(relevantKeys);
    console.log('🗑️ Cleared relevant media cache keys after like:', relevantKeys.length);

    res.status(200).json(media);
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: "Lỗi khi thả tim" });
  }
});

/**
 * @route   PATCH /api/media/:id/category
 * @desc    Cập nhật danh mục cho media (Chỉ admin)
 */
app.patch("/api/media/:id/category", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;
    
    if (!category || category.trim() === '') {
      return res.status(400).json({ message: "Tên danh mục không được rỗng" });
    }

    // Kiểm tra media có tồn tại không
    const media = await Media.findById(id);
    if (!media) {
      return res.status(404).json({ message: "Không tìm thấy media này." });
    }

    // Kiểm tra category có tồn tại không
    const categoryExists = await Category.findOne({ name: category.trim() });
    if (!categoryExists) {
      return res.status(400).json({ message: "Danh mục không tồn tại." });
    }

    // Cập nhật category cho media
    const updatedMedia = await Media.findByIdAndUpdate(
      id,
      { category: category.trim() },
      { new: true }
    );

    // Clear relevant cache keys
    const keys = cache.keys();
    const mediaKeys = keys.filter(key => key.startsWith('media_'));
    cache.del(mediaKeys);
    console.log('🗑️ Cleared media cache after category update');

    res.status(200).json(updatedMedia);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: "Lỗi khi cập nhật danh mục", error });
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

    // Remove from slideshow if present
    await Slideshow.updateMany(
      {},
      { $pull: { items: { mediaId: id } } }
    );

    // Xóa media khỏi MongoDB
    await Media.findByIdAndDelete(id);

    // Clear relevant cache keys
    const keys = cache.keys();
    const mediaKeys = keys.filter(key => key.startsWith('media_'));
    cache.del(mediaKeys);
    console.log('🗑️ Cleared media cache after delete');

    res.status(200).json({ message: "Đã xóa media thành công." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa media", error });
  }
});

/**
 * @route   GET /api/slideshow
 * @desc    Get slideshow items (images only, for public display)
 */
app.get("/api/slideshow", async (req, res) => {
  try {
    const cacheKey = 'slideshow_main';
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const slideshow = await Slideshow.findOne({ slug: 'main' }).lean();
    if (!slideshow || !slideshow.items || slideshow.items.length === 0) {
      const result = { items: [] };
      cache.set(cacheKey, result, 60);
      return res.status(200).json(result);
    }

    const sorted = [...slideshow.items].sort((a, b) => a.order - b.order);
    const mediaIds = sorted.map((i) => i.mediaId);
    const mediaList = await Media.find({ _id: { $in: mediaIds }, type: 'image' }).lean();

    const mediaById = new Map(mediaList.map((m) => [m._id.toString(), m]));
    const items = sorted
      .map((entry) => mediaById.get(entry.mediaId.toString()))
      .filter(Boolean)
      .map((m) => {
        const base = { ...m };
        if (isCloudinaryUrl(base.url) && base.public_id) {
          base.thumbUrl = buildCloudinaryImageUrl(base.public_id, { size: 640 });
          base.slideshowUrl = buildCloudinaryImageUrl(base.public_id, { size: 1920 });
        } else {
          base.slideshowUrl = base.url;
        }
        return base;
      });

    const result = { items };
    cache.set(cacheKey, result, 120);
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error fetching slideshow:', error);
    res.status(500).json({ message: "Lỗi khi lấy slideshow", error: error.message });
  }
});

const clearSlideshowCache = () => {
  cache.del('slideshow_main');
  console.log('🗑️ Cleared slideshow cache');
};

/**
 * @route   POST /api/slideshow/items
 * @desc    Add image to slideshow (admin only, images only)
 */
app.post("/api/slideshow/items", authenticateAdmin, async (req, res) => {
  try {
    const { mediaId } = req.body;
    if (!mediaId) {
      return res.status(400).json({ message: "Thiếu mediaId." });
    }

    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({ message: "Không tìm thấy ảnh này." });
    }
    if (media.type !== 'image') {
      return res.status(400).json({ message: "Chỉ có thể thêm ảnh vào slideshow." });
    }

    let slideshow = await Slideshow.findOne({ slug: 'main' });
    if (!slideshow) {
      slideshow = await Slideshow.create({ slug: 'main', items: [] });
    }

    const alreadyIn = slideshow.items.some((i) => i.mediaId.toString() === mediaId);
    if (alreadyIn) {
      return res.status(400).json({ message: "Ảnh đã có trong slideshow." });
    }

    const maxOrder = slideshow.items.length === 0
      ? 0
      : Math.max(...slideshow.items.map((i) => i.order));
    slideshow.items.push({ mediaId: media._id, order: maxOrder + 1 });
    slideshow.updatedAt = new Date();
    await slideshow.save();

    clearSlideshowCache();
    const updated = await Slideshow.findOne({ slug: 'main' }).lean();
    res.status(201).json(updated);
  } catch (error) {
    console.error('❌ Error adding to slideshow:', error);
    res.status(500).json({ message: "Lỗi khi thêm vào slideshow", error: error.message });
  }
});

// ==========================================
// LoveStory API Endpoints
// ==========================================

/**
 * @route   GET /api/lovestory
 * @desc    Get all love story milestones
 */
app.get("/api/lovestory", async (req, res) => {
  try {
    const milestones = await LoveStory.find().sort({ order: 1 }).lean();
    res.status(200).json(milestones);
  } catch (error) {
    console.error('❌ Error fetching love story:', error);
    res.status(500).json({ message: "Lỗi khi lấy câu chuyện tình yêu", error: error.message });
  }
});

/**
 * @route   POST /api/lovestory
 * @desc    Create a new love story milestone with image upload (admin only)
 */
app.post("/api/lovestory", authenticateAdmin, (req, res, next) => {
  return videoUpload.single("imageFile")(req, res, next);
}, async (req, res) => {
  try {
    const { title, date, description, icon, order } = req.body;
    let imageUrl = req.body.image; // fallback to text URL if provided
    
    if (!title || !date || !description) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin bắt buộc." });
    }

    // Process file upload if provided
    if (req.file) {
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "File tải lên phải là hình ảnh." });
      }
      
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "wedding_album/lovestory",
            resource_type: "image",
            quality: "auto:good",
            fetch_format: "auto",
            secure: true
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      
      imageUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Vui lòng cung cấp URL hình ảnh hoặc upload file." });
    }

    const newMilestone = new LoveStory({
      title,
      date,
      description,
      icon: icon || "Heart",
      image: imageUrl,
      order: order !== undefined ? parseInt(order) : 0
    });

    const savedMilestone = await newMilestone.save();
    res.status(201).json(savedMilestone);
  } catch (error) {
    console.error('❌ Error creating love story milestone:', error);
    res.status(500).json({ message: "Lỗi khi tạo mốc thời gian", error: error.message });
  }
});

/**
 * @route   PUT /api/lovestory/:id
 * @desc    Update a love story milestone with optional image upload (admin only)
 */
app.put("/api/lovestory/:id", authenticateAdmin, (req, res, next) => {
  return videoUpload.single("imageFile")(req, res, next);
}, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, description, icon, order, image } = req.body;

    const milestone = await LoveStory.findById(id);
    if (!milestone) {
      return res.status(404).json({ message: "Không tìm thấy mốc thời gian." });
    }

    let imageUrl = image;

    // Process new file upload if provided
    if (req.file) {
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "File tải lên phải là hình ảnh." });
      }
      
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "wedding_album/lovestory",
            resource_type: "image",
            quality: "auto:good",
            fetch_format: "auto",
            secure: true
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      
      imageUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
    }

    if (title) milestone.title = title;
    if (date) milestone.date = date;
    if (description) milestone.description = description;
    if (icon) milestone.icon = icon;
    if (imageUrl) milestone.image = imageUrl;
    if (order !== undefined) milestone.order = parseInt(order);

    const updatedMilestone = await milestone.save();
    res.status(200).json(updatedMilestone);
  } catch (error) {
    console.error('❌ Error updating love story milestone:', error);
    res.status(500).json({ message: "Lỗi khi cập nhật mốc thời gian", error: error.message });
  }
});

/**
 * @route   DELETE /api/lovestory/:id
 * @desc    Delete a love story milestone (admin only)
 */
app.delete("/api/lovestory/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const milestone = await LoveStory.findByIdAndDelete(id);
    if (!milestone) {
      return res.status(404).json({ message: "Không tìm thấy mốc thời gian." });
    }

    res.status(200).json({ message: "Xóa thành công", id });
  } catch (error) {
    console.error('❌ Error deleting love story milestone:', error);
    res.status(500).json({ message: "Lỗi khi xóa mốc thời gian", error: error.message });
  }
});

/**
 * @route   DELETE /api/slideshow/items/:mediaId
 * @desc    Remove image from slideshow (admin only)
 */
app.delete("/api/slideshow/items/:mediaId", authenticateAdmin, async (req, res) => {
  try {
    const { mediaId } = req.params;
    const slideshow = await Slideshow.findOne({ slug: 'main' });
    if (!slideshow) {
      return res.status(404).json({ message: "Không tìm thấy slideshow." });
    }

    slideshow.items = slideshow.items.filter((i) => i.mediaId.toString() !== mediaId);
    slideshow.updatedAt = new Date();
    await slideshow.save();

    clearSlideshowCache();
    const updated = await Slideshow.findOne({ slug: 'main' }).lean();
    res.status(200).json(updated);
  } catch (error) {
    console.error('❌ Error removing from slideshow:', error);
    res.status(500).json({ message: "Lỗi khi xóa khỏi slideshow", error: error.message });
  }
});

/**
 * @route   PUT /api/slideshow/items/reorder
 * @desc    Reorder slideshow items (admin only). Body: { itemIds: [id1, id2, ...] }
 */
app.put("/api/slideshow/items/reorder", authenticateAdmin, async (req, res) => {
  try {
    const { itemIds } = req.body;
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ message: "itemIds phải là mảng không rỗng." });
    }

    const slideshow = await Slideshow.findOne({ slug: 'main' });
    if (!slideshow) {
      return res.status(404).json({ message: "Không tìm thấy slideshow." });
    }

    const orderById = new Map(itemIds.map((id, index) => [id, index]));
    slideshow.items.forEach((entry) => {
      const id = entry.mediaId.toString();
      if (orderById.has(id)) {
        entry.order = orderById.get(id);
      }
    });
    slideshow.items.sort((a, b) => a.order - b.order);
    slideshow.updatedAt = new Date();
    await slideshow.save();

    clearSlideshowCache();
    const updated = await Slideshow.findOne({ slug: 'main' }).lean();
    res.status(200).json(updated);
  } catch (error) {
    console.error('❌ Error reordering slideshow:', error);
    res.status(500).json({ message: "Lỗi khi sắp xếp slideshow", error: error.message });
  }
});

/**
 * @route   GET /api/settings/audio
 * @desc    Get background audio URLs array
 */
app.get("/api/settings/audio", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'background_audio' }).lean();
    let audioList = [];
    if (setting && setting.value) {
      try {
        audioList = JSON.parse(setting.value);
      } catch (e) {
        // Fallback for transition from single URL to array
        audioList = [{ url: setting.value, id: 'legacy' }];
      }
    }
    res.status(200).json({ list: audioList });
  } catch (error) {
    console.error('❌ Error fetching audio setting:', error);
    res.status(500).json({ message: "Lỗi khi lấy cài đặt nhạc nền", error: error.message });
  }
});

/**
 * @route   POST /api/settings/audio
 * @desc    Upload background audio and append to playlist
 */
app.post("/api/settings/audio", authenticateAdmin, (req, res, next) => {
  return videoUpload.single("audio")(req, res, next);
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file nào được tải lên." });
    }

    if (!req.file.mimetype.startsWith('audio/')) {
      return res.status(400).json({ message: "File tải lên phải là file âm thanh (MP3, WAV)." });
    }

    // Upload to Cloudinary
    const publicId = `bg_audio_${Date.now()}`;
    const cloudinaryResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "wedding_audio",
          resource_type: "video", // Cloudinary uses 'video' for audio files
          public_id: publicId,
          secure: true
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const audioUrl = cloudinaryResult.secure_url || cloudinaryResult.url;
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const newAudioItem = { id: publicId, url: audioUrl, name: originalName };

    // Fetch existing settings
    let setting = await Setting.findOne({ key: 'background_audio' });
    let audioList = [];

    if (setting && setting.value) {
      try {
        audioList = JSON.parse(setting.value);
      } catch (e) {
        audioList = [{ id: 'legacy', url: setting.value, name: 'Unknown' }];
      }
    }

    // Append new audio file
    audioList.push(newAudioItem);

    // Update or create setting
    await Setting.findOneAndUpdate(
      { key: 'background_audio' },
      { value: JSON.stringify(audioList), updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json({ list: audioList });
  } catch (error) {
    console.error('❌ Error uploading audio setting:', error);
    res.status(500).json({ message: "Lỗi khi tải lên nhạc nền", error: error.message });
  }
});

/**
 * @route   DELETE /api/settings/audio/:id
 * @desc    Delete a specific background audio file from the playlist
 */
app.delete("/api/settings/audio/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let setting = await Setting.findOne({ key: 'background_audio' });

    if (!setting || !setting.value) {
      return res.status(404).json({ message: "Không tìm thấy danh sách nhạc nền." });
    }

    let audioList = [];
    try {
      audioList = JSON.parse(setting.value);
    } catch (e) {
      audioList = [{ id: 'legacy', url: setting.value, name: 'Unknown' }];
    }

    // Find the item to delete
    const itemIndex = audioList.findIndex(audio => audio.id === id);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Không tìm thấy bài hát này." });
    }

    // Avoid removing "legacy" from cloudinary since we don't have its public_id accurately
    if (id !== 'legacy') {
      try {
        await cloudinary.uploader.destroy(id, { resource_type: 'video' });
      } catch (err) {
        console.error('⚠️ Could not delete from Cloudinary:', err);
      }
    }

    // Remove from array
    audioList.splice(itemIndex, 1);

    // Update DB
    await Setting.findOneAndUpdate(
      { key: 'background_audio' },
      { value: JSON.stringify(audioList), updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.status(200).json({ list: audioList });
  } catch (error) {
    console.error('❌ Error deleting audio setting:', error);
    res.status(500).json({ message: "Lỗi khi xóa bài hát", error: error.message });
  }
});

/**
 * @route   GET /api/guestbook
 * @desc    Lấy danh sách lời chúc
 */
app.get("/api/guestbook", async (req, res) => {
  try {
    const messages = await Guestbook.find().sort({ createdAt: -1 }).lean();
    res.status(200).json(messages);
  } catch (error) {
    console.error('❌ Error fetching guestbook:', error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách lời chúc", error: error.message });
  }
});

/**
 * @route   POST /api/guestbook
 * @desc    Thêm lời chúc mới
 */
app.post("/api/guestbook", async (req, res) => {
  try {
    const { name, message } = req.body;
    
    if (!name || !name.trim() || !message || !message.trim()) {
      return res.status(400).json({ message: "Tên và lời chúc không được để trống" });
    }

    const newEntry = new Guestbook({
      name: name.trim(),
      message: message.trim()
    });

    await newEntry.save();
    res.status(201).json(newEntry);
  } catch (error) {
    console.error('❌ Error adding guestbook entry:', error);
    res.status(500).json({ message: "Lỗi khi gửi lời chúc", error: error.message });
  }
});

/**
 * @route   DELETE /api/guestbook/:id
 * @desc    Xóa lời chúc (Chỉ admin)
 */
app.delete("/api/guestbook/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const entry = await Guestbook.findById(id);
    if (!entry) {
      return res.status(404).json({ message: "Không tìm thấy lời chúc." });
    }

    await Guestbook.findByIdAndDelete(id);
    res.status(200).json({ message: "Đã xóa lời chúc thành công." });
  } catch (error) {
    console.error('❌ Error deleting guestbook entry:', error);
    res.status(500).json({ message: "Lỗi khi xóa lời chúc", error: error.message });
  }
});

// 7. Khởi chạy Server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});
