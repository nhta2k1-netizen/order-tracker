/**
 * SQLite layer — users Telegram + subscriptions + status cache.
 * Free tier friendly (file local / volume Render).
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db = null;

/**
 * @param {{ dataDir?: string }} [opts]
 */
export function initDb(opts = {}) {
  if (db) return db;

  const dataDir = path.resolve(
    opts.dataDir || process.env.DATA_DIR || "./data"
  );
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "tracker.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_users (
      chat_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT NOT NULL UNIQUE,
      carrier TEXT,
      carrier_name TEXT,
      current_status TEXT,
      current_status_raw TEXT,
      last_message TEXT,
      last_checked_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      package_id INTEGER NOT NULL,
      last_notified_status TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(chat_id, package_id),
      FOREIGN KEY (chat_id) REFERENCES telegram_users(chat_id) ON DELETE CASCADE,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      status TEXT,
      status_raw TEXT,
      message TEXT,
      location TEXT,
      event_time TEXT,
      event_ts INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS zalo_users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      last_user_message_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS zalo_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      package_id INTEGER NOT NULL,
      last_notified_status TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, package_id),
      FOREIGN KEY (user_id) REFERENCES zalo_users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_secrets (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_packages_active ON packages(is_active);
    CREATE INDEX IF NOT EXISTS idx_packages_tracking ON packages(tracking_number);
    CREATE INDEX IF NOT EXISTS idx_subs_active ON subscriptions(is_active);
    CREATE INDEX IF NOT EXISTS idx_subs_chat ON subscriptions(chat_id);
    CREATE INDEX IF NOT EXISTS idx_history_package ON status_history(package_id);
    CREATE INDEX IF NOT EXISTS idx_zalo_subs_active ON zalo_subscriptions(is_active);
    CREATE INDEX IF NOT EXISTS idx_zalo_subs_user ON zalo_subscriptions(user_id);
  `);

  console.log(`[db] SQLite: ${dbPath}`);
  return db;
}

export function getDb() {
  if (!db) initDb();
  return db;
}

// ─── Users ───────────────────────────────────────────────

export function upsertTelegramUser({ chatId, username, firstName, lastName }) {
  const database = getDb();
  database
    .prepare(
      `
    INSERT INTO telegram_users (chat_id, username, first_name, last_name)
    VALUES (@chatId, @username, @firstName, @lastName)
    ON CONFLICT(chat_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      updated_at = datetime('now')
  `
    )
    .run({
      chatId: String(chatId),
      username: username || null,
      firstName: firstName || null,
      lastName: lastName || null,
    });
}

// ─── Packages ────────────────────────────────────────────

export function getPackageByTracking(trackingNumber) {
  return getDb()
    .prepare(`SELECT * FROM packages WHERE tracking_number = ?`)
    .get(String(trackingNumber).trim().toUpperCase());
}

export function getPackageById(id) {
  return getDb().prepare(`SELECT * FROM packages WHERE id = ?`).get(id);
}

export function upsertPackage({
  trackingNumber,
  carrier,
  carrierName,
  currentStatus,
  currentStatusRaw,
  lastMessage,
}) {
  const database = getDb();
  const tracking = String(trackingNumber).trim().toUpperCase();
  const existing = getPackageByTracking(tracking);

  if (existing) {
    database
      .prepare(
        `
      UPDATE packages SET
        carrier = COALESCE(@carrier, carrier),
        carrier_name = COALESCE(@carrierName, carrier_name),
        current_status = COALESCE(@currentStatus, current_status),
        current_status_raw = COALESCE(@currentStatusRaw, current_status_raw),
        last_message = COALESCE(@lastMessage, last_message),
        last_checked_at = datetime('now'),
        is_active = 1,
        updated_at = datetime('now')
      WHERE id = @id
    `
      )
      .run({
        id: existing.id,
        carrier: carrier ?? null,
        carrierName: carrierName ?? null,
        currentStatus: currentStatus ?? null,
        currentStatusRaw: currentStatusRaw ?? null,
        lastMessage: lastMessage ?? null,
      });
    return getPackageById(existing.id);
  }

  const info = database
    .prepare(
      `
    INSERT INTO packages (
      tracking_number, carrier, carrier_name,
      current_status, current_status_raw, last_message, last_checked_at
    ) VALUES (
      @tracking, @carrier, @carrierName,
      @currentStatus, @currentStatusRaw, @lastMessage, datetime('now')
    )
  `
    )
    .run({
      tracking,
      carrier: carrier ?? null,
      carrierName: carrierName ?? null,
      currentStatus: currentStatus ?? null,
      currentStatusRaw: currentStatusRaw ?? null,
      lastMessage: lastMessage ?? null,
    });

  return getPackageById(info.lastInsertRowid);
}

export function updatePackageFromTrack(packageId, result) {
  getDb()
    .prepare(
      `
    UPDATE packages SET
      carrier = @carrier,
      carrier_name = @carrierName,
      current_status = @currentStatus,
      current_status_raw = @currentStatusRaw,
      last_message = @lastMessage,
      last_checked_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = @id
  `
    )
    .run({
      id: packageId,
      carrier: result.carrier ?? null,
      carrierName: result.carrierName ?? null,
      currentStatus: result.currentStatus ?? null,
      currentStatusRaw: result.currentStatusRaw ?? null,
      lastMessage: result.events?.[0]?.message || result.currentStatus || null,
    });
  return getPackageById(packageId);
}

export function deactivatePackage(id) {
  getDb()
    .prepare(
      `UPDATE packages SET is_active = 0, updated_at = datetime('now') WHERE id = ?`
    )
    .run(id);
}

export function listActivePackages() {
  return getDb()
    .prepare(
      `
    SELECT p.* FROM packages p
    WHERE p.is_active = 1
      AND (
        EXISTS (
          SELECT 1 FROM subscriptions s
          WHERE s.package_id = p.id AND s.is_active = 1
        )
        OR EXISTS (
          SELECT 1 FROM zalo_subscriptions zs
          WHERE zs.package_id = p.id AND zs.is_active = 1
        )
      )
    ORDER BY p.last_checked_at ASC NULLS FIRST
  `
    )
    .all();
}

// ─── Subscriptions ───────────────────────────────────────

/**
 * Đăng ký theo dõi: tạo user + package + subscription.
 */
export function subscribe({
  chatId,
  username,
  firstName,
  lastName,
  trackingNumber,
  carrier,
  carrierName,
  currentStatus,
  currentStatusRaw,
  lastMessage,
}) {
  upsertTelegramUser({ chatId, username, firstName, lastName });
  const pkg = upsertPackage({
    trackingNumber,
    carrier,
    carrierName,
    currentStatus,
    currentStatusRaw,
    lastMessage,
  });

  getDb()
    .prepare(
      `
    INSERT INTO subscriptions (chat_id, package_id, last_notified_status, is_active)
    VALUES (@chatId, @packageId, @status, 1)
    ON CONFLICT(chat_id, package_id) DO UPDATE SET
      is_active = 1,
      last_notified_status = COALESCE(excluded.last_notified_status, subscriptions.last_notified_status),
      updated_at = datetime('now')
  `
    )
    .run({
      chatId: String(chatId),
      packageId: pkg.id,
      status: currentStatus ?? null,
    });

  return {
    package: getPackageById(pkg.id),
    subscription: getSubscription(chatId, pkg.id),
  };
}

export function getSubscription(chatId, packageId) {
  return getDb()
    .prepare(
      `SELECT * FROM subscriptions WHERE chat_id = ? AND package_id = ?`
    )
    .get(String(chatId), packageId);
}

export function listSubscriptionsByChat(chatId) {
  return getDb()
    .prepare(
      `
    SELECT
      s.id AS subscription_id,
      s.chat_id,
      s.last_notified_status,
      s.is_active AS sub_active,
      s.created_at AS subscribed_at,
      p.*
    FROM subscriptions s
    JOIN packages p ON p.id = s.package_id
    WHERE s.chat_id = ? AND s.is_active = 1
    ORDER BY s.updated_at DESC
  `
    )
    .all(String(chatId));
}

export function unsubscribe(chatId, trackingNumber) {
  const pkg = getPackageByTracking(trackingNumber);
  if (!pkg) return { ok: false, reason: "not_found" };

  const info = getDb()
    .prepare(
      `
    UPDATE subscriptions
    SET is_active = 0, updated_at = datetime('now')
    WHERE chat_id = ? AND package_id = ? AND is_active = 1
  `
    )
    .run(String(chatId), pkg.id);

  if (info.changes === 0) return { ok: false, reason: "not_subscribed" };

  // Nếu không còn ai theo dõi → tắt package
  const still = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM subscriptions WHERE package_id = ? AND is_active = 1`
    )
    .get(pkg.id);
  if (still.c === 0) deactivatePackage(pkg.id);

  return { ok: true, package: pkg };
}

