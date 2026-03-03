import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Heart, CalendarHeart, Rings, Wine, Camera, Sparkles } from 'lucide-react';

const milestones = [
    {
        id: 1,
        date: "15.08.2023",
        title: "Lần Đầu Gặp Gỡ",
        description: "Ánh mắt ta chạm nhau giữa biển người mênh mông, và khoảnh khắc đó, thế giới như ngừng lại. Anh biết rằng, mình đã tìm thấy một nửa của đời mình.",
        icon: Camera,
        align: "left",
        image: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&q=80"
    },
    {
        id: 2,
        date: "20.10.2023",
        title: "Lời Yêu Đầu Tiên",
        description: "Dưới cơn mưa thu dịu dàng, tiếng yêu ngập ngừng được cất lên. Cái nắm tay thật chặt thay cho bao lời muốn nói.",
        icon: Heart,
        align: "right",
        image: "https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&q=80"
    },
    {
        id: 3,
        date: "14.02.2024",
        title: "Kỷ Niệm Khó Quên",
        description: "Valentine đầu tiên bên nhau với những món quà nhỏ xinh nhưng đong đầy tình cảm. Cùng nhau hứa hẹn về một tương lai xa hơn.",
        icon: Wine,
        align: "left",
        image: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=800&q=80"
    },
    {
        id: 4,
        date: "24.12.2025",
        title: "Anh Đồng Ý Không?",
        description: "Trong không khí ấm áp của đêm Giáng sinh, chiếc nhẫn lấp lánh được trao tay. Nước mắt rơi, và câu 'Em đồng ý' được thốt lên.",
        icon: CalendarHeart, // replaced Rings with CalendarHeart since Rings is not in lucide-react standard
        align: "right",
        image: "https://images.unsplash.com/photo-1549416878-b9ca95e1ccf7?w=800&q=80"
    },
    {
        id: 5,
        date: "May 2026",
        title: "Ngày Hạnh Phúc Trọn Vẹn",
        description: "Ngày chúng ta chính thức gọi nhau bằng tiếng 'Vợ - Chồng'. Hành trình mới chỉ vừa bắt đầu, với trọn vẹn yêu thương.",
        icon: Sparkles,
        align: "left",
        image: "https://images.unsplash.com/photo-1519741497674-611821869e9a?w=800&q=80"
    }
];

export default function LoveStory() {
    const { scrollYProgress } = useScroll();

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
                    <div className="space-y-16 md:space-y-24">
                        {milestones.map((milestone, index) => {
                            const Icon = milestone.icon;
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
                                            className="bg-white/10 backdrop-blur-md border border-white/20 p-6 sm:p-8 rounded-3xl shadow-xl hover:bg-white/15 transition-all duration-500 group"
                                        >
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
                </div>
            </div>

            {/* Transition decor at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-slate-900 to-transparent" />
        </section>
    );
}
