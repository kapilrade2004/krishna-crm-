'use strict';

const fs   = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

// ── Load Employee models ──────────────────────────────────────────────────────
let Employee, EmployeeDocument, DOC_TYPES, DOC_TYPE_LABELS, MANDATORY_DOC_TYPES;
try {
  const empModule = require('../models/Employee');
  Employee           = empModule.Employee;
  EmployeeDocument   = empModule.EmployeeDocument;
  DOC_TYPES          = empModule.DOC_TYPES;
  DOC_TYPE_LABELS    = empModule.DOC_TYPE_LABELS;
  MANDATORY_DOC_TYPES = empModule.MANDATORY_DOC_TYPES || ['aadhaar_card', 'pan_card', 'resume', 'bank_passbook', 'photo'];
  if (!Employee) throw new Error('Employee model not found');
} catch (err) {
  console.error('FATAL: Failed to load Employee model:', err.message);
  throw err;
}

// ── Load User from index ──────────────────────────────────────────────────────
const { User } = require('../models');
const { createAuditEvent } = require('../services/auditService');

const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination } = require('../utils/response');
const logger = require('../config/logger');

// ── Helper: Profile completeness % ───────────────────────────────────────────
const calcCompleteness = (e) => {
  const fields = [
    'date_of_birth','gender','phone','present_address',
    'employee_code','department','designation','date_of_joining',
    'bank_name','bank_account_number','bank_ifsc','pan_number',
    'emergency_contact_name','emergency_contact_phone',
  ];
  const filled = fields.filter(f => e[f] && String(e[f]).trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
};

// ── Helper: Calculate Onboarding Progress & Mandatory Doc Checklist ───────────
const calcOnboardingProgress = (documents = []) => {
  const currentDocs = documents.filter(d => d.is_current !== false);
  const checklist = MANDATORY_DOC_TYPES.map(type => {
    const doc = currentDocs.find(d => d.document_type === type);
    return {
      type,
      label: DOC_TYPE_LABELS[type] || type,
      status: doc ? doc.status : 'missing',
      doc_id: doc ? doc.id : null,
      updated_at: doc ? doc.updated_at : null,
      rejection_reason: doc ? doc.rejection_reason : null,
      remarks: doc ? doc.remarks : null,
    };
  });

  const verifiedCount = checklist.filter(c => c.status === 'verified').length;
  const uploadedCount = checklist.filter(c => ['uploaded', 'under_review', 'verified'].includes(c.status)).length;
  const totalMandatory = MANDATORY_DOC_TYPES.length;

  const completionPercent = Math.round((uploadedCount / totalMandatory) * 100);
  const verifiedPercent = Math.round((verifiedCount / totalMandatory) * 100);
  const missingTypes = checklist.filter(c => c.status === 'missing' || c.status === 'rejected').map(c => c.label);

  return {
    checklist,
    completion_percent: completionPercent,
    verified_percent: verifiedPercent,
    missing_docs: missingTypes,
    is_complete: verifiedCount === totalMandatory,
  };
};

// ── Helper: Auto-Update Employee Onboarding Status ────────────────────────────
const syncEmployeeOnboardingStatus = async (employeeId) => {
  try {
    const employee = await Employee.findByPk(employeeId, {
      include: [{ model: EmployeeDocument, as: 'documents' }]
    });
    if (!employee || employee.onboarding_status === 'waived') return;

    const { completion_percent, is_complete } = calcOnboardingProgress(employee.documents || []);

    let newStatus = 'pending';
    if (is_complete) {
      newStatus = 'completed';
    } else if (completion_percent > 0) {
      newStatus = 'in_progress';
    }

    if (employee.onboarding_status !== newStatus) {
      await employee.update({ onboarding_status: newStatus });
    }
  } catch (err) {
    logger.warn(`Failed to sync onboarding status for employee ${employeeId}: ${err.message}`);
  }
};

// ── GET /api/employees ────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status)            where.status            = req.query.status;
    if (req.query.onboarding_status) where.onboarding_status = req.query.onboarding_status;
    if (req.query.department)        where.department        = req.query.department;
    if (req.query.employment_type)   where.employment_type   = req.query.employment_type;

    // Manager scoping: Managers can only view employees in their team
    if (req.user.role === 'manager') {
      where[Op.or] = [
        { reporting_manager_id: req.user.id },
        { reporting_manager: req.user.name },
        { created_by: req.user.id },
      ];
    }

    if (req.query.q) {
      const search = `%${req.query.q}%`;
      const searchClause = [
        { first_name:    { [Op.like]: search } },
        { last_name:     { [Op.like]: search } },
        { email:         { [Op.like]: search } },
        { employee_code: { [Op.like]: search } },
        { designation:   { [Op.like]: search } },
      ];
      if (where[Op.or]) {
        where[Op.and] = [{ [Op.or]: where[Op.or] }, { [Op.or]: searchClause }];
        delete where[Op.or];
      } else {
        where[Op.or] = searchClause;
      }
    }

    let employees;
    try {
      employees = await Employee.findAll({
        where,
        include: [
          { model: EmployeeDocument, as: 'documents' },
          { model: User, as: 'linkedUser', attributes: ['id', 'name', 'email', 'role'] },
          { model: User, as: 'reportingManager', attributes: ['id', 'name', 'role'] },
        ],
        order: [['first_name', 'ASC'], ['last_name', 'ASC']],
      });
    } catch (includeErr) {
      logger.warn(`getAll employees fallback query: ${includeErr.message}`);
      employees = await Employee.findAll({
        where,
        order: [['first_name', 'ASC'], ['last_name', 'ASC']],
      });
    }

    const data = employees.map(e => {
      const json = e.toJSON();
      const progress = calcOnboardingProgress(json.documents || []);
      return {
        ...json,
        full_name: `${e.first_name} ${e.last_name}`,
        completeness: calcCompleteness(e),
        onboarding_completion: progress.completion_percent,
        missing_docs: progress.missing_docs,
        doc_count: (json.documents || []).filter(d => d.is_current !== false).length,
        verified_doc_count: (json.documents || []).filter(d => d.status === 'verified' && d.is_current !== false).length,
      };
    });

    sendSuccess(res, { employees: data });
  } catch (err) {
    logger.error('getAll employees error:', err.message);
    next(err);
  }
};

