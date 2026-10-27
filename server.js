// // import express from "express";
// // import cors from "cors";
// // import dotenv from "dotenv";
// // import { ImapFlow } from "imapflow";
// // import { simpleParser } from "mailparser";

// // dotenv.config();
// // console.log('DEBUG — EMAIL_USERNAME:', process.env.EMAIL_USERNAME);
// // console.log('DEBUG — EMAIL_PASSWORD length:', process.env.EMAIL_PASSWORD?.length);
// // console.log('DEBUG — EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD);
// // const app = express();
// // app.use(cors());
// // app.use(express.json());

// // let client = null;
// // let connecting = null;

// // async function getClient() {
// //   if (client && client.usable) return client;

// //   if (connecting) return connecting; // avoid parallel connect attempts

// //   connecting = (async () => {
// //     const c = new ImapFlow({
// //       host: process.env.EMAIL_HOST,
// //       port: Number(process.env.EMAIL_PORT),
// //       secure: true,
// //       auth: {
// //         user: process.env.EMAIL_USERNAME,
// //         pass: process.env.EMAIL_PASSWORD,
// //       },
// //       tls: { rejectUnauthorized: false },
// //       logger: false,
// //     });
// //     await c.connect();
// //     client = c;
// //     connecting = null;
// //     return c;
// //   })();

// //   return connecting;
// // }

// // function isEmbeddedMessage(att) {
// //   return (
// //     att.contentType === "message/rfc822" ||
// //     (att.filename || "").toLowerCase().endsWith(".eml")
// //   );
// // }

// // async function extractNestedText(parsed) {
// //   const nested = [];
// //   for (const att of parsed.attachments) {
// //     if (isEmbeddedMessage(att)) {
// //       try {
// //         const innerParsed = await simpleParser(att.content);
// //         nested.push({
// //           from: innerParsed.from?.text || "",
// //           subject: innerParsed.subject || "",
// //           date: innerParsed.date,
// //           text: innerParsed.text || "",
// //         });
// //       } catch (e) {
// //         console.error("Failed to parse embedded message", e);
// //       }
// //     }
// //   }
// //   return nested;
// // }

// // // Builds one flat list combining direct attachments with any attachments
// // // nested inside embedded (.eml/message-rfc822) forwarded messages, so the
// // // list route and the download route always agree on indexing.
// // async function getAllAttachments(parsed) {
// //   const directAttachments = parsed.attachments.filter(
// //     (att) => !isEmbeddedMessage(att),
// //   );

// //   const nestedAttachments = [];
// //   for (const att of parsed.attachments) {
// //     if (isEmbeddedMessage(att)) {
// //       try {
// //         const innerParsed = await simpleParser(att.content);
// //         nestedAttachments.push(...innerParsed.attachments);
// //       } catch (e) {
// //         console.error("Failed to parse embedded message for attachments", e);
// //       }
// //     }
// //   }

// //   return [...directAttachments, ...nestedAttachments];
// // }

// // function getFileType(filename, contentType) {
// //   const ext = (filename || "").split(".").pop().toLowerCase();
// //   if (ext === "pdf" || contentType?.includes("pdf")) return "pdf";
// //   if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
// //   if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
// //   if (["doc", "docx"].includes(ext)) return "word";
// //   return "other";
// // }

// // function countAttachments(node) {
// //   if (!node) return 0;
// //   let count = node.disposition === "attachment" ? 1 : 0;
// //   if (node.childNodes)
// //     for (const c of node.childNodes) count += countAttachments(c);
// //   return count;
// // }

// // // ---------------------------------------------------------------------------
// // // GET /api/emails — list the most recent messages in INBOX (used by the
// // // sidebar). This was accidentally dropped in a previous edit — restored here.
// // // ---------------------------------------------------------------------------
// // app.get("/api/emails", async (req, res) => {
// //   try {
// //     const c = await getClient();
// //     const lock = await c.getMailboxLock("INBOX");
// //     const results = [];
// //     try {
// //       const status = await c.status("INBOX", { messages: true });
// //       const total = status.messages;
// //       const start = Math.max(1, total - 19);
// //       for await (const msg of c.fetch(`${start}:${total}`, {
// //         envelope: true,
// //         bodyStructure: true,
// //       })) {
// //         results.push({
// //           id: String(msg.uid),
// //           sender: msg.envelope.from?.[0]?.address || "Unknown",
// //           subject: msg.envelope.subject || "(no subject)",
// //           received_date: msg.envelope.date,
// //           attachment_count: countAttachments(msg.bodyStructure),
// //           status: "received",
// //         });
// //       }
// //     } finally {
// //       lock.release();
// //     }
// //     results.reverse();
// //     res.json({
// //       results,
// //       total_count: results.length,
// //       pending_count: results.length,
// //     });
// //   } catch (err) {
// //     console.error(err);
// //     client = null; // force reconnect next time
// //     res.status(500).json({ error: "Failed to fetch emails" });
// //   }
// // });

// // app.get("/api/email/:id", async (req, res) => {
// //   try {
// //     const c = await getClient();
// //     const lock = await c.getMailboxLock("INBOX");
// //     let result = null;
// //     try {
// //       const msg = await c.fetchOne(
// //         req.params.id,
// //         { envelope: true, source: true },
// //         { uid: true },
// //       );
// //       const parsed = await simpleParser(msg.source);
// //       const nestedMessages = await extractNestedText(parsed);

// //       let fullText = parsed.text || "";
// //       for (const nm of nestedMessages) {
// //         fullText +=
// //           `\n\n---------- Forwarded message ----------\n` +
// //           `From: ${nm.from}\nSubject: ${nm.subject}\n\n${nm.text}`;
// //       }

