import { DataTypes, Model } from 'sequelize';
import { sequelize } from './db.js';

export class User extends Model {}
User.init({
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  fullName: { type: DataTypes.STRING(255) },
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export class Purchase extends Model {}
Purchase.init({
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  totalAmount: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0 },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'TRY' },
  status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'pending' },
  purchaseDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  shippingAddress: { type: DataTypes.TEXT },
}, {
  sequelize,
  modelName: 'Purchase',
  tableName: 'purchases',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export class PurchaseItem extends Model {}
PurchaseItem.init({
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  productSku: { type: DataTypes.STRING(128) },
  productName: { type: DataTypes.STRING(512) },
  quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  unitPrice: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0 },
  lineTotal: { type: DataTypes.DECIMAL(12,2), allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'PurchaseItem',
  tableName: 'purchase_items',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

User.hasMany(Purchase, { foreignKey: 'user_id', as: 'purchases', onDelete: 'CASCADE' });
Purchase.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Purchase.hasMany(PurchaseItem, { foreignKey: 'purchase_id', as: 'items', onDelete: 'CASCADE' });
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchase_id', as: 'purchase' });

export async function syncModels() {
  await sequelize.sync();
}
