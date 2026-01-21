import mongoose from "mongoose";

const photoSchema = new mongoose.Schema({
  url: { type: String, required: true }, // Link ảnh để hiển thị
  public_id: { type: String, required: true }, // ID để xóa ảnh trên Cloudinary nếu cần
  caption: { type: String }, // Lời chúc của khách (nếu có)
  category: { 
    type: String, 
    required: true, 
    enum: ['ảnh check-in', 'ảnh từng bàn'],
    default: 'ảnh check-in'
  }, // Danh mục ảnh
  likes: { type: Number, default: 0 }, // Số lượt thả tim
  createdAt: { type: Date, default: Date.now },
});

export const Photo = mongoose.model("Photo", photoSchema);