// //       const directAttachments = parsed.attachments.filter(
// //         (att) => !isEmbeddedMessage(att),
// //       );

// //       result = {
// //         id: req.params.id,
// //         sender: msg.envelope.from?.[0]?.address,
// //         subject: msg.envelope.subject,
// //         received_date: msg.envelope.date,
// //         body_preview: fullText.slice(0, 2000),
// //         attachment_count: directAttachments.length,
// //         status: "received",
// //       };
// //     } finally {
// //       lock.release();
// //     }
// //     res.json(result);
// //   } catch (err) {
// //     console.error(err);
// //     client = null;
// //     res.status(500).json({ error: "Failed to fetch email detail" });
// //   }
// // });

// // app.get("/api/email/:id/attachments", async (req, res) => {
// //   try {
// //     const c = await getClient();
// //     const lock = await c.getMailboxLock("INBOX");
// //     let attachments = [];
// //     try {
// //       const msg = await c.fetchOne(
// //         req.params.id,
// //         { source: true },
// //         { uid: true },
// //       );
// //       const parsed = await simpleParser(msg.source);
// //       const allAttachments = await getAllAttachments(parsed);

// //       attachments = allAttachments.map((att, i) => ({
// //         id: String(i),
// //         filename: att.filename || `attachment-${i}`,
// //         type: getFileType(att.filename, att.contentType),
// //         size: att.size,
// //         url: `/api/email/${req.params.id}/attachments/${i}`,
// //       }));
// //     } finally {
// //       lock.release();
// //     }
// //     res.json(attachments);
// //   } catch (err) {
// //     console.error(err);
// //     client = null;
// //     res.status(500).json({ error: "Failed to fetch attachments" });
// //   }
// // });

// // app.get("/api/email/:id/attachments/:attId", async (req, res) => {
// //   try {
// //     const c = await getClient();
// //     const lock = await c.getMailboxLock("INBOX");
// //     try {
// //       const msg = await c.fetchOne(
// //         req.params.id,
// //         { source: true },
// //         { uid: true },
// //       );
// //       const parsed = await simpleParser(msg.source);
// //       const allAttachments = await getAllAttachments(parsed);
// //       const att = allAttachments[Number(req.params.attId)];
// //       if (!att) return res.status(404).send("Not found");

// //       res.set("Content-Type", att.contentType || "application/pdf");
// //       res.set(
// //         "Content-Disposition",
// //         `inline; filename="${att.filename || "file.pdf"}"`,
// //       );
// //       res.send(att.content);
// //     } finally {
// //       lock.release();
// //     }
// //   } catch (err) {
// //     console.error(err);
// //     client = null;
// //     res.status(500).send("Failed to fetch attachment");
// //   }
// // });

// // // Fetches the full email (with attachment bytes) by id and forwards it
// // // to n8n for declaration extraction. Only PDF attachments (direct or
// // // nested inside an embedded .eml forward) are sent; other file types
// // // are excluded.
// // app.post("/api/email/:id/notify-n8n", async (req, res) => {
// //   try {
// //     const c = await getClient();
// //     const lock = await c.getMailboxLock("INBOX");
// //     let payload;
// //     try {
// //       const msg = await c.fetchOne(
// //         req.params.id,
// //         { envelope: true, source: true },
// //         { uid: true },
// //       );
// //       const parsed = await simpleParser(msg.source);
// //       const nestedMessages = await extractNestedText(parsed);

// //       let fullText = parsed.text || "";
// //       for (const nm of nestedMessages) {
// //         fullText +=
// //           `\n\n---------- Forwarded message ----------\n` +
// //           `From: ${nm.from}\nSubject: ${nm.subject}\n\n${nm.text}`;
// //       }

// //       const allAttachments = await getAllAttachments(parsed);
// //       const pdfAttachments = allAttachments.filter(
// //         (att) => getFileType(att.filename, att.contentType) === "pdf",
// //       );

// //       payload = {
// //         id: req.params.id,
// //         sender:
// //           parsed.from?.value?.[0]?.address || msg.envelope.from?.[0]?.address,
// //         subject: parsed.subject || msg.envelope.subject,
// //         received_date: msg.envelope.date,
// //         body: fullText,
// //         attachments: pdfAttachments.map((att) => ({
// //           filename: att.filename || "attachment.pdf",
// //           contentType: att.contentType,
// //           size: att.size,
// //           content_base64: att.content.toString("base64"),
// //         })),
// //       };
// //     } finally {
// //       lock.release();
// //     }

// //     console.log(`[n8n] sending request for email ${req.params.id}...`);
// //     const n8nRes = await fetch(process.env.N8N_WEBHOOK_URL, {
// //       method: "POST",
// //       headers: { "Content-Type": "application/json" },
// //       body: JSON.stringify(payload),
// //     });
// //     console.log(`[n8n] GOT RESPONSE — status ${n8nRes.status}`);
// //     if (!n8nRes.ok) throw new Error(`n8n responded ${n8nRes.status}`);
// //     const data = await n8nRes.json().catch(() => ({}));
// //     console.log(`[n8n] response body:`, data);
// //     res.json({ success: true, n8n_response: data });
// //   } catch (err) {
// //     console.error("n8n notify failed:", err);
// //     client = null;
// //     res.status(500).json({ error: "Failed to notify n8n" });
// //   }
// // });

