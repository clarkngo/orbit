import { useEffect, useRef, useState } from 'preact/hooks';
import { fromCode, merge, normalize, toCode, empty, type Progress } from '../lib/progress';

interface Props {
  progress: Progress;
  knownIds: Set<string>;
  onClose: () => void;
  onReplace: (p: Progress) => void;
}

export default function Sync({ progress, knownIds, onClose, onReplace }: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [paste, setPaste] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const code = toCode(progress);
  const tracked = Object.keys(progress.nodes);
  const orphans = tracked.filter((id) => !knownIds.has(id)).length;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  const apply = (incoming: Progress, source: string) => {
    const n = Object.keys(incoming.nodes).length;
    const merged = merge(progress, incoming);
    onReplace(merged);
    setMsg({ ok: true, text: `Merged ${n} node${n === 1 ? "" : "s"} from ${source}. Newer reviews win.` });
  };
  const fail = (e: unknown) => setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'progress.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importFile = async (f?: File) => {
    if (!f) return;
    try { apply(normalize(JSON.parse(await f.text())), f.name); } catch (e) { fail(e); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { (document.getElementById('sync-code') as HTMLTextAreaElement | null)?.select(); }
  };

  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sync-title">
        <div class="detail-head">
          <h2 id="sync-title">Sync progress</h2>
          <button class="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p class="muted">
          Progress lives in this browser only. Move it between devices with a file or a sync code.
          Imports merge: for each node the most recent review wins. Tracking {tracked.length} nodes
          {orphans > 0 && <> ({orphans} from nodes no longer in the map, kept safely)</>}.
        </p>

        <h3>File</h3>
        <div class="row">
          <button class="btn primary" onClick={exportFile}>Download progress.json</button>
          <button class="btn" onClick={() => fileRef.current?.click()}>Import file…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => importFile((e.target as HTMLInputElement).files?.[0])} />
        </div>

        <h3>Sync code</h3>
        <p class="muted small">Copy on one device, paste on the other.</p>
        <textarea id="sync-code" readOnly rows={3} value={code} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
        <div class="row"><button class="btn" onClick={copy}>{copied ? 'Copied ✓' : 'Copy code'}</button></div>
        <textarea rows={3} placeholder="Paste a sync code here" value={paste}
          onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)} />
        <div class="row">
          <button class="btn primary" disabled={!paste.trim()}
            onClick={() => { try { apply(fromCode(paste), 'sync code'); setPaste(''); } catch (e) { fail(e); } }}>
            Import code
          </button>
        </div>

        {msg && <p class={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}

        <details class="danger">
          <summary>Reset</summary>
          <p class="muted small">Erase all progress in this browser. Export first if you might want it back.</p>
          <button class="btn bad" onClick={() => { if (confirm('Erase all progress in this browser?')) { onReplace(empty()); setMsg({ ok: true, text: 'Progress erased.' }); } }}>
            Erase progress
          </button>
        </details>
      </div>
    </div>
  );
}
