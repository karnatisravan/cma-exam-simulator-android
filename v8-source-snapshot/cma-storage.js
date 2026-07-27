(() => {
  "use strict";

  const DATABASE_NAME = "cma-exam-simulator";
  const DATABASE_VERSION = 2;
  const STORE_NAME = "application-data";
  const POINTER_TYPE = "cma-indexeddb-pointer";
  const STRUCTURED_STORES = Object.freeze({
    applicationData: STORE_NAME,
    questionBanks: "questionBanks",
    questions: "questions",
    questionAttempts: "questionAttempts",
    questionAggregates: "questionAggregates",
    questionCycleStatus: "questionCycleStatus",
    questionNotes: "questionNotes",
    testSessions: "testSessions",
    testHistory: "testHistoryV2",
    settings: "settingsV2",
    migrations: "migrations",
    recoverySnapshots: "recoverySnapshots"
  });
  const LARGE_KEYS = new Set([
    "cma-simulator-question-bank-v1",
    "cma-simulator-history-v1",
    "cma-simulator-catalog-v1",
    "cma-simulator-settings-v1",
    "cma-simulator-import-queue-v1",
    "cma-simulator-migration-backup-v1",
    "cma-simulator-final-migration-backup-v2",
    "cma-simulator-case-bank-v1",
    "cma-simulator-case-history-v1",
    "cma-simulator-v2-workspace-v1"
  ]);

  let databasePromise = null;
  let writeChain = Promise.resolve();
  const memoryFallback = new Map();
  const memoryStores = new Map(Object.values(STRUCTURED_STORES).map((name) => [name, new Map()]));

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function isPointer(value) {
    return Boolean(value && value.type === POINTER_TYPE && value.database === DATABASE_NAME);
  }

  function readLegacy(key, fallback) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      const parsed = JSON.parse(raw);
      return isPointer(parsed) ? fallback : parsed;
    } catch (_error) {
      return fallback;
    }
  }

  function writeLegacyPointer(key) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify({ type: POINTER_TYPE, database: DATABASE_NAME, key, updatedAt: new Date().toISOString() }));
    } catch (_error) {
      // IndexedDB remains authoritative even when the compatibility pointer cannot be written.
    }
  }

  function createStore(database, name, options, indexes = []) {
    if (database.objectStoreNames.contains(name)) return null;
    const store = database.createObjectStore(name, options);
    indexes.forEach(([indexName, keyPath, indexOptions]) => store.createIndex(indexName, keyPath, indexOptions || {}));
    return store;
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    if (!globalThis.indexedDB) return Promise.resolve(null);
    databasePromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        createStore(database, STORE_NAME, { keyPath: "key" });
        createStore(database, STRUCTURED_STORES.questionBanks, { keyPath: "bankId" }, [
          ["status", "status"], ["updatedAt", "updatedAt"]
        ]);
        createStore(database, STRUCTURED_STORES.questions, { keyPath: "questionUid" }, [
          ["bankId", "bankId"],
          ["bankSourceId", ["bankId", "sourceQuestionId"], { unique: true }],
          ["sectionId", "sectionId"],
          ["unitId", "unitId"],
          ["status", "status"],
          ["contentHash", "contentHash"]
        ]);
        createStore(database, STRUCTURED_STORES.questionAttempts, { keyPath: "attemptId" }, [
          ["questionUid", "questionUid"], ["bankId", "bankId"], ["testId", "testId"], ["batchId", "batchId"], ["attemptedAt", "attemptedAt"], ["isCorrect", "isCorrect"]
        ]);
        createStore(database, STRUCTURED_STORES.questionAggregates, { keyPath: "questionUid" }, [
          ["bankId", "bankId"], ["unitId", "unitId"], ["masteryStatus", "masteryStatus"], ["remediationStatus", "remediationStatus"]
        ]);
        createStore(database, STRUCTURED_STORES.questionCycleStatus, { keyPath: "questionUid" }, [
          ["bankId", "bankId"], ["unitId", "unitId"], ["bankUnit", ["bankId", "unitId"]], ["currentCycleNumber", "currentCycleNumber"]
        ]);
        createStore(database, STRUCTURED_STORES.questionNotes, { keyPath: "noteId" }, [
          ["questionUid", "questionUid", { unique: true }], ["bankId", "bankId"], ["updatedAt", "updatedAt"]
        ]);
        createStore(database, STRUCTURED_STORES.testSessions, { keyPath: "testId" }, [
          ["status", "status"], ["createdAt", "createdAt"]
        ]);
        createStore(database, STRUCTURED_STORES.testHistory, { keyPath: "batchId" }, [
          ["completedAt", "completedAt"], ["mode", "mode"], ["presetId", "presetId"]
        ]);
        createStore(database, STRUCTURED_STORES.settings, { keyPath: "key" });
        createStore(database, STRUCTURED_STORES.migrations, { keyPath: "migrationId" });
        createStore(database, STRUCTURED_STORES.recoverySnapshots, { keyPath: "snapshotId" }, [
          ["createdAt", "createdAt"], ["type", "type"]
        ]);
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error || new Error("IndexedDB could not be opened."));
      request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another open simulator tab."));
    });
    return databasePromise;
  }

  async function getRecord(key) {
    const database = await openDatabase();
    if (!database) return memoryFallback.has(key) ? clone(memoryFallback.get(key)) : undefined;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ? clone(request.result.value) : undefined);
      request.onerror = () => reject(request.error || new Error(`Could not read ${key}.`));
      transaction.onabort = () => reject(transaction.error || new Error(`Read transaction for ${key} was aborted.`));
    });
  }

  async function putRecord(key, value) {
    const snapshot = clone(value);
    const database = await openDatabase();
    if (!database) {
      memoryFallback.set(key, snapshot);
      try { globalThis.localStorage?.setItem(key, JSON.stringify(snapshot)); } catch (_error) {}
      return { backend: "localStorage-fallback", key };
    }
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ key, value: snapshot, updatedAt: new Date().toISOString() });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error(`Could not save ${key}.`));
      transaction.onabort = () => reject(transaction.error || new Error(`Write transaction for ${key} was aborted.`));
    });
    writeLegacyPointer(key);
    return { backend: "indexedDB", key };
  }

  async function deleteRecord(key) {
    const database = await openDatabase();
    memoryFallback.delete(key);
    if (database) {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error(`Could not remove ${key}.`));
      });
    }
    try { globalThis.localStorage?.removeItem(key); } catch (_error) {}
  }

  function assertStore(storeName) {
    if (!Object.values(STRUCTURED_STORES).includes(storeName)) throw new Error(`Unknown IndexedDB store: ${storeName}`);
  }

  async function storeGet(storeName, key) {
    assertStore(storeName);
    const database = await openDatabase();
    if (!database) return clone(memoryStores.get(storeName)?.get(key));
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(clone(request.result));
      request.onerror = () => reject(request.error || new Error(`Could not read ${storeName}:${key}.`));
      tx.onabort = () => reject(tx.error || new Error(`Read transaction for ${storeName} was aborted.`));
    });
  }

  async function storeGetAll(storeName, query = undefined) {
    assertStore(storeName);
    const database = await openDatabase();
    if (!database) return Array.from(memoryStores.get(storeName)?.values() || []).map(clone);
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll(query);
      request.onsuccess = () => resolve((request.result || []).map(clone));
      request.onerror = () => reject(request.error || new Error(`Could not read ${storeName}.`));
      tx.onabort = () => reject(tx.error || new Error(`Read transaction for ${storeName} was aborted.`));
    });
  }

  async function storePut(storeName, value) {
    assertStore(storeName);
    const snapshot = clone(value);
    const database = await openDatabase();
    if (!database) {
      const keyPath = {
        questionBanks: "bankId", questions: "questionUid", questionAttempts: "attemptId", questionAggregates: "questionUid",
        questionCycleStatus: "questionUid", questionNotes: "noteId", testSessions: "testId", testHistoryV2: "batchId",
        settingsV2: "key", migrations: "migrationId", recoverySnapshots: "snapshotId", "application-data": "key"
      }[storeName];
      const key = snapshot?.[keyPath];
      if (key === undefined) throw new Error(`Missing key for ${storeName}.`);
      memoryStores.get(storeName).set(key, snapshot);
      return key;
    }
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).put(snapshot);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(`Could not write ${storeName}.`));
      tx.onabort = () => reject(tx.error || new Error(`Write transaction for ${storeName} was aborted.`));
    });
  }

  async function storePutMany(storeName, values) {
    assertStore(storeName);
    const snapshots = (Array.isArray(values) ? values : []).map(clone);
    if (!snapshots.length) return 0;
    const database = await openDatabase();
    if (!database) {
      for (const value of snapshots) await storePut(storeName, value);
      return snapshots.length;
    }
    await new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      snapshots.forEach((value) => store.put(value));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error(`Could not write records to ${storeName}.`));
      tx.onabort = () => reject(tx.error || new Error(`Batch write to ${storeName} was aborted.`));
    });
    return snapshots.length;
  }

  async function storeDelete(storeName, key) {
    assertStore(storeName);
    const database = await openDatabase();
    if (!database) {
      memoryStores.get(storeName)?.delete(key);
      return;
    }
    await new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error(`Could not delete ${storeName}:${key}.`));
      tx.onabort = () => reject(tx.error || new Error(`Delete transaction for ${storeName} was aborted.`));
    });
  }

  async function storeClear(storeName) {
    assertStore(storeName);
    const database = await openDatabase();
    if (!database) {
      memoryStores.get(storeName)?.clear();
      return;
    }
    await new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error(`Could not clear ${storeName}.`));
      tx.onabort = () => reject(tx.error || new Error(`Clear transaction for ${storeName} was aborted.`));
    });
  }

  async function replaceStore(storeName, values) {
    assertStore(storeName);
    const snapshots = (Array.isArray(values) ? values : []).map(clone);
    const database = await openDatabase();
    if (!database) {
      await storeClear(storeName);
      await storePutMany(storeName, snapshots);
      return snapshots.length;
    }
    await new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.clear();
      snapshots.forEach((value) => store.put(value));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error(`Could not replace ${storeName}.`));
      tx.onabort = () => reject(tx.error || new Error(`Replace transaction for ${storeName} was aborted.`));
    });
    return snapshots.length;
  }

  async function get(key, fallback = null) {
    try {
      const stored = await getRecord(key);
      if (stored !== undefined) return stored;
      const legacy = readLegacy(key, undefined);
      if (legacy !== undefined) {
        await putRecord(key, legacy);
        return clone(legacy);
      }
      return clone(fallback);
    } catch (error) {
      const legacy = readLegacy(key, undefined);
      if (legacy !== undefined) return clone(legacy);
      throw error;
    }
  }

  function set(key, value) {
    const snapshot = clone(value);
    const operation = writeChain.then(() => putRecord(key, snapshot));
    writeChain = operation.catch(() => undefined);
    return operation;
  }

  function remove(key) {
    const operation = writeChain.then(() => deleteRecord(key));
    writeChain = operation.catch(() => undefined);
    return operation;
  }

  async function flush() { await writeChain; }

  async function estimate() {
    let estimateResult = {};
    try { estimateResult = await globalThis.navigator?.storage?.estimate?.() || {}; } catch (_error) {}
    const database = await openDatabase().catch(() => null);
    return {
      backend: database ? "IndexedDB" : "localStorage fallback",
      durable: Boolean(database),
      usage: Number(estimateResult.usage) || null,
      quota: Number(estimateResult.quota) || null,
      usageDetails: estimateResult.usageDetails || null,
      databaseVersion: DATABASE_VERSION,
      stores: Object.values(STRUCTURED_STORES)
    };
  }

  async function migrateLegacy(keys = Array.from(LARGE_KEYS)) {
    const migrated = [];
    for (const key of keys) {
      const existing = await getRecord(key);
      if (existing !== undefined) continue;
      const legacy = readLegacy(key, undefined);
      if (legacy === undefined) continue;
      await putRecord(key, legacy);
      migrated.push(key);
    }
    return migrated;
  }

  globalThis.CMAStorage = Object.freeze({
    DATABASE_NAME,
    DATABASE_VERSION,
    STORE_NAME,
    STRUCTURED_STORES,
    POINTER_TYPE,
    LARGE_KEYS,
    isPointer,
    readLegacy,
    openDatabase,
    get,
    set,
    remove,
    flush,
    estimate,
    migrateLegacy,
    storeGet,
    storeGetAll,
    storePut,
    storePutMany,
    storeDelete,
    storeClear,
    replaceStore
  });
})();