// ── GET /api/employees/departments ───────────────────────────────────────────
exports.getDepartments = async (req, res, next) => {
  try {
    const rows = await Employee.findAll({
      attributes: ['department'],
      where: { department: { [Op.ne]: null } },
      group: ['department'],
      raw: true,
    });
    sendSuccess(res, { departments: rows.map(r => r.department).filter(Boolean) });
  } catch (err) { next(err); }
};

// ── GET /api/employees/document-center (HR-Only) ──────────────────────────────
exports.getDocumentCenter = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.onboarding_status) where.onboarding_status = req.query.onboarding_status;
    if (req.query.department)        where.department        = req.query.department;

    let employees = await Employee.findAll({
      where,
      include: [
        {
          model: EmployeeDocument,
          as: 'documents',
          include: [
            { model: User, as: 'uploader', attributes: ['id', 'name'] },
            { model: User, as: 'verifier', attributes: ['id', 'name'] },
          ],
        },
        { model: User, as: 'linkedUser', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'reportingManager', attributes: ['id', 'name', 'role'] },
      ],
      order: [['created_at', 'DESC']],
    });

    // Filter by role if query param present
    if (req.query.role) {
      employees = employees.filter(e => e.linkedUser?.role === req.query.role);
    }

    // Filter by manager if query param present
    if (req.query.reporting_manager_id) {
      employees = employees.filter(e => e.reporting_manager_id === req.query.reporting_manager_id);
    }

    const rows = employees.map(e => {
      const json = e.toJSON();
      const docs = (json.documents || []).filter(d => d.is_current !== false);
      const progress = calcOnboardingProgress(docs);

      const pendingReviewCount = docs.filter(d => d.status === 'under_review' || d.status === 'uploaded').length;
      const rejectedCount = docs.filter(d => d.status === 'rejected').length;

      return {
        id: e.id,
        employee_code: e.employee_code,
        full_name: `${e.first_name} ${e.last_name}`,
        email: e.email,
        phone: e.phone,
        department: e.department || 'General',
        designation: e.designation || 'Staff',
        role: e.linkedUser?.role || 'Staff',
        reporting_manager: e.reportingManager?.name || e.reporting_manager || 'None',
        onboarding_status: e.onboarding_status || 'pending',
        onboarding_completion: progress.completion_percent,
        verified_percent: progress.verified_percent,
        missing_docs: progress.missing_docs,
        pending_review_count: pendingReviewCount,
        rejected_count: rejectedCount,
        documents: docs,
        checklist: progress.checklist,
        user_id: e.user_id,
        is_super_admin: e.linkedUser?.role === 'admin' || e.linkedUser?.role === 'super_admin',
      };
    });

    // Filter by document status if requested
    let resultRows = rows;
    if (req.query.document_status) {
      const docStat = req.query.document_status;
      if (docStat === 'pending_review') {
        resultRows = rows.filter(r => r.pending_review_count > 0);
      } else if (docStat === 'incomplete') {
        resultRows = rows.filter(r => r.onboarding_completion < 100);
      } else if (docStat === 'rejected') {
        resultRows = rows.filter(r => r.rejected_count > 0);
      } else if (docStat === 'verified') {
        resultRows = rows.filter(r => r.verified_percent === 100);
      }
    }

    sendSuccess(res, {
      employees: resultRows,
      summary: {
        total: rows.length,
        pending_onboarding: rows.filter(r => r.onboarding_status === 'pending' || r.onboarding_status === 'in_progress').length,
        completed_onboarding: rows.filter(r => r.onboarding_status === 'completed').length,
        pending_verifications: rows.reduce((acc, r) => acc + r.pending_review_count, 0),
        rejected_documents: rows.reduce((acc, r) => acc + r.rejected_count, 0),
      },
    });
  } catch (err) {
    logger.error('getDocumentCenter error:', err.message);
    next(err);
  }
};

