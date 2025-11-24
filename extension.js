// const vscode = require("vscode");
// const fs = require("fs");
// const path = require("path");

// let sessionLogs = [];
// let fileOpenTimestamps = {};
// let keystrokeCounter = 0;
// let pasteCounter = 0;
// let workspaceRoot = null;
// let writeInterval = null;
// let logFilePath = null;

// // ---------------------------------------------
// // Helpers
// // ---------------------------------------------
// function getLogFileName(storagePath) {
//   const d = new Date();
//   const yyyy = d.getFullYear();
//   const mm = String(d.getMonth() + 1).padStart(2, "0");
//   const dd = String(d.getDate()).padStart(2, "0");
//   return path.join(storagePath, `dev-logs-${yyyy}-${mm}-${dd}.log`);
// }

// function appendToLogFileSync(filePath, obj) {
//   try {
//     const line = JSON.stringify(obj) + "\n";
//     fs.appendFileSync(filePath, line, "utf8");
//   } catch (e) {
//     console.error("Failed writing log file:", e);
//   }
// }

// function extractFeature(filePath) {
//   const parts = filePath.split(/[\/\\]/);
//   return parts.slice(-3, -1).join("/");
// }

// // ---------------------------------------------
// // Flush logs
// // ---------------------------------------------
// function flushLogsToFile(storagePath) {
//   if (!logFilePath) {
//     logFilePath = getLogFileName(storagePath);
//     try {
//       fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
//     } catch {}
//   }

//   if (sessionLogs.length === 0 && keystrokeCounter === 0 && pasteCounter === 0) {
//     return;
//   }

//   const payload = {
//     timestamp: Date.now(),
//     stats: {
//       keystrokes: keystrokeCounter,
//       pasteEvents: pasteCounter
//     },
//     logs: [...sessionLogs]
//   };

//   appendToLogFileSync(logFilePath, payload);

//   sessionLogs = [];
//   keystrokeCounter = 0;
//   pasteCounter = 0;
// }

// // ---------------------------------------------
// // Activate
// // ---------------------------------------------
// function activate(context) {
//   const storagePath = path.join(context.extensionUri.fsPath, "logs");
//   workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;

//   try {
//     fs.mkdirSync(storagePath, { recursive: true });
//   } catch {}

//   logFilePath = getLogFileName(storagePath);

//   vscode.window.showInformationMessage("Advanced Dev Logger (Local) running…");

//   // Start session log
//   sessionLogs.push({
//     type: "session_start",
//     timestamp: Date.now(),
//     project: workspaceRoot
//   });

//   // File open
//   const openSub = vscode.workspace.onDidOpenTextDocument((doc) => {
//     const name = path.basename(doc.fileName);
//     fileOpenTimestamps[name] = Date.now();
//     sessionLogs.push({
//       type: "file_open",
//       file: name,
//       timestamp: Date.now(),
//       language: doc.languageId,
//       folderHint: extractFeature(doc.fileName),
//       project: workspaceRoot
//     });
//   });

//   // File close
//   const closeSub = vscode.workspace.onDidCloseTextDocument((doc) => {
//     const name = path.basename(doc.fileName);
//     if (fileOpenTimestamps[name]) {
//       const spent = Date.now() - fileOpenTimestamps[name];
//       sessionLogs.push({
//         type: "file_close",
//         file: name,
//         timeSpentMs: spent,
//         timestamp: Date.now(),
//         language: doc.languageId
//       });
//       delete fileOpenTimestamps[name];
//     }
//   });

//   // File save
//   const saveSub = vscode.workspace.onDidSaveTextDocument((doc) => {
//     sessionLogs.push({
//       type: "file_save",
//       file: path.basename(doc.fileName),
//       timestamp: Date.now(),
//       language: doc.languageId,
//       folderHint: extractFeature(doc.fileName)
//     });
//   });

//   // Keystrokes / paste
//   const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
//     let inserted = 0;

//     for (const ch of e.contentChanges) {
//       if (ch.text) {
//         inserted += ch.text.length;
//         if (ch.text.length > 5) pasteCounter++;
//       }
//     }

//     keystrokeCounter += inserted;
//   });

//   // Diagnostics
//   const diagSub = vscode.languages.onDidChangeDiagnostics((e) => {
//     try {
//       const entries = [];
//       e.uris.forEach((uri) => {
//         const ds = vscode.languages.getDiagnostics(uri);
//         entries.push({
//           file: path.basename(uri.fsPath),
//           errors: ds.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length,
//           warnings: ds.filter((d) => d.severity === vscode.DiagnosticSeverity.Warning).length
//         });
//       });

