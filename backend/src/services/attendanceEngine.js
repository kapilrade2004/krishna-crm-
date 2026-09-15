'use strict';

const { Op } = require('sequelize');
const {
  AttendanceDay,
  AttendanceSegment,
  AttendanceShift,
  AttendanceCorrection,
  BiometricPunchEvent,
  Employee,
} = require('../models');
const logger = require('../config/logger');

/**
 * Attendance Engine
 * Core deterministic engine for processing biometric & manual punches into daily attendance records.
 */
class AttendanceEngine {
  /**
   * Helper: Parse "HH:mm:ss" or Date into minutes from midnight
   */
  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    if (timeStr instanceof Date) {
      return timeStr.getHours() * 60 + timeStr.getMinutes();
    }
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }

  /**
   * Helper: Format minutes from midnight to "HH:mm:ss"
   */
  minutesToTimeStr(minutes) {
    const total = Math.max(0, Math.floor(minutes));
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }

  /**
   * Helper: Format Date to "HH:mm:ss"
   */
  dateToTimeString(date) {
    if (!date) return null;
    const d = new Date(date);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  /**
   * Determine punch direction if vendor returns UNKNOWN
   */
  normalizePunchDirection(punches) {
    // If directions already provided (in / out), respect them
    // Otherwise, pair chronologically: 1st IN, 2nd OUT, 3rd IN, 4th OUT...
    return punches.map((p, idx) => {
      let dir = (p.punch_direction || '').toUpperCase().trim();
      if (dir !== 'IN' && dir !== 'OUT') {
        dir = idx % 2 === 0 ? 'IN' : 'OUT';
      }
      return {
        ...p,
        normalized_direction: dir,
      };
    });
  }

  /**
   * Build work and break segments from a sequence of normalized punches
   */
  buildSegments(normalizedPunches) {
    const workSegments = [];
    const breakSegments = [];

    let currentIn = null;
    let lastOut = null;

    for (let i = 0; i < normalizedPunches.length; i++) {
      const p = normalizedPunches[i];
      const pTime = new Date(p.punch_timestamp);

      if (p.normalized_direction === 'IN') {
        if (lastOut) {
          // Time between last OUT and this IN is a BREAK
          const breakDuration = Math.max(0, Math.round((pTime - new Date(lastOut.punch_timestamp)) / 60000));
          if (breakDuration > 0) {
            breakSegments.push({
              segment_type: 'BREAK',
              in_time: new Date(lastOut.punch_timestamp),
              out_time: pTime,
              duration_minutes: breakDuration,
              in_event_id: lastOut.id,
              out_event_id: p.id,
            });
          }
        }
        currentIn = p;
        lastOut = null;
      } else if (p.normalized_direction === 'OUT') {
        if (currentIn) {
          // Time between current IN and this OUT is a WORK segment
          const workDuration = Math.max(0, Math.round((pTime - new Date(currentIn.punch_timestamp)) / 60000));
          workSegments.push({
            segment_type: 'WORK',
            in_time: new Date(currentIn.punch_timestamp),
            out_time: pTime,
            duration_minutes: workDuration,
            in_event_id: currentIn.id,
            out_event_id: p.id,
          });
          lastOut = p;
          currentIn = null;
        } else {
          // Standalone OUT without previous IN
          lastOut = p;
        }
      }
    }

    // If there's an unmatched open IN at the end of the day
    const hasUnmatchedIn = Boolean(currentIn);

    return {
      workSegments,
      breakSegments,
      hasUnmatchedIn,
      openInPunch: currentIn,
    };
  }

  /**
   * Calculate and save/update the daily attendance record for an employee on a given date.
   * Fully idempotent: can be recalculated whenever punches or shifts change.
   */
  async calculateAttendanceForDay(employeeId, dateStr, options = {}) {
    try {
      const { transaction = null, overrideShiftId = null } = options;

      const employee = await Employee.findByPk(employeeId, { transaction });
      if (!employee) {
        throw new Error(`Employee ${employeeId} not found for attendance calculation.`);
      }

      // 1. Fetch Shift Definition (employee shift, override, or default)
      let shift = null;
      if (overrideShiftId) {
        shift = await AttendanceShift.findByPk(overrideShiftId, { transaction });
      }
      if (!shift) {
        shift = await AttendanceShift.findOne({ where: { is_default: true, is_active: true }, transaction });
      }
      if (!shift) {
        shift = {
          id: null,
          shift_name: 'Standard Shift (10:00 - 18:00)',
          start_time: '10:00:00',
          end_time: '18:00:00',
          grace_period_minutes: 10,
          late_after_minutes: 10,
          early_leave_before_minutes: 10,
          min_full_day_hours: 8.0,
          min_half_day_hours: 4.0,
        };
      }

      // 2. Fetch all raw punch events for this employee on this date
      const punchEvents = await BiometricPunchEvent.findAll({
        where: {
          employee_id: employeeId,
          punch_date: dateStr,
        },
        order: [['punch_timestamp', 'ASC']],
        transaction,
      });

      // 3. Check for approved manual correction
      const approvedCorrection = await AttendanceCorrection.findOne({
        where: {
          employee_id: employeeId,
          correction_date: dateStr,
          status: 'approved',
        },
        order: [['updated_at', 'DESC']],
        transaction,
      });

      // If no punches and no manual correction, check if existing record needs updating or if absent
      if (punchEvents.length === 0 && !approvedCorrection) {
        let attDay = await AttendanceDay.findOne({
          where: { employee_id: employeeId, date: dateStr },
          transaction,
        });
        if (attDay && !attDay.is_locked) {
          await attDay.update({
            status: 'ABSENT',
            first_in: null,
            last_out: null,
            total_work_minutes: 0,
            total_break_minutes: 0,
            work_hours: 0,
            break_hours: 0,
            late_minutes: 0,
            early_leave_minutes: 0,
            overtime_minutes: 0,
          }, { transaction });
        }
        return attDay;
      }

      // 4. Normalize & Segment Punches
      const normalized = this.normalizePunchDirection(punchEvents.map((p) => p.toJSON()));
      const { workSegments, breakSegments, hasUnmatchedIn } = this.buildSegments(normalized);

      // Determine First IN and Last OUT
      let firstInStr = normalized.length > 0 ? this.dateToTimeString(normalized[0].punch_timestamp) : null;
      let lastOutStr = null;

      const lastPunch = normalized[normalized.length - 1];
      if (lastPunch && lastPunch.normalized_direction === 'OUT') {
        lastOutStr = this.dateToTimeString(lastPunch.punch_timestamp);
      }

      let totalWorkMinutes = workSegments.reduce((acc, s) => acc + s.duration_minutes, 0);
      let totalBreakMinutes = breakSegments.reduce((acc, s) => acc + s.duration_minutes, 0);

      // Apply approved manual correction overrides if present
      let isCorrected = false;
      let correctionRemarks = null;
      if (approvedCorrection) {
        isCorrected = true;
        correctionRemarks = `Manual override applied: ${approvedCorrection.reason}`;
        if (approvedCorrection.corrected_in) firstInStr = approvedCorrection.corrected_in;
        if (approvedCorrection.corrected_out) lastOutStr = approvedCorrection.corrected_out;

        if (firstInStr && lastOutStr) {
          const inM = this.timeToMinutes(firstInStr);
          const outM = this.timeToMinutes(lastOutStr);
          totalWorkMinutes = Math.max(0, outM - inM - totalBreakMinutes);
        }
      }

      const workHours = Math.round((totalWorkMinutes / 60) * 100) / 100;
      const breakHours = Math.round((totalBreakMinutes / 60) * 100) / 100;

      // 5. Shift & Late / Early / Overtime Calculations
      const shiftStartMinutes = this.timeToMinutes(shift.start_time);
      const shiftEndMinutes = this.timeToMinutes(shift.end_time);
      const shiftDurationMinutes = shiftEndMinutes - shiftStartMinutes;
      const graceMinutes = shift.grace_period_minutes || 10;
      const earlyLeaveThresholdMinutes = shift.early_leave_before_minutes || 10;

      let lateMinutes = 0;
      let earlyLeaveMinutes = 0;
      let overtimeMinutes = 0;

      if (firstInStr) {
        const firstInMinutes = this.timeToMinutes(firstInStr);
        if (firstInMinutes > shiftStartMinutes + graceMinutes) {
          lateMinutes = firstInMinutes - shiftStartMinutes;
        }
      }

      if (lastOutStr) {
        const lastOutMinutes = this.timeToMinutes(lastOutStr);
        if (lastOutMinutes < shiftEndMinutes - earlyLeaveThresholdMinutes) {
          earlyLeaveMinutes = shiftEndMinutes - lastOutMinutes;
        } else if (lastOutMinutes > shiftEndMinutes) {
          overtimeMinutes = lastOutMinutes - shiftEndMinutes;
        }
      }

      // 6. Status Determination
      let status = 'PRESENT';

      if (hasUnmatchedIn && !lastOutStr && !approvedCorrection) {
        // Punched IN but no OUT punch registered
        status = 'INCOMPLETE';
      } else if (workHours >= Number(shift.min_full_day_hours || 8.0)) {
        if (lateMinutes > 0) {
          status = 'LATE';
        } else if (overtimeMinutes >= 60) {
          status = 'OVERTIME';
        } else {
          status = 'PRESENT';
        }
      } else if (workHours >= Number(shift.min_half_day_hours || 4.0)) {
        status = 'HALF_DAY';
      } else if (workHours > 0) {
        status = 'EARLY_LEAVE';
      } else {
        status = 'ABSENT';
      }

      // 7. Upsert AttendanceDay Record
      let [attDay] = await AttendanceDay.findOrCreate({
        where: { employee_id: employeeId, date: dateStr },
        defaults: {
          employee_id: employeeId,
          employee_code: employee.employee_code,
          date: dateStr,
          shift_id: shift.id,
          scheduled_start: shift.start_time,
          scheduled_end: shift.end_time,
          first_in: firstInStr,
          last_out: lastOutStr,
          total_work_minutes: totalWorkMinutes,
          total_break_minutes: totalBreakMinutes,
          work_hours: workHours,
          break_hours: breakHours,
          late_minutes: lateMinutes,
          early_leave_minutes: earlyLeaveMinutes,
          overtime_minutes: overtimeMinutes,
          status,
          source: punchEvents.some(p => p.source === 'MANUAL') ? (punchEvents.some(p => p.source === 'BIOMETRIC') ? 'HYBRID' : 'MANUAL') : 'BIOMETRIC',
          is_corrected: isCorrected,
          remarks: correctionRemarks,
        },
        transaction,
      });

      if (!attDay.is_locked) {
        await attDay.update({
          employee_code: employee.employee_code,
          shift_id: shift.id,
          scheduled_start: shift.start_time,
          scheduled_end: shift.end_time,
          first_in: firstInStr,
          last_out: lastOutStr,
          total_work_minutes: totalWorkMinutes,
          total_break_minutes: totalBreakMinutes,
          work_hours: workHours,
          break_hours: breakHours,
          late_minutes: lateMinutes,
          early_leave_minutes: earlyLeaveMinutes,
          overtime_minutes: overtimeMinutes,
          status,
          source: punchEvents.some(p => p.source === 'MANUAL') ? (punchEvents.some(p => p.source === 'BIOMETRIC') ? 'HYBRID' : 'MANUAL') : 'BIOMETRIC',
          is_corrected: isCorrected,
          remarks: correctionRemarks,
        }, { transaction });
      }

      // 8. Rebuild Attendance Segments
      await AttendanceSegment.destroy({
        where: { attendance_day_id: attDay.id },
        transaction,
      });

      const allSegmentsToInsert = [...workSegments, ...breakSegments].map((s) => ({
        attendance_day_id: attDay.id,
        employee_id: employeeId,
        segment_type: s.segment_type,
        in_time: s.in_time,
        out_time: s.out_time,
        duration_minutes: s.duration_minutes,
        in_event_id: s.in_event_id,
        out_event_id: s.out_event_id,
      }));

      if (allSegmentsToInsert.length > 0) {
        await AttendanceSegment.bulkCreate(allSegmentsToInsert, { transaction });
      }

      // 9. Mark Punch Events as PROCESSED
      if (punchEvents.length > 0) {
        await BiometricPunchEvent.update(
          {
            processing_status: 'PROCESSED',
            processed_at: new Date(),
          },
          {
            where: {
              id: { [Op.in]: punchEvents.map((p) => p.id) },
              processing_status: { [Op.ne]: 'PROCESSED' },
            },
            transaction,
          }
        );
      }

      return attDay;
    } catch (err) {
      logger.error(`Attendance calculation error for employee ${employeeId} on ${dateStr}:`, err.message);
      throw err;
    }
  }

  /**
   * Recalculate attendance for a range of dates or all active employees
   */
  async recalculateDateRange(startDateStr, endDateStr, employeeId = null) {
    const where = { status: 'active' };
    if (employeeId) where.id = employeeId;

    const employees = await Employee.findAll({ where });
    const results = [];

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    for (const emp of employees) {
      const current = new Date(start);
      while (current <= end) {
        const dStr = current.toISOString().split('T')[0];
        const res = await this.calculateAttendanceForDay(emp.id, dStr);
        if (res) results.push(res);
        current.setDate(current.getDate() + 1);
      }
    }

    return results;
  }
}

module.exports = new AttendanceEngine();
