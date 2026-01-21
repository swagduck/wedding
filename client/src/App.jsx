import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart, Camera, Image as ImageIcon, Loader2, Trash2, LogIn, LogOut, Sparkles, Flower, Star, Share2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import QRCode from 'qrcode';

const API_URL = 'http://localhost:5000/api';

function App() {
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [showLogin, setShowLogin] = useState(false);
    const [showQRCode, setShowQRCode] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ảnh check-in');
    const [filterCategory, setFilterCategory] = useState('tất cả');

    useEffect(() => {
        fetchPhotos();
        // Check if admin token exists in localStorage
        const token = localStorage.getItem('adminToken');
        if (token === 'huy&y2026') {
            setIsAdmin(true);
        }
    }, []);

    const fetchPhotos = async () => {
        try {
            const res = await axios.get(`${API_URL}/photos`);
            setPhotos(res.data);
        } catch (err) {
            toast.error("Không thể tải ảnh!");
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);
        formData.append('category', selectedCategory);

        setLoading(true);
        try {
            await axios.post(`${API_URL}/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            toast.success("Tải ảnh thành công!");
            fetchPhotos();
        } catch (err) {
            toast.error("Tải ảnh thất bại! Bạn cần quyền admin.");
        } finally {
            setLoading(false);
        }
    };

    const handleLike = async (id) => {
        try {
            const res = await axios.patch(`${API_URL}/photos/${id}/like`);
            setPhotos(photos.map(p => p._id === id ? res.data : p));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa ảnh này?")) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/photos/${id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            toast.success("Đã xóa ảnh thành công!");
            setPhotos(photos.filter(p => p._id !== id));
        } catch (err) {
            toast.error("Xóa ảnh thất bại! Bạn cần quyền admin.");
            console.error(err);
        }
    };

    const handleLogin = () => {
        if (adminPassword === 'huy&y2026') {
            setIsAdmin(true);
            localStorage.setItem('adminToken', 'huy&y2026');
            setShowLogin(false);
            setAdminPassword('');
            toast.success("Đăng nhập admin thành công!");
        } else {
            toast.error("Mật khẩu không đúng!");
        }
    };

    const handleLogout = () => {
        setIsAdmin(false);
        localStorage.removeItem('adminToken');
        toast.success("Đã đăng xuất!");
    };

    const generateQRCode = async () => {
        try {
            const url = window.location.href;
            const qrDataUrl = await QRCode.toDataURL(url, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#1e3a8a',
                    light: '#ffffff'
                }
            });
            setQrCodeUrl(qrDataUrl);
            setShowQRCode(true);
        } catch (err) {
            toast.error("Không thể tạo mã QR!");
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Floating Hearts Background */}
            <div className="floating-hearts">
                {[...Array(8)].map((_, i) => (
                    <Heart
                        key={i}
                        size={15 + Math.random() * 25}
                        className="heart"
                        style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 6}s`,
                            animationDuration: `${4 + Math.random() * 4}s`
                        }}
                    />
                ))}
                {[...Array(4)].map((_, i) => (
                    <Star
                        key={`star-${i}`}
                        size={12 + Math.random() * 18}
                        className="heart sparkle"
                        style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 6}s`,
                            animationDuration: `${3 + Math.random() * 3}s`,
                            color: 'rgba(250, 204, 21, 0.4)'
                        }}
                    />
                ))}
            </div>

            <Toaster position="top-center" />

            {/* Hero Section */}
            <header className="relative h-[70vh] flex flex-col items-center justify-center wedding-gradient text-white overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute inset-0">
                    <div className="absolute top-10 left-10 text-wedding-gold-300 animate-float floating">
                        <Star size={30} fill="currentColor" className="sparkle" />
                    </div>
                    <div className="absolute top-20 right-20 text-wedding-gold-300 animate-float" style={{ animationDelay: '1s' }}>
                        <Sparkles size={25} fill="currentColor" className="rotate-scale" />
                    </div>
                    <div className="absolute bottom-20 left-20 text-wedding-gold-300 animate-float" style={{ animationDelay: '2s' }}>
                        <Flower size={28} fill="currentColor" className="wiggle" />
                    </div>
                    <div className="absolute bottom-10 right-10 text-wedding-gold-300 animate-float" style={{ animationDelay: '3s' }}>
                        <Star size={22} fill="currentColor" className="pulse-glow" />
                    </div>
                </div>

                {/* Admin Login/Logout Button */}
                <div className="absolute top-6 right-6 z-20">
                    {isAdmin ? (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleLogout}
                            className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full text-white hover:bg-white/30 transition-all duration-200 border border-white/20"
                        >
                            <LogOut size={18} />
                            <span className="text-sm font-medium">Đăng xuất</span>
                        </motion.button>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowLogin(true)}
                            className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-6 py-3 rounded-full text-white hover:bg-white/30 transition-all duration-200 border border-white/20"
                        >
                            <LogIn size={18} />
                            <span className="text-sm font-medium">Admin</span>
                        </motion.button>
                    )}
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="z-10 text-center px-4"
                >
                    <div className="relative">
                        <h1 className="text-6xl md:text-8xl font-playfair font-black mb-6 tracking-tight">
                            <span className="shimmer-text">Wedding</span>
                            <span className="gold-accent"> Gallery</span>
                        </h1>
                        <div className="absolute -top-4 -right-8 text-wedding-gold-400 animate-pulse-slow">
                            <Sparkles size={32} fill="currentColor" className="sparkle" />
                        </div>
                    </div>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-2xl md:text-3xl font-dancing font-bold mb-8 gold-accent"
                    >
                        Huy & Ý
                    </motion.p>

                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "120px" }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                        className="h-1.5 bg-gradient-to-r from-wedding-gold-400 to-wedding-gold-600 mx-auto rounded-full shadow-gold shimmer-gold"
                    />

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="mt-8 text-lg md:text-xl text-wedding-blue-100 font-light"
                    >
                        Cùng nhau lưu giữ những khoảnh khắc đẹp nhất
                    </motion.p>
                </motion.div>

                {/* Enhanced Decorative Background */}
                <div className="absolute top-[-10%] left-[-5%] w-80 h-80 bg-wedding-gold-300/10 rounded-full blur-3xl animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-wedding-blue-400/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />
            </header>

            {/* Admin Login Modal */}
            {showLogin && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="wedding-card rounded-3xl p-10 max-w-md w-full border border-wedding-blue-200"
                    >
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-wedding-blue-100 rounded-full mb-4">
                                <LogIn size={28} className="text-wedding-blue-600" />
                            </div>
                            <h3 className="text-3xl font-playfair font-bold text-wedding-blue-900 mb-2">Đăng nhập Admin</h3>
                            <p className="text-wedding-blue-600">Nhập mật khẩu để quản lý thư viện</p>
                        </div>

                        <input
                            type="password"
                            placeholder="Nhập mật khẩu admin"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full px-6 py-4 border-2 border-wedding-blue-200 rounded-2xl mb-6 focus:outline-none focus:ring-2 focus:ring-wedding-blue-500 focus:border-wedding-blue-500 text-lg transition-all"
                            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                        />

                        <div className="flex gap-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleLogin}
                                className="flex-1 btn-primary"
                            >
                                Đăng nhập
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    setShowLogin(false);
                                    setAdminPassword('');
                                }}
                                className="flex-1 btn-secondary"
                            >
                                Hủy
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* QR Code Modal */}
            {showQRCode && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="wedding-card rounded-3xl p-10 max-w-md w-full border border-wedding-blue-200 relative"
                    >
                        {/* Close Button */}
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowQRCode(false)}
                            className="absolute top-6 right-6 w-10 h-10 bg-wedding-blue-100 rounded-full flex items-center justify-center hover:bg-wedding-blue-200 transition-colors"
                        >
                            <X size={20} className="text-wedding-blue-600" />
                        </motion.button>

                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-wedding-blue-100 rounded-full mb-6 animate-pulse-slow pulse-glow">
                                <Share2 size={36} className="text-wedding-blue-600" />
                            </div>
                            <h3 className="text-3xl font-playfair font-bold text-wedding-blue-900 mb-2">
                                Chia sẻ <span className="gold-accent">Gallery</span>
                            </h3>
                            <p className="text-wedding-blue-600">
                                Quét mã QR để truy cập thư viện ảnh cưới
                            </p>
                        </div>

                        {/* QR Code Display */}
                        <div className="flex justify-center mb-8">
                            <div className="p-6 bg-white rounded-2xl shadow-lg border-2 border-wedding-gold-200">
                                {qrCodeUrl ? (
                                    <img
                                        src={qrCodeUrl}
                                        alt="QR Code"
                                        className="w-64 h-64"
                                    />
                                ) : (
                                    <div className="w-64 h-64 flex items-center justify-center">
                                        <Loader2 className="animate-spin text-wedding-blue-600" size={32} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* URL Display */}
                        <div className="mb-6">
                            <p className="text-sm text-wedding-blue-600 mb-2">Hoặc truy cập trực tiếp:</p>
                            <div className="bg-wedding-blue-50 border-2 border-wedding-blue-200 rounded-xl p-3">
                                <p className="text-sm text-wedding-blue-800 break-all font-mono">
                                    {window.location.href}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    toast.success("Đã sao chép đường link!");
                                }}
                                className="flex-1 btn-primary"
                            >
                                Sao chép link
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowQRCode(false)}
                                className="flex-1 btn-secondary"
                            >
                                Đóng
                            </motion.button>
                        </div>

                        {/* Decorative Elements */}
                        <div className="absolute -top-4 -left-4 text-wedding-gold-400 animate-pulse-slow">
                            <Sparkles size={24} fill="currentColor" className="sparkle" />
                        </div>
                        <div className="absolute -bottom-4 -right-4 text-wedding-gold-400 animate-pulse-slow" style={{ animationDelay: '1s' }}>
                            <Star size={20} fill="currentColor" className="wiggle" />
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Upload Section - Admin Only */}
            {isAdmin && (
                <section className="max-w-5xl mx-auto -mt-16 px-4 relative z-20">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="wedding-card rounded-3xl shadow-wedding-lg p-10 text-center"
                    >
                        <div className="mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-wedding-blue-100 rounded-full mb-6 animate-pulse-slow pulse-glow">
                                <Camera size={36} className="text-wedding-blue-600 heartbeat" />
                            </div>
                            <h2 className="text-4xl font-playfair font-bold text-wedding-blue-900 mb-4">
                                Admin: <span className="gold-accent">Tải ảnh lên</span>
                            </h2>
                            <p className="text-xl text-wedding-blue-700 mb-2">
                                Chỉ admin mới có thể tải ảnh lên thư viện
                            </p>
                            <p className="text-wedding-blue-600 font-dancing text-lg">
                                Quản lý khoảnh khắc đẹp nhất của đám cưới
                            </p>
                        </div>

                        {/* Category Selection */}
                        <div className="mb-8">
                            <label className="block text-wedding-blue-800 font-semibold mb-4 text-lg">
                                Chọn danh mục ảnh:
                            </label>
                            <div className="flex justify-center gap-4">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setSelectedCategory('ảnh check-in')}
                                    className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${selectedCategory === 'ảnh check-in'
                                            ? 'wedding-gradient text-white shadow-wedding-lg'
                                            : 'bg-wedding-blue-100 text-wedding-blue-700 hover:bg-wedding-blue-200 border-2 border-wedding-blue-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Camera size={18} />
                                        <span>Ảnh check-in</span>
                                    </div>
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setSelectedCategory('ảnh từng bàn')}
                                    className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${selectedCategory === 'ảnh từng bàn'
                                            ? 'wedding-gradient text-white shadow-wedding-lg'
                                            : 'bg-wedding-blue-100 text-wedding-blue-700 hover:bg-wedding-blue-200 border-2 border-wedding-blue-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <ImageIcon size={18} />
                                        <span>Ảnh từng bàn</span>
                                    </div>
                                </motion.button>
                            </div>
                            <p className="mt-3 text-sm text-wedding-blue-600">
                                Đã chọn: <span className="font-semibold text-wedding-blue-800">{selectedCategory}</span>
                            </p>
                        </div>

                        <motion.label
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`
                inline-flex items-center gap-3 px-10 py-5 rounded-full font-bold text-lg transition-all cursor-pointer shadow-wedding-lg
                ${loading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'wedding-gradient text-white hover:shadow-wedding-lg active:scale-95 border-2 border-wedding-blue-300'
                                }
              `}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={28} />
                                    Đang gửi ảnh...
                                </>
                            ) : (
                                <>
                                    <Camera size={28} />
                                    <span>Tải ảnh lên ngay</span>
                                    <Sparkles size={20} className="animate-pulse sparkle" />
                                </>
                            )}
                            <input
                                type="file"
                                className="hidden"
                                onChange={handleUpload}
                                disabled={loading}
                                accept="image/*"
                            />
                        </motion.label>

                        <div className="mt-8 flex justify-center gap-8 text-wedding-blue-600">
                            <div className="flex items-center gap-2">
                                <Heart size={16} className="text-red-400 fill-current animate-pulse heartbeat" />
                                <span className="text-sm">Yêu thương</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Star size={16} className="gold-accent fill-current wiggle" />
                                <span className="text-sm">Hạnh phúc</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Flower size={16} className="text-pink-400 fill-current floating" />
                                <span className="text-sm">Lãng mạn</span>
                            </div>
                        </div>
                    </motion.div>
                </section>
            )}

            {/* Gallery Section */}
            <main className="max-w-7xl mx-auto px-4 py-24">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-center mb-16"
                >
                    <h2 className="text-5xl font-playfair font-bold text-wedding-blue-900 mb-4">
                        Khoảnh khắc <span className="gold-accent">yêu thương</span>
                    </h2>
                    <p className="text-xl text-wedding-blue-700 font-dancing">
                        Những kỷ niệm đẹp đẽ của chúng ta
                    </p>
                    <div className="mt-6 h-1 w-32 bg-gradient-to-r from-wedding-blue-400 to-wedding-gold-400 mx-auto rounded-full" />
                </motion.div>

                {/* Share QR Code Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="text-center mb-12"
                >
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={generateQRCode}
                        className="inline-flex items-center gap-3 wedding-gradient text-white px-8 py-4 rounded-full font-bold shadow-wedding-lg hover:shadow-wedding-lg transition-all duration-300 border-2 border-wedding-blue-300"
                    >
                        <Share2 size={20} />
                        <span>Chia sẻ Gallery</span>
                        <Sparkles size={16} className="animate-pulse sparkle" />
                    </motion.button>
                </motion.div>

                {/* Category Filter */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-center mb-12"
                >
                    <div className="flex justify-center gap-4 flex-wrap">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFilterCategory('tất cả')}
                            className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${filterCategory === 'tất cả'
                                    ? 'wedding-gradient text-white shadow-wedding-lg'
                                    : 'bg-wedding-blue-100 text-wedding-blue-700 hover:bg-wedding-blue-200 border-2 border-wedding-blue-200'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <ImageIcon size={18} />
                                <span>Tất cả</span>
                            </div>
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFilterCategory('ảnh check-in')}
                            className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${filterCategory === 'ảnh check-in'
                                    ? 'wedding-gradient text-white shadow-wedding-lg'
                                    : 'bg-wedding-blue-100 text-wedding-blue-700 hover:bg-wedding-blue-200 border-2 border-wedding-blue-200'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Camera size={18} />
                                <span>Ảnh check-in</span>
                            </div>
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFilterCategory('ảnh từng bàn')}
                            className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${filterCategory === 'ảnh từng bàn'
                                    ? 'wedding-gradient text-white shadow-wedding-lg'
                                    : 'bg-wedding-blue-100 text-wedding-blue-700 hover:bg-wedding-blue-200 border-2 border-wedding-blue-200'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <ImageIcon size={18} />
                                <span>Ảnh từng bàn</span>
                            </div>
                        </motion.button>
                    </div>
                </motion.div>

                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8 space-y-8">
                    <AnimatePresence>
                        {photos
                            .filter(photo => filterCategory === 'tất cả' || photo.category === filterCategory)
                            .map((photo, index) => (
                                <motion.div
                                    key={photo._id}
                                    initial={{ opacity: 0, y: 30, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ delay: index * 0.1, duration: 0.5 }}
                                    className="relative group break-inside-avoid rounded-3xl overflow-hidden shadow-wedding wedding-card border-2 border-transparent hover:border-wedding-blue-200 transition-all duration-500 gallery-item fade-in-up"
                                >
                                    <div className="relative">
                                        <img
                                            src={photo.url}
                                            alt="Wedding moment"
                                            className="w-full h-auto gallery-image"
                                        />

                                        {/* Decorative corner */}
                                        <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-wedding-gold-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 sparkle" />
                                        <div className="absolute top-2 left-2 w-6 h-6 bg-wedding-gold-400/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pulse-glow" />
                                    </div>

                                    {/* Enhanced Overlay on Hover */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-wedding-blue-950/90 via-wedding-blue-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-between p-6">
                                        <div className="flex justify-end">
                                            <div className="flex items-center gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        size={12}
                                                        className={i < Math.min(5, Math.floor(photo.likes / 2)) ? "gold-accent" : "text-white/30"}
                                                        fill="currentColor"
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => handleLike(photo._id)}
                                                className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-6 py-3 rounded-full text-wedding-blue-900 hover:bg-red-500 hover:text-white transition-all duration-300 shadow-lg"
                                            >
                                                <Heart size={20} className={photo.likes > 0 ? "text-red-500 fill-current heartbeat" : ""} />
                                                <span className="font-bold">{photo.likes}</span>
                                            </motion.button>

                                            {isAdmin && (
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => handleDelete(photo._id)}
                                                    className="flex items-center gap-2 bg-red-500/90 backdrop-blur-md px-6 py-3 rounded-full text-white hover:bg-red-600 transition-all duration-300 shadow-lg"
                                                >
                                                    <Trash2 size={20} />
                                                    <span className="font-bold">Xóa</span>
                                                </motion.button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                    </AnimatePresence>
                </div>

                {photos.length === 0 && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-32"
                    >
                        <div className="flex items-center justify-center w-32 h-32 bg-wedding-blue-100 rounded-full mb-8 pulse-glow mx-auto">
                            <ImageIcon size={48} className="text-wedding-blue-400 floating" />
                        </div>
                        <h3 className="text-2xl font-playfair font-bold text-wedding-blue-900 mb-4 text-center">
                            Chưa có tấm ảnh nào
                        </h3>
                        <p className="text-xl text-wedding-blue-700 mb-2 text-center">
                            Hãy là người đầu tiên chia sẻ khoảnh khắc đẹp nhất!
                        </p>
                        <p className="text-wedding-blue-600 font-dancing text-center">
                            Mỗi tấm ảnh là một câu chuyện tình yêu
                        </p>
                    </motion.div>
                )}
            </main>

            <footer className="relative bg-gradient-to-r from-wedding-blue-900 via-wedding-blue-800 to-wedding-blue-900 text-white py-16 mt-20 overflow-hidden">
                {/* Decorative background */}
                <div className="absolute inset-0">
                    <div className="absolute top-0 left-10 w-32 h-32 bg-wedding-gold-400/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 right-10 w-40 h-40 bg-wedding-blue-400/10 rounded-full blur-2xl" />
                </div>

                <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mb-8"
                    >
                        <div className="flex justify-center mb-6">
                            <div className="flex items-center gap-3">
                                <Heart size={24} className="text-red-400 fill-current animate-pulse heartbeat" />
                                <span className="text-2xl font-playfair font-bold gold-accent">Huy & Ý</span>
                                <Heart size={24} className="text-red-400 fill-current animate-pulse heartbeat" />
                            </div>
                        </div>

                        <p className="text-xl font-dancing mb-4 text-wedding-blue-200">
                            "Tình yêu là hành trình đẹp nhất"
                        </p>

                        <div className="flex justify-center items-center gap-8 mb-8">
                            <div className="flex items-center gap-2 text-wedding-blue-300">
                                <Star size={16} className="gold-accent" fill="currentColor" />
                                <span className="text-sm">Forever</span>
                            </div>
                            <div className="flex items-center gap-2 text-wedding-blue-300">
                                <Flower size={16} className="text-pink-400" fill="currentColor" />
                                <span className="text-sm">Always</span>
                            </div>
                            <div className="flex items-center gap-2 text-wedding-blue-300">
                                <Heart size={16} className="text-red-400" fill="currentColor" />
                                <span className="text-sm">Together</span>
                            </div>
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-wedding-gold-400 to-transparent w-32 mx-auto mb-8" />
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-wedding-blue-400 font-medium"
                    >
                        Made with <span className="text-red-400 animate-pulse heartbeat">❤️</span> for my Sister's Big Day
                    </motion.p>

                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-sm text-wedding-blue-500 mt-4"
                    >
                        © 2026 Wedding Gallery. Wishing you a lifetime of love and happiness.
                    </motion.p>
                </div>
            </footer>
        </div>
    );
}

export default App;