//       sessionLogs.push({
//         type: "diagnostics",
//         issues: entries,
//         timestamp: Date.now()
//       });
//     } catch {}
//   });

//   // Flush every 5 minutes
//   writeInterval = setInterval(() => {
//     flushLogsToFile(storagePath);
//   }, 5 * 60 * 1000);

//   context.subscriptions.push(openSub, closeSub, saveSub, changeSub, diagSub);
// }

// // ---------------------------------------------
// // Deactivate
// // ---------------------------------------------
// function deactivate() {
//   sessionLogs.push({
//     type: "session_end",
//     timestamp: Date.now(),
//     project: workspaceRoot
//   });

//   try {
//     flushLogsToFile(path.dirname(logFilePath));
//   } catch {}

//   if (writeInterval) clearInterval(writeInterval);
// }

// module.exports = { activate, deactivate };




const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const fetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null;


let sessionLogs = [];
let fileOpenTimestamps = {};
let keystrokeCounter = 0;
let pasteCounter = 0;
let workspaceRoot = null;
let writeInterval = null;
let logFilePath = null;
let storageDir = null; 

// Backend endpoint
const BACKEND_UPLOAD_URL = "https://chaitanyaabhade.vercel.app/api/admin/uploadlog";

// Config
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_SESSION_LOGS_BEFORE_FLUSH = 5000; // simple safeguard


function getDailyFileName(date, storagePath) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return path.join(storagePath, `dev-logs-${yyyy}-${mm}-${dd}.log`);
}

function todayFile(storagePath) {
  return getDailyFileName(new Date(), storagePath);
}

function appendToLogFile(filePath, obj) {
  try {
    const line = JSON.stringify(obj) + "\n";
    fs.appendFileSync(filePath, line, "utf8");
    return true;
  } catch (e) {
    console.error("Failed writing log file:", e);
    return false;
  }
}

function extractFeature(filePath) {
  const parts = filePath.split(/[\/\\]/);
  if (parts.length >= 3) return parts.slice(-3, -1).join("/");
  return parts.slice(-2).join("/");
}

function readAllLogFiles(storagePath) {
  try {
    if (!fs.existsSync(storagePath)) return [];
    return fs.readdirSync(storagePath)
      .filter(f => f.startsWith("dev-logs-") && f.endsWith(".log"))
      .map(f => path.join(storagePath, f));
  } catch (e) {
    console.error("readAllLogFiles error:", e);
    return [];
  }
}

function loadProcessedList(storagePath) {
  const p = path.join(storagePath, "processed.json");
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) || [];
  } catch (e) {
    console.error("Failed to read processed.json:", e);
    return [];
  }
}

function saveProcessedList(storagePath, list) {
  const p = path.join(storagePath, "processed.json");
  try {
    // write atomically to temp file then rename
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), "utf8");
    fs.renameSync(tmp, p);
  } catch (e) {
    console.error("Failed to write processed.json:", e);
  }
}

