import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Heart, Camera, Image as ImageIcon, Loader2, Trash2, LogIn, LogOut, Sparkles, Flower, Star, Share2, X, Download, Video, Plus, Edit, MoreVertical, Film, ChevronLeft, ChevronRight, Music, Moon, Sun, MessageCircle, Send, Hand } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import QRCode from 'qrcode';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import './slideshow-animations.css';

import Guestbook from './Guestbook';

const slideVariants = {
    enter: ({ direction, offset }) => ({
        x: direction > 0 ? window.innerWidth + offset : -window.innerWidth + offset,
        scale: 0.95,
        opacity: 0.3,
        zIndex: 1
    }),
    center: {
        x: 0,
        scale: 1,
        opacity: 1,
        zIndex: 1
    },
    exit: ({ direction }) => ({
        x: direction > 0 ? -window.innerWidth : window.innerWidth,
        scale: 0.95,
        opacity: 0.3,
        zIndex: 0
    })
};

const LazyImage = React.memo(
    ({
        src,
        srcSet,
        sizes,
        alt,
        wrapperClassName,
        imgClassName,
        loading = 'lazy',
        fetchPriority = 'auto',
        onClick,
    }) => {
        const [isLoaded, setIsLoaded] = useState(false);

        return (
            <div className={`relative ${wrapperClassName || ''}`} onClick={onClick}>
                <img
                    src={src}
                    srcSet={srcSet}
                    sizes={sizes}
                    alt={alt}
                    className={imgClassName || 'w-full h-full object-cover'}
                    loading={loading}
                    decoding="async"
                    fetchPriority={fetchPriority}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setIsLoaded(true)}
                    style={{
                        opacity: isLoaded ? 1 : 0,
                        filter: isLoaded ? 'none' : 'blur(8px)',
                    }}
                />
                {!isLoaded && (
                    <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                        <Loader2 className="animate-spin text-gray-400" size={24} />
                    </div>
                )}
            </div>
        );
    }
);

const API_URL = import.meta.env.PROD
    ? 'https://wedding-f35z.onrender.com/api'
    : 'http://localhost:8000/api';

