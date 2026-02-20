export function toNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getDiscountedPrice(basePrice, discountPercent, discountAmount) {
  const base = toNumber(basePrice)
  if (base === null) return null

  const percent = toNumber(discountPercent)
  const amount = toNumber(discountAmount)

  let discounted = base
  if (percent !== null && percent > 0) {
    discounted = base - (base * percent) / 100
  } else if (amount !== null && amount > 0) {
    discounted = base - amount
  }

  return Math.max(0, Number(discounted.toFixed(2)))
}

export function formatUsd(value) {
  const num = toNumber(value)
  if (num === null) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}
