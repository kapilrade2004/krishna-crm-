'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Op } = require('sequelize');
const {
  sequelize,
  Role,
  Permission,
  RolePermission,
  UserPermission,
  syncModels,
} = require(path.join(__dirname, '../models'));

const {
  SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
} = require(path.join(__dirname, '../config/rolesAndCapabilities'));

async function syncAllRolesAndPermissions() {
  console.log('🚀 Synchronizing All Enterprise Roles and Permissions into Database from SSOT...');

  // 0. Purge disabled module permissions from database
  const disabledModules = ['reviews', 'accounting', 'spn_ads', 'sam', 'delivery', 'ecommerce'];
  try {
    const disabledPerms = await Permission.findAll({
      where: {
        [Op.or]: [
          { module: { [Op.in]: disabledModules } },
          { name: { [Op.in]: ['telecaller:reviews'] } },
        ],
      },
    });
    if (disabledPerms.length > 0) {
      const disabledPermIds = disabledPerms.map(p => p.id);
      if (RolePermission) {
        await RolePermission.destroy({ where: { permission_id: { [Op.in]: disabledPermIds } } });
      }
      if (UserPermission) {
        await UserPermission.destroy({ where: { permission_id: { [Op.in]: disabledPermIds } } });
      }
      await Permission.destroy({ where: { id: { [Op.in]: disabledPermIds } } });
      console.log(`🧹 Cleaned up ${disabledPerms.length} disabled module permissions from database.`);
    }
  } catch (cleanErr) {
    console.warn(`Permission cleanup notice: ${cleanErr.message}`);
  }

  // 1. Upsert Permissions
  const permissionMap = new Map();
  for (const p of SYSTEM_PERMISSIONS) {
    let [perm] = await Permission.findOrCreate({
      where: { name: p.name },
      defaults: {
        name: p.name,
        action: p.action || p.name.split(':')[1] || 'manage',
        description: p.description,
        module: p.module,
      },
    });
    perm.action = p.action || p.name.split(':')[1] || 'manage';
    perm.description = p.description;
    perm.module = p.module;
    await perm.save();
    permissionMap.set(p.name, perm);
  }
  console.log(`✅ Upserted ${SYSTEM_PERMISSIONS.length} Granular Permissions.`);

  // 2. Upsert Roles and link RolePermissions
  for (const r of SYSTEM_ROLES) {
    let [role] = await Role.findOrCreate({
      where: { name: r.name },
      defaults: {
        name: r.name,
        description: r.description,
        data_scope: r.data_scope,
        is_system: r.is_system,
      },
    });
    role.description = r.description;
    role.data_scope = r.data_scope;
    role.is_system = r.is_system;
    await role.save();

    // Link default permissions
    const allowedPermNames = ROLE_DEFAULT_PERMISSIONS[r.name] || [];
    let permIds = [];
    if (allowedPermNames.includes('*')) {
      permIds = Array.from(permissionMap.values()).map(p => p.id);
    } else {
      for (const pName of allowedPermNames) {
        const pObj = permissionMap.get(pName);
        if (pObj) permIds.push(pObj.id);
      }
    }

    // Clear and re-populate role permissions
    await RolePermission.destroy({ where: { role_id: role.id } });
    for (const pid of permIds) {
      await RolePermission.create({
        role_id: role.id,
        permission_id: pid,
      });
    }
  }
  console.log(`✅ Upserted and configured ${SYSTEM_ROLES.length} Enterprise Roles with Permissions.`);
  console.log('🎉 Enterprise Role & Permission Matrix Sync Complete!');
}

if (require.main === module) {
  syncAllRolesAndPermissions()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error syncing roles and permissions:', err);
      process.exit(1);
    });
}

module.exports = { syncAllRolesAndPermissions };
