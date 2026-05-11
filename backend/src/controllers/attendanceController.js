// src/controllers/attendanceController.js
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// Helper to get start of day (IST-aware)
const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Check in (For logged-in staff)
exports.checkIn = async (req, res, next) => {
  try {
    const today = getStartOfDay();
    let attendance = await Attendance.findOne({
      staffId: req.user._id,
      company: req.company._id,
      date: today
    });

    if (attendance && attendance.checkInTime) {
      return next(new AppError('Already checked in today', 400));
    }

    if (!attendance) {
      attendance = new Attendance({
        staffId: req.user._id,
        company: req.company._id,
        date: today
      });
    }

    attendance.checkInTime = new Date();
    attendance.status = 'Present';
    await attendance.save();

    res.status(200).json({ success: true, data: { attendance } });
  } catch (err) {
    next(err);
  }
};

// Check out
exports.checkOut = async (req, res, next) => {
  try {
    const today = getStartOfDay();
    const attendance = await Attendance.findOne({
      staffId: req.user._id,
      company: req.company._id,
      date: today
    });

    if (!attendance || !attendance.checkInTime) {
      return next(new AppError('Must check in first', 400));
    }
    if (attendance.checkOutTime) {
      return next(new AppError('Already checked out today', 400));
    }

    const checkOutTime = new Date();
    attendance.checkOutTime = checkOutTime;

    // Calculate total hours
    const diffMs = checkOutTime - attendance.checkInTime;
    const diffHrs = diffMs / (1000 * 60 * 60);
    attendance.totalHours = parseFloat(diffHrs.toFixed(2));

    // Calculate status and overtime
    if (attendance.totalHours >= 8) {
      attendance.status = 'Present';
      if (attendance.totalHours > 8) {
        attendance.overtimeHours = parseFloat((attendance.totalHours - 8).toFixed(2));
      }
    } else if (attendance.totalHours >= 4) {
      attendance.status = 'Half';
    } else {
      attendance.status = 'Absent';
    }

    await attendance.save();
    res.status(200).json({ success: true, data: { attendance } });
  } catch (err) {
    next(err);
  }
};

// Get today's attendance (For current user)
exports.getMyTodayAttendance = async (req, res, next) => {
  try {
    const today = getStartOfDay();
    const attendance = await Attendance.findOne({
      staffId: req.user._id,
      company: req.company._id,
      date: today
    });
    res.status(200).json({ success: true, data: { attendance } });
  } catch (err) {
    next(err);
  }
};

// Admin: Get all attendance for a date or date range
exports.getAllAttendance = async (req, res, next) => {
  try {
    const { date, startDate, endDate, staffId } = req.query;
    let query = { company: req.company._id };

    if (staffId) query.staffId = staffId;

    if (date) {
      query.date = getStartOfDay(new Date(date));
    } else if (startDate && endDate) {
      query.date = {
        $gte: getStartOfDay(new Date(startDate)),
        $lte: getStartOfDay(new Date(endDate))
      };
    } else {
      query.date = getStartOfDay(); // Default to today
    }

    const records = await Attendance.find(query)
      .populate('staffId', 'name phone role salaryType')
      .sort({ date: -1, 'staffId.name': 1 });

    res.status(200).json({ success: true, data: { records } });
  } catch (err) {
    next(err);
  }
};

// Admin: Mark attendance for specific staff on a specific date
exports.markAttendance = async (req, res, next) => {
  try {
    const { staffId, date, status, checkInTime, checkOutTime, totalHours, overtimeHours, note } = req.body;

    if (!staffId || !date || !status) {
      return next(new AppError('staffId, date, and status are required', 400));
    }

    // Verify staff belongs to this company
    const staff = await User.findOne({ _id: staffId, company: req.company._id });
    if (!staff) return next(new AppError('Staff not found', 404));

    const attendanceDate = getStartOfDay(new Date(date));

    // Upsert attendance record
    const attendance = await Attendance.findOneAndUpdate(
      { staffId, company: req.company._id, date: attendanceDate },
      {
        staffId,
        company: req.company._id,
        date: attendanceDate,
        status,
        checkInTime: checkInTime ? new Date(checkInTime) : undefined,
        checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
        totalHours: totalHours || (status === 'Present' ? 8 : status === 'Half' ? 4 : 0),
        overtimeHours: overtimeHours || 0,
        note
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, data: { attendance } });
  } catch (err) {
    next(err);
  }
};

// Admin: Get attendance summary per staff for a month
exports.getMonthlyAttendanceSummary = async (req, res, next) => {
  try {
    const { month } = req.query; // 'YYYY-MM'
    if (!month) return next(new AppError('month parameter required (YYYY-MM)', 400));

    const [year, m] = month.split('-');
    const startDate = new Date(year, parseInt(m) - 1, 1);
    const endDate = new Date(year, parseInt(m), 0, 23, 59, 59);

    // Get all active staff
    const staffList = await User.find({
      company: req.company._id,
      role: { $ne: 'admin' },
      isActive: true
    }).select('name phone role salaryType salaryAmount');

    const summary = await Promise.all(staffList.map(async (staff) => {
      const records = await Attendance.find({
        staffId: staff._id,
        company: req.company._id,
        date: { $gte: startDate, $lte: endDate }
      });

      const present = records.filter(r => r.status === 'Present').length;
      const half = records.filter(r => r.status === 'Half').length;
      const absent = records.filter(r => r.status === 'Absent').length;
      const totalOT = records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

      return {
        staff,
        present,
        half,
        absent,
        totalOT: parseFloat(totalOT.toFixed(2)),
        totalDaysMarked: records.length,
      };
    }));

    res.status(200).json({ success: true, data: { summary, month } });
  } catch (err) {
    next(err);
  }
};

// Admin: Update attendance manually (by record id)
exports.updateAttendance = async (req, res, next) => {
  try {
    const { status, totalHours, overtimeHours, checkInTime, checkOutTime } = req.body;
    
    const attendance = await Attendance.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      { status, totalHours, overtimeHours, checkInTime, checkOutTime },
      { new: true, runValidators: true }
    );

    if (!attendance) return next(new AppError('Attendance record not found', 404));

    res.status(200).json({ success: true, data: { attendance } });
  } catch (err) {
    next(err);
  }
};

// Admin: Delete attendance record
exports.deleteAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.findOneAndDelete({
      _id: req.params.id,
      company: req.company._id
    });
    if (!attendance) return next(new AppError('Attendance record not found', 404));
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

// Admin: Export attendance as CSV for a month
exports.exportAttendanceCsv = async (req, res, next) => {
  try {
    const { month } = req.query; // 'YYYY-MM'
    if (!month) return next(new AppError('month required', 400));
    const [year, m] = month.split('-');
    const startDate = new Date(year, parseInt(m) - 1, 1);
    const endDate = new Date(year, parseInt(m), 0, 23, 59, 59);

    const records = await Attendance.find({
      company: req.company._id,
      date: { $gte: startDate, $lte: endDate }
    }).populate('staffId', 'name role salaryType salaryAmount');

    const rows = [['Date', 'Staff Name', 'Role', 'Salary Type', 'Check In', 'Check Out', 'Total Hours', 'Status', 'OT Hours']];
    records.forEach(r => {
      rows.push([
        new Date(r.date).toLocaleDateString('en-IN'),
        r.staffId?.name || '',
        r.staffId?.role || '',
        r.staffId?.salaryType || '',
        r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '',
        r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '',
        r.totalHours || 0,
        r.status || '',
        r.overtimeHours || 0
      ]);
    });

    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${month}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