function App() {
    const [media, setMedia] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showLikeEffectId, setShowLikeEffectId] = useState(null);
    const [likedPhotos, setLikedPhotos] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('likedPhotos')) || [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState('tất cả');
    const [filterCategory, setFilterCategory] = useState('tất cả');
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [showLogin, setShowLogin] = useState(false);
    const [showQRCode, setShowQRCode] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState('ảnh check-in');
    const [multipleFiles, setMultipleFiles] = useState([]);
    const [likingPhotoId, setLikingPhotoId] = useState(null);
    const [zoomedImage, setZoomedImage] = useState(null);
    const [isZoomedIn, setIsZoomedIn] = useState(false);
    const [slideDirection, setSlideDirection] = useState(1);
    const [dragOffset, setDragOffset] = useState(0);
    const [showSwipeHint, setShowSwipeHint] = useState(false);
    const [editingPhoto, setEditingPhoto] = useState(null);
    const [newCategoryForPhoto, setNewCategoryForPhoto] = useState('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(null);
    const [pagination, setPagination] = useState(null);
    const [isPageTransitioning, setIsPageTransitioning] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [bgAudioList, setBgAudioList] = useState([]);
    const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
    const [audioUploading, setAudioUploading] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const audioRef = React.useRef(null);

    // Welcome Letter
    const [showWelcomeLetter, setShowWelcomeLetter] = useState(false);
    
    // Comments
    const [commentName, setCommentName] = useState('');
    const [commentContent, setCommentContent] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    // Slideshow
    const [slideshowItems, setSlideshowItems] = useState([]);
    const [showSlideshowManager, setShowSlideshowManager] = useState(false);
    const [showAddToSlideshowPicker, setShowAddToSlideshowPicker] = useState(false);
    const [showSlideshowFullscreen, setShowSlideshowFullscreen] = useState(false);
    const [slideshowIndex, setSlideshowIndex] = useState(0);
    const [slideshowLoading, setSlideshowLoading] = useState(false);
    const [allImagesForPicker, setAllImagesForPicker] = useState([]);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // Dark Mode
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('weddingDarkMode');
        return saved === 'true';
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('weddingDarkMode', isDarkMode);
    }, [isDarkMode]);

    // Handle scroll locking for modals
    useEffect(() => {
        if (zoomedImage || showSlideshowFullscreen || showWelcomeLetter) {
            // Store current scroll position to prevent iOS jumping
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        
        // Reset zoom state on new image
        setIsZoomedIn(false);

        // Add side-effect hint logic here when zoomedImage changes
        if (zoomedImage && window.innerWidth < 768) {
            const hasSeen = localStorage.getItem('hasSeenSwipeHint');
            if (!hasSeen) {
                setShowSwipeHint(true);
                setTimeout(() => {
                    setShowSwipeHint(false);
                    localStorage.setItem('hasSeenSwipeHint', 'true');
                }, 3000);
            }
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [zoomedImage, showSlideshowFullscreen, showWelcomeLetter]);

    const navigateZoomedImage = useCallback((direction, currentOffset = 0) => {
        if (!zoomedImage || media.length === 0) return;
        const currentIndex = media.findIndex(m => m._id === zoomedImage._id);
        if (currentIndex === -1) return;
        
        let newIndex;
        if (direction === 'next') {
            newIndex = (currentIndex + 1) % media.length;
            setSlideDirection(1);
        } else {
            newIndex = (currentIndex - 1 + media.length) % media.length;
            setSlideDirection(-1);
        }
        
        setDragOffset(currentOffset);
        setZoomedImage(media[newIndex]);
    }, [zoomedImage, media]);

    // Handle ESC key and arrow keys to navigate images
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (zoomedImage || showSlideshowFullscreen || showWelcomeLetter) {
                    setZoomedImage(null);
                    setShowSlideshowFullscreen(false);
                    setShowWelcomeLetter(false);
                }
            } else if (e.key === 'ArrowRight') {
                if (zoomedImage) navigateZoomedImage('next');
            } else if (e.key === 'ArrowLeft') {
                if (zoomedImage) navigateZoomedImage('prev');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [zoomedImage, showSlideshowFullscreen, showWelcomeLetter, navigateZoomedImage]);

    // Welcome Letter Effect
    useEffect(() => {
        const hasSeen = localStorage.getItem('weddingWelcomeLetter');
        if (!hasSeen && !isAdmin) {
            const timer = setTimeout(() => {
                setShowWelcomeLetter(true);
            }, 1000); // Show after 1 second
            return () => clearTimeout(timer);
        }
    }, [isAdmin]);

    const closeWelcomeLetter = () => {
        setShowWelcomeLetter(false);
        localStorage.setItem('weddingWelcomeLetter', 'true');
        // Auto-play music if possible
        if (audioRef.current) {
            audioRef.current.play().then(() => {
                setIsPlayingAudio(true);
            }).catch(e => console.log('Autoplay prevented', e));
        }
    };

    const floatingDecor = React.useMemo(() => {
        const hearts = [...Array(12)].map((_, i) => ({
            key: `heart-${i}`,
            size: 15 + Math.random() * 25,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
        }));

        const stars = [...Array(6)].map((_, i) => ({
            key: `star-${i}`,
            size: 12 + Math.random() * 18,
            left: `${Math.random() * 100}%`,
            animationDuration: `${4 + Math.random() * 4}s`,
            color: 'rgba(2,132,199,0.3)',
        }));

        const particles = [...Array(20)].map((_, i) => ({
            key: `particle-${i}`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 15}s`,
            animationDuration: `${10 + Math.random() * 10}s`,
        }));

        return { hearts, stars, particles };
    }, []);

    const mediaById = React.useMemo(() => new Map(media.map((m) => [m._id, m])), [media]);

    const fetchCategories = async () => {
        try {
            const res = await axios.get(`${API_URL}/categories`);
            setCategories(res.data);
        } catch (err) {
            toast.error("Không thể tải danh mục!");
        }
    };

    const fetchSlideshow = async () => {
        try {
            const res = await axios.get(`${API_URL}/slideshow`);
            setSlideshowItems(res.data.items || []);
        } catch (err) {
            toast.error("Không thể tải slideshow!");
        }
    };

    const fetchAudioUrl = async () => {
        try {
            const res = await axios.get(`${API_URL}/settings/audio`);
            if (res.data.list && res.data.list.length > 0) {
                setBgAudioList(res.data.list);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const addToSlideshow = async (mediaId) => {
        try {
            await axios.post(`${API_URL}/slideshow/items`, { mediaId }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            await fetchSlideshow();
            toast.success("Đã thêm ảnh vào slideshow!");
        } catch (err) {
            toast.error(err.response?.data?.message || "Không thể thêm vào slideshow!");
        }
    };

    const removeFromSlideshow = async (mediaId) => {
        try {
            await axios.delete(`${API_URL}/slideshow/items/${mediaId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            await fetchSlideshow();
            toast.success("Đã xóa khỏi slideshow!");
        } catch (err) {
            toast.error("Không thể xóa khỏi slideshow!");
        }
    };

    const reorderSlideshow = async (itemIds) => {
        try {
            await axios.put(`${API_URL}/slideshow/items/reorder`, { itemIds }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            await fetchSlideshow();
            toast.success("Đã cập nhật thứ tự!");
        } catch (err) {
            toast.error("Không thể sắp xếp slideshow!");
        }
    };

    // Register service worker
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('SW registered'))
                .catch(error => console.log('SW registration failed'));
        }
    }, []);

    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                window.innerWidth <= 640;
            setIsMobile(isMobileDevice);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        fetchMedia();
        fetchCategories();
        fetchSlideshow();
        fetchAudioUrl();
        // Check if admin token exists in localStorage
        const token = localStorage.getItem('adminToken');
        if (token === 'huy&y2026') {
            setIsAdmin(true);
        }
    }, []);

    // Slideshow auto-advance every 5s (for regular slideshow)
    useEffect(() => {
        if (slideshowItems.length <= 1 || showSlideshowFullscreen) return; // Don't auto-advance when fullscreen is open
        const t = setInterval(() => {
            setSlideshowIndex((i) => (i + 1) % slideshowItems.length);
        }, 5000);
        return () => clearInterval(t);
    }, [slideshowItems.length, showSlideshowFullscreen]);

    // Fullscreen auto-play functionality
    useEffect(() => {
        if (!isAutoPlaying || slideshowItems.length <= 1 || !showSlideshowFullscreen) return;

        const t = setInterval(() => {
            setSlideshowIndex((i) => (i + 1) % slideshowItems.length);
        }, 4000); // 4 seconds for fullscreen auto-play

        return () => clearInterval(t);
    }, [isAutoPlaying, slideshowItems.length, showSlideshowFullscreen]);

    // Handle fullscreen change events
    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                // User exited fullscreen using ESC key or browser UI
                setShowSlideshowFullscreen(false);
                setIsAutoPlaying(false);
                setShowControls(true); // Show controls when exiting fullscreen
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showSlideshowFullscreen) {
                closeFullscreenSlideshow();
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showSlideshowFullscreen]);

    // Auto-hide controls in fullscreen mode
    useEffect(() => {
        if (!showSlideshowFullscreen) return;

        let hideTimer;

        const showControlsTemporarily = () => {
            setShowControls(true);

            // Clear existing timer
            if (hideTimer) clearTimeout(hideTimer);

            // Hide controls after 3 seconds of inactivity
            hideTimer = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        };

        const handleMouseMove = () => {
            showControlsTemporarily();
        };

        const handleMouseEnter = () => {
            showControlsTemporarily();
        };

        // Show controls initially when entering fullscreen
        showControlsTemporarily();

        // Add event listeners to the fullscreen element
        const fullscreenElement = document.querySelector('.slideshow-fullscreen');
        if (fullscreenElement) {
            fullscreenElement.addEventListener('mousemove', handleMouseMove);
            fullscreenElement.addEventListener('mouseenter', handleMouseEnter);
        }

        return () => {
            if (hideTimer) clearTimeout(hideTimer);
            if (fullscreenElement) {
                fullscreenElement.removeEventListener('mousemove', handleMouseMove);
                fullscreenElement.removeEventListener('mouseenter', handleMouseEnter);
            }
        };
    }, [showSlideshowFullscreen]);

    useEffect(() => {
        if (slideshowItems.length > 0 && slideshowIndex >= slideshowItems.length) {
            setSlideshowIndex(0);
        }
    }, [slideshowItems.length, slideshowIndex]);

    const fetchMedia = async (page = 1, direction = null) => {
        try {
            if (direction) setIsPageTransitioning(direction);
            const params = new URLSearchParams();
            
            if (filterCategory === 'yêu thích') {
                if (likedPhotos.length === 0) {
                    setMedia([]);
                    setPagination({ currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 20, hasNextPage: false, hasPrevPage: false });
                    setIsPageTransitioning(null);
                    return;
                }
                params.append('ids', likedPhotos.join(','));
            } else {
                if (filterType !== 'tất cả') params.append('type', filterType);
                if (filterCategory !== 'tất cả') params.append('category', filterCategory);
            }
            
            params.append('page', page);
            params.append('limit', 20);

            const res = await axios.get(`${API_URL}/media?${params}`);
            
            const mediaItems = res.data.media;
            // Preload ONLY the first 6 images (viewport) to reduce lag. 
            // The rest will load lazily when the user scrolls down.
            await Promise.all(mediaItems.slice(0, 6).map(item => {
                if (item.type === 'video') return Promise.resolve();
                return new Promise((resolve) => {
                    const img = new Image();
                    img.src = item.thumbUrl || item.url;
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            }));

            setMedia(mediaItems);
            setPagination(res.data.pagination);
            
            if (direction) {
                setTimeout(() => {
                    const galleryEl = document.getElementById('gallery-section');
                    if (galleryEl) {
                        const y = galleryEl.getBoundingClientRect().top + window.scrollY - 80;
                        window.scrollTo({ top: y, behavior: 'auto' });
                    }
                }, 50);
            }
        } catch (err) {
            toast.error("Không thể tải media!");
        } finally {
            setIsPageTransitioning(null);
        }
    };

    useEffect(() => {
        fetchMedia(1); // Reset to first page when filters change
    }, [filterType, filterCategory]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showCategoryDropdown && !event.target.closest('.category-dropdown')) {
                setShowCategoryDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCategoryDropdown]);

    const compressImage = async (file) => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions (max 1920px for width/height)
                const MAX_WIDTH = 1920;
                const MAX_HEIGHT = 1920;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress image
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.8); // 80% quality
            };

            img.src = URL.createObjectURL(file);
        });
    };

    const handleMultipleUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files || files.length === 0) return;

        setLoading(true);
        setMultipleFiles(files);

        try {
            const uploadPromises = files.map(async (file, index) => {
                let processedFile = file;

                // Only compress images, not videos
                if (file.type.startsWith('image/')) {
                    processedFile = await compressImage(file);
                }

                const formData = new FormData();
                formData.append('media', processedFile, file.name);
                formData.append('category', selectedCategory);

                return axios.post(`${API_URL}/upload`, formData, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'multipart/form-data'
                    },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        setUploadProgress(Math.round((index * 100 + percentCompleted) / files.length));
                    }
                });
            });

            await Promise.all(uploadPromises);

            toast.success(`Đã tải thành công ${files.length} media!`);
            fetchMedia(1); // Reset to first page after upload
        } catch (err) {
            toast.error("Tải media thất bại! Bạn cần quyền admin.");
            console.error(err);
        } finally {
            setLoading(false);
            setUploadProgress(0);
            setMultipleFiles([]);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);

        try {
            let processedFile = file;

            // Only compress images, not videos
            if (file.type.startsWith('image/')) {
                processedFile = await compressImage(file);
            }

            const formData = new FormData();
            formData.append('media', processedFile, file.name);
            formData.append('category', selectedCategory);

            await axios.post(`${API_URL}/upload`, formData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'multipart/form-data'
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setUploadProgress(percentCompleted);
                }
            });

            toast.success("Tải media thành công!");
            fetchMedia(1); // Reset to first page after upload
        } catch (err) {
            toast.error("Tải media thất bại! Bạn cần quyền admin.");
            console.error(err);
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    const handleAudioUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setAudioUploading(true);

        try {
            const formData = new FormData();
            formData.append('audio', file);

            const res = await axios.post(`${API_URL}/settings/audio`, formData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.list) {
                setBgAudioList(res.data.list);
            }
            toast.success("Tải nhạc nền thành công!");
        } catch (err) {
            toast.error("Tải nhạc nền thất bại! File phải là âm thanh.");
            console.error(err);
        } finally {
            setAudioUploading(false);
        }
    };

    const handleDeleteAudio = async (audioId) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa bài hát này?")) return;

        try {
            const res = await axios.delete(`${API_URL}/settings/audio/${audioId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            if (res.data.list) {
                setBgAudioList(res.data.list);
                // Adjust index if out of bounds
                if (currentAudioIndex >= res.data.list.length) {
                    setCurrentAudioIndex(0);
                }
            }
            toast.success("Xóa bài hát thành công!");
        } catch (err) {
            toast.error("Xóa bài hát thất bại!");
            console.error(err);
        }
    };

    const handleAudioEnded = () => {
        if (bgAudioList.length <= 1) {
            if (audioRef.current && isPlayingAudio) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.log(e));
            }
            return;
        }
        setCurrentAudioIndex((prev) => {
            const nextIdx = (prev + 1) % bgAudioList.length;
            setTimeout(() => {
                if (audioRef.current && isPlayingAudio) {
                    audioRef.current.play().catch(e => console.log(e));
                }
            }, 50);
            return nextIdx;
        });
    };

    const handleLike = async (id) => {
        if (likingPhotoId === id) return;

        setLikingPhotoId(id);
        
        // Trigger heart animation
        setShowLikeEffectId(id);
        setTimeout(() => {
            setShowLikeEffectId(prev => prev === id ? null : prev);
        }, 1000);

        const previousMedia = [...media];
        setMedia(media.map(m =>
            m._id === id ? { ...m, likes: m.likes + 1 } : m
        ));

        try {
            const res = await axios.patch(`${API_URL}/media/${id}/like`);
            setMedia(prev => prev.map(m =>
                m._id === id ? res.data : m
            ));
            
            // Save to localStorage
            setLikedPhotos(prev => {
                const newLiked = prev.includes(id) ? prev : [...prev, id];
                localStorage.setItem('likedPhotos', JSON.stringify(newLiked));
                return newLiked;
            });
            
            setLikingPhotoId(null);
        } catch (err) {
            setMedia(previousMedia);
            toast.error("Không thể thả tim, vui lòng thử lại!");
            console.error(err);
            setLikingPhotoId(null);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa media này?")) {
            return;
        }

        try {
            await axios.delete(`${API_URL}/media/${id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });
            toast.success("Đã xóa media thành công!");
            setMedia(media.filter(m => m._id !== id));
        } catch (err) {
            toast.error("Xóa media thất bại! Bạn cần quyền admin.");
            console.error(err);
        }
    };

    const handleEditCategory = async (photoId) => {
        if (!newCategoryForPhoto.trim()) {
            toast.error('Vui lòng chọn danh mục!');
            return;
        }

        try {
            const res = await axios.patch(`${API_URL}/media/${photoId}/category`,
                { category: newCategoryForPhoto.trim() },
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    }
                }
            );

            setMedia(media.map(m => m._id === photoId ? res.data : m));
            setEditingPhoto(null);
            setNewCategoryForPhoto('');
            toast.success('Đã cập nhật danh mục!');
        } catch (err) {
            if (err.response?.status === 400) {
                toast.error(err.response.data.message || 'Danh mục không tồn tại!');
            } else {
                toast.error('Không thể cập nhật danh mục! Bạn cần quyền admin.');
            }
            console.error(err);
        }
    };

    const handleLogin = () => {
        if (adminPassword === 'huy&y2026') {
            setIsAdmin(true);
            localStorage.setItem('adminToken', 'huy&y2026');
            setShowLogin(false);
            setAdminPassword('');
            toast.success("Đăng nhập thành công!");
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

    const handleAddCategory = async () => {
        if (!newCategory.trim()) {
            toast.error('Vui lòng nhập tên danh mục!');
            return;
        }

        try {
            const res = await axios.post(`${API_URL}/categories`,
                { category: newCategory.trim() },
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                    }
                }
            );

            setCategories(res.data);
            setSelectedCategory(newCategory.trim());
            setNewCategory('');
            setShowAddCategory(false);
            toast.success('Đã thêm danh mục mới!');
        } catch (err) {
            if (err.response?.status === 400) {
                toast.error(err.response.data.message || 'Danh mục đã tồn tại!');
            } else {
                toast.error('Không thể thêm danh mục! Bạn cần quyền admin.');
            }
            console.error(err);
        }
    };

    const downloadPhoto = async (photoUrl, photoId, category) => {
        try {
            // Fetch the image as a blob
            const response = await fetch(photoUrl);
            const blob = await response.blob();

            // Create a blob URL
            const blobUrl = URL.createObjectURL(blob);

            // Create a temporary link element
            const link = document.createElement('a');
            link.href = blobUrl;

            // Generate filename based on category and ID
            const categoryName = category.replace('ảnh ', '').replace(/ /g, '_');
            const filename = `wedding_${categoryName}_${photoId}.jpg`;

            link.download = filename;
            link.target = '_blank';

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the blob URL
            URL.revokeObjectURL(blobUrl);

            toast.success("Đã tải ảnh thành công!");
        } catch (err) {
            toast.error("Không thể tải ảnh!");
            console.error(err);
        }
    };

    // Auto-play slideshow functions
    const startAutoPlaySlideshow = () => {
        setIsAutoPlaying(true);
        setShowSlideshowFullscreen(true);
        setSlideshowIndex(0); // Start from beginning

        // Request fullscreen after a short delay
        setTimeout(() => {
            const slideshowElement = document.querySelector('.slideshow-fullscreen');
            if (slideshowElement && slideshowElement.requestFullscreen) {
                slideshowElement.requestFullscreen();
            } else if (slideshowElement && slideshowElement.webkitRequestFullscreen) {
                slideshowElement.webkitRequestFullscreen();
            } else if (slideshowElement && slideshowElement.msRequestFullscreen) {
                slideshowElement.msRequestFullscreen();
            }
        }, 100);
    };

    const toggleAutoPlay = () => {
        setIsAutoPlaying(!isAutoPlaying);
    };

    const closeFullscreenSlideshow = () => {
        // Exit fullscreen if in fullscreen mode
        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }

        setShowSlideshowFullscreen(false);
        setIsAutoPlaying(false);
    };

    const currentAudioUrl = bgAudioList.length > 0 ? bgAudioList[currentAudioIndex]?.url || '' : '';

    const handleCommentSubmit = async (e, mediaId) => {
        e.preventDefault();
        e.stopPropagation();
        if (!commentName.trim() || !commentContent.trim()) {
            toast.error("Vui lòng nhập đầy đủ tên và lời bình luận!");
            return;
        }
        setIsSubmittingComment(true);
        try {
            const res = await axios.post(`${API_URL}/media/${mediaId}/comment`, {
                name: commentName,
                content: commentContent
            });
            // Update media list
            setMedia(prev => prev.map(m => m._id === mediaId ? res.data : m));
            setCommentContent('');
            toast.success("Đã gửi lời bình luận!");
        } catch (error) {
            toast.error("Lỗi khi gửi bình luận!");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (e, mediaId, commentId) => {
        e.stopPropagation();
        if(!window.confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;
        try {
            const res = await axios.delete(`${API_URL}/media/${mediaId}/comment/${commentId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
            });
            setMedia(prev => prev.map(m => m._id === mediaId ? res.data : m));
            toast.success("Đã xóa bình luận!");
        } catch(error) {
            toast.error("Lỗi xóa bình luận");
        }
    };

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Enhanced Floating Background - Disabled on Mobile */}
            {!isMobile && (
                <>
                    <div className="floating-hearts">
                        {floatingDecor.hearts.map((h) => (
                            <Heart
                                key={h.key}
                                size={h.size}
                                className="heart"
                                style={{
                                    left: h.left,
                                    animationDelay: h.animationDelay,
                                    animationDuration: h.animationDuration
                                }}
                            />
                        ))}
                        {floatingDecor.stars.map((s) => (
                            <Star
                                key={s.key}
                                size={s.size}
                                className="heart sparkle"
                                style={{
                                    left: s.left,
                                    animationDuration: s.animationDuration,
                                    color: s.color
                                }}
                            />
                        ))}
                    </div>

                    {/* Floating Particles */}
                    <div className="floating-particles">
                        {floatingDecor.particles.map((p) => (
                            <div
                                key={p.key}
                                className="particle"
                                style={{
                                    left: p.left,
                                    animationDelay: p.animationDelay,
                                    animationDuration: p.animationDuration
                                }}
                            />
                        ))}
                    </div>
                </>
            )}

            <Toaster position="top-center" />
            <header className="relative h-[60vh] sm:h-[70vh] flex flex-col items-center justify-center wedding-gradient text-white overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute inset-0">
                    <div className="absolute top-10 left-10 text-wedding-gold-300 animate-float floating">
                        <div>
                            <Star size={30} fill="currentColor" className="sparkle" />
                        </div>
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

                {/* Top Right Controls (Dark Mode & Admin) */}
                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-2 sm:gap-4">
                    {/* Dark Mode Toggle */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-all duration-200 border border-white/20"
                        title={isDarkMode ? "Chế độ sáng" : "Chế độ tối"}
                    >
                        {isDarkMode ? <Sun size={20} className="sm:size-24" /> : <Moon size={20} className="sm:size-24" />}
                    </motion.button>

                    {/* Admin Login/Logout Button */}
                    {isAdmin ? (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleLogout}
                            className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 sm:px-6 sm:py-3 rounded-full text-white hover:bg-white/30 transition-all duration-200 border border-white/20"
                        >
                            <LogOut size={16} className="sm:size-18" />
                            <span className="text-xs sm:text-sm font-medium hidden sm:inline">Đăng xuất</span>
                        </motion.button>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowLogin(true)}
                            className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 sm:px-6 sm:py-3 rounded-full text-white hover:bg-white/30 transition-all duration-200 border border-white/20"
                        >
                            <LogIn size={16} className="sm:size-18" />
                            <span className="text-xs sm:text-sm font-medium hidden sm:inline">Admin</span>
                        </motion.button>
                    )}
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="z-10 text-center px-8 py-10 md:px-16 md:py-12 rounded-[2.5rem] bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] relative"
                >
                    <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <div className="relative">
                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-playfair font-black mb-4 sm:mb-6 tracking-tight drop-shadow-md">
                            <span className="shimmer-text text-white">Wedding</span>
                            <span className="gold-accent drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]"> Gallery</span>
                        </h1>
                        <div className="absolute -top-6 -right-10 text-wedding-gold-400 animate-pulse-slow drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                            <Sparkles size={32} fill="currentColor" className="sparkle" />
                        </div>
                    </div>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-dancing font-bold mb-6 sm:mb-8 gold-accent drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)] tracking-wide relative z-10"
                    >
                        Nhật Huy & Thiên Ý
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
                        className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-wedding-blue-100 font-light px-4"
                    >
                        Cùng nhau lưu giữ những khoảnh khắc đẹp nhất
                    </motion.p>
                </motion.div>

                {/* Enhanced Decorative Background */}
                <div className="absolute top-[-10%] left-[-5%] w-80 h-80 bg-wedding-gold-300/10 rounded-full blur-3xl animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-wedding-blue-400/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />
            </header>

            {/* Welcome Letter Modal */}
            <AnimatePresence>
                {showWelcomeLetter && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[2000] p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 50 }}
                            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="wedding-card rounded-3xl p-8 sm:p-12 max-w-lg w-full border border-wedding-gold-200/50 relative overflow-hidden bg-white/95 dark:bg-slate-900/95 shadow-2xl"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-wedding-gold-300 via-wedding-gold-500 to-wedding-gold-300" />
                            
                            <div className="text-center relative z-10">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-wedding-gold-50 dark:bg-slate-800 rounded-full mb-6 relative">
                                    <div className="absolute inset-0 border-2 border-wedding-gold-200 rounded-full animate-[spin_10s_linear_infinite]" />
                                    <Flower size={36} className="text-wedding-gold-500" />
                                </div>
                                
                                <h3 className="text-3xl sm:text-4xl font-playfair font-bold text-wedding-blue-900 dark:text-wedding-blue-50 mb-4 tracking-tight drop-shadow-sm">
                                    <span className="gold-accent">Thư Cảm Ơn</span>
                                </h3>
                                
                                <div className="space-y-4 mb-8">
                                    <p className="text-wedding-blue-800 dark:text-wedding-blue-200 font-semibold mb-2">
                                        Gửi những người thương yêu của chúng mình,
                                    </p>
                                    <p className="text-sm sm:text-base text-wedding-blue-700/80 dark:text-wedding-blue-200/80 leading-relaxed mb-2">
                                        Từ tận đáy lòng, Nhật Huy và Thiên Ý xin gửi lời cảm ơn chân thành và sâu sắc nhất đến mọi người vì đã dành thời gian quý báu đến chung vui trong ngày trọng đại. 
                                        Sự hiện diện cùng những lời chúc phúc tốt đẹp của mọi người chính là món quà vô giá, đánh dấu một khởi đầu viên mãn cho chặng đường mới của chúng mình.
                                    </p>
                                    <p className="text-sm sm:text-base text-wedding-blue-700/80 dark:text-wedding-blue-200/80 leading-relaxed">
                                        Thư viện ảnh này là nơi lưu giữ lại những khoảnh khắc tuyệt vời nhất của đám cưới. Mời mọi người cùng nhìn ngắm, tải về và chia sẻ những kỷ niệm vô giá này nhé!
                                    </p>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={closeWelcomeLetter}
                                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-wedding-gold-400 to-wedding-gold-600 text-white rounded-full font-bold shadow-lg hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] transition-all duration-300"
                                >
                                    <Heart size={18} fill="currentColor" className="animate-pulse" />
                                    Mở thư viện ảnh
                                </motion.button>
                            </div>

                            <div className="absolute -top-4 -left-4 text-wedding-gold-300/30">
                                <Sparkles size={64} className="animate-pulse-slow" />
                            </div>
                            <div className="absolute -bottom-4 -right-4 text-wedding-gold-300/30">
                                <Sparkles size={64} className="animate-pulse-slow" />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Admin Login Modal */}
            {
                showLogin && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="wedding-card rounded-3xl p-10 max-w-md w-full border border-wedding-blue-200"
                        >
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-wedding-blue-100 dark:bg-slate-800 rounded-full mb-4">
                                    <LogIn size={28} className="text-wedding-blue-600 dark:text-wedding-blue-400" />
                                </div>
                                <h3 className="text-3xl font-playfair font-bold text-wedding-blue-900 dark:text-wedding-blue-50 mb-2">
                                    Đăng nhập Admin
                                </h3>
                                <p className="text-wedding-blue-600 dark:text-wedding-blue-300">
                                    Nhập mật khẩu để quản lý thư viện
                                </p>
                            </div>

                            <input
                                type="password"
                                placeholder="Nhập mật khẩu admin"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                className="w-full px-4 py-3 sm:px-6 sm:py-4 border-2 border-wedding-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-2xl mb-6 focus:outline-none focus:ring-2 focus:ring-wedding-blue-500 focus:border-wedding-blue-500 text-base sm:text-lg transition-all"
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
                )
            }

            {/* Add Category Modal */}
            {
                showAddCategory && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="wedding-card rounded-3xl p-8 max-w-md w-full border border-wedding-blue-200"
                        >
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-wedding-blue-100 dark:bg-slate-800 rounded-full mb-4">
                                    <Plus size={28} className="text-wedding-blue-600 dark:text-wedding-blue-400" />
                                </div>
                                <h3 className="text-2xl font-playfair font-bold text-wedding-blue-900 dark:text-wedding-blue-50 mb-2">
                                    Thêm danh mục mới
                                </h3>
                                <p className="text-wedding-blue-600 dark:text-wedding-blue-300">
                                    Tạo danh mục media mới cho gallery
                                </p>
                            </div>

                            <input
                                type="text"
                                placeholder="Nhập tên danh mục mới"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-wedding-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white rounded-2xl mb-6 focus:outline-none focus:ring-2 focus:ring-wedding-blue-500 focus:border-wedding-blue-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                            />

                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleAddCategory}
                                    disabled={!newCategory.trim()}
                                    className="flex-1 btn-primary disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    Thêm danh mục
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        setShowAddCategory(false);
                                        setNewCategory('');
                                    }}
                                    className="flex-1 btn-secondary"
                                >
                                    Hủy
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )
            }
            {
                showQRCode && (
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
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-wedding-blue-100 dark:bg-slate-800 rounded-full mb-6 animate-pulse-slow pulse-glow">
                                    <Share2 size={36} className="text-wedding-blue-600 dark:text-wedding-blue-400" />
                                </div>
                                <h3 className="text-3xl font-playfair font-bold text-wedding-blue-900 dark:text-wedding-blue-50 mb-2">
                                    Chia sẻ <span className="gold-accent">Gallery</span>
                                </h3>
                                <p className="text-wedding-blue-600 dark:text-wedding-blue-300">
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
                )
            }

            {/* Edit Category Modal */}
            {
                editingPhoto && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="wedding-card rounded-3xl p-8 max-w-md w-full border border-wedding-blue-200"
                        >
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-wedding-blue-100 rounded-full mb-4">
                                    <Plus size={28} className="text-wedding-blue-600" />
                                </div>
                                <h3 className="text-2xl font-playfair font-bold text-wedding-blue-900 mb-2">
                                    Sửa danh mục ảnh
                                </h3>
                                <p className="text-wedding-blue-600">
                                    Chọn danh mục mới cho ảnh này
                                </p>
                            </div>

                            <div className="mb-6">
                                <label className="block text-wedding-blue-800 font-semibold mb-3">
                                    Chọn danh mục:
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {categories.map((category) => (
                                        <motion.button
                                            key={category}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setNewCategoryForPhoto(category)}
                                            className={`w-full px-4 py-3 rounded-xl font-medium transition-all duration-300 text-left ${newCategoryForPhoto === category
                                                ? 'wedding-gradient text-white shadow-wedding-lg'
                                                : 'bg-wedding-blue-50 text-wedding-blue-700 hover:bg-wedding-blue-100 border-2 border-wedding-blue-200'
                                                }`}
                                        >
                                            {category}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleEditCategory(editingPhoto._id)}
                                    disabled={!newCategoryForPhoto.trim()}
                                    className="flex-1 btn-primary disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    Cập nhật
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                        setEditingPhoto(null);
                                        setNewCategoryForPhoto('');
                                    }}
                                    className="flex-1 btn-secondary"
                                >
                                    Hủy
                                </motion.button>
                            </div>
                        </motion.div>
                    </div>
                )
            }

            {/* Upload Section - Admin Only */}
            {
                isAdmin && (
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
                                <p className="text-wedding-blue-600 font-dancing text-xl sm:text-2xl md:text-3xl">
                                    Quản lý khoảnh khắc đẹp nhất của đám cưới
                                </p>
                            </div>

                            {/* Category Selection with Dynamic Categories */}
                            <div className="mb-8 flex flex-col items-center">
                                <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
                                    <label className="text-wedding-blue-800 font-semibold text-lg">
                                        Chọn danh mục media:
                                    </label>
                                    {isAdmin && (
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setShowAddCategory(true)}
                                            className="flex items-center gap-2 bg-wedding-gold-500 text-white px-3 py-1.5 rounded-full text-sm hover:bg-wedding-gold-600 transition-all shadow-sm"
                                        >
                                            <Plus size={14} />
                                            <span>Thêm danh mục</span>
                                        </motion.button>
                                    )}
                                </div>
                                <div className="flex justify-center gap-3 flex-wrap">
                                    {categories.map((category) => {
                                        const isSelected = selectedCategory === category;
                                        const canDelete = isAdmin && category !== 'ảnh check-in' && category !== 'ảnh từng bàn' && category !== 'Videos';
                                        
                                        return (
                                            <div key={category} className="relative inline-block category-dropdown">
                                                <div
                                                    className={`flex items-center rounded-full transition-all duration-300 ${isSelected
                                                        ? 'wedding-gradient text-white shadow-wedding-lg'
                                                        : 'bg-wedding-blue-100 text-wedding-blue-700 hover:bg-wedding-blue-200 border-2 border-wedding-blue-200'
                                                        }`}
                                                >
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => setSelectedCategory(category)}
                                                        className={`px-4 py-2 font-semibold outline-none ${canDelete ? 'pr-2' : ''}`}
                                                    >
                                                        {category}
                                                    </motion.button>
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => setShowCategoryDropdown(showCategoryDropdown === category ? null : category)}
                                                            className={`pr-3 pl-1 outline-none transition-colors ${isSelected ? 'text-white hover:text-gray-200' : 'text-wedding-blue-500 hover:text-wedding-blue-800'}`}
                                                            title="Tùy chọn"
                                                        >
                                                            <MoreVertical size={14} />
                                                        </button>
                                                    )}
                                                </div>

                                                <AnimatePresence>
                                                    {showCategoryDropdown === category && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                            transition={{ duration: 0.15 }}
                                                            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-lg shadow-lg border border-wedding-blue-200 py-1 z-50 min-w-[140px]"
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    setShowCategoryDropdown(null);
                                                                    if (window.confirm(`Bạn có chắc chắn muốn xóa danh mục "${category}"?`)) {
                                                                        axios.delete(`${API_URL}/categories/${encodeURIComponent(category)}`, {
                                                                            headers: {
                                                                                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                                                                            }
                                                                        })
                                                                            .then(res => {
                                                                                setCategories(res.data);
                                                                                if (selectedCategory === category) {
                                                                                    setSelectedCategory('ảnh check-in');
                                                                                }
                                                                                if (filterCategory === category) {
                                                                                    setFilterCategory('tất cả');
                                                                                }
                                                                                toast.success('Đã xóa danh mục thành công!');
                                                                            })
                                                                            .catch(err => {
                                                                                if (err.response?.status === 400) {
                                                                                    toast.error(err.response.data.message || 'Không thể xóa danh mục này!');
                                                                                } else {
                                                                                    toast.error('Xóa danh mục thất bại! Bạn cần quyền admin.');
                                                                                }
                                                                            });
                                                                    }
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                                Xóa danh mục
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="mt-4 text-sm text-wedding-blue-600">
                                    Đã chọn: <span className="font-semibold text-wedding-blue-800">{selectedCategory}</span>
                                </p>
                            </div>

                            <motion.label
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`
                inline-flex items-center gap-2 sm:gap-3 px-6 py-4 sm:px-10 sm:py-5 rounded-full font-bold text-base sm:text-lg transition-all cursor-pointer shadow-wedding-lg
                ${loading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'wedding-gradient text-white hover:shadow-wedding-lg active:scale-95 border-2 border-wedding-blue-300'
                                    }
              `}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={28} />
                                        <span>Đang gửi media...</span>
                                    </>
                                ) : (
                                    <>
                                        <Camera size={28} />
                                        <span>Tải media lên ngay</span>
                                        <Sparkles size={20} className="animate-pulse sparkle" />
                                    </>
                                )}
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleUpload}
                                    disabled={loading}
                                    accept="image/*,video/*"
                                />
                            </motion.label>

                            {/* Multiple Upload Button */}
                            <motion.label
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`
                inline-flex items-center gap-2 sm:gap-3 px-6 py-4 sm:px-10 sm:py-5 rounded-full font-bold text-base sm:text-lg transition-all cursor-pointer shadow-wedding-lg mt-4
                ${loading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-wedding-gold-500 text-white hover:bg-wedding-gold-600 active:scale-95 border-2 border-wedding-gold-300'
                                    }
              `}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={28} />
                                        <span>Đang xử lý nhiều media...</span>
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon size={28} />
                                        <span>Tải nhiều media</span>
                                        <Sparkles size={20} className="animate-pulse sparkle" />
                                    </>
                                )}
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleMultipleUpload}
                                    disabled={loading}
                                    accept="image/*,video/*"
                                    multiple
                                />
                            </motion.label>

                            {/* Upload Progress Bar */}
                            {loading && uploadProgress > 0 && (
                                <div className="mt-6 max-w-md mx-auto">
                                    <div className="flex justify-between text-sm text-wedding-blue-600 mb-2">
                                        <span>Đang gửi media...</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-wedding-blue-100 rounded-full h-3 overflow-hidden">
                                        <motion.div
                                            className="h-full wedding-gradient rounded-full transition-all duration-300 ease-out"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${uploadProgress}%` }}
                                            style={{ minWidth: '2%' }}
                                        />
                                    </div>
                                </div>
                            )}

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
                )
            }

            {/* Admin Slideshow Manager */}
            {isAdmin && (
                <section className="max-w-5xl mx-auto px-4 mt-8 relative z-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="wedding-card rounded-3xl shadow-wedding-lg p-6 sm:p-8"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-wedding-blue-100 flex items-center justify-center">
                                    <Film size={24} className="text-wedding-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-playfair font-bold text-wedding-blue-900">
                                        Slideshow cưới
                                    </h2>
                                    <p className="text-sm text-wedding-blue-600">
                                        Chọn ảnh từ gallery để tạo slideshow phát tại tiệc
                                    </p>
                                </div>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={async () => {
                                    setShowAddToSlideshowPicker(true);
                                    setSlideshowLoading(true);
                                    try {
                                        const res = await axios.get(`${API_URL}/media?type=image&limit=100`);
                                        setAllImagesForPicker(res.data.media || []);
                                    } catch {
                                        toast.error("Không tải được danh sách ảnh");
                                    }
                                    setSlideshowLoading(false);
                                }}
                                className="inline-flex items-center gap-2 wedding-gradient text-white px-4 py-2 rounded-full font-semibold shadow-lg"
                            >
                                <Plus size={18} />
                                Thêm ảnh vào slideshow
                            </motion.button>
                        </div>

                        {slideshowItems.length === 0 ? (
                            <div className="text-center py-8 rounded-2xl bg-wedding-blue-50/50 border-2 border-dashed border-wedding-blue-200">
                                <Film size={40} className="mx-auto text-wedding-blue-400 mb-2" />
                                <p className="text-wedding-blue-700 font-medium">Chưa có ảnh nào trong slideshow</p>
                                <p className="text-sm text-wedding-blue-600 mt-1">Bấm &quot;Thêm ảnh vào slideshow&quot; để chọn ảnh từ gallery</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {slideshowItems.map((item, idx) => (
                                    <div
                                        key={item._id}
                                        className="group relative aspect-square rounded-xl overflow-hidden border-2 border-wedding-blue-200 bg-wedding-blue-50"
                                    >
                                        <img
                                            src={item.thumbUrl || item.url}
                                            alt={item.category}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <span className="text-white text-sm font-medium">#{idx + 1}</span>
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={() => removeFromSlideshow(item._id)}
                                                className="p-2 bg-red-500 rounded-full text-white"
                                                title="Xóa khỏi slideshow"
                                            >
                                                <Trash2 size={16} />
                                            </motion.button>
                                            {idx > 0 && (
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => {
                                                        const ids = slideshowItems.map((i) => i._id);
                                                        [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                                                        reorderSlideshow(ids);
                                                    }}
                                                    className="p-2 bg-white/80 rounded-full text-wedding-blue-800"
                                                    title="Lên trước"
                                                >
                                                    <ChevronLeft size={16} />
                                                </motion.button>
                                            )}
                                            {idx < slideshowItems.length - 1 && (
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => {
                                                        const ids = slideshowItems.map((i) => i._id);
                                                        [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                                                        reorderSlideshow(ids);
                                                    }}
                                                    className="p-2 bg-white/80 rounded-full text-wedding-blue-800"
                                                    title="Xuống sau"
                                                >
                                                    <ChevronRight size={16} />
                                                </motion.button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </section>
            )}

            {/* Admin Audio Player */}
            {isAdmin && (
                <section className="max-w-5xl mx-auto px-4 mt-8 relative z-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="wedding-card rounded-3xl shadow-wedding-lg p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-wedding-blue-100 flex items-center justify-center shrink-0">
                                <Music size={24} className="text-wedding-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-playfair font-bold text-wedding-blue-900 mb-1">
                                    Danh sách nhạc nền (Admin)
                                </h2>
                                <p className="text-sm text-wedding-blue-600">
                                    Upload các file nhạc (MP3, WAV) để phát tự động theo thứ tự
                                </p>
                            </div>
                        </div>
                        <div className="w-full sm:w-auto flex flex-col items-center gap-4">
                            <div className="flex flex-col gap-2 w-full max-h-40 overflow-y-auto pr-2">
                                {bgAudioList.map((audioItem, idx) => (
                                    <div key={audioItem.id} className={`flex items-center justify-between p-2 rounded-lg border ${idx === currentAudioIndex ? 'bg-wedding-blue-100 border-wedding-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                                        <div
                                            className="text-sm font-medium text-wedding-blue-800 truncate cursor-pointer flex-1"
                                            onClick={() => {
                                                setCurrentAudioIndex(idx);
                                                setIsPlayingAudio(true);
                                                if (audioRef.current) {
                                                    setTimeout(() => audioRef.current?.play().catch(e => console.log(e)), 50);
                                                }
                                            }}
                                            title="Phát bài này"
                                        >
                                            {idx === currentAudioIndex && <Music size={12} className={`inline mr-1 text-wedding-blue-600 ${isPlayingAudio ? 'animate-[spin_2s_linear_infinite]' : ''}`} />}
                                            {audioItem.name || 'Audio file'}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteAudio(audioItem.id)}
                                            className="ml-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-full transition-colors"
                                            title="Xóa bài hát"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {bgAudioList.length === 0 && (
                                    <div className="text-sm text-gray-500 text-center italic">Chưa có bài hát nào</div>
                                )}
                            </div>
                            <label className={`
                                inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full font-bold text-sm sm:text-base transition-all cursor-pointer shadow-md
                                ${audioUploading
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'wedding-gradient text-white hover:shadow-lg active:scale-95 border border-wedding-blue-300'
                                }
                            `}>
                                {audioUploading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} />
                                        <span>Đang tải...</span>
                                    </>
                                ) : (
                                    <>
                                        <Music size={18} />
                                        <span>Tải nhạc lên</span>
                                    </>
                                )}
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleAudioUpload}
                                    disabled={audioUploading}
                                    accept="audio/mpeg, audio/mp3, audio/wav"
                                />
                            </label>
                        </div>
                    </motion.div>
                </section>
            )}

            {/* Image Zoom Modal */}
            {
                zoomedImage && (() => {
                    const currentIndex = media.findIndex(m => m._id === zoomedImage._id);
                    const prevMedia = media.length > 1 ? media[(currentIndex - 1 + media.length) % media.length] : null;
                    const nextMedia = media.length > 1 ? media[(currentIndex + 1) % media.length] : null;
                    
                    return (
                        <div
                            className="fixed inset-0 bg-black/100 md:bg-black/90 md:backdrop-blur-sm md:flex md:items-center md:justify-center z-[5000] p-0 md:p-6 overflow-y-auto md:overflow-hidden"
                            onClick={() => setZoomedImage(null)}
                        >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="relative max-w-[1400px] w-full md:h-full flex flex-col md:flex-row bg-transparent md:bg-black md:rounded-2xl shadow-2xl mx-auto md:max-h-[90vh] md:overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close Button - Desktop (Inside Image Area) & Mobile (Fixed top right) */}
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setZoomedImage(null)}
                                className="fixed md:absolute top-4 right-4 md:right-[370px] z-[5010] w-10 h-10 md:w-12 md:h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-black/70 transition-colors shadow-lg"
                            >
                                <X size={20} className="text-white md:w-6 md:h-6" />
                            </motion.button>

                            {/* Left/Top: Media Container */}
                            <div className="relative w-full h-[100dvh] md:flex-1 md:h-full bg-black flex items-center justify-center shrink-0 group overflow-hidden">
                                <AnimatePresence initial={false} custom={{ direction: slideDirection, offset: dragOffset }} mode="popLayout">
                                    <motion.div
                                        key={zoomedImage._id}
                                        custom={{ direction: slideDirection, offset: dragOffset }}
                                        variants={slideVariants}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{ 
                                            x: { type: "spring", stiffness: 300, damping: 30 },
                                            opacity: { duration: 0.2 },
                                            scale: { duration: 0.2 }
                                        }}
                                        className="absolute inset-0 w-full h-full flex items-center justify-center gpu-accelerated"
                                        drag={!isZoomedIn ? "x" : false}
                                        dragConstraints={{ left: 0, right: 0 }}
                                        dragElastic={1}
                                        onDragEnd={(e, { offset, velocity }) => {
                                            const swipe = offset.x;
                                            if (swipe < -50 || velocity.x < -500) {
                                                navigateZoomedImage('next', offset.x);
                                            } else if (swipe > 50 || velocity.x > 500) {
                                                navigateZoomedImage('prev', offset.x);
                                            }
                                        }}
                                    >
                                        {/* Prev Image Peek */}
                                        {prevMedia && (
                                            <div className="absolute right-full w-full h-full flex items-center justify-center opacity-30 scale-95 pointer-events-none">
                                                {prevMedia.type === 'video' ? (
                                                    <div className="w-full h-full max-w-lg bg-slate-900 flex items-center justify-center"><Film size={48} className="text-gray-500" /></div>
                                                ) : (
                                                    <img src={prevMedia.url} className="max-w-full max-h-full object-contain" draggable="false" />
                                                )}
                                            </div>
                                        )}

                                        {/* Current Image */}
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            {zoomedImage.type === 'video' ? (
                                                <video
                                                    src={zoomedImage.url}
                                                    className="max-w-full max-h-full object-contain pointer-events-none"
                                                    controls
                                                    autoPlay
                                                />
                                            ) : (
                                                <TransformWrapper 
                                                    centerZoomedOut={true}
                                                    panning={{ disabled: !isZoomedIn }}
                                                    onTransformed={(ref) => {
                                                        setIsZoomedIn(ref.state.scale > 1);
                                                    }}
                                                >
                                                    <TransformComponent wrapperClass="w-full h-full flex items-center justify-center" contentClass="w-full h-full flex items-center justify-center">
                                                        <img
                                                            src={zoomedImage.url}
                                                            alt="Wedding moment zoomed"
                                                            className={`max-w-full max-h-full object-contain ${!isZoomedIn ? 'cursor-grab active:cursor-grabbing pointer-events-none' : 'cursor-zoom-in'}`}
                                                            draggable="false"
                                                        />
                                                    </TransformComponent>
                                                </TransformWrapper>
                                            )}
                                        </div>

                                        {/* Next Image Peek */}
                                        {nextMedia && (
                                            <div className="absolute left-full w-full h-full flex items-center justify-center opacity-30 scale-95 pointer-events-none">
                                                {nextMedia.type === 'video' ? (
                                                    <div className="w-full h-full max-w-lg bg-slate-900 flex items-center justify-center"><Film size={48} className="text-gray-500" /></div>
                                                ) : (
                                                    <img src={nextMedia.url} className="max-w-full max-h-full object-contain" draggable="false" />
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                                
                                {/* Swipe Hint Overlay */}
                                <AnimatePresence>
                                    {showSwipeHint && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 bg-black/60 z-[5020] flex flex-col items-center justify-center pointer-events-none"
                                        >
                                            <motion.div
                                                animate={{ x: [-20, 20, -20] }}
                                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                                className="bg-white/20 p-4 rounded-full backdrop-blur-md mb-4"
                                            >
                                                <Hand size={40} className="text-white drop-shadow-lg" />
                                            </motion.div>
                                            <p className="text-white font-medium text-lg drop-shadow-md">Vuốt sang ngang để xem ảnh</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                
                                {/* Navigation Buttons */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); navigateZoomedImage('prev'); }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all z-[5010] border border-white/20 opacity-0 group-hover:opacity-100 md:opacity-100 hidden md:block"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); navigateZoomedImage('next'); }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-all z-[5010] border border-white/20 opacity-0 group-hover:opacity-100 md:opacity-100 hidden md:block"
                                >
                                    <ChevronRight size={24} />
                                </button>
                                
                                {/* Mobile Swipe Up Hint */}
                                <div className="absolute bottom-8 md:hidden flex flex-col items-center pointer-events-none opacity-60">
                                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-white/20 to-white/90 animate-bounce mb-1"></div>
                                    <span className="text-[10px] text-white tracking-widest uppercase font-bold drop-shadow-md">Kéo xuống Bình Luận</span>
                                </div>
                            </div>

                            {/* Right/Bottom: Comments & Info Panel (Width 350px on Desktop) */}
                            <div className="w-full md:w-[350px] bg-white dark:bg-slate-900 flex flex-col h-[85vh] md:h-full shrink-0 border-t md:border-l border-gray-200 dark:border-slate-800 relative z-[5005] rounded-t-3xl md:rounded-none -mt-6 md:mt-0 shadow-[0_-10px_40px_rgba(0,0,0,0.3)] md:shadow-none">
                                {/* Header: Category & Date */}
                                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-wedding-gold-300 to-wedding-gold-500 p-[2px]">
                                            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                                                <Heart size={16} className="text-wedding-gold-500 fill-current" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-wedding-blue-900 dark:text-wedding-blue-50">
                                                {zoomedImage.category}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(zoomedImage.createdAt).toLocaleDateString('vi-VN', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Comments List */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-700 bg-white dark:bg-slate-900">
                                    {(!mediaById.get(zoomedImage._id)?.comments || mediaById.get(zoomedImage._id).comments.length === 0) ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 space-y-2">
                                            <Camera size={32} className="opacity-20" />
                                            <p className="text-sm">Chưa có bình luận nào</p>
                                            <p className="text-xs">Hãy là người đầu tiên để lại lời chúc!</p>
                                        </div>
                                    ) : (
                                        mediaById.get(zoomedImage._id).comments.map((comment, idx) => (
                                            <div key={idx} className="flex gap-3 relative group">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 uppercase font-bold text-gray-600 dark:text-gray-300 text-xs">
                                                    {comment.name.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-6">
                                                    <p className="text-sm">
                                                        <span className="font-bold text-gray-900 dark:text-white mr-2">{comment.name}</span>
                                                        <span className="text-gray-700 dark:text-gray-300 break-words">{comment.content}</span>
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-1 uppercase">
                                                        {new Date(comment.createdAt).toLocaleDateString('vi-VN')}
                                                    </p>
                                                </div>
                                                {isAdmin && (
                                                    <button
                                                        onClick={(e) => handleDeleteComment(e, zoomedImage._id, comment._id)}
                                                        className="absolute right-0 top-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-900 px-1"
                                                        title="Xóa bình luận"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Action Buttons (Like / Download) */}
                                <div className="p-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-4 shrink-0 bg-white dark:bg-slate-900">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleLike(zoomedImage._id);
                                        }}
                                        disabled={likingPhotoId === zoomedImage._id}
                                        className="flex items-center transition-transform hover:scale-110 active:scale-90"
                                    >
                                        <motion.div
                                            animate={(mediaById.get(zoomedImage._id)?.likes || 0) > 0 ? { scale: [1, 1.3, 1], transition: { duration: 0.4, type: "spring", stiffness: 400, damping: 10 } } : {}}
                                            key={(mediaById.get(zoomedImage._id)?.likes || 0)}
                                        >
                                            <Heart
                                                size={28}
                                                className={(mediaById.get(zoomedImage._id)?.likes || 0) > 0 ? "text-red-500 fill-current drop-shadow-md" : "text-gray-800 dark:text-gray-300"}
                                            />
                                        </motion.div>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            downloadPhoto(zoomedImage.url, zoomedImage._id, zoomedImage.category);
                                        }}
                                        className="hover:opacity-70 transition-opacity text-gray-800 dark:text-gray-300"
                                    >
                                        <Download size={26} />
                                    </button>
                                    <div className="ml-auto text-sm font-semibold text-gray-900 dark:text-white">
                                        {(mediaById.get(zoomedImage._id)?.likes || 0)} lượt thích
                                    </div>
                                </div>

                                {/* Comment Form */}
                                <div className="p-3 border-t border-gray-100 dark:border-slate-800 shrink-0 bg-gray-50 dark:bg-slate-800/80">
                                    <form onSubmit={(e) => handleCommentSubmit(e, zoomedImage._id)} className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            placeholder="Tên của bạn..."
                                            value={commentName}
                                            onChange={(e) => setCommentName(e.target.value)}
                                            className="w-full text-sm bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white placeholder-gray-500 font-semibold outline-none"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="Thêm bình luận..."
                                                value={commentContent}
                                                onChange={(e) => setCommentContent(e.target.value)}
                                                className="flex-1 text-sm bg-transparent border-none focus:ring-0 p-1 text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <button
                                                type="submit"
                                                disabled={isSubmittingComment || !commentName.trim() || !commentContent.trim()}
                                                className="text-wedding-blue-600 dark:text-wedding-blue-400 font-bold text-sm disabled:opacity-50 px-2 py-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {isSubmittingComment ? <Loader2 size={16} className="animate-spin" /> : "Đăng"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                );
            })()
            }

            {/* Add to Slideshow Picker Modal */}
            {showAddToSlideshowPicker && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="wedding-card rounded-3xl p-6 max-w-4xl w-full max-h-[85vh] flex flex-col"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-playfair font-bold text-wedding-blue-900">
                                Chọn ảnh thêm vào slideshow
                            </h3>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowAddToSlideshowPicker(false)}
                                className="p-2 rounded-full bg-wedding-blue-100 text-wedding-blue-700 hover:bg-wedding-blue-200"
                            >
                                <X size={20} />
                            </motion.button>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            {slideshowLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="animate-spin text-wedding-blue-600" size={32} />
                                </div>
                            ) : allImagesForPicker.length === 0 ? (
                                <p className="text-center text-wedding-blue-600 py-8">Chưa có ảnh nào trong gallery.</p>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                    {allImagesForPicker.map((m) => {
                                        const inSlideshow = slideshowItems.some((i) => i._id === m._id);
                                        return (
                                            <div key={m._id} className="relative aspect-square rounded-xl overflow-hidden border-2 border-wedding-blue-200 group">
                                                <img
                                                    src={m.thumbUrl || m.url}
                                                    alt={m.category}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {inSlideshow ? (
                                                        <span className="text-white text-sm font-medium bg-wedding-gold-500 px-2 py-1 rounded-full">Đã thêm</span>
                                                    ) : (
                                                        <motion.button
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => addToSlideshow(m._id)}
                                                            className="bg-wedding-blue-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold"
                                                        >
                                                            Thêm vào slideshow
                                                        </motion.button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Fullscreen Slideshow Modal */}
            {showSlideshowFullscreen && slideshowItems.length > 0 && (
                <div className={`slideshow-fullscreen ${!showControls ? 'hide-cursor' : ''}`}>
                    {/* Blurred Background Layer */}
                    <AnimatePresence mode="wait">
                        <motion.img
                            key={`bg-${slideshowItems[slideshowIndex]?._id}`}
                            src={slideshowItems[slideshowIndex]?.slideshowUrl || slideshowItems[slideshowIndex]?.url}
                            className="slideshow-fullscreen-bg"
                            alt="Background blur"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.5, ease: 'easeInOut' }}
                        />
                    </AnimatePresence>

                    {/* Close Button */}
                    <button
                        onClick={closeFullscreenSlideshow}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[1010] p-3 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all backdrop-blur-md shadow-lg"
                        style={{
                            opacity: showControls ? 1 : 0,
                            pointerEvents: showControls ? 'auto' : 'none',
                            transition: 'opacity 0.3s ease-in-out'
                        }}
                        aria-label="Đóng slideshow"
                    >
                        <X size={24} />
                    </button>

                    <div
                        className="flex-1 flex items-center justify-center p-4 min-h-0 relative z-10 w-full h-full cursor-pointer"
                        onClick={() => setShowControls(!showControls)}
                    >
                        <AnimatePresence mode="wait">
                            <motion.img
                                key={slideshowItems[slideshowIndex]?._id}
                                src={slideshowItems[slideshowIndex]?.slideshowUrl || slideshowItems[slideshowIndex]?.url}
                                alt={`Slideshow ${slideshowIndex + 1}`}
                                className="slideshow-fullscreen-image max-w-90vw max-h-90vh object-contain"
                                initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                                transition={{
                                    duration: 1.2,
                                    ease: [0.33, 1, 0.68, 1]
                                }}
                            />
                        </AnimatePresence>
                    </div>
                    {slideshowItems.length > 1 && (
                        <>
                            {showControls && (
                                <div className="absolute inset-x-0 bottom-6 sm:bottom-10 z-[1010] flex flex-col items-center justify-end gap-4 px-4 pointer-events-none" style={{
                                    opacity: showControls ? 1 : 0,
                                    transition: 'opacity 0.3s ease-in-out'
                                }}>
                                    <div className="flex items-center gap-4 sm:gap-6 bg-black/40 backdrop-blur-md px-4 sm:px-6 py-3 rounded-full border border-white/20 pointer-events-auto">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setSlideshowIndex((i) => (i - 1 + slideshowItems.length) % slideshowItems.length); }}
                                            className="text-white bg-white/10 hover:bg-white/30 rounded-full p-2.5 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-95 border border-white/10"
                                            aria-label="Ảnh trước"
                                        >
                                            <ChevronLeft size={24} className="sm:w-6 sm:h-6 w-5 h-5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleAutoPlay(); }}
                                            className="text-white bg-white/10 hover:bg-white/30 rounded-full p-3 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-95 border border-white/10"
                                            aria-label={isAutoPlaying ? "Tạm dừng" : "Chơi tự động"}
                                        >
                                            {isAutoPlaying ? (
                                                <div className="w-6 h-6 flex items-center justify-center gap-[3px]">
                                                    <div className="w-1.5 h-4 bg-white rounded-[1px]" />
                                                    <div className="w-1.5 h-4 bg-white rounded-[1px]" />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 flex items-center justify-center">
                                                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                                                </div>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setSlideshowIndex((i) => (i + 1) % slideshowItems.length); }}
                                            className="text-white bg-white/10 hover:bg-white/30 rounded-full p-2.5 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-110 active:scale-95 border border-white/10"
                                            aria-label="Ảnh sau"
                                        >
                                            <ChevronRight size={24} className="sm:w-6 sm:h-6 w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="hidden"></div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Gallery Section */}
            <main className="max-w-7xl mx-auto px-4 py-24">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-center mb-16 relative"
                >
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-wedding-blue-200/20 rounded-full blur-3xl pointer-events-none" />
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-playfair font-black text-wedding-blue-900 dark:text-wedding-blue-50 mb-4 drop-shadow-sm tracking-tight relative z-10">
                        Khoảnh khắc <span className="gold-accent drop-shadow-[0_2px_10px_rgba(250,204,21,0.3)]">yêu thương</span>
                    </h2>
                    <p className="text-2xl sm:text-3xl md:text-4xl text-wedding-blue-700/80 dark:text-wedding-blue-200/80 font-dancing tracking-wide relative z-10">
                        Những kỷ niệm đẹp đẽ của chúng ta
                    </p>
                    <div className="mt-8 h-1 w-40 bg-gradient-to-r from-transparent via-wedding-blue-400 to-transparent mx-auto rounded-full opacity-70 relative z-10" />
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
                        className="inline-flex items-center gap-2 sm:gap-3 wedding-gradient text-white px-6 py-3 sm:px-8 sm:py-4 rounded-full font-bold shadow-wedding-lg hover:shadow-wedding-lg transition-all duration-300 border-2 border-wedding-blue-300 text-base sm:text-base"
                    >
                        <Share2 size={20} />
                        <span>Chia sẻ Gallery</span>
                        <Sparkles size={16} className="animate-pulse sparkle" />
                    </motion.button>
                </motion.div>

                {/* Public Slideshow Section */}
                {slideshowItems.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                        className="mb-16"
                    >
                        <h2 className="text-3xl sm:text-4xl font-playfair font-bold text-wedding-blue-900 dark:text-wedding-blue-50 text-center mb-6">
                            Slideshow <span className="gold-accent">cưới</span>
                        </h2>
                        <div className="slideshow-container max-w-4xl mx-auto">
                            <div className="slideshow-image-wrapper aspect-[16/10] sm:aspect-video relative overflow-hidden">
                                <AnimatePresence mode="wait" custom={slideshowIndex}>
                                    <motion.img
                                        key={slideshowItems[slideshowIndex]?._id}
                                        src={slideshowItems[slideshowIndex]?.slideshowUrl || slideshowItems[slideshowIndex]?.url}
                                        alt={`Slideshow ${slideshowIndex + 1}`}
                                        className="slideshow-image w-full h-full object-cover"
                                        variants={{
                                            enter: { opacity: 0, scale: 1.05, filter: 'blur(10px)' },
                                            center: { opacity: 1, scale: 1, filter: 'blur(0px)' },
                                            exit: { opacity: 0, scale: 0.95, filter: 'blur(10px)' }
                                        }}
                                        initial="enter"
                                        animate="center"
                                        exit="exit"
                                        transition={{
                                            duration: 1.2,
                                            ease: [0.33, 1, 0.68, 1]
                                        }}
                                    />
                                </AnimatePresence>
                                <div className="slideshow-overlay" />
                                {slideshowItems.length > 1 && (
                                    <div className="slideshow-controls">
                                        <button
                                            type="button"
                                            onClick={() => setSlideshowIndex((i) => (i - 1 + slideshowItems.length) % slideshowItems.length)}
                                            className="slideshow-control-btn"
                                            aria-label="Ảnh trước"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSlideshowIndex((i) => (i + 1) % slideshowItems.length)}
                                            className="slideshow-control-btn"
                                            aria-label="Ảnh sau"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                )}
                                <div className="slideshow-info">
                                    <p className="text-sm font-medium text-wedding-blue-800">
                                        Ảnh {slideshowIndex + 1} / {slideshowItems.length}
                                    </p>
                                    <p className="text-xs text-wedding-blue-600 mt-1">
                                        {slideshowItems[slideshowIndex]?.category || 'Ảnh cưới'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-wedding-blue-50 to-wedding-blue-100/80">
                                <div className="hidden"></div>
                                <div className="flex items-center justify-center gap-3 flex-shrink-0 order-1 md:order-2 w-full md:w-auto">
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={startAutoPlaySlideshow}
                                        className="inline-flex items-center gap-2 bg-gradient-to-r from-wedding-gold-400 to-wedding-gold-600 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg hover:shadow-wedding-lg transition-all duration-300"
                                    >
                                        <Sparkles size={18} />
                                        Chạy slideshow tự động
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowSlideshowFullscreen(true)}
                                        className="inline-flex items-center gap-2 wedding-gradient text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg"
                                    >
                                        <Film size={18} />
                                        Xem slideshow
                                    </motion.button>
                                </div>
                            </div>
                            <div
                                className="slideshow-progress"
                                style={{
                                    transform: `scaleX(${((slideshowIndex + 1) / slideshowItems.length)})`
                                }}
                            />
                        </div>
                    </motion.div>
                )}

                {/* Type and Category Filter */}
                <motion.div
                    id="gallery-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-center mb-12"
                >
                    {/* Type Filter */}
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-wedding-blue-800/80 dark:text-wedding-blue-200/80 mb-4 tracking-wide">Loại media</h3>
                        <div className="flex justify-center gap-3 flex-wrap">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFilterType('tất cả')}
                                className={`px-5 py-2.5 rounded-full font-bold transition-all duration-300 text-sm ${filterType === 'tất cả'
                                    ? 'bg-gradient-to-r from-wedding-blue-500 to-wedding-blue-700 text-white shadow-[0_4px_15px_rgba(2,132,199,0.4)]'
                                    : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-wedding-blue-700 dark:text-wedding-blue-200 hover:bg-wedding-blue-50 dark:hover:bg-slate-700 border border-wedding-blue-200 dark:border-slate-700 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <ImageIcon size={16} />
                                    <span>Tất cả</span>
                                </div>
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFilterType('image')}
                                className={`px-5 py-2.5 rounded-full font-bold transition-all duration-300 text-sm ${filterType === 'image'
                                    ? 'bg-gradient-to-r from-wedding-blue-500 to-wedding-blue-700 text-white shadow-[0_4px_15px_rgba(2,132,199,0.4)]'
                                    : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-wedding-blue-700 dark:text-wedding-blue-200 hover:bg-wedding-blue-50 dark:hover:bg-slate-700 border border-wedding-blue-200 dark:border-slate-700 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <ImageIcon size={16} />
                                    <span>Ảnh</span>
                                </div>
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFilterType('video')}
                                className={`px-5 py-2.5 rounded-full font-bold transition-all duration-300 text-sm ${filterType === 'video'
                                    ? 'bg-gradient-to-r from-wedding-blue-500 to-wedding-blue-700 text-white shadow-[0_4px_15px_rgba(2,132,199,0.4)]'
                                    : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-wedding-blue-700 dark:text-wedding-blue-200 hover:bg-wedding-blue-50 dark:hover:bg-slate-700 border border-wedding-blue-200 dark:border-slate-700 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Video size={16} />
                                    <span>Video</span>
                                </div>
                            </motion.button>
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <h3 className="text-lg font-semibold text-wedding-blue-800/80 dark:text-wedding-blue-200/80 mb-4 tracking-wide">Danh mục</h3>
                        <div className="flex justify-center gap-3 flex-wrap">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFilterCategory('tất cả')}
                                className={`px-5 py-2.5 rounded-full font-bold transition-all duration-300 text-sm ${filterCategory === 'tất cả'
                                    ? 'bg-gradient-to-r from-wedding-blue-500 to-wedding-blue-700 text-white shadow-[0_4px_15px_rgba(2,132,199,0.4)]'
                                    : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-wedding-blue-700 dark:text-wedding-blue-200 hover:bg-wedding-blue-50 dark:hover:bg-slate-700 border border-wedding-blue-200 dark:border-slate-700 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <ImageIcon size={16} />
                                    <span>Tất cả</span>
                                </div>
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFilterCategory('yêu thích')}
                                className={`px-5 py-2.5 rounded-full font-bold transition-all duration-300 text-sm flex items-center gap-2 ${filterCategory === 'yêu thích'
                                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-[0_4px_15px_rgba(251,191,36,0.4)]'
                                    : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-slate-700 border border-yellow-200 dark:border-slate-700 shadow-sm'
                                    }`}
                            >
                                <Star size={16} className={filterCategory === 'yêu thích' ? "fill-current" : ""} />
                                <span>Đã thích</span>
                            </motion.button>
                            {categories.map((category) => (
                                <motion.button
                                    key={category}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setFilterCategory(category)}
                                    className={`px-5 py-2.5 rounded-full font-bold transition-all duration-300 text-sm ${filterCategory === category
                                        ? 'bg-gradient-to-r from-wedding-blue-500 to-wedding-blue-700 text-white shadow-[0_4px_15px_rgba(2,132,199,0.4)]'
                                        : 'bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-wedding-blue-700 dark:text-wedding-blue-200 hover:bg-wedding-blue-50 dark:hover:bg-slate-700 border border-wedding-blue-200 dark:border-slate-700 shadow-sm'
                                        }`}
                                >
                                    {category}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 w-full max-w-7xl mx-auto">
                    {media.map((item, index) => (
                        <motion.div
                            key={item._id}
                            variants={{
                                hidden: { opacity: 0, scale: 0.9, y: 30 },
                                visible: { opacity: 1, scale: 1, y: 0 }
                            }}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5, delay: (index % 10) * 0.1 }}
                            className="gallery-item group cursor-pointer transform transition-transform duration-500 hover:-translate-y-2 rounded-2xl overflow-hidden mb-4 sm:mb-6 lg:mb-8 gpu-accelerated"
                            onClick={() => setZoomedImage(item)}
                        >
                            {/* Media Container */}
                            <div className="aspect-square relative overflow-hidden rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-white/60 backdrop-blur-sm bg-white/40">
                                {/* Decorative corner elements */}
                                <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-wedding-gold-400/40 rounded-tl-lg" />
                                <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-wedding-gold-400/40 rounded-tr-lg" />
                                <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-wedding-gold-400/40 rounded-bl-lg" />
                                <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-wedding-gold-400/40 rounded-br-lg" />

                                {/* Inner frame */}
                                <div className="absolute inset-1 border border-wedding-gold-300/20 rounded-xl pointer-events-none" />

                                {/* Image wrapper with proper rounding */}
                                <div className="absolute inset-0 rounded-xl overflow-hidden">
                                    {item.type === 'video' ? (
                                        item.posterUrl ? (
                                            <LazyImage
                                                src={item.posterUrl}
                                                alt={`Video - ${item.category}`}
                                                wrapperClassName="w-full h-full"
                                                imgClassName="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                                                loading={index < 8 ? 'eager' : 'lazy'}
                                                fetchPriority={index < 4 ? 'high' : 'auto'}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-black/30 flex items-center justify-center">
                                                <Video size={48} className="text-white/80" />
                                            </div>
                                        )
                                    ) : (
                                        <LazyImage
                                            src={item.thumbUrl || item.url}
                                            srcSet={item.srcSet}
                                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                                            alt={item.category}
                                            wrapperClassName="w-full h-full"
                                            imgClassName="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                                            loading={index < 8 ? 'eager' : 'lazy'}
                                            fetchPriority={index < 4 ? 'high' : 'auto'}
                                        />
                                    )}
                                </div>

                                {/* Video Indicator */}
                                {item.type === 'video' && (
                                    <div className="absolute top-3 left-3 bg-wedding-gold-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                                        <Video size={12} />
                                        <span>Video</span>
                                    </div>
                                )}

                                {/* Enhanced Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-xl">
                                    {/* Decorative overlay pattern */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-wedding-gold-400/20 via-transparent to-wedding-blue-400/20 rounded-xl" />
                                </div>
                            </div>

                            {/* Enhanced Content */}
                            <div className="p-4 bg-gradient-to-br from-white/95 to-wedding-blue-50/90 dark:from-slate-800/95 dark:to-slate-900/90 backdrop-blur-md rounded-b-2xl border-x border-b border-white/40 dark:border-slate-700 shadow-lg">
                                <div className="mb-3">
                                    <span className="inline-block text-xs font-semibold text-wedding-blue-700 bg-gradient-to-r from-wedding-gold-100 to-wedding-blue-100 px-3 py-1.5 rounded-full border border-wedding-gold-300/40 shadow-sm">
                                        {item.category}
                                    </span>
                                </div>

                                {/* Enhanced Actions */}
                                <div className="flex justify-between items-center gap-2">
                                    <div className="flex gap-2">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLike(item._id);
                                            }}
                                            disabled={likingPhotoId === item._id}
                                            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 border shadow-sm ${likingPhotoId === item._id
                                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                : item.likes > 0
                                                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shadow-[0_2px_8px_rgba(239,68,68,0.2)]'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-red-500'
                                                }`}
                                        >
                                            {/* Floating Hearts Effect */}
                                            <AnimatePresence>
                                                {showLikeEffectId === item._id && (
                                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none w-full h-full z-10">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ opacity: 1, scale: 0.5, y: 0, x: 0 }}
                                                                animate={{ 
                                                                    opacity: 0, 
                                                                    scale: 1.2 + Math.random() * 0.5, 
                                                                    y: -40 - Math.random() * 40, 
                                                                    x: (Math.random() - 0.5) * 50 
                                                                }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.6 + Math.random() * 0.4, ease: "easeOut" }}
                                                                className="absolute left-1/2 top-0 -translate-x-1/2"
                                                            >
                                                                <Heart size={14} className="text-red-500 fill-current drop-shadow-md" />
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                            </AnimatePresence>

                                            {likingPhotoId === item._id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <motion.div
                                                    animate={item.likes > 0 ? { scale: [1, 1.3, 1], transition: { duration: 0.4, type: "spring", stiffness: 400, damping: 10 } } : {}}
                                                    key={item.likes}
                                                >
                                                    <Heart size={16} className={likedPhotos.includes(item._id) ? "text-red-500 fill-current drop-shadow-sm" : item.likes > 0 ? "text-red-400/50" : ""} />
                                                </motion.div>
                                            )}
                                            <span className="text-sm font-bold z-20">{item.likes > 0 ? item.likes : 'Thích'}</span>
                                        </motion.button>

                                        {item.comments && item.comments.length > 0 && (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full border border-blue-200 shadow-sm cursor-pointer hover:bg-blue-100 transition-colors">
                                                <MessageCircle size={16} />
                                                <span className="text-sm font-bold">{item.comments.length}</span>
                                            </div>
                                        )}
                                    </div>

                                    {isAdmin && (
                                        <div className="flex items-center gap-1">
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingPhoto(item);
                                                    setNewCategoryForPhoto(item.category);
                                                }}
                                                className="text-blue-500 hover:text-blue-700 transition-colors p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg shadow-sm hover:shadow-md"
                                                title="Sửa danh mục"
                                            >
                                                <Edit size={14} />
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(item._id);
                                                }}
                                                className="text-red-500 hover:text-red-700 transition-colors p-1.5 bg-red-50 hover:bg-red-100 rounded-lg shadow-sm hover:shadow-md"
                                            >
                                                <Trash2 size={14} />
                                            </motion.button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {
                    media.length === 0 && !loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-32"
                        >
                            <div className="flex items-center justify-center w-32 h-32 bg-wedding-blue-100 dark:bg-slate-800 rounded-full mb-8 pulse-glow mx-auto">
                                <ImageIcon size={48} className="text-wedding-blue-400 floating" />
                            </div>
                            <h3 className="text-2xl font-playfair font-bold text-wedding-blue-900 dark:text-wedding-blue-50 mb-4 text-center">
                                Chưa có media nào
                            </h3>
                            <p className="text-xl text-wedding-blue-700 dark:text-wedding-blue-200 mb-2 text-center">
                                Hãy là người đầu tiên chia sẻ khoảnh khắc đẹp nhất!
                            </p>
                            <p className="text-wedding-blue-600 dark:text-wedding-blue-300 font-dancing text-center">
                                Mỗi media là một câu chuyện tình yêu
                            </p>
                        </motion.div>
                    )
                }

                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 sm:gap-4 py-12">
                        <button
                            onClick={() => {
                                if (pagination.hasPrevPage && !isPageTransitioning) {
                                    fetchMedia(pagination.currentPage - 1, 'prev');
                                }
                            }}
                            disabled={!pagination.hasPrevPage || isPageTransitioning}
                            className={`px-4 sm:px-6 py-2.5 rounded-full font-medium transition-all shadow-sm flex items-center gap-1 sm:gap-2 ${pagination.hasPrevPage ? 'bg-white text-wedding-blue-700 hover:bg-wedding-blue-50 hover:shadow-md border border-wedding-blue-200 dark:bg-slate-800 dark:text-wedding-blue-200 dark:border-slate-700 dark:hover:bg-slate-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 dark:bg-slate-800/50 dark:border-slate-800/50 dark:text-slate-500'}`}
                        >
                            {isPageTransitioning === 'prev' ? <Loader2 size={18} className="animate-spin" /> : <ChevronLeft size={18} />}
                            <span className="hidden sm:inline">Trang trước</span>
                        </button>
                        
                        <span className="text-wedding-blue-800 dark:text-wedding-blue-200 font-bold px-3 sm:px-4 py-2 bg-white/50 dark:bg-slate-800/50 rounded-full border border-wedding-blue-100 dark:border-slate-700 shadow-sm whitespace-nowrap min-w-[60px] text-center">
                            {pagination.currentPage} / {pagination.totalPages}
                        </span>
                        
                        <button
                            onClick={() => {
                                if (pagination.hasNextPage && !isPageTransitioning) {
                                    fetchMedia(pagination.currentPage + 1, 'next');
                                }
                            }}
                            disabled={!pagination.hasNextPage || isPageTransitioning}
                            className={`px-4 sm:px-6 py-2.5 rounded-full font-medium transition-all shadow-sm flex items-center gap-1 sm:gap-2 ${pagination.hasNextPage ? 'bg-gradient-to-r from-wedding-blue-500 to-wedding-blue-700 text-white hover:shadow-md' : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 dark:bg-slate-800/50 dark:border-slate-800/50 dark:text-slate-500'}`}
                        >
                            <span className="hidden sm:inline">Trang sau</span>
                            {isPageTransitioning === 'next' ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                        </button>
                    </div>
                )}

            </main >

            {/* Guestbook Section */}
            <Guestbook API_URL={API_URL} isAdmin={isAdmin} />

            <footer className="relative bg-gradient-to-r from-wedding-blue-900 via-wedding-blue-800 to-wedding-blue-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white py-16 mt-0 overflow-hidden">
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
                                <span className="text-2xl font-playfair font-bold gold-accent">Nhật Huy & Thiên Ý</span>
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
                        Made with <span className="text-red-400 animate-pulse heartbeat">❤️</span> for my Sister's Big Day by Võ Trần Hoàng Uy
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

            {/* Global Audio Element */}
            <audio
                ref={audioRef}
                src={currentAudioUrl}
                onEnded={handleAudioEnded}
                title={bgAudioList[currentAudioIndex]?.name || "Wedding Audio"}
                autoPlay={isPlayingAudio}
            />

            {/* Floating Audio Toggle */}
            {bgAudioList.length > 0 && (
                <button
                    onClick={() => {
                        if (isPlayingAudio) {
                            audioRef.current?.pause();
                            setIsPlayingAudio(false);
                        } else {
                            audioRef.current?.play().then(() => setIsPlayingAudio(true)).catch(e => console.log(e));
                        }
                    }}
                    className={`fixed bottom-6 right-6 z-[4000] w-12 h-12 rounded-full shadow-wedding-lg flex items-center justify-center transition-all duration-300 ${isPlayingAudio ? 'bg-wedding-blue-600 text-white animate-[spin_4s_linear_infinite]' : 'bg-white text-wedding-blue-600 hover:bg-wedding-blue-50 hover:scale-110'}`}
                    title={isPlayingAudio ? "Tạm dừng nhạc" : "Phát nhạc"}
                >
                    <Music size={20} className={!isPlayingAudio ? 'opacity-60' : ''} />
                    {!isPlayingAudio && (
                        <span className="absolute inset-0 rounded-full border-2 border-wedding-blue-400 opacity-50 animate-ping"></span>
                    )}
                </button>
            )}

        </div >
    );
}

export default App;
