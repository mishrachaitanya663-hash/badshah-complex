type Name =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'external'
  | 'logout'
  | 'menu'
  | 'search'
  | 'close'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'eye'
  | 'eye-off'
  | 'image'
  | 'chart'
  | 'check'
  | 'alert'
  | 'star'
  | 'chevron'
  | 'shield'
  | 'arrow'
  | 'grid';

const paths: Record<Name, string> = {
  dashboard: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  products: '<path d="M4 8h16l-1 12H5z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/>',
  categories: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  external: '<path d="M13 5h6v6"/><path d="M19 5 10 14"/><path d="M18 13v6H5V6h6"/>',
  logout: '<path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4"/><path d="M9 12h9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m4 20 4-1 11-11-3-3L5 16z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  'eye-off': '<path d="M4 4l16 16"/><path d="M9 6.5A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.5"/><path d="M6 8A17 17 0 0 0 2 12s4 6 10 6a10 10 0 0 0 3-.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17h.01"/>',
  star: '<path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.4l6-.9z"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  arrow: '<path d="M5 12h14"/><path d="m14 7 5 5-5 5"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
};

export default function Icon({ name, size = 18 }: { name: Name; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: paths[name] }}
    />
  );
}
