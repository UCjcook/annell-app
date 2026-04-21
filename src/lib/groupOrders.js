export function groupOrders(rows) {
  const groups = {
    new: [],
    dueSoon: [],
    overdue: [],
    done: [],
  };

  for (const row of rows) {
    const normalized = {
      id: row.orderNumber,
      sourceOrderId: row.sourceOrderId,
      source: row.sourcePlatform,
      orderDate: row.orderDate,
      customer: row.customerName,
      item: row.itemsSummary,
      shipBy: row.shipByLabel,
      daysLeft: row.daysLeft,
      status: row.status,
      notes: row.notes,
    };

    if (row.status === 'Done') {
      groups.done.push(normalized);
    } else if (row.daysLeft < 0) {
      groups.overdue.push(normalized);
    } else if (row.daysLeft <= 3) {
      groups.dueSoon.push(normalized);
    } else {
      groups.new.push(normalized);
    }
  }

  return groups;
}
