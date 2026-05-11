import api from './api';

export const checkIn = async () => {
  const res = await api.post('/attendance/checkin');
  return res.data.data.attendance;
};

export const checkOut = async () => {
  const res = await api.post('/attendance/checkout');
  return res.data.data.attendance;
};

export const getMyTodayAttendance = async () => {
  const res = await api.get('/attendance/me/today');
  return res.data.data.attendance;
};

export const getAllAttendance = async (date?: string, startDate?: string, endDate?: string, staffId?: string) => {
  const params: any = {};
  if (date) params.date = date;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (staffId) params.staffId = staffId;
  const res = await api.get('/attendance', { params });
  return res.data.data.records;
};

export const markAttendance = async (data: {
  staffId: string; date: string; status: 'Present' | 'Half' | 'Absent'; totalHours?: number; overtimeHours?: number;
}) => {
  const res = await api.post('/attendance/mark', data);
  return res.data.data.attendance;
};

export const getMonthlyAttendanceSummary = async (month: string) => {
  const res = await api.get('/attendance/summary', { params: { month } });
  return res.data.data;
};

export const updateAttendance = async (id: string, data: any) => {
  const res = await api.patch(`/attendance/${id}`, data);
  return res.data.data.attendance;
};

export const deleteAttendance = async (id: string) => {
  const res = await api.delete(`/attendance/${id}`);
  return res.data;
};

export const getAttendanceExportUrl = (month: string, token: string) =>
  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/attendance/export?month=${month}&token=${token}`;
