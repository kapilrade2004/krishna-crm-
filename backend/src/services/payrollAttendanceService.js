'use strict';

const { Op } = require('sequelize');
const {
  AttendanceDay,
  Employee,
  PayrollProfile,
  PayrollRecord,
  User,
} = require('../models');
const logger = require('../config/logger');

/**
 * Payroll Attendance Service
 * Computes monthly attendance summaries and feeds real attendance statistics into salary computation.
 */
class PayrollAttendanceService {
  /**
   * Get days in month (e.g., "2026-08" -> 31)
   */
  getDaysInMonth(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }

  /**
   * Calculate monthly attendance summary for an employee
   */
  async getEmployeeMonthlyAttendanceSummary(employeeId, yearMonth) {
    const totalDays = this.getDaysInMonth(yearMonth);
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${String(totalDays).padStart(2, '0')}`;

    const records = await AttendanceDay.findAll({
      where: {
        employee_id: employeeId,
        date: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [['date', 'ASC']],
    });

    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let onLeaveCount = 0;
    let holidayCount = 0;
    let weekOffCount = 0;
    let overtimeCount = 0;
    let incompleteCount = 0;

    let totalWorkMinutes = 0;
    let totalLateMinutes = 0;
    let totalOvertimeMinutes = 0;

    for (const rec of records) {
      totalWorkMinutes += rec.total_work_minutes || 0;
      totalLateMinutes += rec.late_minutes || 0;
      totalOvertimeMinutes += rec.overtime_minutes || 0;

      switch (rec.status) {
        case 'PRESENT':
          presentCount++;
          break;
        case 'LATE':
          lateCount++;
          presentCount++; // Late employees still attended work
          break;
        case 'OVERTIME':
          overtimeCount++;
          presentCount++;
          break;
        case 'HALF_DAY':
          halfDayCount++;
          break;
        case 'ABSENT':
          absentCount++;
          break;
        case 'ON_LEAVE':
          onLeaveCount++;
          break;
        case 'HOLIDAY':
          holidayCount++;
          break;
        case 'WEEK_OFF':
          weekOffCount++;
          break;
        case 'INCOMPLETE':
          incompleteCount++;
          break;
        default:
          absentCount++;
          break;
      }
    }

    // Default week offs (assume ~4-8 weekend days if not explicitly marked)
    const recordedDaysCount = records.length;
    const missingDays = Math.max(0, totalDays - recordedDaysCount);
    // If some days have no record yet, treat them as pending/unrecorded

    const payableDays =
      presentCount +
      onLeaveCount +
      holidayCount +
      weekOffCount +
      halfDayCount * 0.5;

    const unpaidDays = absentCount + halfDayCount * 0.5;

    return {
      year_month: yearMonth,
      total_days: totalDays,
      recorded_days: recordedDaysCount,
      present_days: presentCount,
      late_days: lateCount,
      half_days: halfDayCount,
      absent_days: absentCount,
      on_leave_days: onLeaveCount,
      holiday_days: holidayCount,
      week_off_days: weekOffCount,
      incomplete_days: incompleteCount,
      payable_days: Math.round(payableDays * 10) / 10,
      unpaid_days: Math.round(unpaidDays * 10) / 10,
      total_work_hours: Math.round((totalWorkMinutes / 60) * 10) / 10,
      total_late_minutes: totalLateMinutes,
      total_overtime_hours: Math.round((totalOvertimeMinutes / 60) * 10) / 10,
      records,
    };
  }

  /**
   * Calculate salary with biometric attendance adjustments for an employee
   */
  async calculateMonthlySalary(employeeId, yearMonth, customOverrides = {}) {
    const employee = await Employee.findByPk(employeeId, {
      include: [
        { model: PayrollProfile, as: 'payrollProfile' },
        { model: User, as: 'linkedUser' },
      ],
    });

    if (!employee) throw new Error('Employee not found.');

    const summary = await this.getEmployeeMonthlyAttendanceSummary(employeeId, yearMonth);
    const profile = employee.payrollProfile;

    // Base salary fallback
    const baseSalary = Number(profile ? profile.basic_salary : employee.salary) || 30000;
    const basic = customOverrides.basic !== undefined ? Number(customOverrides.basic) : Math.round(baseSalary * 0.55);
    const hra = customOverrides.hra !== undefined ? Number(customOverrides.hra) : Math.round(baseSalary * 0.25);
    const conveyance = customOverrides.conveyance !== undefined ? Number(customOverrides.conveyance) : 2000;
    const special = customOverrides.special_allowance !== undefined ? Number(customOverrides.special_allowance) : Math.round(baseSalary * 0.12);

    const standardGross = basic + hra + conveyance + special;

    // Unpaid absence deduction: (Gross / Total Days) * Unpaid Days
    const perDayRate = summary.total_days > 0 ? standardGross / summary.total_days : 0;
    const unpaidDeduction = Math.round(perDayRate * summary.unpaid_days);

    // Overtime addition: (Gross / Total Days / 8 hrs) * 1.5 * Overtime Hours
    const hourlyRate = perDayRate / 8;
    const overtimeRate = hourlyRate * 1.25;
    const overtimeAddition = Math.round(overtimeRate * summary.total_overtime_hours);

    // Late penalty: 3+ late days = 0.5 day deduction
    let latePenaltyDeduction = 0;
    if (summary.late_days >= 3) {
      const latePenaltyFactor = Math.floor(summary.late_days / 3) * 0.5;
      latePenaltyDeduction = Math.round(perDayRate * latePenaltyFactor);
    }

    const pf = customOverrides.pf !== undefined ? Number(customOverrides.pf) : 1800;
    const esi = customOverrides.esi !== undefined ? Number(customOverrides.esi) : Math.round(baseSalary * 0.015);
    const tds = customOverrides.tds !== undefined ? Number(customOverrides.tds) : (baseSalary > 50000 ? 1500 : 0);

    const grossSalary = Math.max(0, standardGross + overtimeAddition - unpaidDeduction - latePenaltyDeduction);
    const totalDeductions = pf + esi + tds;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    return {
      employee_id: employee.id,
      employee_code: employee.employee_code,
      employee_name: `${employee.first_name} ${employee.last_name}`,
      designation: employee.designation || 'Staff',
      department: employee.department || 'General',
      payroll_month: yearMonth,
      attendance_summary: summary,
      breakdown: {
        base_salary: baseSalary,
        basic,
        hra,
        conveyance,
        special_allowance: special,
        standard_gross: standardGross,
        overtime_addition: overtimeAddition,
        unpaid_absence_deduction: unpaidDeduction,
        late_penalty_deduction: latePenaltyDeduction,
        gross_salary: grossSalary,
        pf,
        esi,
        tds,
        total_deductions: totalDeductions,
        net_salary: netSalary,
      },
    };
  }
}

module.exports = new PayrollAttendanceService();
