const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'island_nutrition.sqlite');

async function createDatabase() {
  const SQL = await initSqlJs();
  let buffer = null;
  if (fs.existsSync(dbFile)) {
    try {
      buffer = fs.readFileSync(dbFile);
    } catch (e) {
      console.warn('Could not read existing database file, creating fresh DB:', e.message);
    }
  }
  const rawDb = new SQL.Database(buffer);

  function saveToDisk() {
    try {
      const data = rawDb.export();
      fs.writeFileSync(dbFile, Buffer.from(data));
    } catch (err) {
      console.error('Error saving database to disk:', err);
    }
  }

  const wrapper = {
    raw: rawDb,
    pragma(str) {
      try {
        rawDb.exec(`PRAGMA ${str};`);
      } catch (e) {}
    },
    exec(sql) {
      rawDb.exec(sql);
      saveToDisk();
    },
    prepare(sql) {
      return {
        all(...args) {
          const params = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
          const cleanParams = params.map(p => (p === undefined ? null : p));
          const stmt = rawDb.prepare(sql);
          if (cleanParams.length > 0) stmt.bind(cleanParams);
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        },
        get(...args) {
          const params = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
          const cleanParams = params.map(p => (p === undefined ? null : p));
          const stmt = rawDb.prepare(sql);
          if (cleanParams.length > 0) stmt.bind(cleanParams);
          let row = undefined;
          if (stmt.step()) {
            row = stmt.getAsObject();
          }
          stmt.free();
          return row;
        },
        run(...args) {
          const params = (args.length === 1 && Array.isArray(args[0])) ? args[0] : args;
          const cleanParams = params.map(p => (p === undefined ? null : p));
          rawDb.run(sql, cleanParams);
          const lastIdRes = rawDb.exec('SELECT last_insert_rowid() AS id;');
          const lastInsertRowid = lastIdRes[0]?.values[0]?.[0] || 0;
          const changesRes = rawDb.exec('SELECT changes() AS ch;');
          const changes = changesRes[0]?.values[0]?.[0] || 0;
          saveToDisk();
          return { lastInsertRowid, changes };
        }
      };
    },
    transaction(fn) {
      return (...args) => {
        rawDb.exec('BEGIN TRANSACTION;');
        try {
          const result = fn(...args);
          rawDb.exec('COMMIT;');
          saveToDisk();
          return result;
        } catch (err) {
          try {
            rawDb.exec('ROLLBACK;');
          } catch (e) {}
          throw err;
        }
      };
    },
    save: saveToDisk
  };

  return wrapper;
}

module.exports = { createDatabase };
