import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Guestbook({ API_URL, isAdmin }) {
    const [messages, setMessages] = useState([]);
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/guestbook`);
            setMessages(res.data);
        } catch (error) {
            console.error('Lỗi khi tải lời chúc:', error);
            toast.error("Không thể tải lời chúc!");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, [API_URL]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !message.trim()) {
            toast.error("Vui lòng nhập tên và lời chúc!");
            return;
        }

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_URL}/guestbook`, { name, message });
            setMessages(prev => [res.data, ...prev]);
            setName('');
            setMessage('');
            toast.success("Đã gửi lời chúc thành công!");
        } catch (error) {
            console.error('Lỗi khi gửi lời chúc:', error);
            toast.error("Không thể gửi lời chúc, vui lòng thử lại!");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa lời chúc này?")) return;

        try {
            await axios.delete(`${API_URL}/guestbook/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            setMessages(prev => prev.filter(m => m._id !== id));
            toast.success("Đã xóa lời chúc!");
        } catch (error) {
            console.error('Lỗi khi xóa lời chúc:', error);
            toast.error("Không thể xóa lời chúc!");
        }
    };

    return (
        <section className="py-20 bg-gradient-to-b from-white to-wedding-blue-50/50 dark:from-slate-900 dark:to-wedding-blue-950/50 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-wedding-gold-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-wedding-blue-200/30 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

            <div className="max-w-4xl mx-auto px-4 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <h2 className="text-4xl sm:text-5xl font-playfair font-black text-wedding-blue-900 dark:text-wedding-blue-50 mb-4 drop-shadow-sm">
                        Sổ Lưu Bút <span className="gold-accent">Điện Tử</span>
                    </h2>
                    <p className="text-xl text-wedding-blue-700/80 dark:text-wedding-blue-200/80 font-dancing tracking-wide">
                        Gửi gắm những lời chúc tốt đẹp nhất đến cô dâu và chú rể
                    </p>
                    <div className="mt-6 h-1 w-32 bg-gradient-to-r from-transparent via-wedding-gold-400 to-transparent mx-auto rounded-full opacity-70" />
                </motion.div>

                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-3xl shadow-xl p-6 sm:p-10 border border-white/50 dark:border-wedding-blue-800/50 mb-12 relative">
                    <div className="absolute -top-6 -left-6 text-wedding-gold-300 opacity-50 rotate-[-15deg]">
                        {/* Fake SVG decoration icon */}
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-wedding-blue-800 dark:text-wedding-blue-200 font-semibold text-sm pl-2">Tên của bạn</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ví dụ: Bạn thân của cô dâu"
                                    className="px-4 py-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-wedding-blue-200 dark:border-wedding-blue-700/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-wedding-blue-400 focus:border-transparent transition-all shadow-sm w-full"
                                    maxLength={50}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-wedding-blue-800 dark:text-wedding-blue-200 font-semibold text-sm pl-2">Lời chúc của bạn</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Viết lời chúc..."
                                rows={4}
                                className="px-4 py-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-wedding-blue-200 dark:border-wedding-blue-700/50 dark:text-white focus:outline-none focus:ring-2 focus:ring-wedding-blue-400 focus:border-transparent transition-all shadow-sm w-full resize-none"
                                maxLength={500}
                                required
                            />
                        </div>

                        <div className="flex justify-end">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                type="submit"
                                disabled={submitting}
                                className="inline-flex items-center gap-2 wedding-gradient text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        <span>Đang gửi...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={20} />
                                        <span>Gửi lời chúc</span>
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </form>
                </div>

                <div className="space-y-6">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-wedding-blue-500" size={32} />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-12 bg-white/40 dark:bg-slate-800/40 rounded-3xl border border-white/50 dark:border-wedding-blue-800/50 backdrop-blur-sm">
                            <p className="text-wedding-blue-700 dark:text-wedding-blue-300 text-lg">Chưa có lời chúc nào. Hãy là người đầu tiên!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                            <AnimatePresence>
                                {messages.map((msg, index) => (
                                    <motion.div
                                        key={msg._id}
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 260,
                                            damping: 20,
                                            delay: index * 0.05
                                        }}
                                        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-wedding-blue-100/50 dark:border-wedding-blue-800/50 hover:shadow-md dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all group relative"
                                    >
                                        <div className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br from-wedding-gold-200 to-wedding-gold-400 rounded-full flex items-center justify-center shadow-sm -rotate-12 group-hover:rotate-12 transition-transform">
                                            {/* Pin decor */}
                                            <div className="w-2 h-2 bg-white rounded-full shadow-inner" />
                                        </div>

                                        <div className="mb-4 text-wedding-blue-800 dark:text-wedding-blue-100">
                                            <p className="italic text-lg relative z-10 break-words line-clamp-4">
                                                "{msg.message}"
                                            </p>
                                        </div>

                                        <div className="flex justify-between items-end mt-4 pt-4 border-t border-wedding-blue-100/50 dark:border-wedding-blue-800/50">
                                            <div>
                                                <h4 className="font-bold text-wedding-blue-900 dark:text-wedding-blue-50">{msg.name}</h4>
                                                <p className="text-xs text-wedding-blue-500 dark:text-wedding-blue-400 mt-1">
                                                    {new Date(msg.createdAt).toLocaleDateString('vi-VN', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                            </div>

                                            {isAdmin && (
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => handleDelete(msg._id)}
                                                    className="text-red-400 hover:text-red-600 p-2 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                                                    title="Xóa lời chúc"
                                                >
                                                    <Trash2 size={16} />
                                                </motion.button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
