'use strict';

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

class User extends Model {
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  toSafeJSON() {
    const obj = this.toJSON();
    delete obj.password;
    delete obj.refresh_token;
    if (this.permissions) {
      obj.permissions = this.permissions;
    }
    return obj;
  }
}

User.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'sales',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    status: {
      type: DataTypes.STRING(30),
      defaultValue: 'active', // active, inactive, suspended, pending_activation, archived
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    designation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    employee_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    reporting_manager_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    locked_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    force_password_reset: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    temp_password_created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    display_password: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    last_active_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    presence_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'offline',
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        const isBcrypt = typeof user.password === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password);
        if (user.password && !isBcrypt) {
          if (!user.display_password) {
            user.display_password = user.password;
          }
          user.password = await bcrypt.hash(user.password, 12);
        }
        if (!user.name && (user.first_name || user.last_name)) {
          user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password') && user.password) {
          const isBcrypt = typeof user.password === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password);
          if (!isBcrypt) {
            user.display_password = user.password;
            user.password = await bcrypt.hash(user.password, 12);
          }
        }
        if ((user.changed('first_name') || user.changed('last_name')) && (user.first_name || user.last_name)) {
          user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        }
      },
    },
  }
);

module.exports = User;