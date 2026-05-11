import api from './api';

export const applyLeave = async (data: any) => {
  const res = await api.post('/leave', data);
  return res.data.data.leave;
};

export const adminAddLeave = async (data: any) => {
  const res = await api.post('/leave/admin-add', data);
  return res.data.data.leave;
};

export const getMyLeaves = async () => {
  const res = await api.get('/leave/me');
  return res.data.data.leaves;
};

export const getAllLeaves = async () => {
  const res = await api.get('/leave/all');
  return res.data.data.leaves;
};

export const updateLeaveStatus = async (id: string, status: string) => {
  const res = await api.patch(`/leave/${id}/status`, { status });
  return res.data.data.leave;
};

export const deleteLeave = async (id: string) => {
  const res = await api.delete(`/leave/${id}`);
  return res.data;
};

export const getLeaveExportUrl = (month: string, token: string) =>
  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/leave/export?month=${month}&token=${token}`;
