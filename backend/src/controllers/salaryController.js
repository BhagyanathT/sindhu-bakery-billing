// src/controllers/salaryController.js
const Salary = require('../models/Salary');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// Calculate and generate salary for a specific month or week
exports.generateSalary = async (req, res, next) => {
  try {
    const { month, week } = req.body; // month: 'YYYY-MM' | week: 'YYYY-Www' (e.g. '2026-W19')
    
    let period, startDate, endDate, isWeekly = false;

    if (week) {
      // Parse ISO week: e.g. '2026-W19'
      isWeekly = true;
      period = week;
      const [yearStr, weekStr] = week.split('-W');
      const year = parseInt(yearStr);
      const weekNum = parseInt(weekStr);
      // Get Monday of that ISO week
      const jan4 = new Date(year, 0, 4);
      const mondayOfW1 = new Date(jan4);
      mondayOfW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
      startDate = new Date(mondayOfW1);
      startDate.setDate(mondayOfW1.getDate() + (weekNum - 1) * 7);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else if (month) {
      period = month;
      const [year, m] = month.split('-');
      startDate = new Date(year, parseInt(m) - 1, 1);
      endDate = new Date(year, parseInt(m), 0);
    } else {
      return next(new AppError('month (YYYY-MM) or week (YYYY-Www) is required', 400));
    }

    // Get all active staff
    const staffMembers = await User.find({
      company: req.company._id,
      role: { $ne: 'admin' },
      isActive: true
    });

    const generatedSalaries = [];

    for (const staff of staffMembers) {
      // Skip staff with wrong pay cycle
      if (isWeekly && staff.salaryType !== 'weekly') continue;
      if (!isWeekly && staff.salaryType === 'weekly') continue;

      // Get attendance records for this period
      const attendanceRecords = await Attendance.find({
        staffId: staff._id,
        company: req.company._id,
        date: { $gte: startDate, $lte: endDate }
      });

      let presentDays = 0, halfDays = 0, overtimeHours = 0;
      attendanceRecords.forEach(record => {
        if (record.status === 'Present') presentDays++;
        else if (record.status === 'Half') halfDays++;
        overtimeHours += (record.overtimeHours || 0);
      });

      const baseSalary = staff.salaryAmount || 0;
      let finalSalary = 0;

      if (staff.salaryType === 'monthly') {
        const totalWorkingDays = endDate.getDate();
        const earnedDays = presentDays + (0.5 * halfDays);
        finalSalary = (earnedDays / totalWorkingDays) * baseSalary;
        const hourlyRate = baseSalary / (totalWorkingDays * 8);
        finalSalary += overtimeHours * hourlyRate;

      } else if (staff.salaryType === 'weekly') {
        // Base = weekly salary amount; 5 working days per week
        const totalWorkingDays = 6; // Mon-Sat typically for bakeries
        const earnedDays = presentDays + (0.5 * halfDays);
        finalSalary = (earnedDays / totalWorkingDays) * baseSalary;
        const hourlyRate = baseSalary / (totalWorkingDays * 8);
        finalSalary += overtimeHours * hourlyRate;

      } else if (staff.salaryType === 'daily') {
        finalSalary = (presentDays * baseSalary) + (halfDays * (baseSalary / 2));
        const hourlyRate = baseSalary / 8;
        finalSalary += overtimeHours * hourlyRate;
      }

      // Check existing record
      let salaryRecord = await Salary.findOne({
        staffId: staff._id,
        company: req.company._id,
        month: period
      });

      const advances = salaryRecord ? salaryRecord.advances : 0;
      finalSalary = Math.max(0, finalSalary - advances);

      if (salaryRecord) {
        if (salaryRecord.status !== 'Paid') {
          salaryRecord.presentDays = presentDays;
          salaryRecord.halfDays = halfDays;
          salaryRecord.overtimeHours = parseFloat(overtimeHours.toFixed(2));
          salaryRecord.baseSalary = baseSalary;
          salaryRecord.finalSalary = parseFloat(finalSalary.toFixed(2));
          await salaryRecord.save();
        }
      } else {
        salaryRecord = await Salary.create({
          staffId: staff._id,
          company: req.company._id,
          month: period,
          totalWorkingDays: isWeekly ? 6 : endDate.getDate(),
          presentDays,
          halfDays,
          overtimeHours: parseFloat(overtimeHours.toFixed(2)),
          baseSalary,
          finalSalary: parseFloat(finalSalary.toFixed(2)),
          advances: 0,
          status: 'Pending'
        });
      }

      generatedSalaries.push(salaryRecord);
    }

    res.status(200).json({ success: true, data: { salaries: generatedSalaries } });
  } catch (err) {
    next(err);
  }
};

// Get all salaries for a specific month/week
exports.getSalaries = async (req, res, next) => {
  try {
    const { month } = req.query;
    let query = { company: req.company._id };
    if (month) query.month = month;

    const salaries = await Salary.find(query)
      .populate('staffId', 'name phone role salaryType')
      .sort({ month: -1, createdAt: -1 });

    res.status(200).json({ success: true, data: { salaries } });
  } catch (err) {
    next(err);
  }
};

// Get pending salary count for alerts
exports.getPendingSalarySummary = async (req, res, next) => {
  try {
    const pendingSalaries = await Salary.find({
      company: req.company._id,
      status: 'Pending'
    }).populate('staffId', 'name role salaryType');

    const totalPending = pendingSalaries.reduce((sum, s) => sum + s.finalSalary, 0);

    res.status(200).json({
      success: true,
      data: {
        count: pendingSalaries.length,
        totalPending: parseFloat(totalPending.toFixed(2)),
        records: pendingSalaries
      }
    });
  } catch (err) {
    next(err);
  }
};

// Update salary status / advances
exports.updateSalary = async (req, res, next) => {
  try {
    const { status, advances } = req.body;
    
    const salary = await Salary.findOne({ _id: req.params.id, company: req.company._id });
    if (!salary) return next(new AppError('Salary record not found', 404));

    if (status) {
      salary.status = status;
      if (status === 'Paid' && !salary.paidDate) {
        salary.paidDate = new Date();
      }
    }

    if (advances !== undefined) {
      salary.finalSalary = Math.max(0, salary.finalSalary + salary.advances - advances);
      salary.advances = advances;
    }

    await salary.save();

    res.status(200).json({ success: true, data: { salary } });
  } catch (err) {
    next(err);
  }
};

// Admin: Delete a salary record
exports.deleteSalary = async (req, res, next) => {
  try {
    const salary = await Salary.findOneAndDelete({ _id: req.params.id, company: req.company._id });
    if (!salary) return next(new AppError('Salary record not found', 404));
    res.status(200).json({ success: true, message: 'Salary record deleted' });
  } catch (err) {
    next(err);
  }
};

// Admin: Export salary as CSV
exports.exportSalaryCsv = async (req, res, next) => {
  try {
    const { month } = req.query;
    let query = { company: req.company._id };
    if (month) query.month = month;

    const salaries = await Salary.find(query).populate('staffId', 'name role phone salaryType');
    const rows = [['Period', 'Staff Name', 'Role', 'Salary Type', 'Present Days', 'Half Days', 'OT Hours', 'Base Salary', 'Advances', 'Final Salary', 'Status', 'Paid Date']];
    salaries.forEach(s => {
      rows.push([
        s.month,
        s.staffId?.name || '', s.staffId?.role || '', s.staffId?.salaryType || '',
        s.presentDays, s.halfDays, s.overtimeHours,
        s.baseSalary, s.advances, s.finalSalary,
        s.status, s.paidDate ? new Date(s.paidDate).toLocaleDateString('en-IN') : ''
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="salary_${month || 'all'}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