// // app.listen(process.env.PORT, "0.0.0.0", () => {
// //   console.log(`Backend running on http://192.168.1.40:${process.env.PORT}`);
// //   console.log(
// //     `(also reachable locally at http://localhost:${process.env.PORT})`,
// //   );
// // });


// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { ImapFlow } from "imapflow";
// import { simpleParser } from "mailparser";

// dotenv.config();
// // NOTE: never log the password. Only confirm that the values are loaded.
// console.log("ENV loaded — user:", process.env.EMAIL_USERNAME, "| password set:", !!process.env.EMAIL_PASSWORD);

// const app = express();
// app.use(cors());
// app.use(express.json());

// let client = null;
// let connecting = null;

// async function getClient() {
//   if (client && client.usable) return client;

//   if (connecting) return connecting; // avoid parallel connect attempts

//   connecting = (async () => {
//     const c = new ImapFlow({
//       host: process.env.EMAIL_HOST,
//       port: Number(process.env.EMAIL_PORT),
//       secure: true,
//       auth: {
//         user: process.env.EMAIL_USERNAME,
//         pass: process.env.EMAIL_PASSWORD,
//       },
//       tls: { rejectUnauthorized: false }, // TODO: fix certificate before production
//       logger: false,
//     });
//     await c.connect();
//     client = c;
//     connecting = null;
//     return c;
//   })();

//   return connecting;
// }

// function isEmbeddedMessage(att) {
//   return (
//     att.contentType === "message/rfc822" ||
//     (att.filename || "").toLowerCase().endsWith(".eml")
//   );
// }

// async function extractNestedText(parsed) {
//   const nested = [];
//   for (const att of parsed.attachments) {
//     if (isEmbeddedMessage(att)) {
//       try {
//         const innerParsed = await simpleParser(att.content);
//         nested.push({
//           from: innerParsed.from?.text || "",
//           subject: innerParsed.subject || "",
//           date: innerParsed.date,
//           text: innerParsed.text || "",
//         });
//       } catch (e) {
//         console.error("Failed to parse embedded message", e);
//       }
//     }
//   }
//   return nested;
// }

// // Builds one flat list combining direct attachments with any attachments
// // nested inside embedded (.eml/message-rfc822) forwarded messages, so the
// // list route and the download route always agree on indexing.
// async function getAllAttachments(parsed) {
//   const directAttachments = parsed.attachments.filter(
//     (att) => !isEmbeddedMessage(att),
//   );

//   const nestedAttachments = [];
//   for (const att of parsed.attachments) {
//     if (isEmbeddedMessage(att)) {
//       try {
//         const innerParsed = await simpleParser(att.content);
//         nestedAttachments.push(...innerParsed.attachments);
//       } catch (e) {
//         console.error("Failed to parse embedded message for attachments", e);
//       }
//     }
//   }

//   return [...directAttachments, ...nestedAttachments];
// }

// // Combines the main body with the text of any forwarded .eml messages.
// function buildFullText(parsed, nestedMessages) {
//   let fullText = parsed.text || "";
//   for (const nm of nestedMessages) {
//     fullText +=
//       `\n\n---------- Forwarded message ----------\n` +
//       `From: ${nm.from}\nSubject: ${nm.subject}\n\n${nm.text}`;
//   }
//   return fullText;
// }

// function getFileType(filename, contentType) {
//   const ext = (filename || "").split(".").pop().toLowerCase();
//   if (ext === "pdf" || contentType?.includes("pdf")) return "pdf";
//   if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
//   if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
//   if (["doc", "docx"].includes(ext)) return "word";
//   return "other";
// }

// function countAttachments(node) {
//   if (!node) return 0;
//   let count = node.disposition === "attachment" ? 1 : 0;
//   if (node.childNodes)
//     for (const c of node.childNodes) count += countAttachments(c);
//   return count;
// }

// // ---------------------------------------------------------------------------
// // GET /api/emails — list the most recent messages in INBOX (sidebar)
// // ---------------------------------------------------------------------------
// app.get("/api/emails", async (req, res) => {
//   try {
//     const c = await getClient();
//     const lock = await c.getMailboxLock("INBOX");
//     const results = [];
//     try {
//       const status = await c.status("INBOX", { messages: true });
//       const total = status.messages;
//       const start = Math.max(1, total - 19);
//       for await (const msg of c.fetch(`${start}:${total}`, {
//         envelope: true,
//         bodyStructure: true,
//       })) {
//         results.push({
//           id: String(msg.uid),
//           sender: msg.envelope.from?.[0]?.address || "Unknown",
//           subject: msg.envelope.subject || "(no subject)",
//           received_date: msg.envelope.date,
//           attachment_count: countAttachments(msg.bodyStructure),
//           status: "received",
//         });
//       }
//     } finally {
//       lock.release();
//     }
//     results.reverse();
//     res.json({
//       results,
//       total_count: results.length,
//       pending_count: results.length,
//     });
//   } catch (err) {
//     console.error(err);
//     client = null; // force reconnect next time
//     res.status(500).json({ error: "Failed to fetch emails" });
//   }
// });

// app.get("/api/email/:id", async (req, res) => {
//   try {
//     const c = await getClient();
//     const lock = await c.getMailboxLock("INBOX");
//     let result = null;
//     try {
//       const msg = await c.fetchOne(
//         req.params.id,
//         { envelope: true, source: true },
//         { uid: true },
//       );
//       const parsed = await simpleParser(msg.source);
//       const nestedMessages = await extractNestedText(parsed);
//       const fullText = buildFullText(parsed, nestedMessages);

//       const directAttachments = parsed.attachments.filter(
//         (att) => !isEmbeddedMessage(att),
//       );