export function unsubscribeAll(chatId) {
  const rows = listSubscriptionsByChat(chatId);
  for (const row of rows) {
    unsubscribe(chatId, row.tracking_number);
  }
  return { ok: true, count: rows.length };
}

export function markSubscriptionNotified(chatId, packageId, status) {
  getDb()
    .prepare(
      `
    UPDATE subscriptions
    SET last_notified_status = @status, updated_at = datetime('now')
    WHERE chat_id = @chatId AND package_id = @packageId
  `
    )
    .run({
      chatId: String(chatId),
      packageId,
      status,
    });
}

/**
 * Mọi subscription active của 1 package (để gửi notify).
 */
export function listActiveSubsForPackage(packageId) {
  return getDb()
    .prepare(
      `
    SELECT * FROM subscriptions
    WHERE package_id = ? AND is_active = 1
  `
    )
    .all(packageId);
}

// ─── History ─────────────────────────────────────────────

export function replaceHistory(packageId, events) {
  const database = getDb();
  const clear = database.prepare(
    `DELETE FROM status_history WHERE package_id = ?`
  );
  const insert = database.prepare(`
    INSERT INTO status_history
      (package_id, status, status_raw, message, location, event_time, event_ts)
    VALUES
      (@packageId, @status, @statusRaw, @message, @location, @eventTime, @eventTs)
  `);

  const tx = database.transaction((list) => {
    clear.run(packageId);
    const chronological = [...list].reverse();
    for (const ev of chronological) {
      insert.run({
        packageId,
        status: ev.status ?? null,
        statusRaw: ev.statusRaw ?? null,
        message: ev.message ?? null,
        location: ev.location ?? null,
        eventTime: ev.timestamp ?? null,
        eventTs: ev.timestampUnix ?? null,
      });
    }
  });
  tx(events || []);
}

