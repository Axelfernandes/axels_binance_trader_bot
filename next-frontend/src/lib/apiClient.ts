import axios from 'axios';
import { auth } from './firebaseClient';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: apiBaseUrl || undefined,
});

api.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
