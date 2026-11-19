import { initDb, getDbKind, testDbConnection, closeCurrentDb } from '../src/db/index.js';
import { ensureAdmin } from '../src/services/authService.js';
import { createCategory, createSubcategory } from '../src/services/catalogService.js';
import { config } from '../src/config.js';

const catalogue = [
  {
    name: 'Cement',
    description: 'Cement options for general construction and finishing work.',
    subcategories: ['Dalmia Cement', 'PPC Cement', 'OPC Cement'],
  },
  {
    name: 'Sand & Aggregates',
    description: 'Sand and stone materials used in mixing, leveling and construction.',
    subcategories: ['River Sand', 'White Sand', 'Stone Chips (Gitti)', 'Stone Dust'],
  },
  {
    name: 'TMT Bars & Steel',
    description: 'TMT bars and other steel materials for structural work.',
    subcategories: ['TMT Bars', '8mm', '10mm', '12mm', '16mm', '20mm', 'Other Steel Products'],
  },
  {
    name: 'Doors & Windows',
    description: 'Door and window options for residential and commercial spaces.',
    subcategories: ['Wooden Doors', 'Steel Doors', 'Door Frames', 'Windows'],
  },
  {
    name: 'Bricks & Blocks',
    description: 'Brick and block options for walls and masonry work.',
    subcategories: ['Red Bricks', 'Fly Ash Bricks', 'Concrete Blocks', 'Cement Blocks'],
  },
];

async function main() {
  try {
    await initDb();
    const ok = await testDbConnection();
    if (!ok) throw new Error('Database connection test failed');
    console.log(`[seed] DB connected (${getDbKind()})`);

    await ensureAdmin();
    if (getDbKind() === 'sqlite') {
      const { getDb } = await import('../src/db/sqlite.js');
      getDb().exec('DELETE FROM products; DELETE FROM subcategories; DELETE FROM categories;');
    } else {
      const { query } = await import('../src/db/postgres.js');
      await query('TRUNCATE TABLE products, subcategories, categories RESTART IDENTITY CASCADE');
    }

    let subcategoryTotal = 0;
    for (const [categoryIndex, entry] of catalogue.entries()) {
      const category = await createCategory({
        name: entry.name,
        description: entry.description,
        displayOrder: categoryIndex,
        active: true,
      });
      for (const [subcategoryIndex, name] of entry.subcategories.entries()) {
        await createSubcategory({
          categoryId: category.id,
          name,
          description: '',
          displayOrder: subcategoryIndex,
          active: true,
        });
        subcategoryTotal += 1;
      }
    }

    console.log(`Seeded ${catalogue.length} categories and ${subcategoryTotal} subcategories. No products added.`);
    console.log(`Admin login: ${config.adminUsername} (password from ADMIN_PASSWORD in .env)`);
  } finally {
    await closeCurrentDb();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error?.message || error);
  process.exit(1);
});