export function getHistory(packageId, limit = 50) {
  return getDb()
    .prepare(
      `
    SELECT * FROM status_history
    WHERE package_id = ?
    ORDER BY
      CASE WHEN event_ts IS NULL THEN 0 ELSE 1 END DESC,
      event_ts DESC,
      id DESC
    LIMIT ?
  `
    )
    .all(packageId, limit);
}

// ─── Zalo users & subscriptions ──────────────────────────

export function upsertZaloUser({ userId, displayName, touchMessage = true }) {
  const database = getDb();
  database
    .prepare(
      `
    INSERT INTO zalo_users (user_id, display_name, last_user_message_at)
    VALUES (@userId, @displayName, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, zalo_users.display_name),
      last_user_message_at = CASE
        WHEN @touch = 1 THEN datetime('now')
        ELSE zalo_users.last_user_message_at
      END,
      updated_at = datetime('now')
  `
    )
    .run({
      userId: String(userId),
      displayName: displayName || null,
      touch: touchMessage ? 1 : 0,
    });
  return getZaloUser(userId);
}

export function getZaloUser(userId) {
  return getDb()
    .prepare(`SELECT * FROM zalo_users WHERE user_id = ?`)
    .get(String(userId));
}

/**
 * Đăng ký theo dõi qua Zalo.
 */
