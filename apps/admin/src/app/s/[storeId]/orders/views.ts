/** Saved order list views; shared by the list page and the CSV export. */
export const ORDER_VIEWS = [
  { key: 'all', label: 'All', query: {} },
  {
    key: 'unfulfilled',
    label: 'Unfulfilled',
    query: { status: 'OPEN', fulfillmentStatus: 'UNFULFILLED' },
  },
  { key: 'unpaid', label: 'Awaiting payment', query: { status: 'PENDING_PAYMENT' } },
  { key: 'cancelled', label: 'Cancelled', query: { status: 'CANCELLED' } },
] as const;
