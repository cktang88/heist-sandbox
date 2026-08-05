type StatusProps = { label: string; value: string; danger?: boolean }

export function Status({ label, value, danger = false }: StatusProps) {
  return <div className={`status ${danger ? 'danger' : ''}`}><small>{label}</small><strong>{value}</strong></div>
}
