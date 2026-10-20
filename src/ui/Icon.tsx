/** Line icons drawn in the current text color, so they follow both themes. */
const PATHS: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  people: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M17 11.5a2.5 2.5 0 1 0 0-5M16.5 14.5c2.6.2 4.4 2 5 5',
  book: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  play: 'M8 5v14l11-7z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  books: 'M5 3h4v18H5zM10 3h4v18h-4zM15.5 4.5l3.8-1 3.2 17-3.8 1z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  cake: 'M4 21h16M5 21v-8h14v8M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0M12 13V9M12 6.5c-1 0-1.5-1-1-2L12 3l1 1.5c.5 1 0 2-1 2z',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5h.01',
  pause: 'M8 5v14M16 5v14',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  dict: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 1 2-2h13M9 8h6M9 12h4',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7M14 20h3',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  team: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.2-6 8-6s7 2 8 6',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h11',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  back: 'M9 6l6 6-6 6',
  whatsapp: 'M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 9.5c0 3 2.5 5.5 5.5 5.5l1.5-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z',
  facebook: 'M14 21v-8h3l.5-3.5H14V7.8c0-1 .3-1.8 1.8-1.8H18V3a24 24 0 0 0-2.7-.1C12.7 2.9 11 4.5 11 7.4v2.1H8V13h3v8',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  drive: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  close: 'M6 6l12 12M18 6L6 18',
};

export default function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  const fill = name === 'play';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={name === 'more' || name === 'pause' ? 3 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