// ── GET /api/employees/onboarding-dashboard ───────────────────────────────────
exports.getOnboardingDashboard = async (req, res, next) => {
  try {
    let where = {};
    if (req.user.role === 'manager') {
      where[Op.or] = [
        { reporting_manager_id: req.user.id },
        { reporting_manager: req.user.name },
        { created_by: req.user.id },
      ];
    }

    const employees = await Employee.findAll({
      where,
      include: [{ model: EmployeeDocument, as: 'documents' }],
    });

    let pendingOnboardingCount = 0;
    let incompleteDocsCount = 0;
    let rejectedDocsCount = 0;
    let verificationRequestsCount = 0;

    employees.forEach(e => {
      // Exclude primary Super Admin from employee document onboarding checklists
      if (e.email === 'admin@krishnacrm.com' || (e.designation && e.designation.toLowerCase().includes('admin'))) {
        return;
      }
      const docs = (e.documents || []).filter(d => d.is_current !== false);
      const progress = calcOnboardingProgress(docs);

      if (e.onboarding_status === 'pending' || e.onboarding_status === 'in_progress') {
        pendingOnboardingCount++;
      }
      if (progress.completion_percent < 100) {
        incompleteDocsCount++;
      }
      docs.forEach(d => {
        if (d.status === 'rejected') rejectedDocsCount++;
        if (d.status === 'under_review' || d.status === 'uploaded') verificationRequestsCount++;
      });
    });

    sendSuccess(res, {
      widgets: {
        pending_onboarding: pendingOnboardingCount,
        incomplete_documentation: incompleteDocsCount,
        rejected_documents: rejectedDocsCount,
        verification_requests: verificationRequestsCount,
        total_employees: employees.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/employees/documents/stats ───────────────────────────────────────
exports.getDocumentStats = async (req, res, next) => {
  try {
    const [byStatus, recentlyUploaded, pendingVerification] = await Promise.all([
      EmployeeDocument.findAll({
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: { is_current: true },
        group: ['status'], raw: true,
      }),
      EmployeeDocument.count({
        where: { is_current: true, created_at: { [Op.gte]: new Date(Date.now() - 7*24*60*60*1000) } },
      }),
      EmployeeDocument.count({ where: { is_current: true, status: { [Op.in]: ['uploaded', 'under_review'] } } }),
    ]);
    const total = byStatus.reduce((s, r) => s + Number(r.count), 0);
    sendSuccess(res, { stats: { byStatus, total, recentlyUploaded, pendingVerification } });
  } catch (err) { next(err); }
};

// ── GET /api/employees/documents ─────────────────────────────────────────────
exports.getAllDocuments = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = { is_current: true };
    if (req.query.status)        where.status        = req.query.status;
    if (req.query.document_type) where.document_type = req.query.document_type;
    if (req.query.employee_id)   where.employee_id   = req.query.employee_id;

    const empWhere = {};
    if (req.query.q) {
      empWhere[Op.or] = [
        { first_name: { [Op.like]: `%${req.query.q}%` } },
        { last_name:  { [Op.like]: `%${req.query.q}%` } },
      ];
    }

    const { count, rows } = await EmployeeDocument.findAndCountAll({
      where,
      include: [
        { model: Employee, as: 'employee',
          attributes: ['id','first_name','last_name','employee_code'],
          where: Object.keys(empWhere).length ? empWhere : undefined,
          required: !!req.query.q },
        { model: User, as: 'verifier',  attributes: ['id','name'], required: false },
        { model: User, as: 'uploader',  attributes: ['id','name'] },
      ],
      order: [['created_at','DESC']],
      limit, offset,
    });
    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) { next(err); }
};

// ── GET /api/employees/:id ────────────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    let employee = await Employee.findByPk(req.params.id, {
      include: [
        {
          model: EmployeeDocument, as: 'documents',
          include: [
            { model: User, as: 'verifier', attributes: ['id','name'], required: false },
            { model: User, as: 'uploader', attributes: ['id','name'] },
          ],
          order: [['version', 'DESC']],
        },
        { model: User, as: 'linkedUser', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'reportingManager', attributes: ['id', 'name', 'role'] },
      ],
    });

    // If id was a User ID (for self service), fallback lookup by user_id
    if (!employee) {
      employee = await Employee.findOne({
        where: { user_id: req.params.id },
        include: [
          {
            model: EmployeeDocument, as: 'documents',
            include: [
              { model: User, as: 'verifier', attributes: ['id','name'], required: false },
              { model: User, as: 'uploader', attributes: ['id','name'] },
            ],
            order: [['version', 'DESC']],
          },
          { model: User, as: 'linkedUser', attributes: ['id', 'name', 'email', 'role'] },
          { model: User, as: 'reportingManager', attributes: ['id', 'name', 'role'] },
        ],
      });
    }

    if (!employee) return next(new AppError('Employee record not found.', 404));

    const json = employee.toJSON();
    const progress = calcOnboardingProgress(json.documents || []);

    sendSuccess(res, {
      employee: {
        ...json,
        completeness: calcCompleteness(employee),
        onboarding_progress: progress,
      },
    });
  } catch (err) { next(err); }
};

