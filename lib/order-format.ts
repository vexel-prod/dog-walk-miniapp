export function formatOrderNumber(orderNumber: number) {
  return `LW-${String(orderNumber).padStart(6, '0')}`
}
