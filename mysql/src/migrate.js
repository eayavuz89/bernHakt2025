import { sequelize } from './db.js';
import { syncModels } from './models.js';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    await syncModels();
    console.log('Schema synced');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();
