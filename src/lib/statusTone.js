export function getToneForOrder(order) {
  if (order.status === 'Done') return 'done';
  if (order.daysLeft < 0) return 'overdue';
  if (order.daysLeft <= 1) return 'overdue';
  if (order.daysLeft <= 3) return 'soon';
  return 'new';
}
