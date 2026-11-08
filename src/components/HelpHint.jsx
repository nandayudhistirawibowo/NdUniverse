import { useState } from 'preact/hooks';

export default function HelpHint({ title = 'Panduan', text = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <span class={`help-hint${open ? ' is-open' : ''}`}>
      <button
        class="help-hint-trigger"
        type="button"
        aria-label={`Buka bantuan: ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">❓</span>
      </button>
      <span class="help-hint-popover" role="tooltip">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <style>{`
        .help-hint { --help-ink:var(--text-main,#17202a); --help-muted:var(--muted,#65717d); --help-accent:var(--accent-gold,#e5a93b); position:relative; display:inline-flex; vertical-align:middle; }
        .help-hint-trigger { display:grid; width:2rem; height:2rem; min-width:24px; min-height:24px; place-items:center; border:1px solid var(--help-accent); border-radius:50%; padding:0; background:rgba(229,169,59,.12); color:var(--help-ink); font-size:1rem; line-height:1; cursor:pointer; touch-action:manipulation; transition:transform .18s ease,background-color .18s ease,box-shadow .18s ease; }
        .help-hint-trigger:hover,.help-hint-trigger:focus-visible { background:rgba(229,169,59,.28); box-shadow:0 0 0 4px rgba(229,169,59,.16); transform:translateY(-1px); }
        .help-hint-trigger:focus-visible { outline:2px solid var(--help-accent); outline-offset:2px; }
        .help-hint-popover { position:absolute; z-index:20; top:calc(100% + .65rem); left:0; display:grid; width:min(320px,90vw); max-width:90vw; gap:.3rem; padding:.85rem 1rem; border:1px solid var(--help-accent); border-radius:.7rem; background:var(--card-bg,#fff); color:var(--help-ink); box-shadow:0 12px 30px rgba(20,25,30,.18); opacity:0; pointer-events:none; transform:translateY(-5px); transition:opacity .18s ease,transform .18s ease; }
        .help-hint-popover::before { content:""; position:absolute; top:-6px; left:1rem; width:10px; height:10px; border-top:1px solid var(--help-accent); border-left:1px solid var(--help-accent); background:var(--card-bg,#fff); transform:rotate(45deg); }
        .help-hint-popover strong { color:var(--help-ink); font-size:.82rem; }
        .help-hint-popover span { color:var(--help-muted); font-size:.78rem; font-weight:500; line-height:1.5; }
        .help-hint:hover .help-hint-popover,.help-hint:focus-within .help-hint-popover,.help-hint.is-open .help-hint-popover { opacity:1; pointer-events:auto; transform:translateY(0); }
        @media(max-width:768px) { .help-hint-popover { position:fixed; top:auto; right:5vw; bottom:1rem; left:5vw; width:auto; max-width:90vw; } .help-hint-popover::before { top:auto; right:1.25rem; bottom:-6px; left:auto; border-top:0; border-left:1px solid var(--help-accent); border-right:1px solid var(--help-accent); border-bottom:1px solid var(--help-accent); } }
      `}</style>
    </span>
  );
}
