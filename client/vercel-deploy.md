# Deploy Frontend lên Vercel

## 1. Chuẩn bị
- Đã có tài khoản Vercel
- Code đã push lên GitHub

## 2. Cấu hình trên Vercel
1. Login vào Vercel dashboard
2. Click "New Project"
3. Import GitHub repository
4. Cấu hình:
   - **Framework Preset**: React
   - **Root Directory**: ./client
   - **Build Command**: `npm run build`
   - **Output Directory**: dist

## 3. Environment Variables
Thêm biến môi trường (nếu cần):
```
VITE_API_URL=https://your-backend-url.onrender.com/api
```

## 4. Cập nhật API_URL
Trong file `src/App.jsx`, cập nhật:
```javascript
const API_URL = import.meta.env.PROD 
  ? 'https://wedding-backend.onrender.com/api'  // URL backend của bạn
  : 'http://localhost:8000/api';
```

## 5. Deploy
- Click "Deploy"
- Chờ vài phút để Vercel build và deploy
- Test ứng dụng tại URL được cung cấp
