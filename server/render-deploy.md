# Deploy Backend lên Render

## 1. Chuẩn bị
- Đã có tài khoản Render
- Code đã push lên GitHub

## 2. Cấu hình trên Render
1. Login vào Render dashboard
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Cấu hình:
   - **Name**: wedding-backend
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Instance Type**: Free (hoặc paid nếu cần)

## 3. Environment Variables
Thêm các biến môi trường:
```
NODE_ENV=production
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/wedding
CLOUDINARY_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ADMIN_TOKEN=huy&y2026
PORT=3000
```

## 4. Sau khi deploy
- Copy URL của backend (ví dụ: https://wedding-backend.onrender.com)
- Update API_URL trong frontend
