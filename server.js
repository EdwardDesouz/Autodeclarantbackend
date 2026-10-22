// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { ImapFlow } from "imapflow";
// import { simpleParser } from "mailparser";

// dotenv.config();
// console.log('DEBUG — EMAIL_USERNAME:', process.env.EMAIL_USERNAME);
// console.log('DEBUG — EMAIL_PASSWORD length:', process.env.EMAIL_PASSWORD?.length);
// console.log('DEBUG — EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD);
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
//       tls: { rejectUnauthorized: false },
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
// // GET /api/emails — list the most recent messages in INBOX (used by the
// // sidebar). This was accidentally dropped in a previous edit — restored here.
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

//       let fullText = parsed.text || "";
//       for (const nm of nestedMessages) {
//         fullText +=
//           `\n\n---------- Forwarded message ----------\n` +
//           `From: ${nm.from}\nSubject: ${nm.subject}\n\n${nm.text}`;
//       }

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
// // to n8n for declaration extraction. Only PDF attachments (direct or
// // nested inside an embedded .eml forward) are sent; other file types
// // are excluded.
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

//       let fullText = parsed.text || "";
//       for (const nm of nestedMessages) {
//         fullText +=
//           `\n\n---------- Forwarded message ----------\n` +
//           `From: ${nm.from}\nSubject: ${nm.subject}\n\n${nm.text}`;
//       }

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
console.log("ENV loaded — user:", process.env.EMAIL_USERNAME, "| password set:", !!process.env.EMAIL_PASSWORD);

const app = express();
app.use(cors());
app.use(express.json());

let client = null;
let connecting = null;

async function getClient() {
  if (client && client.usable) return client;

  if (connecting) return connecting; // avoid parallel connect attempts

  connecting = (async () => {
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
    await c.connect();
    client = c;
    connecting = null;
    return c;
  })();

  return connecting;
}

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

// Builds one flat list combining direct attachments with any attachments
// nested inside embedded (.eml/message-rfc822) forwarded messages, so the
// list route and the download route always agree on indexing.
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

// Combines the main body with the text of any forwarded .eml messages.
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

app.get("/api/email/:id", async (req, res) => {
  try {
    const c = await getClient();
    const lock = await c.getMailboxLock("INBOX");
    let result = null;
    try {
      const msg = await c.fetchOne(
        req.params.id,
        { envelope: true, source: true },
        { uid: true },
      );
      const parsed = await simpleParser(msg.source);
      const nestedMessages = await extractNestedText(parsed);
      const fullText = buildFullText(parsed, nestedMessages);

      const directAttachments = parsed.attachments.filter(
        (att) => !isEmbeddedMessage(att),
      );

      result = {
        id: req.params.id,
        sender: msg.envelope.from?.[0]?.address,
        subject: msg.envelope.subject,
        received_date: msg.envelope.date,
        body_preview: fullText.slice(0, 2000),
        attachment_count: directAttachments.length,
        status: "received",
      };
    } finally {
      lock.release();
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    client = null;
    res.status(500).json({ error: "Failed to fetch email detail" });
  }
});

app.get("/api/email/:id/attachments", async (req, res) => {
  try {
    const c = await getClient();
    const lock = await c.getMailboxLock("INBOX");
    let attachments = [];
    try {
      const msg = await c.fetchOne(
        req.params.id,
        { source: true },
        { uid: true },
      );
      const parsed = await simpleParser(msg.source);
      const allAttachments = await getAllAttachments(parsed);

      attachments = allAttachments.map((att, i) => ({
        id: String(i),
        filename: att.filename || `attachment-${i}`,
        type: getFileType(att.filename, att.contentType),
        size: att.size,
        url: `/api/email/${req.params.id}/attachments/${i}`,
      }));
    } finally {
      lock.release();
    }
    res.json(attachments);
  } catch (err) {
    console.error(err);
    client = null;
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

app.get("/api/email/:id/attachments/:attId", async (req, res) => {
  try {
    const c = await getClient();
    const lock = await c.getMailboxLock("INBOX");
    try {
      const msg = await c.fetchOne(
        req.params.id,
        { source: true },
        { uid: true },
      );
      const parsed = await simpleParser(msg.source);
      const allAttachments = await getAllAttachments(parsed);
      const att = allAttachments[Number(req.params.attId)];
      if (!att) return res.status(404).send("Not found");

      res.set("Content-Type", att.contentType || "application/pdf");
      res.set(
        "Content-Disposition",
        `inline; filename="${att.filename || "file.pdf"}"`,
      );
      res.send(att.content);
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error(err);
    client = null;
    res.status(500).send("Failed to fetch attachment");
  }
});

// Fetches the full email (with attachment bytes) by id and forwards it
// to n8n. The payload includes the full email body (main text + forwarded
// messages) so n8n can read FLIGHT #, FLT DATE, COUNTRY OF ORIGIN, MAWB.
// Only PDF attachments (direct or nested in a forwarded .eml) are sent.
//
// In n8n the Webhook node puts this JSON under $json.body, so the email
// text is at $json.body.body.
app.post("/api/email/:id/notify-n8n", async (req, res) => {
  try {
    const c = await getClient();
    const lock = await c.getMailboxLock("INBOX");
    let payload;
    try {
      const msg = await c.fetchOne(
        req.params.id,
        { envelope: true, source: true },
        { uid: true },
      );
      const parsed = await simpleParser(msg.source);
      const nestedMessages = await extractNestedText(parsed);
      const fullText = buildFullText(parsed, nestedMessages);

      const allAttachments = await getAllAttachments(parsed);
      const pdfAttachments = allAttachments.filter(
        (att) => getFileType(att.filename, att.contentType) === "pdf",
      );

      payload = {
        id: req.params.id,
        sender:
          parsed.from?.value?.[0]?.address || msg.envelope.from?.[0]?.address,
        subject: parsed.subject || msg.envelope.subject,
        received_date: msg.envelope.date,
        body: fullText,
        attachments: pdfAttachments.map((att) => ({
          filename: att.filename || "attachment.pdf",
          contentType: att.contentType,
          size: att.size,
          content_base64: att.content.toString("base64"),
        })),
      };
    } finally {
      lock.release();
    }

    // Preview of what is being sent (no base64 data, body truncated)
    console.log("[n8n] payload preview:", {
      id: payload.id,
      sender: payload.sender,
      subject: payload.subject,
      received_date: payload.received_date,
      bodyLength: payload.body.length,
      bodyStart: payload.body.slice(0, 300),
      hasFlightFields: /FLIGHT\s*#/i.test(payload.body),
      attachments: payload.attachments.map(
        (a) => `${a.filename} (${a.size} bytes)`,
      ),
    });

    console.log(`[n8n] sending request for email ${req.params.id}...`);
    const n8nRes = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(`[n8n] GOT RESPONSE — status ${n8nRes.status}`);
    if (!n8nRes.ok) throw new Error(`n8n responded ${n8nRes.status}`);
    const data = await n8nRes.json().catch(() => ({}));
    console.log(`[n8n] response body:`, data);
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