//       result = {
//         id: req.params.id,
//         sender: msg.envelope.from?.[0]?.address,
//         subject: msg.envelope.subject,
//         received_date: msg.envelope.date,
//         body_preview: fullText.slice(0, 2000),
//         attachment_count: directAttachments.length,
//         status: "received",
//       };
//     } finally {
//       lock.release();
//     }
//     res.json(result);
//   } catch (err) {
//     console.error(err);
//     client = null;
//     res.status(500).json({ error: "Failed to fetch email detail" });
//   }
// });

// app.get("/api/email/:id/attachments", async (req, res) => {
//   try {
//     const c = await getClient();
//     const lock = await c.getMailboxLock("INBOX");
//     let attachments = [];
//     try {
//       const msg = await c.fetchOne(
//         req.params.id,
//         { source: true },
//         { uid: true },
//       );
//       const parsed = await simpleParser(msg.source);
//       const allAttachments = await getAllAttachments(parsed);

//       attachments = allAttachments.map((att, i) => ({
//         id: String(i),
//         filename: att.filename || `attachment-${i}`,
//         type: getFileType(att.filename, att.contentType),
//         size: att.size,
//         url: `/api/email/${req.params.id}/attachments/${i}`,
//       }));
//     } finally {
//       lock.release();
//     }
//     res.json(attachments);
//   } catch (err) {
//     console.error(err);
//     client = null;
//     res.status(500).json({ error: "Failed to fetch attachments" });
//   }
// });

// app.get("/api/email/:id/attachments/:attId", async (req, res) => {
//   try {
//     const c = await getClient();
//     const lock = await c.getMailboxLock("INBOX");
//     try {
//       const msg = await c.fetchOne(
//         req.params.id,
//         { source: true },
//         { uid: true },
//       );
//       const parsed = await simpleParser(msg.source);
//       const allAttachments = await getAllAttachments(parsed);
//       const att = allAttachments[Number(req.params.attId)];
//       if (!att) return res.status(404).send("Not found");

//       res.set("Content-Type", att.contentType || "application/pdf");
//       res.set(
//         "Content-Disposition",
//         `inline; filename="${att.filename || "file.pdf"}"`,
//       );
//       res.send(att.content);
//     } finally {
//       lock.release();
//     }
//   } catch (err) {
//     console.error(err);
//     client = null;
//     res.status(500).send("Failed to fetch attachment");
//   }
// });

// // Fetches the full email (with attachment bytes) by id and forwards it
// // to n8n. The payload includes the full email body (main text + forwarded
// // messages) so n8n can read FLIGHT #, FLT DATE, COUNTRY OF ORIGIN, MAWB.
// // Only PDF attachments (direct or nested in a forwarded .eml) are sent.
// //
// // In n8n the Webhook node puts this JSON under $json.body, so the email
// // text is at $json.body.body.
// app.post("/api/email/:id/notify-n8n", async (req, res) => {
//   try {
//     const c = await getClient();
//     const lock = await c.getMailboxLock("INBOX");
//     let payload;
//     try {
//       const msg = await c.fetchOne(
//         req.params.id,
//         { envelope: true, source: true },
//         { uid: true },
//       );
//       const parsed = await simpleParser(msg.source);
//       const nestedMessages = await extractNestedText(parsed);
//       const fullText = buildFullText(parsed, nestedMessages);

//       const allAttachments = await getAllAttachments(parsed);
//       const pdfAttachments = allAttachments.filter(
//         (att) => getFileType(att.filename, att.contentType) === "pdf",
//       );

//       payload = {
//         id: req.params.id,
//         sender:
//           parsed.from?.value?.[0]?.address || msg.envelope.from?.[0]?.address,
//         subject: parsed.subject || msg.envelope.subject,
//         received_date: msg.envelope.date,
//         body: fullText,
//         attachments: pdfAttachments.map((att) => ({
//           filename: att.filename || "attachment.pdf",
//           contentType: att.contentType,
//           size: att.size,
//           content_base64: att.content.toString("base64"),
//         })),
//       };
//     } finally {
//       lock.release();
//     }

//     // Preview of what is being sent (no base64 data, body truncated)
//     console.log("[n8n] payload preview:", {
//       id: payload.id,
//       sender: payload.sender,
//       subject: payload.subject,
//       received_date: payload.received_date,
//       bodyLength: payload.body.length,
//       bodyStart: payload.body.slice(0, 300),
//       hasFlightFields: /FLIGHT\s*#/i.test(payload.body),
//       attachments: payload.attachments.map(
//         (a) => `${a.filename} (${a.size} bytes)`,
//       ),
//     });

//     console.log(`[n8n] sending request for email ${req.params.id}...`);
//     const n8nRes = await fetch(process.env.N8N_WEBHOOK_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload),
//     });
//     console.log(`[n8n] GOT RESPONSE — status ${n8nRes.status}`);
//     if (!n8nRes.ok) throw new Error(`n8n responded ${n8nRes.status}`);
//     const data = await n8nRes.json().catch(() => ({}));
//     console.log(`[n8n] response body:`, data);
//     res.json({ success: true, n8n_response: data });
//   } catch (err) {
//     console.error("n8n notify failed:", err);
//     client = null;
//     res.status(500).json({ error: "Failed to notify n8n" });
//   }
// });

// app.listen(process.env.PORT, "0.0.0.0", () => {
//   console.log(`Backend running on http://192.168.1.40:${process.env.PORT}`);
//   console.log(
//     `(also reachable locally at http://localhost:${process.env.PORT})`,
//   );
// });

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

