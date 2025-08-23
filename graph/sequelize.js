import 'dotenv/config';
// Reuse the mysql module's sequelize and models
import { sequelize } from '../mysql/src/db.js';
import { User, Purchase, PurchaseItem, syncModels } from '../mysql/src/models.js';

export { sequelize, User, Purchase, PurchaseItem, syncModels };

export async function createUser(data) {
  return User.create(data);
}

export async function createPurchaseWithItems(userId, items, { currency = 'TRY', status = 'complete', shippingAddress = null } = {}) {
  return sequelize.transaction(async (t) => {
    const total = items.reduce((sum, it) => sum + (Number(it.unitPrice) * Number(it.quantity)), 0);
    const purchase = await Purchase.create({ user_id: userId, totalAmount: total, currency, status, shippingAddress }, { transaction: t });
    const rows = items.map(it => ({
      purchase_id: purchase.id,
      productSku: it.productSku,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: Number(it.unitPrice) * Number(it.quantity)
    }));
    await PurchaseItem.bulkCreate(rows, { transaction: t });
    return purchase;
  });
}

export async function getUserPurchases(userId) {
  return Purchase.findAll({
    where: { user_id: userId },
    include: [{ model: PurchaseItem, as: 'items' }],
    order: [['id', 'DESC']]
  });
}