// ── GET /api/employees/:id/onboarding ─────────────────────────────────────────
exports.getOnboardingChecklist = async (req, res, next) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      include: [{ model: EmployeeDocument, as: 'documents' }],
    });
    if (!employee) return next(new AppError('Employee not found.', 404));

    const progress = calcOnboardingProgress(employee.documents || []);
    sendSuccess(res, {
      employee_id: employee.id,
      employee_name: `${employee.first_name} ${employee.last_name}`,
      onboarding_status: employee.onboarding_status,
      ...progress,
    });
  } catch (err) { next(err); }
};

// ── PATCH /api/employees/:id/onboarding ────────────────────────────────────────
exports.updateOnboardingStatus = async (req, res, next) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return next(new AppError('Employee not found.', 404));

    const { onboarding_status } = req.body;
    if (!['pending', 'in_progress', 'pending_documents', 'pending_hr_review', 'completed', 'waived'].includes(onboarding_status)) {
      return next(new AppError('Invalid onboarding status.', 400));
    }

    await employee.update({ onboarding_status });

    createAuditEvent({
      userId: employee.user_id || req.user.id,
      actorUserId: req.user.id,
      action: 'ONBOARDING_STATUS_UPDATED',
      module: 'hr',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: { onboarding_status },
    });

    sendSuccess(res, { employee }, 'Onboarding status updated.');
  } catch (err) { next(err); }
};

