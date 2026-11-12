import { useId } from 'react'
import { Chip } from '../../components/Chip'
import type { Trade } from './useTrades'

/**
 * A contractor's trades as chips you tap on and off (OT-99; the boards draw one Trade
 * dropdown, and a contractor can now have several). Offers the trades that are on; a
 * turned-off one shows only while it is picked, since a contractor who has it keeps it.
 * The database refuses taking one on while it is off.
 */
export function TradePicker({
  trades,
  value,
  onChange,
}: {
  trades: Trade[]
  /** The ids picked. */
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const id = useId()
  const shown = trades.filter((t) => t.active || value.includes(t.id))
  const toggle = (tradeId: string) =>
    onChange(value.includes(tradeId) ? value.filter((v) => v !== tradeId) : [...value, tradeId])
  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-13 font-semibold text-text-body">
        Trades
      </span>
      <div className="flex flex-wrap gap-2">
        {shown.map((t) => (
          <Chip key={t.id} tone="pick" selected={value.includes(t.id)} onClick={() => toggle(t.id)}>
            {t.name}
          </Chip>
        ))}
      </div>
    </div>
  )
}