export function subscribeZalo({
  userId,
  displayName,
  trackingNumber,
  carrier,
  carrierName,
  currentStatus,
  currentStatusRaw,
  lastMessage,
}) {
  upsertZaloUser({ userId, displayName, touchMessage: true });
  const pkg = upsertPackage({
    trackingNumber,
    carrier,
    carrierName,
    currentStatus,
    currentStatusRaw,
    lastMessage,
  });

  getDb()
    .prepare(
      `
    INSERT INTO zalo_subscriptions (user_id, package_id, last_notified_status, is_active)
    VALUES (@userId, @packageId, @status, 1)
    ON CONFLICT(user_id, package_id) DO UPDATE SET
      is_active = 1,
      last_notified_status = COALESCE(excluded.last_notified_status, zalo_subscriptions.last_notified_status),
      updated_at = datetime('now')
  `
    )
    .run({
      userId: String(userId),
      packageId: pkg.id,
      status: currentStatus ?? null,
    });

  return {
    package: getPackageById(pkg.id),
    subscription: getDb()
      .prepare(
        `SELECT * FROM zalo_subscriptions WHERE user_id = ? AND package_id = ?`
      )
      .get(String(userId), pkg.id),
  };
}

export function listZaloSubscriptionsByUser(userId) {
  return getDb()
    .prepare(
      `
    SELECT
      zs.id AS subscription_id,
      zs.user_id,
      zs.last_notified_status,
      zs.is_active AS sub_active,
      zs.created_at AS subscribed_at,
      p.*
    FROM zalo_subscriptions zs
    JOIN packages p ON p.id = zs.package_id
    WHERE zs.user_id = ? AND zs.is_active = 1
    ORDER BY zs.updated_at DESC
  `
    )
    .all(String(userId));
}

export function unsubscribeZalo(userId, trackingNumber) {
  const pkg = getPackageByTracking(trackingNumber);
  if (!pkg) return { ok: false, reason: "not_found" };

  const info = getDb()
    .prepare(
      `
    UPDATE zalo_subscriptions
    SET is_active = 0, updated_at = datetime('now')
    WHERE user_id = ? AND package_id = ? AND is_active = 1
  `
    )
    .run(String(userId), pkg.id);

  if (info.changes === 0) return { ok: false, reason: "not_subscribed" };

  const stillTg = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM subscriptions WHERE package_id = ? AND is_active = 1`
    )
    .get(pkg.id);
  const stillZalo = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM zalo_subscriptions WHERE package_id = ? AND is_active = 1`
    )
    .get(pkg.id);
  if (stillTg.c === 0 && stillZalo.c === 0) deactivatePackage(pkg.id);

  return { ok: true, package: pkg };
}

export function listActiveZaloSubsForPackage(packageId) {
  return getDb()
    .prepare(
      `
    SELECT zs.*, zu.last_user_message_at, zu.display_name
    FROM zalo_subscriptions zs
    JOIN zalo_users zu ON zu.user_id = zs.user_id
    WHERE zs.package_id = ? AND zs.is_active = 1
  `
    )
    .all(packageId);
}

export function markZaloSubscriptionNotified(userId, packageId, status) {
  getDb()
    .prepare(
      `
    UPDATE zalo_subscriptions
    SET last_notified_status = @status, updated_at = datetime('now')
    WHERE user_id = @userId AND package_id = @packageId
  `
    )
    .run({
      userId: String(userId),
      packageId,
      status,
    });
}

// ─── App secrets (lưu refresh_token Zalo an toàn hơn .env) ─

export function setSecret(key, value) {
  getDb()
    .prepare(
      `
    INSERT INTO app_secrets (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `
    )
    .run(String(key), value == null ? null : String(value));
}

export function getSecret(key) {
  const row = getDb()
    .prepare(`SELECT value FROM app_secrets WHERE key = ?`)
    .get(String(key));
  return row?.value ?? null;
}