// ── POST /api/employees/:id/offboard ──────────────────────────────────────────
exports.offboard = async (req, res, next) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    const canOffboard = role === 'admin' || role === 'super_admin' || role === 'hr';
    if (!canOffboard) {
      return next(new AppError('Unauthorized: Only HR and Super Admin can initiate offboarding.', 403));
    }

    let employee = await Employee.findByPk(req.params.id, {
      include: [{ model: User, as: 'linkedUser' }],
    });

    if (!employee) {
      employee = await Employee.findOne({
        where: { user_id: req.params.id },
        include: [{ model: User, as: 'linkedUser' }],
      });
    }

    if (!employee) return next(new AppError('Employee record not found.', 404));

    const { exit_reason = 'resigned', exit_date, handover_notes } = req.body;

    // 1. Update Employee Record
    await employee.update({
      status: 'terminated',
      exit_reason,
      exit_date: exit_date || new Date().toISOString().split('T')[0],
      handover_notes: handover_notes || null,
      offboarded_by: req.user.id,
      offboarded_at: new Date(),
    });

    // 2. Disable Linked User Account if exists
    if (employee.linkedUser) {
      await employee.linkedUser.update({
        is_active: false,
        status: 'inactive',
        refresh_token: null, // Terminate active user sessions
      });
    }

    // 3. Log Audit Event
    createAuditEvent({
      userId: employee.user_id || req.user.id,
      actorUserId: req.user.id,
      action: 'EMPLOYEE_OFFBOARDED',
      module: 'hr',
      entityType: 'Employee',
      entityId: employee.id,
      metadata: {
        exit_reason,
        exit_date: employee.exit_date,
        handover_notes,
        user_account_disabled: Boolean(employee.linkedUser),
      },
    });

    sendSuccess(res, {
      employee,
      message: 'Employee offboarded successfully. User account deactivated and historical records preserved.',
    });
  } catch (err) { next(err); }
};

// ── POST /api/employees ───────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { first_name, last_name } = req.body;
    if (!first_name?.trim()) return next(new AppError('First name is required.', 400));
    if (!last_name?.trim())  return next(new AppError('Last name is required.', 400));

    const allowed = [
      'user_id','reporting_manager_id','employee_code','first_name','last_name','email','phone','status',
      'onboarding_status','date_of_birth','gender','blood_group','personal_email','personal_phone',
      'present_address','permanent_address','department','designation',
      'date_of_joining','date_of_leaving','probation_end_date','confirmation_date','exit_date','exit_reason','handover_notes',
      'employment_type','reporting_manager','work_location','salary',
      'bank_name','bank_account_number','bank_ifsc','pan_number','aadhaar_last4','uan_number',
      'emergency_contact_name','emergency_contact_phone','emergency_contact_relation','notes',
    ];
    const payload = Object.fromEntries(
      Object.entries(req.body)
        .filter(([k]) => allowed.includes(k))
        .map(([k, v]) => [k, v === '' ? null : v])
    );

    // Default onboarding_status to pending
    payload.onboarding_status = payload.onboarding_status || 'pending';

    const employee = await Employee.create({ ...payload, created_by: req.user.id });
    logger.info(`Employee created: ${employee.id} by ${req.user.id}`);
    
    sendCreated(res, {
      employee: {
        ...employee.toJSON(),
        completeness: calcCompleteness(employee),
        onboarding_progress: calcOnboardingProgress([]),
      },
    }, 'Employee created with Onboarding Pending status.');
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const field = err.errors?.[0]?.path;
      return next(new AppError(`${field === 'email' ? 'Email' : 'Employee code'} already exists.`, 409));
    }
    next(err);
  }
};

// ── PATCH /api/employees/:id ──────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return next(new AppError('Employee not found.', 404));

    const allowed = [
      'user_id','reporting_manager_id','employee_code','first_name','last_name','email','phone','status',
      'onboarding_status','date_of_birth','gender','blood_group','personal_email','personal_phone',
      'present_address','permanent_address','department','designation',
      'date_of_joining','date_of_leaving','probation_end_date','confirmation_date','exit_date','exit_reason','handover_notes',
      'employment_type','reporting_manager','work_location','salary',
      'bank_name','bank_account_number','bank_ifsc','pan_number','aadhaar_last4','uan_number',
      'emergency_contact_name','emergency_contact_phone','emergency_contact_relation','notes',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body)
        .filter(([k]) => allowed.includes(k))
        .map(([k, v]) => [k, v === '' ? null : v])
    );

    await employee.update(updates);
    await syncEmployeeOnboardingStatus(employee.id);

    sendSuccess(res, { employee: { ...employee.toJSON(), completeness: calcCompleteness(employee) } }, 'Employee updated.');
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const field = err.errors?.[0]?.path;
      return next(new AppError(`${field === 'email' ? 'Email' : 'Employee code'} already exists.`, 409));
    }
    next(err);
  }
};

