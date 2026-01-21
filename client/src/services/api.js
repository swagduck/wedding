import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:5000/api" });

export const fetchPhotos = () => API.get("/photos");
export const uploadPhoto = (formData) => API.post("/upload", formData);
export const likePhoto = (id) => API.patch(`/photos/${id}/like`);
