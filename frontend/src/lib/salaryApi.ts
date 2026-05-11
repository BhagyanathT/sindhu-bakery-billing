import api from './api';

export const getSalaries = async (period?: string) => {
  const params = period ? { month: period } : {};
  const res = await api.get('/salary', { params });
  return res.data.data.salaries;
};

export const generateSalary = async (period: string, isWeekly = false) => {
  const body = isWeekly ? { week: period } : { month: period };
  const res = await api.post('/salary/generate', body);
  return res.data.data.salaries;
};

export const getPendingSalaries = async () => {
  const res = await api.get('/salary/pending');
  return res.data.data;
};

export const updateSalary = async (id: string, data: any) => {
  const res = await api.patch(`/salary/${id}`, data);
  return res.data.data.salary;
};

export const deleteSalary = async (id: string) => {
  const res = await api.delete(`/salary/${id}`);
  return res.data;
};

export const getSalaryExportUrl = (period: string, token: string) =>
  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/salary/export?month=${period}&token=${token}`;