// ── DELETE /api/employees/:id ─────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return next(new AppError('Employee not found.', 404));
    await employee.destroy();
    sendSuccess(res, null, 'Employee deleted.');
  } catch (err) { next(err); }
};

// ── POST /api/employees/:id/documents ────────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('File is required.', 400));
    
    let employee = await Employee.findByPk(req.params.id);
    if (!employee) {
      employee = await Employee.findOne({ where: { user_id: req.params.id } });
    }
    if (!employee) return next(new AppError('Employee record not found.', 404));

    const { document_type = 'other', document_name, expiry_date, notes } = req.body;

    // Check if a document of this type already exists as current
    const existingCurrent = await EmployeeDocument.findOne({
      where: { employee_id: employee.id, document_type, is_current: true },
    });

    let versionNumber = 1;
    if (existingCurrent) {
      versionNumber = (existingCurrent.version || 1) + 1;
      await existingCurrent.update({ is_current: false });
    }

    const webFilePath = req.file.filename
      ? `/uploads/documents/${req.file.filename}`
      : (req.file.path ? `/uploads/documents/${path.basename(req.file.path)}` : req.file.path);

    const doc = await EmployeeDocument.create({
      employee_id:   employee.id,
      document_type,
      document_name: document_name || DOC_TYPE_LABELS[document_type] || 'Document',
      original_name: req.file.originalname,
      file_path:     webFilePath,
      file_size:     req.file.size,
      mime_type:     req.file.mimetype,
      status:        'uploaded',
      version:       versionNumber,
      is_current:    true,
      expiry_date:   expiry_date || null,
      notes:         notes || null,
      uploaded_by:   req.user.id,
    });

    if (existingCurrent) {
      await existingCurrent.update({ replaced_by: doc.id });
    }

    await syncEmployeeOnboardingStatus(employee.id);

    sendCreated(res, { document: doc }, 'Document uploaded successfully.');
  } catch (err) { next(err); }
};

// ── POST /api/employees/:id/documents/:docId/replace ─────────────────────────
exports.replaceDocument = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('Replacement file is required.', 400));

    const oldDoc = await EmployeeDocument.findByPk(req.params.docId);
    if (!oldDoc) return next(new AppError('Original document not found.', 404));

    const { notes, expiry_date } = req.body;

    // Mark old doc as not current
    await oldDoc.update({ is_current: false });

    const webFilePath = req.file.filename
      ? `/uploads/documents/${req.file.filename}`
      : (req.file.path ? `/uploads/documents/${path.basename(req.file.path)}` : req.file.path);

    // Create new document version
    const newDoc = await EmployeeDocument.create({
      employee_id:   oldDoc.employee_id,
      document_type: oldDoc.document_type,
      document_name: oldDoc.document_name,
      original_name: req.file.originalname,
      file_path:     webFilePath,
      file_size:     req.file.size,
      mime_type:     req.file.mimetype,
      status:        'uploaded',
      version:       (oldDoc.version || 1) + 1,
      is_current:    true,
      expiry_date:   expiry_date || oldDoc.expiry_date,
      notes:         notes || oldDoc.notes,
      uploaded_by:   req.user.id,
    });

    await oldDoc.update({ replaced_by: newDoc.id });
    await syncEmployeeOnboardingStatus(oldDoc.employee_id);

    sendCreated(res, { document: newDoc }, 'Document version replaced successfully.');
  } catch (err) { next(err); }
};

