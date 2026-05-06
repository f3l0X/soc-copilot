"use client";

import { useRequireAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// ─── Heurísticos de extracción ─────────────────────────────────────────────
const IP_REGEX_G = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const MAC_REGEX = /\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b/;
// Protocolos típicos en logs (mayúsculas como token aislado).
const PROTO_TOKENS = ["TCP", "UDP", "ICMP", "HTTPS", "HTTP", "SSH", "DNS", "FTP", "SMTP", "TLS", "ARP"];
const PROTO_REGEX = new RegExp(`\\b(${PROTO_TOKENS.join("|")})\\b`);

interface ParsedLine {
  id: number;
  text: string;
  ts: number | null;
  srcIp: string | null;
  dstIp: string | null;
  srcPort: number | null;
  dstPort: number | null;
  mac: string | null;
  proto: string | null;
}

function extractTimestamp(line: string): number | null {
  const syslogMatch = line.match(/^[A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2}/);
  if (syslogMatch) {
    const d = new Date(`${syslogMatch[0]} ${new Date().getFullYear()}`);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const webMatch = line.match(/\[(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})\]/);
  if (webMatch) {
    const str = webMatch[1].replace(":", " ");
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  const isoMatch = line.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  return null;
}

function toPort(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 && n <= 65535 ? n : null;
}

/**
 * Heurística de extracción de src/dst IP+puerto y protocolo. Cubre tres
 * formatos comunes; si ninguno casa, deja a null y los filtros lo descartan.
 *
 *  1. iptables / pf: SRC=1.2.3.4 DST=5.6.7.8 SPT=12345 DPT=80 PROTO=TCP
 *  2. flecha:        1.2.3.4:12345 -> 5.6.7.8:80 (TCP)
 *  3. sshd estilo:   "from 1.2.3.4 port 12345" → solo origen
 *  4. fallback:      primera IP = origen, segunda = destino
 */
function parseLine(text: string): Omit<ParsedLine, "id" | "text" | "ts"> {
  let srcIp: string | null = null;
  let dstIp: string | null = null;
  let srcPort: number | null = null;
  let dstPort: number | null = null;
  let proto: string | null = null;

  // 1. key=value (iptables y similares, case-insensitive)
  const kv = text.match(
    /SRC=(\d{1,3}(?:\.\d{1,3}){3}).*?DST=(\d{1,3}(?:\.\d{1,3}){3})/i
  );
  if (kv) {
    srcIp = kv[1];
    dstIp = kv[2];
  }
  const sptMatch = text.match(/SPT=(\d{1,5})/i);
  const dptMatch = text.match(/DPT=(\d{1,5})/i);
  if (sptMatch) srcPort = toPort(sptMatch[1]);
  if (dptMatch) dstPort = toPort(dptMatch[1]);
  const protoKv = text.match(/PROTO=([A-Za-z]+)/i);
  if (protoKv) proto = protoKv[1].toUpperCase();

  // 2. flecha IP:port -> IP:port
  if (!srcIp || !dstIp) {
    const arrow = text.match(
      /(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?\s*(?:->|→|=>)\s*(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?/
    );
    if (arrow) {
      srcIp = srcIp ?? arrow[1];
      srcPort = srcPort ?? toPort(arrow[2]);
      dstIp = dstIp ?? arrow[3];
      dstPort = dstPort ?? toPort(arrow[4]);
    }
  }

  // 3. "from <ip> port <n>" típico de sshd
  if (!srcIp) {
    const sshd = text.match(/from\s+(\d{1,3}(?:\.\d{1,3}){3})(?:\s+port\s+(\d{1,5}))?/i);
    if (sshd) {
      srcIp = sshd[1];
      srcPort = srcPort ?? toPort(sshd[2]);
    }
  }

  // 4. Fallback: primera IP = origen, segunda = destino
  if (!srcIp || !dstIp) {
    const ips = text.match(IP_REGEX_G) ?? [];
    if (!srcIp && ips[0]) srcIp = ips[0];
    if (!dstIp && ips[1]) dstIp = ips[1];
  }

  // Protocolo por token suelto si no vino en key=value
  if (!proto) {
    const m = text.match(PROTO_REGEX);
    if (m) proto = m[1].toUpperCase();
  }

  const macMatch = text.match(MAC_REGEX);

  return {
    srcIp,
    dstIp,
    srcPort,
    dstPort,
    mac: macMatch ? macMatch[0] : null,
    proto,
  };
}

const PAGE_SIZE_OPTIONS = [10, 50, 100, 150] as const;
const DEFAULT_PAGE_SIZE = 50;
const PROTO_OPTIONS = ["", ...PROTO_TOKENS];

export default function LogsAnalyzerPage() {
  const auth = useRequireAuth();
  const router = useRouter();

  const [filename, setFilename] = useState<string | null>(null);
  const [lines, setLines] = useState<ParsedLine[]>([]);

  // Filtros
  const [searchTermInput, setSearchTermInput] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [srcIpFilter, setSrcIpFilter] = useState("");
  const [dstIpFilter, setDstIpFilter] = useState("");
  const [srcPortFilter, setSrcPortFilter] = useState("");
  const [dstPortFilter, setDstPortFilter] = useState("");
  const [macFilter, setMacFilter] = useState("");
  const [protoFilter, setProtoFilter] = useState("");
  const [requireAuthFailure, setRequireAuthFailure] = useState(false);
  const [requireHTTPError, setRequireHTTPError] = useState(false);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // Selección
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTermInput), 300);
    return () => clearTimeout(handler);
  }, [searchTermInput]);

  const handleClearFilters = () => {
    setSearchTermInput("");
    setDebouncedSearchTerm("");
    setSrcIpFilter("");
    setDstIpFilter("");
    setSrcPortFilter("");
    setDstPortFilter("");
    setMacFilter("");
    setProtoFilter("");
    setRequireAuthFailure(false);
    setRequireHTTPError(false);
    setTimeFrom("");
    setTimeTo("");
    setCurrentPage(1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const rawLines = content.split("\n").filter((l) => l.trim() !== "");

      const parsedLines: ParsedLine[] = rawLines.map((text, idx) => ({
        id: idx,
        text,
        ts: extractTimestamp(text),
        ...parseLine(text),
      }));

      setLines(parsedLines);
      setSelectedIds(new Set());
      setCurrentPage(1);
    };
    reader.readAsText(file);
  };

  const filteredLines = useMemo(() => {
    const fromTs = timeFrom ? new Date(timeFrom).getTime() : null;
    const toTs = timeTo ? new Date(timeTo).getTime() + 59999 : null;

    const srcIpQ = srcIpFilter.trim();
    const dstIpQ = dstIpFilter.trim();
    const macQ = macFilter.trim().toLowerCase();
    const srcPortQ = srcPortFilter.trim();
    const dstPortQ = dstPortFilter.trim();
    const protoQ = protoFilter.trim().toUpperCase();

    return lines.filter((line) => {
      if (srcIpQ && (!line.srcIp || !line.srcIp.includes(srcIpQ))) return false;
      if (dstIpQ && (!line.dstIp || !line.dstIp.includes(dstIpQ))) return false;
      if (srcPortQ && String(line.srcPort ?? "") !== srcPortQ) return false;
      if (dstPortQ && String(line.dstPort ?? "") !== dstPortQ) return false;
      if (macQ && (!line.mac || !line.mac.toLowerCase().includes(macQ))) return false;
      if (protoQ && line.proto !== protoQ) return false;

      if (requireAuthFailure && !/(failed|invalid|failure|error)/i.test(line.text)) return false;
      if (requireHTTPError && !/HTTP\/[12](\.[01])?" [45]\d{2}/.test(line.text)) return false;
      if (debouncedSearchTerm && !line.text.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) return false;

      if (line.ts) {
        if (fromTs && line.ts < fromTs) return false;
        if (toTs && line.ts > toTs) return false;
      } else if (fromTs || toTs) {
        return false;
      }

      return true;
    });
  }, [
    lines,
    debouncedSearchTerm,
    srcIpFilter,
    dstIpFilter,
    srcPortFilter,
    dstPortFilter,
    macFilter,
    protoFilter,
    requireAuthFailure,
    requireHTTPError,
    timeFrom,
    timeTo,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredLines.length]);

  const totalPages = Math.ceil(filteredLines.length / pageSize) || 1;
  const paginatedLines = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLines.slice(start, start + pageSize);
  }, [filteredLines, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const handleToggleSelectAll = () => {
    const pageIds = paginatedLines.map((l) => l.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));

    const next = new Set(selectedIds);
    if (allSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const handleToggleLine = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleAnalyze = () => {
    if (selectedIds.size === 0) return;

    const selectedText = lines
      .filter((l) => selectedIds.has(l.id))
      .map((l) => l.text)
      .join("\n");

    sessionStorage.setItem("soc_copilot_imported_logs", selectedText);
    router.push("/alerts?import=true");
  };

  const allPageSelected =
    paginatedLines.length > 0 && paginatedLines.every((l) => selectedIds.has(l.id));

  if (!auth.ready) {
    return <main className="min-h-screen p-8 text-slate-500">Verificando sesión…</main>;
  }

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Analizador de Logs</h1>
        <p className="text-slate-400 mt-2">
          Carga un archivo local, filtra las líneas de interés y envíalas al Alert Explainer.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Panel Izquierdo: Filtros y Subida */}
        <div className="space-y-6">
          <section className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 space-y-4">
            <h2 className="font-semibold text-lg">1. Cargar Archivo</h2>
            <label className="block w-full border-2 border-dashed border-slate-700 hover:border-slate-500 rounded p-6 text-center cursor-pointer transition-colors">
              <span className="text-sm text-slate-400">
                {filename ? filename : "Haz clic para subir un .log o .txt"}
              </span>
              <input type="file" accept=".log,.txt,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
            {lines.length > 0 && (
              <p className="text-xs text-sky-400">{lines.length} líneas procesadas.</p>
            )}
          </section>

          <section className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">2. Filtros de Red</h2>
              <button
                onClick={handleClearFilters}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Limpiar
              </button>
            </div>

            <label className="block text-xs">
              <span className="text-slate-400">IP origen (substring)</span>
              <input
                type="text"
                value={srcIpFilter}
                onChange={(e) => setSrcIpFilter(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                placeholder="Ej: 192.168.1"
              />
            </label>
            <label className="block text-xs">
              <span className="text-slate-400">IP destino (substring)</span>
              <input
                type="text"
                value={dstIpFilter}
                onChange={(e) => setDstIpFilter(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                placeholder="Ej: 10.0.0.5"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs">
                <span className="text-slate-400">Puerto origen</span>
                <input
                  type="number"
                  min={0}
                  max={65535}
                  value={srcPortFilter}
                  onChange={(e) => setSrcPortFilter(e.target.value)}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                  placeholder="Ej: 41234"
                />
              </label>
              <label className="block text-xs">
                <span className="text-slate-400">Puerto destino</span>
                <input
                  type="number"
                  min={0}
                  max={65535}
                  value={dstPortFilter}
                  onChange={(e) => setDstPortFilter(e.target.value)}
                  className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                  placeholder="Ej: 22"
                />
              </label>
            </div>

            <label className="block text-xs">
              <span className="text-slate-400">Dirección MAC (substring)</span>
              <input
                type="text"
                value={macFilter}
                onChange={(e) => setMacFilter(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                placeholder="Ej: aa:bb:cc"
              />
            </label>

            <label className="block text-xs">
              <span className="text-slate-400">Protocolo</span>
              <select
                value={protoFilter}
                onChange={(e) => setProtoFilter(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
              >
                {PROTO_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p === "" ? "(todos)" : p}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 space-y-4">
            <h2 className="font-semibold text-lg">3. Otros filtros</h2>

            <label className="block text-sm">
              <span className="text-slate-400">Buscar texto</span>
              <input
                type="text"
                value={searchTermInput}
                onChange={(e) => setSearchTermInput(e.target.value)}
                className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white"
                placeholder="Ej: sshd, root, failed"
              />
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={requireAuthFailure}
                  onChange={(e) => setRequireAuthFailure(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700"
                />
                Errores de Autenticación
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={requireHTTPError}
                  onChange={(e) => setRequireHTTPError(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700"
                />
                Errores HTTP (4xx/5xx)
              </label>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <span className="text-sm text-slate-400 block mb-2">Periodo de tiempo (heurístico)</span>
              <div className="space-y-2">
                <label className="block text-xs">
                  Desde
                  <input
                    type="datetime-local"
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                  />
                </label>
                <label className="block text-xs">
                  Hasta
                  <input
                    type="datetime-local"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/40 p-4 rounded-lg border border-slate-800 space-y-4">
            <h2 className="font-semibold text-lg">4. Analizar</h2>
            <p className="text-xs text-slate-400">Líneas seleccionadas: {selectedIds.size}</p>
            <button
              onClick={handleAnalyze}
              disabled={selectedIds.size === 0}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-medium py-2 rounded transition-colors"
            >
              Enviar a Alert Explainer
            </button>
          </section>
        </div>

        {/* Panel Derecho: Visor de Logs */}
        <div className="md:col-span-3 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={handleToggleSelectAll}
                disabled={paginatedLines.length === 0}
                className="rounded bg-slate-950 border-slate-700"
              />
              Seleccionar Visibles en Página ({paginatedLines.length})
            </label>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <label className="flex items-center gap-2">
                <span>Por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <span>{filteredLines.length} coincidencias totales</span>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 bg-slate-950">
            {lines.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                Sube un archivo de logs para comenzar.
              </div>
            ) : paginatedLines.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                Ninguna línea coincide con los filtros en esta página.
              </div>
            ) : (
              <div className="font-mono text-xs space-y-1">
                {paginatedLines.map((line) => (
                  <label key={line.id} className="flex gap-3 p-1 hover:bg-slate-800/50 rounded cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(line.id)}
                      onChange={() => handleToggleLine(line.id)}
                      className="mt-0.5 rounded bg-slate-900 border-slate-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className={`break-all ${
                          selectedIds.has(line.id) ? "text-sky-300" : "text-slate-300"
                        }`}
                      >
                        {line.text}
                      </div>
                      {(line.srcIp || line.dstIp || line.proto || line.mac) && (
                        <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-slate-500">
                          {line.srcIp && (
                            <span>
                              src: <span className="text-slate-300">{line.srcIp}{line.srcPort != null && `:${line.srcPort}`}</span>
                            </span>
                          )}
                          {line.dstIp && (
                            <span>
                              dst: <span className="text-slate-300">{line.dstIp}{line.dstPort != null && `:${line.dstPort}`}</span>
                            </span>
                          )}
                          {line.proto && (
                            <span>
                              proto: <span className="text-slate-300">{line.proto}</span>
                            </span>
                          )}
                          {line.mac && (
                            <span>
                              mac: <span className="text-slate-300">{line.mac}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Footer de Paginación */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-sm">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded"
              >
                Anterior
              </button>
              <span className="text-slate-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
