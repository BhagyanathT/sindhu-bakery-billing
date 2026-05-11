// src/controllers/leaveController.js
const Leave = require('../models/Leave');
const AppError = require('../utils/AppError');

// Staff: Apply for leave
exports.applyLeave = async (req, res, next) => {
  try {
    const { startDate, endDate, type, reason } = req.body;

    const leave = await Leave.create({
      staffId: req.user._id,
      company: req.company._id,
      startDate,
      endDate,
      type,
      reason
    });

    res.status(201).json({ success: true, data: { leave } });
  } catch (err) {
    next(err);
  }
};

// Admin: Add leave directly for any staff member
exports.adminAddLeave = async (req, res, next) => {
  try {
    const { staffId, startDate, endDate, type, reason, status } = req.body;
    if (!staffId || !startDate || !endDate) {
      return next(new AppError('staffId, startDate, endDate are required', 400));
    }

    const leave = await Leave.create({
      staffId,
      company: req.company._id,
      startDate,
      endDate,
      type: type || 'unpaid',
      reason: reason || '',
      status: status || 'approved' // Admin-added leaves are auto-approved
    });

    // If approved paid leave, auto-mark attendance as Present
    if ((status === 'approved' || !status) && type === 'paid') {
      const Attendance = require('../models/Attendance');
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateAtMidnight = new Date(d);
        dateAtMidnight.setHours(0, 0, 0, 0);
        await Attendance.findOneAndUpdate(
          { staffId, company: req.company._id, date: dateAtMidnight },
          { status: 'Present', totalHours: 8 },
          { upsert: true, new: true }
        );
      }
    }

    const populated = await Leave.findById(leave._id).populate('staffId', 'name phone role');
    res.status(201).json({ success: true, data: { leave: populated } });
  } catch (err) {
    next(err);
  }
};

// Staff: Get my leaves
exports.getMyLeaves = async (req, res, next) => {
  try {
    const leaves = await Leave.find({ staffId: req.user._id, company: req.company._id })
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { leaves } });
  } catch (err) {
    next(err);
  }
};

// Admin: Get all leaves
exports.getAllLeaves = async (req, res, next) => {
  try {
    const leaves = await Leave.find({ company: req.company._id })
      .populate('staffId', 'name phone role')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: { leaves } });
  } catch (err) {
    next(err);
  }
};

// Admin: Update leave status (Approve/Reject)
exports.updateLeaveStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      { status },
      { new: true, runValidators: true }
    );

    if (!leave) return next(new AppError('Leave application not found', 404));

    // If approved and paid, inject 'Present' attendance records
    if (status === 'approved' && leave.type === 'paid') {
      const Attendance = require('../models/Attendance');
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateAtMidnight = new Date(d);
        dateAtMidnight.setHours(0, 0, 0, 0);
        await Attendance.findOneAndUpdate(
          { staffId: leave.staffId, company: req.company._id, date: dateAtMidnight },
          { status: 'Present', totalHours: 8 },
          { upsert: true, new: true }
        );
      }
    }

    res.status(200).json({ success: true, data: { leave } });
  } catch (err) {
    next(err);
  }
};

// Admin: Delete a leave record
exports.deleteLeave = async (req, res, next) => {
  try {
    const leave = await Leave.findOneAndDelete({ _id: req.params.id, company: req.company._id });
    if (!leave) return next(new AppError('Leave not found', 404));
    res.status(200).json({ success: true, message: 'Leave deleted' });
  } catch (err) {
    next(err);
  }
};

// Admin: Export leaves as CSV
exports.exportLeavesCsv = async (req, res, next) => {
  try {
    const { month } = req.query;
    let query = { company: req.company._id };
    if (month) {
      const [year, m] = month.split('-');
      const start = new Date(year, parseInt(m) - 1, 1);
      const end = new Date(year, parseInt(m), 0, 23, 59, 59);
      query.startDate = { $lte: end };
      query.endDate = { $gte: start };
    }
    const leaves = await Leave.find(query).populate('staffId', 'name role phone');
    const rows = [['Staff Name', 'Role', 'Phone', 'Start Date', 'End Date', 'Days', 'Type', 'Reason', 'Status']];
    leaves.forEach(l => {
      const days = Math.round((new Date(l.endDate) - new Date(l.startDate)) / 86400000) + 1;
      rows.push([
        l.staffId?.name || '', l.staffId?.role || '', l.staffId?.phone || '',
        new Date(l.startDate).toLocaleDateString('en-IN'),
        new Date(l.endDate).toLocaleDateString('en-IN'),
        days, l.type, l.reason || '', l.status
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leaves${month ? '_' + month : ''}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