// ── GET /api/employees/:id/documents/:docId/versions ─────────────────────────
exports.getDocumentVersions = async (req, res, next) => {
  try {
    const doc = await EmployeeDocument.findByPk(req.params.docId);
    if (!doc) return next(new AppError('Document not found.', 404));

    // Security Check: Privileged staff OR Document Owner only
    const userRole = (req.user.role || '').toLowerCase().trim();
    const isPrivileged = ['admin', 'super_admin', 'super admin', 'hr', 'manager'].includes(userRole) ||
      (Array.isArray(req.user.permissions) && (req.user.permissions.includes('*') || req.user.permissions.includes('document_center:view') || req.user.permissions.includes('employees:view')));
    
    let isOwner = doc.employee_id === req.user.id;
    if (!isOwner) {
      const emp = await Employee.findByPk(doc.employee_id);
      if (emp && emp.user_id === req.user.id) isOwner = true;
    }

    if (!isPrivileged && !isOwner) {
      return next(new AppError('Access denied: You cannot view versions of this document.', 403));
    }

    const versions = await EmployeeDocument.findAll({
      where: {
        employee_id:   doc.employee_id,
        document_type: doc.document_type,
      },
      order: [['version', 'DESC']],
      include: [
        { model: User, as: 'uploader', attributes: ['id','name','email'] },
        { model: User, as: 'verifier', attributes: ['id','name','email'] },
      ],
    });

    sendSuccess(res, { versions });
  } catch (err) { next(err); }
};

// ── PATCH /api/employees/documents/:docId/request-review ─────────────────────
exports.requestReview = async (req, res, next) => {
  try {
    const doc = await EmployeeDocument.findByPk(req.params.docId);
    if (!doc) return next(new AppError('Document not found.', 404));

    await doc.update({
      status: 'under_review',
      review_requested_at: new Date(),
    });

    sendSuccess(res, { document: doc }, 'Document submitted for review.');
  } catch (err) { next(err); }
};

// ── PATCH /api/employees/documents/:docId ────────────────────────────────────
exports.updateDocument = async (req, res, next) => {
  try {
    const doc = await EmployeeDocument.findByPk(req.params.docId);
    if (!doc) return next(new AppError('Document not found.', 404));
    const allowed = ['document_name','document_type','notes','expiry_date','remarks'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k)).map(([k, v]) => [k, v === '' ? null : v])
    );
    await doc.update(updates);
    sendSuccess(res, { document: doc }, 'Document updated.');
  } catch (err) { next(err); }
};

// ── PATCH /api/employees/documents/:docId/verify ─────────────────────────────
exports.verifyDocument = async (req, res, next) => {
  try {
    const doc = await EmployeeDocument.findByPk(req.params.docId, {
      include: [{ model: Employee, as: 'employee', include: [{ model: User, as: 'linkedUser' }] }],
    });
    if (!doc) return next(new AppError('Document not found.', 404));

    // Security Guard: HR cannot manage/verify documents of Super Admin
    const targetUser = doc.employee?.linkedUser;
    if (targetUser && (targetUser.role === 'admin' || targetUser.role === 'super_admin')) {
      if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return next(new AppError('Forbidden: Only Super Admin can verify documents of Super Admin accounts.', 403));
      }
    }

    // Security Guard: Managers cannot verify documents
    if (req.user.role === 'manager') {
      return next(new AppError('Forbidden: Managers can upload documents but cannot verify them.', 403));
    }

    const { action, rejection_reason, remarks } = req.body;
    if (!['verify','reject'].includes(action)) return next(new AppError('action must be verify or reject.', 400));
    if (action === 'reject' && !rejection_reason?.trim()) return next(new AppError('rejection_reason is required when rejecting a document.', 400));

    await doc.update({
      status:           action === 'verify' ? 'verified' : 'rejected',
      verified_by:      req.user.id,
      verified_at:      new Date(),
      rejection_reason: action === 'reject' ? rejection_reason : null,
      remarks:          remarks || null,
    });

    await syncEmployeeOnboardingStatus(doc.employee_id);

    sendSuccess(res, { document: doc }, `Document ${action === 'verify' ? 'verified' : 'rejected'}.`);
  } catch (err) { next(err); }
};

