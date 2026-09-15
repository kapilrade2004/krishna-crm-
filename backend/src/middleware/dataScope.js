'use strict';

const { Op } = require('sequelize');
const { SYSTEM_ROLES, DATA_SCOPES } = require('../config/rolesAndCapabilities');

/**
 * Builds Sequelize `where` clause condition based on the user's effective data_scope.
 *
 * @param {Object} user - Authenticated user object (req.user)
 * @param {Object} options - Custom field mappings
 * @param {string} [options.assignedField='assigned_to'] - Field name for assigned staff
 * @param {string} [options.userField='user_id'] - Field name for creator/owner
 * @param {string} [options.departmentField='department'] - Field name for department
 * @returns {Object} Sequelize where condition
 */
function buildDataScopeWhere(user, options = {}) {
  if (!user) return {};

  const role = (user.role || '').toLowerCase().trim();
  const isSuperAdmin =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'super admin' ||
    (Array.isArray(user.permissions) && user.permissions.includes('*'));

  if (isSuperAdmin) {
    return {};
  }

  // Resolve scope: user explicit data_scope > role default scope > 'all'
  let scope = (user.data_scope || '').toLowerCase().trim();
  if (!scope) {
    const roleDef = SYSTEM_ROLES.find(
      r => r.name.toLowerCase().trim() === role || r.key.toLowerCase().trim() === role
    );
    scope = roleDef ? roleDef.data_scope : DATA_SCOPES.ALL;
  }

  const assignedField = options.assignedField || 'assigned_to';
  const userField = options.userField || 'user_id';
  const departmentField = options.departmentField || 'department';

  switch (scope) {
    case DATA_SCOPES.ALL:
      return {};

    case DATA_SCOPES.DEPARTMENT:
      if (user.department) {
        return { [departmentField]: user.department };
      }
      return {};

    case DATA_SCOPES.TEAM:
      // In team scope, user can see records belonging to their department or assigned to team
      if (user.department) {
        return {
          [Op.or]: [
            { [departmentField]: user.department },
            { [assignedField]: user.id },
            { [userField]: user.id },
          ],
        };
      }
      return {
        [Op.or]: [
          { [assignedField]: user.id },
          { [userField]: user.id },
        ],
      };

    case DATA_SCOPES.ASSIGNED:
      return {
        [Op.or]: [
          { [assignedField]: user.id },
          { [userField]: user.id },
        ],
      };

    case DATA_SCOPES.OWN:
      return {
        [Op.or]: [
          { [userField]: user.id },
          { id: user.id },
        ],
      };

    default:
      return {};
  }
}

/**
 * Express middleware to automatically build and attach `req.dataScopeWhere`
 */
function enforceDataScope(options = {}) {
  return (req, res, next) => {
    try {
      req.dataScopeWhere = buildDataScopeWhere(req.user, options);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  buildDataScopeWhere,
  enforceDataScope,
};