dotenv.config();
// NOTE: never log the password. Only confirm that the values are loaded.
console.log(
  "ENV loaded — user:",
  process.env.EMAIL_USERNAME,
  "| password set:",
  !!process.env.EMAIL_PASSWORD,
);

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// IMAP connection (single shared client)
// ---------------------------------------------------------------------------
let client = null;
let connecting = null;

async function getClient() {
  if (client && client.usable) return client;
  if (connecting) return connecting; // avoid parallel connect attempts

  connecting = (async () => {
    try {
      const c = new ImapFlow({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),
        secure: true,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: { rejectUnauthorized: false }, // TODO: fix certificate before production
        logger: false,
      });
      // ImapFlow emits socket errors as events; unhandled ones crash the process
      c.on("error", (err) => {
        console.error("IMAP error:", err.message);
        client = null;
      });
      c.on("close", () => {
        client = null;
      });
      await c.connect();
      client = c;
      return c;
    } finally {
      connecting = null; // always reset, even if connect() throws
    }
  })();

  return connecting;
}

// Fetch one message by UID, holding the mailbox lock only while fetching
// (parsing happens afterwards, outside the lock).
async function fetchMessage(uid, query) {
  const c = await getClient();
  const lock = await c.getMailboxLock("INBOX");
  try {
    return await c.fetchOne(uid, query, { uid: true });
  } finally {
    lock.release();
  }
}

// ---------------------------------------------------------------------------
// Attachment helpers
// ---------------------------------------------------------------------------
function isEmbeddedMessage(att) {
  return (
    att.contentType === "message/rfc822" ||
    (att.filename || "").toLowerCase().endsWith(".eml")
  );
}

async function extractNestedText(parsed) {
  const nested = [];
  for (const att of parsed.attachments) {
    if (isEmbeddedMessage(att)) {
      try {
        const innerParsed = await simpleParser(att.content);
        nested.push({
          from: innerParsed.from?.text || "",
          subject: innerParsed.subject || "",
          date: innerParsed.date,
          text: innerParsed.text || "",
        });
      } catch (e) {
        console.error("Failed to parse embedded message", e);
      }
    }
  }
  return nested;
}

// One flat list: direct attachments + attachments nested inside embedded
// (.eml / message-rfc822) forwarded messages, so the list route and the
// download route always agree on indexing.
async function getAllAttachments(parsed) {
  const directAttachments = parsed.attachments.filter(
    (att) => !isEmbeddedMessage(att),
  );

  const nestedAttachments = [];
  for (const att of parsed.attachments) {
    if (isEmbeddedMessage(att)) {
      try {
        const innerParsed = await simpleParser(att.content);
        nestedAttachments.push(...innerParsed.attachments);
      } catch (e) {
        console.error("Failed to parse embedded message for attachments", e);
      }
    }
  }

  return [...directAttachments, ...nestedAttachments];
}

// Main body + text of any forwarded .eml messages.
function buildFullText(parsed, nestedMessages) {
  let fullText = parsed.text || "";
  for (const nm of nestedMessages) {
    fullText +=
      `\n\n---------- Forwarded message ----------\n` +
      `From: ${nm.from}\nSubject: ${nm.subject}\n\n${nm.text}`;
  }
  return fullText;
}

function getFileType(filename, contentType) {
  const ext = (filename || "").split(".").pop().toLowerCase();
  if (ext === "pdf" || contentType?.includes("pdf")) return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  if (["doc", "docx"].includes(ext)) return "word";
  return "other";
}

function countAttachments(node) {
  if (!node) return 0;
  let count = node.disposition === "attachment" ? 1 : 0;
  if (node.childNodes)
    for (const c of node.childNodes) count += countAttachments(c);
  return count;
}

// ---------------------------------------------------------------------------
// MAIL CONTENT EXTRACTION
//
// Step 1: read every "label : value" pair in the mail, whatever the label is.
// Step 2: map each label to a field using FIELD_ALIASES (exact match first,
//         then fuzzy "label contains alias"). Labels that map to nothing are
//         returned as `unmatched` and logged — add them to FIELD_ALIASES.
// ---------------------------------------------------------------------------
const MONTHS = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

