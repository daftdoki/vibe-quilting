const PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  fit: 'M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M6 6l12 12M18 6 6 18',
  shuffle: 'M3 7h3.5c2 0 3.2 1 4.3 2.7l2.4 4.6C14.3 16 15.5 17 17.5 17H21M3 17h3.5c1.4 0 2.4-.5 3.2-1.4M14.3 8.4c.8-.9 1.8-1.4 3.2-1.4H21M18 4l3 3-3 3M18 14l3 3-3 3',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  reset: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
  stack: 'M12 3 3 7.5l9 4.5 9-4.5L12 3ZM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5',
  ruler: 'M4 17 17 4l3 3L7 20l-3-3ZM8 13l2 2M11 10l2 2M14 7l2 2',
  chevron: 'm6 9 6 6 6-6',
  rotate: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.6 9.2a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9M12 16.8h.01',
  paint: 'M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5Z',
  save: 'M6 4h12v17l-6-4-6 4Z',
  versions: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2',
  flag: 'M5 21V4M5 4h11l-2.5 4L16 12H5',
  square: 'M5 5h3M11 5h2M16 5h3v3M19 11v2M19 16v3h-3M13 19h-2M8 19H5v-3M5 13v-2M5 8V5',
  fileUp: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4ZM14 3v4h4M12 17v-6M9.5 13.5 12 11l2.5 2.5',
  fileDown: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4ZM14 3v4h4M12 11v6M9.5 14.5 12 17l2.5-2.5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
  keyboard: 'M3 7h18v10H3ZM7 10.5h.01M11 10.5h.01M15 10.5h.01M8 14h8',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
