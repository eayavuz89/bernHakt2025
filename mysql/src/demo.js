import { sequelize } from './db.js';
import { User, Purchase, PurchaseItem, syncModels } from './models.js';

export async function createUser({ username, email, passwordHash, fullName }) {
  return User.create({ username, email, passwordHash, fullName });
}

export async function createPurchaseWithItems(userId, { items, currency = 'TRY', status = 'complete', shippingAddress = null }) {
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

async function runDemo() {
  try {
    await sequelize.authenticate();
    await syncModels();
    const user = await createUser({ username: 'test1', email: 'test1@example.com', passwordHash: 'hash', fullName: 'Test User' });
    await createPurchaseWithItems(user.id, {
      items: [
        { productSku: 'SKU1', productName: 'Ürün A', quantity: 2, unitPrice: 50.00 },
        { productSku: 'SKU2', productName: 'Ürün B', quantity: 1, unitPrice: 25.00 }
      ]
    });
    const purchases = await getUserPurchases(user.id);
    console.log(JSON.stringify(purchases, null, 2));
  } catch (e) {
    console.error('Demo failed:', e.message);
  } finally {
    await sequelize.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('demo.js')) {
  runDemo();
}
