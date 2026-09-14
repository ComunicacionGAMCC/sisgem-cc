export type UiIconName =
  | "home"
  | "route"
  | "medical"
  | "users"
  | "people"
  | "procurement"
  | "calendar"
  | "transparency"
  | "shield"
  | "bell"
  | "external"
  | "plus"
  | "inbox"
  | "alert"
  | "check"
  | "clock"
  | "document"
  | "logout"
  | "receive"
  | "send"
  | "history"
  | "search"
  | "payments"
  | "services"
  | "corruption"
  | "lock"
  | "chevron";

export function UiIcon({ name, size = 20, className }: { name: UiIconName; size?: number; className?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return <svg {...common}><path d="m3.5 10.8 8.5-7 8.5 7" /><path d="M5.5 9.4V20h13V9.4" /><path d="M9.5 20v-6h5v6" /></svg>;
    case "route":
      return <svg {...common}><path d="M6 4h8.5a3.5 3.5 0 0 1 0 7H9.2a3.5 3.5 0 0 0 0 7H18" /><path d="m15 15 3 3-3 3" /><circle cx="6" cy="4" r="2" /></svg>;
    case "medical":
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg>;
    case "users":
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.8 19c.6-3.1 2.3-4.7 5.2-4.7s4.6 1.6 5.2 4.7" /><path d="M15.3 5.4a3 3 0 0 1 0 5.2M16.2 14.5c2.2.4 3.5 1.9 4 4.5" /></svg>;
    case "people":
      return <svg {...common}><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M9 6V4h6v2M3 11h18M9.5 15h5" /></svg>;
    case "procurement":
      return <svg {...common}><path d="M8 4h8M9 3v3m6-3v3" /><rect x="5" y="5" width="14" height="16" rx="3" /><path d="m9 13 2 2 4-4M9 18h6" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg>;
    case "transparency":
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /><path d="m4 7 6-4 6 7 5-5" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3 20 6v5c0 5-3.1 8.4-8 10-4.9-1.6-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8" /><path d="M10 21h4" /></svg>;
    case "external":
      return <svg {...common}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "inbox":
      return <svg {...common}><path d="M4 5h16l2 9v5H2v-5l2-9Z" /><path d="M2 14h5l2 3h6l2-3h5" /></svg>;
    case "alert":
      return <svg {...common}><path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></svg>;
    case "check":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16.5 9" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
    case "document":
      return <svg {...common}><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h5M9 13h6M9 17h5" /></svg>;
    case "logout":
      return <svg {...common}><path d="M10 5H5v14h5M13 8l4 4-4 4M17 12H9" /></svg>;
    case "receive":
      return <svg {...common}><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M5 20h14" /></svg>;
    case "send":
      return <svg {...common}><path d="m4 12 16-8-6 16-3-6-7-2Z" /><path d="m11 14 4-5" /></svg>;
    case "history":
      return <svg {...common}><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" /><path d="M4 4v4.6h4.6M12 8v5l3 2" /></svg>;
    case "search":
      return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
    case "payments":
      return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M7 15h3" /><path d="M16 3v3M8 3v3" /></svg>;
    case "services":
      return <svg {...common}><path d="M4 5h7v6H4zM14 5h6v6h-6zM4 14h7v6H4zM14 14h6v6h-6z" /></svg>;
    case "corruption":
      return <svg {...common}><path d="M12 3 20 6v5c0 5-3.1 8.4-8 10-4.9-1.6-8-5-8-10V6l8-3Z" /><path d="M12 8v5m0 3h.01" /></svg>;
    case "lock":
      return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>;
    case "chevron":
      return <svg {...common}><path d="m9 5 7 7-7 7" /></svg>;
  }
}
