import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Heart, CalendarHeart, Wine, Camera, Sparkles, Loader2, Edit2, Trash2, Plus } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

const IconMap = {
    Camera, Heart, Wine, CalendarHeart, Sparkles
};

export default function LoveStory({ API_URL, isAdmin }) {
    const { scrollYProgress } = useScroll();
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);

    // Admin Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        description: '',
        icon: 'Heart',
        order: 0
    });
    const [imageFile, setImageFile] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchMilestones();
    }, []);

    const fetchMilestones = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/lovestory`);
            setMilestones(response.data);
        } catch (error) {
            console.error("Lỗi khi tải câu chuyện tình yêu:", error);
            toast.error("Không thể tải dòng thời gian tình yêu.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa mốc thời gian này?")) return;

        try {
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/lovestory/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Đã xóa mốc thời gian thành công!");
            fetchMilestones();
        } catch (error) {
            console.error("Lỗi khi xóa:", error);
            toast.error("Xóa thất bại.");
        }
    };

    const openCreateModal = () => {
        setEditingItem(null);
        setFormData({
            title: '',
            date: '',
            description: '',
            icon: 'Heart',
            order: milestones.length > 0 ? Math.max(...milestones.map(m => m.order)) + 1 : 1
        });
        setImageFile(null);
        setIsModalOpen(true);
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            title: item.title,
            date: item.date,
            description: item.description,
            icon: item.icon,
            order: item.order
        });
        setImageFile(null);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const token = localStorage.getItem('adminToken');
            const data = new FormData();
            data.append('title', formData.title);
            data.append('date', formData.date);
            data.append('description', formData.description);
            data.append('icon', formData.icon);
            data.append('order', formData.order);

            if (imageFile) {
                data.append('imageFile', imageFile);
            } else if (!editingItem) {
                toast.error("Vui lòng chọn hình ảnh!");
                setIsSubmitting(false);
                return;
            }

            if (editingItem) {
                await axios.put(`${API_URL}/lovestory/${editingItem._id}`, data, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success("Cập nhật thành công!");
            } else {
                await axios.post(`${API_URL}/lovestory`, data, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
                toast.success("Thêm mới thành công!");
            }
            setIsModalOpen(false);
            fetchMilestones();
        } catch (error) {
            console.error("Lỗi khi lưu mốc thời gian:", error);
            toast.error(error.response?.data?.message || "Lỗi khi lưu Daten.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Parallax background effect
    const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
    const opacity = useTransform(scrollYProgress, [0.1, 0.5, 0.9], [0, 1, 0]);

    return (
        <section className="relative py-24 min-h-screen overflow-hidden bg-wedding-blue-900">
            {/* Parallax Background */}
            <motion.div
                className="absolute inset-0 z-0 opacity-20"
                style={{
                    y: backgroundY,
                    backgroundImage: 'url("https://images.unsplash.com/photo-1519225421984-9dc30b022cbe?w=1920&q=80")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-wedding-blue-900 via-transparent to-wedding-blue-900 z-0" />

            <div className="max-w-6xl mx-auto px-4 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-20"
                >
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-playfair font-black text-white mb-4 drop-shadow-md">
                        Câu Chuyện <span className="text-wedding-gold-400">Tình Yêu</span>
                    </h2>
                    <p className="text-2xl text-wedding-blue-200 font-dancing tracking-wide">
                        Hành trình từ hai người xa lạ trở thành chung một nhà
                    </p>
                    <div className="mt-6 h-1 w-40 bg-gradient-to-r from-transparent via-wedding-gold-500 to-transparent mx-auto rounded-full" />
                </motion.div>

                <div className="relative">
                    {/* Center Timeline Line */}
                    <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-wedding-gold-500/50 to-transparent -translate-x-1/2 hidden md:block" />
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-wedding-gold-500/50 to-transparent md:hidden" />

                    {/* Timeline Items */}
                    <div className="space-y-16 md:space-y-24 min-h-[400px]">
                        {loading && (
                            <div className="flex justify-center items-center h-48">
                                <Loader2 className="w-8 h-8 animate-spin text-wedding-blue-400" />
                            </div>
                        )}
                        {!loading && milestones.map((milestone, index) => {
                            const Icon = IconMap[milestone.icon] || Heart;
                            const isEven = index % 2 === 0;

                            return (
                                <div key={milestone.id} className="relative flex flex-col md:flex-row items-center justify-between">
                                    {/* Desktop Center Node */}
                                    <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-wedding-blue-900 border-4 border-wedding-gold-400 items-center justify-center z-20 shadow-[0_0_15px_rgba(250,204,21,0.5)]">
                                        <Icon size={20} className="text-wedding-gold-400" />
                                    </div>

                                    {/* Mobile Left Node */}
                                    <div className="md:hidden absolute left-8 -translate-x-1/2 w-10 h-10 rounded-full bg-wedding-blue-900 border-4 border-wedding-gold-400 items-center justify-center z-20 shadow-[0_0_15px_rgba(250,204,21,0.5)] flex">
                                        <Icon size={16} className="text-wedding-gold-400" />
                                    </div>

                                    {/* Content Wrapper */}
                                    <div className={`w-full md:w-[calc(50%-3rem)] pl-20 md:pl-0 ${isEven ? 'md:pr-12 md:text-right' : 'md:pl-12 md:ml-auto'}`}>
                                        <motion.div
                                            initial={{ opacity: 0, x: isEven ? -50 : 50, y: 20 }}
                                            whileInView={{ opacity: 1, x: 0, y: 0 }}
                                            viewport={{ once: true, margin: "-100px" }}
                                            transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
                                            className="bg-white/10 backdrop-blur-md border border-white/20 p-6 sm:p-8 rounded-3xl shadow-xl hover:bg-white/15 transition-all duration-500 group relative"
                                        >
                                            {/* Admin Controls */}
                                            {isAdmin && (
                                                <div className="absolute top-4 right-4 z-20 flex gap-2 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                                        title="Sửa"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                                        onClick={() => handleDelete(milestone._id)}
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                            <div className={`flex items-center gap-3 mb-4 ${isEven ? 'md:justify-end' : 'justify-start'}`}>
                                                <span className="text-wedding-gold-300 font-bold bg-wedding-blue-950/50 px-4 py-1.5 rounded-full border border-wedding-gold-500/30">
                                                    {milestone.date}
                                                </span>
                                            </div>

                                            <h3 className="text-2xl sm:text-3xl font-playfair font-bold text-white mb-3 group-hover:text-wedding-gold-300 transition-colors">
                                                {milestone.title}
                                            </h3>

                                            <p className="text-wedding-blue-100/90 leading-relaxed mb-6">
                                                {milestone.description}
                                            </p>

                                            <div className="relative rounded-2xl overflow-hidden aspect-video shadow-lg group-hover:shadow-[0_0_20px_rgba(250,204,21,0.2)] transition-shadow">
                                                <img
                                                    src={milestone.image}
                                                    alt={milestone.title}
                                                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            </div>
                                        </motion.div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Add Button for Admin */}
                    {isAdmin && (
                        <div className="flex justify-center mt-16 relative z-10">
                            <motion.button
                                onClick={openCreateModal}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="flex items-center gap-2 px-6 py-3 bg-wedding-gold-500 hover:bg-wedding-gold-600 text-white rounded-full font-medium shadow-lg transition-colors border border-wedding-gold-400"
                            >
                                <Plus size={20} />
                                <span>Thêm cột mốc mới</span>
                            </motion.button>
                        </div>
                    )}
                </div>
            </div>

            {/* Transition decor at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-slate-900 to-transparent" />

            {/* Admin Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 border border-slate-100 dark:border-slate-700 flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
                                <h2 className="text-2xl font-playfair font-bold text-wedding-blue-900 dark:text-wedding-blue-100">
                                    {editingItem ? 'Sửa Cột Mốc Thời Gian' : 'Thêm Cột Mốc Mới'}
                                </h2>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                <form id="lovestory-form" onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tựa đề *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-wedding-blue-400 focus:border-transparent outline-none transition-all dark:bg-slate-700 dark:text-white"
                                            placeholder="VD: Lần Đầu Gặp Gỡ"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Thời gian *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-wedding-blue-400 focus:border-transparent outline-none transition-all dark:bg-slate-700 dark:text-white"
                                            placeholder="VD: 15.08.2023 hoặc Mùa thu năm ấy"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mô tả *</label>
                                        <textarea
                                            required
                                            rows={3}
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-wedding-blue-400 focus:border-transparent outline-none transition-all resize-none dark:bg-slate-700 dark:text-white"
                                            placeholder="Kể lại khoảnh khắc đáng nhớ này..."
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Thứ tự hiển thị</label>
                                            <input
                                                type="number"
                                                value={formData.order}
                                                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-wedding-blue-400 focus:border-transparent outline-none transition-all dark:bg-slate-700 dark:text-white"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Icon</label>
                                            <select
                                                value={formData.icon}
                                                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-wedding-blue-400 focus:border-transparent outline-none transition-all bg-white dark:bg-slate-700 dark:text-white"
                                            >
                                                {Object.keys(IconMap).map(iconName => (
                                                    <option key={iconName} value={iconName}>{iconName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Hình ảnh {editingItem ? '(Tải lên ảnh mới sẽ ghi đè ảnh cũ)' : '*'}
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setImageFile(e.target.files[0])}
                                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-wedding-blue-400 focus:border-transparent outline-none transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-wedding-blue-50 file:text-wedding-blue-700 hover:file:bg-wedding-blue-100 dark:file:bg-slate-600 dark:file:text-slate-200 dark:text-white bg-white dark:bg-slate-700"
                                        />
                                    </div>
                                </form>
                            </div>

                            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2 rounded-full font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    form="lovestory-form"
                                    disabled={isSubmitting}
                                    className="px-6 py-2 rounded-full font-medium text-white bg-wedding-blue-600 hover:bg-wedding-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Đang lưu...
                                        </>
                                    ) : 'Lưu lại'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </section>
    );
}
