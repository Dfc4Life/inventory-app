export const COLORS = {
  primary: '#0d9488', primaryDark: '#134e4a', background: '#f1f5f9',
  card: '#ffffff', text: '#0f172a', muted: '#64748b', line: '#e2e8f0',
  amber: '#f59e0b', red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
};

export const SPACING = { xs: 6, sm: 10, md: 16, lg: 22 };

export function formatIQD(amount: number): string {
  return Math.round(amount).toLocaleString('en-US') + ' د.ع';
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}