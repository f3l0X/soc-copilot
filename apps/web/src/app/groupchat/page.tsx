"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRequireAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { API_BASE } from "@/lib/api";

interface GroupMessage {
  id: number;
  user_id: number | null;
  user_email: string;
  user_name: string;
  content: string;
  created_at: string;
}

async function fetchMessages(limit = 50): Promise<GroupMessage[]> {
  const res = await fetch(`${API_BASE}/api/groupchat?limit=${limit}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Error cargando mensajes");
  return res.json();
}

async function pollMessages(afterId: number): Promise<GroupMessage[]> {
  const res = await fetch(`${API_BASE}/api/groupchat/poll?after_id=${afterId}`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  return res.json();
}

async function sendMessage(content: string): Promise<GroupMessage> {
  const res = await fetch(`${API_BASE}/api/groupchat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Error enviando mensaje");
  return res.json();
}

function Avatar({ name, email }: { name: string; email: string }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : email[0].toUpperCase();
  const colors = [
    "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-sky-500", "bg-pink-500",
  ];
  const color = colors[(email.charCodeAt(0) + email.charCodeAt(1)) % colors.length];
  return (
    <div className={`w-8 h-8 rounded-full ${color} grid place-items-center text-xs font-bold text-white shrink-0`}>
      {initials}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "2-digit", month: "short" }) +
        " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function GroupChatPage() {
  const auth = useRequireAuth();
  const { t } = useI18n();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  // Carga inicial
  useEffect(() => {
    if (!auth.user) return;
    fetchMessages(50)
      .then((msgs) => {
        setMessages(msgs);
        if (msgs.length > 0) lastIdRef.current = msgs[msgs.length - 1].id;
        setLoading(false);
        scrollToBottom();
      })
      .catch(() => { setLoading(false); setError(t("groupchat_err_load")); });
  }, [auth.user, scrollToBottom]);

  // Polling cada 3 segundos
  useEffect(() => {
    if (!auth.user) return;
    pollRef.current = setInterval(async () => {
      if (lastIdRef.current === 0) return;
      const newMsgs = await pollMessages(lastIdRef.current);
      if (newMsgs.length > 0) {
        lastIdRef.current = newMsgs[newMsgs.length - 1].id;
        setMessages((prev) => [...prev, ...newMsgs]);
        scrollToBottom();
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [auth.user, scrollToBottom]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(input.trim());
      setMessages((prev) => [...prev, msg]);
      lastIdRef.current = msg.id;
      setInput("");
      scrollToBottom();
    } catch {
      setError(t("groupchat_err_send"));
    } finally {
      setSending(false);
    }
  }

  if (!auth.ready) return <div className="p-8 text-slate-500 text-sm">{t("alerts_loading")}</div>;

  const myEmail = auth.user?.email;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-4xl mx-auto p-4 gap-3">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b border-ink-700">
        <div className="w-9 h-9 rounded-lg bg-violet-500/20 border border-violet-500/30 grid place-items-center text-violet-300 text-lg">
          ◈
        </div>
        <div>
          <h1 className="font-semibold text-slate-100">{t("nav_groupchat")}</h1>
          <p className="text-xs text-slate-500">{t("groupchat_subtitle")}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-500">{t("groupchat_online")}</span>
        </div>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1"
      >
        {loading && (
          <div className="text-center text-sm text-slate-500 py-8">{t("groupchat_loading_msgs")}</div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-16">
            <div className="text-4xl mb-3">◈</div>
            <p>{t("groupchat_empty")}</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.user_email === myEmail;
          const prevMsg = messages[i - 1];
          const sameUser = prevMsg?.user_email === msg.user_email;
          const showHeader = !sameUser;

          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
              {/* Avatar — solo si cambia de usuario */}
              <div className="w-8 shrink-0">
                {showHeader && <Avatar name={msg.user_name} email={msg.user_email} />}
              </div>

              <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                {showHeader && (
                  <div className={`flex items-baseline gap-2 mb-1 ${isMe ? "flex-row-reverse" : ""}`}>
                    <span className="text-xs font-medium text-slate-300">
                      {isMe ? t("chat_you") : msg.user_name}
                    </span>
                    <span className="text-[10px] text-slate-600">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    isMe
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-ink-800 border border-ink-700 text-slate-200 rounded-tl-sm"
                  }`}
                  style={{ wordBreak: "break-word" }}
                >
                  {msg.content}
                </div>
                {!showHeader && (
                  <span className="text-[10px] text-slate-600 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={onSend} className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(e as unknown as React.FormEvent); }
          }}
          placeholder={t("groupchat_input_placeholder")}
          rows={1}
          disabled={sending}
          className="flex-1 rounded-xl bg-ink-850 border border-ink-700 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-violet-500/50"
          style={{ minHeight: "42px", maxHeight: "120px" }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="h-[42px] px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-ink-800 disabled:text-slate-600 text-white text-sm font-medium transition shrink-0"
        >
          {sending ? "…" : t("chat_send_btn")}
        </button>
      </form>
    </div>
  );
}