// "21 OCT" / "21-Oct-26" / "21 OCT 2026" / "21/10/2026" -> "DD/MM/YYYY"
// When the year is missing, the year of the mail's received date is used.
function parseFlightDate(raw, fallbackDate) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return "";
  const defaultYear = new Date(fallbackDate || Date.now()).getFullYear();

  let m = s.match(
    /(\d{1,2})\s*[- ]?\s*([A-Z]{3})[A-Z]*\.?\s*[- ,]?\s*(\d{2,4})?/,
  );
  if (m && MONTHS[m[2]]) {
    const y = m[3]
      ? m[3].length === 2
        ? "20" + m[3]
        : m[3]
      : String(defaultYear);
    return `${m[1].padStart(2, "0")}/${MONTHS[m[2]]}/${y}`;
  }
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${y}`;
  }
  return "";
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Add new wordings here as you meet them. Labels are compared after norm(),
// so "Flt No.", "FLT NO", "flt-no" are all the same as "fltno".
const FIELD_ALIASES = {
  flightNumber: ["flight", "flightno", "flightnumber", "flightnum", "fltno", "fltnumber", "flt", "carrierflight"],
  // "etd" / "departuredate" added so "ETD : 21 OCT" is captured as the flight date
  flightDate: ["fltdate", "flightdate", "dateofflight", "arrivaldate", "eta", "etd", "etddate", "dateofarrival", "arrival", "etadate", "dateofdeparture", "departuredate"],
  countryOfOrigin: ["countryoforigin", "origin", "coo", "portofloading", "loadingport", "pol", "airportofdeparture", "originairport", "originport", "shippedfrom"],
  mawb: ["mawb", "mawbno", "mawbnumber", "masterawb", "masterairwaybill", "awb", "awbno", "awbnumber", "airwaybill", "airwaybillno"],
  hawb: ["hawb", "hawbno", "hawbnumber", "houseawb", "houseairwaybill", "hbl", "hblno", "consignmentno", "consignment"],
  currency: ["currency", "curr", "ccy", "invoicecurrency"],
  totalPieces: ["totalnoofpieces", "noofpieces", "totalpieces", "pieces", "pcs", "totalpcs", "noofpcs", "noofpackages", "noofpkgs", "totalpackages", "totalpkgs", "packages", "pkgs", "noofparcels", "parcels", "totalouterpack", "quantity", "qty"],
  totalGrossWeight: ["totalgrossweight", "grossweight", "gw", "gwt", "weight", "totalweight", "grosswt", "totalgrosswt", "chargeableweight"],
  invoiceNumber: ["invoiceno", "invoicenumber", "invno", "invoice"],
  invoiceValue: ["invoicevalue", "invoiceamount", "totalvalue", "totalamount", "value", "amount", "cifvalue", "fobvalue", "goodsvalue"],
  termType: ["incoterm", "incoterms", "term", "termtype", "terms", "shipmentterms"],
  importer: ["importer", "consignee", "receiver", "importername", "consigneename"],
  shipper: ["shipper", "exporter", "supplier", "shippername", "sender"],
};

// reverse lookup, built once
const ALIAS_LOOKUP = new Map();
for (const [field, list] of Object.entries(FIELD_ALIASES)) {
  for (const a of list) ALIAS_LOOKUP.set(norm(a), field);
}

function matchField(label) {
  const n = norm(label);
  if (!n) return null;
  if (ALIAS_LOOKUP.has(n)) return ALIAS_LOOKUP.get(n);
  // fuzzy: label contains a long-enough alias ("original mawb no", ...)
  let best = null;
  for (const [alias, field] of ALIAS_LOOKUP) {
    if (alias.length >= 4 && n.includes(alias)) {
      if (!best || alias.length > best.len) best = { field, len: alias.length };
    }
  }
  return best ? best.field : null;
}

const LABEL_RE = /^([A-Za-z][A-Za-z0-9 .#\/&()_-]{1,40}?)\s*[:=]\s*(.*)$/;

// Pull every "label : value" pair out of the mail text
function extractPairs(text) {
  const pairs = [];
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    // strip bullets / numbering prefixes such as "* ", "- ", "3) "
    const line = lines[i].replace(/^[\s*\-•>#\d.)]+(?=[A-Za-z])/, "").trim();
    const m = line.match(LABEL_RE);
    if (!m) continue;
    let value = m[2].trim();
    // value on the next non-empty line ("Currency :" then "TWD")
    if (!value) {
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nxt = lines[j].replace(/^[\s*\-•]+/, "").trim();
        if (nxt && !LABEL_RE.test(nxt)) {
          value = nxt;
          break;
        }
        if (nxt) break;
      }
    }
    if (value) pairs.push({ label: m[1].trim(), value });
  }
  return pairs;
}

function parseWeight(v) {
  const m = String(v).match(
    /([\d.,]+)\s*(kgs?|kgm|kilograms?|tne|tons?|tonnes?|lbs?)?/i,
  );
  if (!m) return { value: "", unit: "" };
  const unit = (m[2] || "").toUpperCase();
  return {
    value: m[1].replace(/,/g, ""),
    unit: /^TNE|^TON/.test(unit) ? "TNE" : unit ? "KGM" : "",
  };
}

function parseMailFields(text, receivedDate) {
  const pairs = extractPairs(text);
  const raw = {};
  const unmatched = [];

  for (const { label, value } of pairs) {
    const field = matchField(label);
    if (!field) {
      unmatched.push({ label, value });
      continue;
    }
    if (field === "hawb") {
      (raw.hawbList ||= []).push(value);
      continue;
    }
    if (!raw[field]) raw[field] = value;
  }

  // ---- label-less fallbacks (patterns recognisable on their own) ----
  const t = String(text || "");

  if (!raw.mawb) {
    const m = t.match(/\b(\d{3})[\s-]?(\d{4})\s?(\d{4})\b/); // 160-1737 0743
    if (m) raw.mawb = `${m[1]}-${m[2]}${m[3]}`;
  }

  const hawbs = [];
  const pushHawbs = (s) =>
    String(s)
      .split(/&|,|;|\band\b|\//i)
      .forEach((p) => {
        const tok = p.trim().split(/\s+/)[0]?.toUpperCase();
        if (tok && /^[A-Z0-9-]{6,}$/.test(tok) && !hawbs.includes(tok)) {
          hawbs.push(tok);
        }
      });
  (raw.hawbList || []).forEach(pushHawbs);
  // house bill numbers anywhere in the text (adjust the prefix if needed)
  for (const m of t.matchAll(/\bLNX[A-Z0-9]{8,}\b/gi)) {
    const tok = m[0].toUpperCase();
    if (!hawbs.includes(tok)) hawbs.push(tok);
  }

  const w = parseWeight(raw.totalGrossWeight || "");
  const cur = String(raw.currency || "").match(/[A-Za-z]{3}/);

  return {
    flightNumber: (raw.flightNumber || "").replace(/\s+/g, " ").trim(),
    flightDate: parseFlightDate(raw.flightDate, receivedDate),
    countryOfOrigin: (raw.countryOfOrigin || "").split(/[\s,(]/)[0],
    mawb: String(raw.mawb || "").replace(/\s+/g, ""),
    hawbs,
    currency: cur ? cur[0].toUpperCase() : "",
    totalPieces: (String(raw.totalPieces || "").match(/\d+/) || [""])[0],
    totalGrossWeight: w.value,
    totalGrossWeightUnit: w.unit,
    invoiceNumber: raw.invoiceNumber || "",
    termType: raw.termType || "",
    unmatched, // labels seen but not mapped -> add them to FIELD_ALIASES
  };
}

// Mail fields -> same key names the declaration JSON from n8n uses,
// so the frontend can merge it straight into the declaration panel.
function mailFieldsToDeclaration(mf) {
  const d = {};
  if (mf.flightNumber) d.FlightNumber = mf.flightNumber;
  if (mf.flightDate) d.ArrivalDate = mf.flightDate;
  if (mf.mawb) d.Mawb = mf.mawb;
  if (mf.hawbs.length) d.Hawb = mf.hawbs.join(", ");
  if (mf.countryOfOrigin) d.LoadingPort = { Code: mf.countryOfOrigin, Name: "" };
  if (mf.totalPieces) d.TotalOuterPack = mf.totalPieces;
  if (mf.totalGrossWeight) {
    d.TotalGrossWeight = mf.totalGrossWeight;
    d.TotalGrossWeightUnit = mf.totalGrossWeightUnit || "KGM";
  }
  return d;
}

// Prints the parsed fields one per line in the terminal.
function logMailFields(id, mf) {
  const { unmatched, hawbs, ...rest } = mf;

  console.log(`\n========== MAIL ${id} ==========`);
  console.log(`Flight No     : ${rest.flightNumber || "-"}`);
  console.log(`Flight Date   : ${rest.flightDate || "-"}`);
  console.log(`Origin        : ${rest.countryOfOrigin || "-"}`);
  console.log(`MAWB          : ${rest.mawb || "-"}`);
  console.log(`HAWB(s)       : ${hawbs.length ? hawbs.join(", ") : "-"}`);
  console.log(`Currency      : ${rest.currency || "-"}`);
  console.log(`Total Pieces  : ${rest.totalPieces || "-"}`);
  console.log(
    `Gross Weight  : ${rest.totalGrossWeight || "-"} ${rest.totalGrossWeightUnit || ""}`,
  );
  console.log(`Invoice No    : ${rest.invoiceNumber || "-"}`);
  console.log(`Term Type     : ${rest.termType || "-"}`);
  if (unmatched.length) {
    console.log("Unmatched labels (add to FIELD_ALIASES):");
    unmatched.forEach((u) => console.log(`   ${u.label} = ${u.value}`));
  }
  console.log("=================================\n");
}

// ---------------------------------------------------------------------------
// GET /api/emails — list the most recent messages in INBOX (sidebar)
// ---------------------------------------------------------------------------
app.get("/api/emails", async (req, res) => {
  try {
    const c = await getClient();
    const lock = await c.getMailboxLock("INBOX");
    const results = [];
    try {
      const status = await c.status("INBOX", { messages: true });
      const total = status.messages;
      const start = Math.max(1, total - 19);
      for await (const msg of c.fetch(`${start}:${total}`, {
        envelope: true,
        bodyStructure: true,
      })) {
        results.push({
          id: String(msg.uid),
          sender: msg.envelope.from?.[0]?.address || "Unknown",
          subject: msg.envelope.subject || "(no subject)",
          received_date: msg.envelope.date,
          attachment_count: countAttachments(msg.bodyStructure),
          status: "received",
        });
      }
    } finally {
      lock.release();
    }
    results.reverse();
    res.json({
      results,
      total_count: results.length,
      pending_count: results.length,
    });
  } catch (err) {
    console.error(err);
    client = null; // force reconnect next time
    res.status(500).json({ error: "Failed to fetch emails" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/email/:id — email detail (includes mail_fields)
// ---------------------------------------------------------------------------
app.get("/api/email/:id", async (req, res) => {
  try {
    const msg = await fetchMessage(req.params.id, {
      envelope: true,
      source: true,
    });
    const parsed = await simpleParser(msg.source);
    const nestedMessages = await extractNestedText(parsed);
    const fullText = buildFullText(parsed, nestedMessages);

    const directAttachments = parsed.attachments.filter(
      (att) => !isEmbeddedMessage(att),
    );

    const mail_fields = parseMailFields(fullText, msg.envelope.date);
    logMailFields(req.params.id, mail_fields);

    res.json({
      id: req.params.id,
      sender: msg.envelope.from?.[0]?.address,
      subject: msg.envelope.subject,
      received_date: msg.envelope.date,
      body_preview: fullText.slice(0, 2000),
      mail_fields,
      mail_declaration: mailFieldsToDeclaration(mail_fields),
      attachment_count: directAttachments.length,
      status: "received",
    });
  } catch (err) {
    console.error(err);
    client = null;
    res.status(500).json({ error: "Failed to fetch email detail" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/email/:id/fields — parsed mail fields only, as clean JSON
//
// Open http://localhost:<PORT>/api/email/<uid>/fields in the browser.
// Add `body: fullText` to the response if you also want the full body text.
//
// NOTE: this route must stay ABOVE nothing in particular — it has its own
// path, so it does not clash with /api/email/:id or the attachment routes.
// ---------------------------------------------------------------------------
app.get("/api/email/:id/fields", async (req, res) => {
  try {
    const msg = await fetchMessage(req.params.id, {
      envelope: true,
      source: true,
    });
    const parsed = await simpleParser(msg.source);
    const nestedMessages = await extractNestedText(parsed);
    const fullText = buildFullText(parsed, nestedMessages);
    const mf = parseMailFields(fullText, msg.envelope.date);

    res.json({
      id: req.params.id,
      subject: parsed.subject || msg.envelope.subject,
      received_date: msg.envelope.date,
      flight_number: mf.flightNumber,
      flight_date: mf.flightDate,
      country_of_origin: mf.countryOfOrigin,
      mawb: mf.mawb,
      hawbs: mf.hawbs,
      currency: mf.currency,
      total_pieces: mf.totalPieces,
      total_gross_weight: mf.totalGrossWeight,
      total_gross_weight_unit: mf.totalGrossWeightUnit,
      invoice_number: mf.invoiceNumber,
      term_type: mf.termType,
      unmatched_labels: mf.unmatched,
    });
  } catch (err) {
    console.error(err);
    client = null;
    res.status(500).json({ error: "Failed to parse email fields" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/email/:id/attachments — attachment list
// ---------------------------------------------------------------------------
app.get("/api/email/:id/attachments", async (req, res) => {
  try {
    const msg = await fetchMessage(req.params.id, { source: true });
    const parsed = await simpleParser(msg.source);
    const allAttachments = await getAllAttachments(parsed);

    const attachments = allAttachments.map((att, i) => ({
      id: String(i),
      filename: att.filename || `attachment-${i}`,
      type: getFileType(att.filename, att.contentType),
      size: att.size,
      url: `/api/email/${req.params.id}/attachments/${i}`,
    }));
    res.json(attachments);
  } catch (err) {
    console.error(err);
    client = null;
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/email/:id/attachments/:attId — attachment download / inline view
// ---------------------------------------------------------------------------
app.get("/api/email/:id/attachments/:attId", async (req, res) => {
  try {
    const msg = await fetchMessage(req.params.id, { source: true });
    const parsed = await simpleParser(msg.source);
    const allAttachments = await getAllAttachments(parsed);
    const att = allAttachments[Number(req.params.attId)];
    if (!att) return res.status(404).send("Not found");

    const filename = att.filename || "file.pdf";
    const asciiName = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");

    res.set("Content-Type", att.contentType || "application/pdf");
    res.set(
      "Content-Disposition",
      `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(att.content);
  } catch (err) {
    console.error(err);
    client = null;
    res.status(500).send("Failed to fetch attachment");
  }
});

