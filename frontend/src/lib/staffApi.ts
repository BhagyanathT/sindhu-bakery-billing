import api from './api';

export const getStaff = async () => {
  const res = await api.get('/staff');
  return res.data.data.staff;
};

export const createStaff = async (staffData: any) => {
  const res = await api.post('/staff', staffData);
  return res.data.data.staff;
};

export const updateStaff = async (id: string, staffData: any) => {
  const res = await api.patch(`/staff/${id}`, staffData);
  return res.data.data.staff;
};

export const deleteStaff = async (id: string) => {
  const res = await api.delete(`/staff/${id}`);
  return res.data;
};

export const permanentDeleteStaff = async (id: string) => {
  const res = await api.delete(`/staff/${id}/permanent`);
  return res.data;
};
