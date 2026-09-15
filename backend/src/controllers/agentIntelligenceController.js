'use strict';

const {
  SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
  MODULE_REGISTRY,
  DATA_SCOPES,
} = require('../config/rolesAndCapabilities');
const { Order, Customer, DailyActivity, User } = require('../models');

/**
 * Machine-Readable System Map (Level 1 System Context)
 */
exports.getSystemMap = async (req, res, next) => {
  try {
    const userRole = (req.user?.role || '').toLowerCase().trim();
    const systemMap = {
      system: 'Krishna CRM & Enterprise Operations Ecosystem',
      version: '2.0.0',
      status: 'operational',
      architecture: 'Intelligent Role-Based Monolith with Adaptive Workspaces',
      registeredRoles: SYSTEM_ROLES.map(r => ({
        key: r.key,
        name: r.name,
        scope: r.data_scope,
        isSystem: r.is_system,
      })),
      registeredModules: MODULE_REGISTRY,
      dataScopes: Object.values(DATA_SCOPES),
      activeUserContext: req.user
        ? {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            department: req.user.department,
            dataScope: req.user.data_scope,
            effectivePermissionsCount: Array.isArray(req.user.permissions) ? req.user.permissions.length : 0,
          }
        : null,
    };

    res.status(200).json({
      status: 'success',
      data: systemMap,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Hierarchical Context Query (Levels 2–5)
 */
exports.getContext = async (req, res, next) => {
  try {
    const { level = 2, moduleKey, entityId } = req.query;

    const contextResponse = {
      level: parseInt(level, 10),
      timestamp: new Date().toISOString(),
    };

    if (level >= 2 && req.user) {
      // Level 2: User Context & Assigned Tasks
      const myPendingTasks = await DailyActivity.count({
        where: {
          assigned_to: req.user.id,
        },
      });

      contextResponse.userContext = {
        id: req.user.id,
        role: req.user.role,
        department: req.user.department,
        dataScope: req.user.data_scope,
        pendingMandatoryTasks: myPendingTasks,
      };

      const userRoleKey = (req.user.role || '').toLowerCase().trim();
      const matchedRole = SYSTEM_ROLES.find(
        r => r.key === userRoleKey || r.name.toLowerCase().trim() === userRoleKey
      );
      if (matchedRole) {
        contextResponse.roleIntelligence = {
          roleKey: matchedRole.key,
          roleName: matchedRole.name,
          dataScope: matchedRole.data_scope,
          capabilities: matchedRole.capabilities || [],
          description: matchedRole.description,
        };
      }
    }

    if (level >= 3 && moduleKey) {
      // Level 3: Module Context
      const mod = MODULE_REGISTRY.find(m => m.key === moduleKey || m.route.includes(moduleKey));
      contextResponse.moduleContext = mod || null;
    }

    if (level >= 4 && entityId) {
      // Level 4: Specific Record Context
      const order = await Order.findByPk(entityId, {
        include: [{ model: Customer, as: 'customer' }],
      });
      contextResponse.recordContext = order || null;
    }

    res.status(200).json({
      status: 'success',
      data: contextResponse,
    });
  } catch (err) {
    next(err);
  }
};