// ---------------------------------------------------------------------------
// POST /api/email/:id/notify-n8n
//
// Sends the full email to n8n: body text (main + forwarded), parsed
// mail_fields, and PDF attachments (direct or nested in a forwarded .eml).
// In n8n the Webhook node puts this JSON under $json.body, so the email text
// is at $json.body.body and the parsed fields at $json.body.mail_fields.
// ---------------------------------------------------------------------------
app.post("/api/email/:id/notify-n8n", async (req, res) => {
  try {
    const msg = await fetchMessage(req.params.id, {
      envelope: true,
      source: true,
    });
    const parsed = await simpleParser(msg.source);
    const nestedMessages = await extractNestedText(parsed);
    const fullText = buildFullText(parsed, nestedMessages);

    const allAttachments = await getAllAttachments(parsed);
    const pdfAttachments = allAttachments.filter(
      (att) => getFileType(att.filename, att.contentType) === "pdf",
    );

    const mail_fields = parseMailFields(fullText, msg.envelope.date);
    logMailFields(req.params.id, mail_fields);

    const payload = {
      id: req.params.id,
      sender:
        parsed.from?.value?.[0]?.address || msg.envelope.from?.[0]?.address,
      subject: parsed.subject || msg.envelope.subject,
      received_date: msg.envelope.date,
      body: fullText,
      mail_fields,
      attachments: pdfAttachments.map((att) => ({
        filename: att.filename || "attachment.pdf",
        contentType: att.contentType,
        size: att.size,
        content_base64: att.content.toString("base64"),
      })),
    };

    // Preview of what is being sent (no base64 data)
    console.log("[n8n] payload preview:", {
      id: payload.id,
      sender: payload.sender,
      subject: payload.subject,
      received_date: payload.received_date,
      bodyLength: payload.body.length,
      attachments: payload.attachments.map(
        (a) => `${a.filename} (${a.size} bytes)`,
      ),
    });
    // mail_fields printed as readable JSON instead of a quoted string
    console.log("[n8n] mail_fields:\n" + JSON.stringify(mail_fields, null, 2));

    console.log(`[n8n] sending request for email ${req.params.id}...`);
    const n8nRes = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120000), 
      body: JSON.stringify(payload),
    });
    console.log(`[n8n] GOT RESPONSE — status ${n8nRes.status}`);
    if (!n8nRes.ok) throw new Error(`n8n responded ${n8nRes.status}`);
    const data = await n8nRes.json().catch(() => ({}));
    console.log("[n8n] response body:", JSON.stringify(data, null, 2));
    res.json({ success: true, n8n_response: data });
  } catch (err) {
    console.error("n8n notify failed:", err);
    client = null;
    res.status(500).json({ error: "Failed to notify n8n" });
  }
});

app.listen(process.env.PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://192.168.1.40:${process.env.PORT}`);
  console.log(
    `(also reachable locally at http://localhost:${process.env.PORT})`,
  );
});