async function uploadLogToBackend(filePath) {
  if (!fetch) {
    console.error("No fetch available in this environment. Install node 18+ or add a fetch polyfill.");
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const fileName = path.basename(filePath);



    const res = await fetch(BACKEND_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: {
        filename: fileName,
        rawLogs: content
      }
    });

    if (!res.ok) {
      console.error(`Upload failed: ${res.status} ${res.statusText}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Upload error:", e);
    return false;
  }
}

function flushLogs(storagePath) {
  if (!storagePath) {
    console.warn("flushLogs called without a storagePath");
    return;
  }

  if (!logFilePath) {
    logFilePath = todayFile(storagePath);
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
  }

  if (
    sessionLogs.length === 0 &&
    keystrokeCounter === 0 &&
    pasteCounter === 0
  ) {
    return; // nothing to write
  }

  // safety: if sessionLogs huge, flush in smaller chunks (simple heuristic)
  const logsToWrite = sessionLogs.splice(0, MAX_SESSION_LOGS_BEFORE_FLUSH);
  const payload = {
    timestamp: Date.now(),
    stats: {
      keystrokes: keystrokeCounter,
      pasteEvents: pasteCounter
    },
    logs: logsToWrite
  };

  const ok = appendToLogFile(logFilePath, payload);
  if (!ok) {
    // if failed, put logs back so next attempt can retry
    sessionLogs = logsToWrite.concat(sessionLogs);
  } else {
    // only reset counters when we've successfully written
    keystrokeCounter = 0;
    pasteCounter = 0;
  }
}

async function processPendingLogs(storagePath) {
  if (!storagePath) return;

  const files = readAllLogFiles(storagePath);
  const processed = loadProcessedList(storagePath);

  // skip today's file to avoid uploading an actively-written log
  const today = todayFile(storagePath);
  const pending = files.filter(f => !processed.includes(f) && f !== today);

  for (const file of pending) {
    try {
      const success = await uploadLogToBackend(file);
      if (success) {
        // mark processed and persist BEFORE deleting
        processed.push(file);
        saveProcessedList(storagePath, processed);

        try {
          fs.unlinkSync(file);
        } catch (e) {
          // can't delete file — log and continue; processed list already recorded to avoid re-upload
          console.warn("Could not delete uploaded log file:", file, e);
        }
      } else {
        console.warn("Upload failed for:", file);
      }
    } catch (e) {
      console.error("Unexpected error processing file:", file, e);
      // continue with next file
    }
  }
}


async function activate(context) {
  storageDir = path.join(context.globalStorageUri.fsPath, "logs");
  fs.mkdirSync(storageDir, { recursive: true });
  workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;

  logFilePath = todayFile(storageDir);

  vscode.window.showInformationMessage("Advanced Dev Logger (Improved) running…");

  // Try uploading previous day's (or older) logs — skip today's file
  try {
    await processPendingLogs(storageDir);
  } catch (e) {
    console.error("processPendingLogs failed during activate:", e);
  }

  // Start session
  sessionLogs.push({
    type: "session_start",
    timestamp: Date.now(),
    project: workspaceRoot
  });

  // File open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      const name = path.basename(doc.fileName);
      fileOpenTimestamps[name] = Date.now();
      sessionLogs.push({
        type: "file_open",
        file: name,
        timestamp: Date.now(),
        language: doc.languageId,
        folderHint: extractFeature(doc.fileName),
        project: workspaceRoot
      });
    })
  );

  // File close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      const name = path.basename(doc.fileName);
      if (fileOpenTimestamps[name]) {
        const spent = Date.now() - fileOpenTimestamps[name];
        sessionLogs.push({
          type: "file_close",
          file: name,
          timeSpentMs: spent,
          timestamp: Date.now(),
          language: doc.languageId
        });
        delete fileOpenTimestamps[name];
      }
    })
  );

  // File save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      sessionLogs.push({
        type: "file_save",
        file: path.basename(doc.fileName),
        timestamp: Date.now(),
        language: doc.languageId,
        folderHint: extractFeature(doc.fileName)
      });

      // optional: flush on save to reduce data loss
      try { flushLogs(storageDir); } catch {}
    })
  );

  // Text change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      let inserted = 0;
      for (const ch of e.contentChanges) {
        if (ch.text) {
          inserted += ch.text.length;
          // heuristic: consider large insert as paste
          if (ch.text.length > 20) pasteCounter++;
        }
      }
      keystrokeCounter += inserted;

      // small heuristic: if we accumulate a lot of session logs quickly, flush
      if (sessionLogs.length > MAX_SESSION_LOGS_BEFORE_FLUSH / 5) {
        try { flushLogs(storageDir); } catch {}
      }
    })
  );

  // Diagnostics
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics((e) => {
      try {
        const entries = [];
        e.uris.forEach((uri) => {
          const ds = vscode.languages.getDiagnostics(uri);
          entries.push({
            file: path.basename(uri.fsPath),
            errors: ds.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length,
            warnings: ds.filter((d) => d.severity === vscode.DiagnosticSeverity.Warning).length
          });
        });

        sessionLogs.push({
          type: "diagnostics",
          issues: entries,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error("Error collecting diagnostics:", err);
      }
    })
  );

  // Flush every FLUSH_INTERVAL_MS
  writeInterval = setInterval(() => {
    try { flushLogs(storageDir); } catch (e) { console.error("Periodic flush failed:", e); }
  }, FLUSH_INTERVAL_MS);
}

function deactivate() {
  sessionLogs.push({
    type: "session_end",
    timestamp: Date.now(),
    project: workspaceRoot
  });

  try {
    // use stored storageDir; guard if undefined
    if (storageDir) {
      flushLogs(storageDir);
    } else if (logFilePath) {
      const dir = path.dirname(logFilePath);
      flushLogs(dir);
    } else {
      console.warn("No storageDir or logFilePath available during deactivate.");
    }
  } catch (e) {
    console.error("Error flushing logs at deactivate:", e);
  }

  if (writeInterval) clearInterval(writeInterval);
}

module.exports = { activate, deactivate };
