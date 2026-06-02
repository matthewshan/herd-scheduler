/* Icons.jsx — Lucide icon path data (MIT), rendered as a small React component.
   Stroke style: 24x24, fill none, currentColor, 2px stroke, round caps/joins. */
const { createElement: h } = React;

const LUCIDE = {
  'arrow-left': ['m12 19-7-7 7-7', 'M19 12H5'],
  'map-pin': ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', { circle: [12, 10, 3] }],
  'clock': [{ circle: [12, 12, 10] }, 'M12 6v6l4 2'],
  'globe': [{ circle: [12, 12, 10] }, 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'],
  'copy': [{ rect: [8, 8, 14, 14, 2] }, 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  'plus': ['M5 12h14', 'M12 5v14'],
  'x': ['M18 6 6 18', 'm6 6 12 12'],
  'trash': ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  'users': ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', { circle: [9, 7, 4] }, 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  'user': [{ circle: [12, 8, 5] }, 'M20 21a8 8 0 0 0-16 0'],
  'share': [{ circle: [18, 5, 3] }, { circle: [6, 12, 3] }, { circle: [18, 19, 3] }, 'm8.59 13.51 6.83 3.98', 'm15.41 6.51-6.82 3.98'],
  'check': ['M20 6 9 17l-5-5'],
  'check-check': ['M18 6 7 17l-5-5', 'm22 10-7.5 7.5L13 16'],
  'settings': ['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z', { circle: [12, 12, 3] }],
  'calendar': [{ rect: [3, 4, 18, 18, 2] }, 'M8 2v4', 'M16 2v4', 'M3 10h18'],
  'link': ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  'moon': ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  'sun': [{ circle: [12, 12, 4] }, 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'],
};

function Icon({ name, size = 20, color, style, strokeWidth = 2 }) {
  const parts = LUCIDE[name] || [];
  const children = parts.map((p, i) => {
    if (typeof p === 'string') return h('path', { key: i, d: p });
    if (p.circle) { const [cx, cy, r] = p.circle; return h('circle', { key: i, cx, cy, r }); }
    if (p.rect) { const [x, y, w, ht, rx] = p.rect; return h('rect', { key: i, x, y, width: w, height: ht, rx }); }
    return null;
  });
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color || 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style,
  }, children);
}

function GoogleG({ size = 20 }) {
  return h('svg', { width: size, height: size, viewBox: '0 0 48 48', className: 'google-g' }, [
    h('path', { key: 1, fill: '#FFC107', d: 'M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z' }),
    h('path', { key: 2, fill: '#FF3D00', d: 'm6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z' }),
    h('path', { key: 3, fill: '#4CAF50', d: 'M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z' }),
    h('path', { key: 4, fill: '#1976D2', d: 'M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z' }),
  ]);
}

Object.assign(window, { Icon, GoogleG });
