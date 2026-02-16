import axios from 'axios';

const getAuthHeaders = (auth?: { username: string; password: string }) => {
  if (!auth?.username && !auth?.password) return {};
  const token = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
  return { Authorization: `Basic ${token}` };
};

export const getSchemasFromRegistry = async (url: string, auth?: { username: string; password: string }) => {
  const response = await axios.get(`${url}/schemas`, {
    headers: getAuthHeaders(auth),
  });
  return response.data;
};

export const getLatestVersionFromSubject = async (
  url: string,
  subject: string,
  auth?: { username: string; password: string }
) => {
  const response = await axios.get(`${url}/subjects/${subject}/versions/latest`, {
    headers: getAuthHeaders(auth),
  });
  return response.data;
};