// ── DELETE /api/employees/documents/:docId ────────────────────────────────────
exports.deleteDocument = async (req, res, next) => {
  try {
    const doc = await EmployeeDocument.findByPk(req.params.docId);
    if (!doc) return next(new AppError('Document not found.', 404));

    // Security Guard: Managers cannot delete documents
    if (req.user.role === 'manager') {
      return next(new AppError('Forbidden: Managers cannot delete employee documents.', 403));
    }

    if (doc.file_path && fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
    await doc.destroy();
    await syncEmployeeOnboardingStatus(doc.employee_id);

    sendSuccess(res, null, 'Document deleted.');
  } catch (err) { next(err); }
};

// ── GET /api/employees/:id/documents/:docId/download ─────────────────────────
exports.downloadDocument = async (req, res, next) => {
  try {
    const doc = await EmployeeDocument.findByPk(req.params.docId);
    if (!doc) return next(new AppError('Document not found.', 404));

    // Security Guard: Prevent IDOR/BOLA by enforcing Owner or HR/Admin role
    const userRole = (req.user.role || '').toLowerCase().trim();
    const isPrivileged = ['admin', 'super_admin', 'super admin', 'hr', 'manager'].includes(userRole) ||
      (Array.isArray(req.user.permissions) && (req.user.permissions.includes('*') || req.user.permissions.includes('document_center:view') || req.user.permissions.includes('employees:view')));
    
    let isOwner = doc.employee_id === req.user.id;
    if (!isOwner) {
      const emp = await Employee.findByPk(doc.employee_id);
      if (emp && emp.user_id === req.user.id) isOwner = true;
    }

    if (!isPrivileged && !isOwner) {
      return next(new AppError('Access denied: You are not authorized to download this document.', 403));
    }

    const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
    const basename = path.basename(doc.file_path);

    const candidates = [
      doc.file_path,
      path.join(uploadDir, 'documents', basename),
      path.join(uploadDir, basename),
      path.join(process.cwd(), 'uploads', 'documents', basename),
      path.join(process.cwd(), 'uploads', basename),
    ];

    let foundPath = null;
    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        try {
          if (fs.statSync(c).isFile()) {
            foundPath = c;
            break;
          }
        } catch {}
      }
    }

    if (!foundPath) return next(new AppError('File not found on server.', 404));
    res.download(foundPath, doc.original_name);
  } catch (err) { next(err); }
};

// ── DELETE /api/employees/:id (Super Admin Only) ─────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const userRole = (req.user?.role || '').toLowerCase().trim();
    if (!['admin', 'super_admin', 'super admin'].includes(userRole)) {
      return next(new AppError('Access denied: Only Super Admin can delete an employee.', 403));
    }

    const { id } = req.params;
    const employee = await Employee.findByPk(id);
    if (!employee) {
      return next(new AppError('Employee not found.', 404));
    }

    // Protect master Super Admin record from accidental self-deletion
    if (employee.user_id && employee.user_id === req.user.id) {
      return next(new AppError('Action prohibited: You cannot delete your own Super Admin employee profile.', 400));
    }

    const empCode = employee.employee_code || id;
    const empName = `${employee.first_name} ${employee.last_name}`.trim();
    const linkedUserId = employee.user_id;

    // 1. Delete associated employee documents
    await EmployeeDocument.destroy({ where: { employee_id: id } });

    // 2. Delete associated payroll profiles and records if models available
    try {
      const { PayrollProfile, PayrollRecord } = require('../models/Payroll');
      if (PayrollRecord) await PayrollRecord.destroy({ where: { employee_id: id } });
      if (PayrollProfile) await PayrollProfile.destroy({ where: { employee_id: id } });
    } catch (_) {}

    // 3. Dissociate or delete linked User if exists and not another super admin
    if (linkedUserId) {
      try {
        const linkedUser = await User.findByPk(linkedUserId);
        if (linkedUser && linkedUser.role !== 'admin' && linkedUser.role !== 'super_admin') {
          await linkedUser.destroy();
        }
      } catch (_) {}
    }

    // 4. Delete the Employee record
    await employee.destroy();

    // 5. Create audit trail
    try {
      await createAuditEvent({
        userId: req.user.id,
        action: 'EMPLOYEE_DELETED',
        resource: 'EMPLOYEE',
        resourceId: id,
        details: {
          employee_code: empCode,
          name: empName,
          deleted_by: req.user.email,
        },
      });
    } catch (_) {}

    logger.info(`🗑️ Super Admin [${req.user.email}] deleted employee [${empCode}] ${empName}`);

    return res.status(200).json({
      status: 'success',
      message: `Employee ${empName} (${empCode}) deleted successfully.`,
      data: { id, employee_code: empCode },
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteEmployee = exports.remove;