import { RETURN_WINDOW_DAYS, type Return as ReturnDto } from '@repo/contracts';
import type { OrderLine, Return, ReturnLine, ReturnStatus } from '@repo/db';

/** Units per order line already in a requested, open or closed return (declined ones free up). */
export function returnedQuantities(
  returns: { status: ReturnStatus; lines: { orderLineId: string; quantity: number }[] }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const r of returns) {
    if (r.status === 'DECLINED') continue;
    for (const line of r.lines) {
      totals.set(line.orderLineId, (totals.get(line.orderLineId) ?? 0) + line.quantity);
    }
  }
  return totals;
}

/** Customers may ask for returns on paid, uncancelled orders within the return window. */
export function returnWindowOpen(
  order: { status: string; financialStatus: string; paidAt: Date | null },
  now = new Date(),
): boolean {
  return (
    order.status === 'OPEN' &&
    (order.financialStatus === 'PAID' || order.financialStatus === 'PARTIALLY_REFUNDED') &&
    order.paidAt !== null &&
    now.getTime() - order.paidAt.getTime() <= RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
}

/**
 * Refund for returned units: their price net of the order discount they carried, plus the
 * matching share of the order's tax. Shipping is not refunded automatically.
 */
export function suggestedRefund(
  order: { subtotal: number; discountTotal: number; taxTotal: number },
  lines: OrderLine[],
  returned: { orderLineId: string; quantity: number }[],
): number {
  const byId = new Map(lines.map((l) => [l.id, l]));
  let net = 0;
  for (const r of returned) {
    const line = byId.get(r.orderLineId);
    if (!line) continue;
    const lineNet = line.unitPrice * line.quantity - line.discountTotal;
    net += Math.round((lineNet * r.quantity) / line.quantity);
  }
  const base = order.subtotal - order.discountTotal;
  const tax = base > 0 ? Math.round((order.taxTotal * net) / base) : 0;
  return net + tax;
}

export function toReturnDto(
  r: Return & { lines: ReturnLine[] },
  order: {
    id: string;
    number: number;
    email: string;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    lines: OrderLine[];
  },
): ReturnDto {
  const byId = new Map(order.lines.map((l) => [l.id, l]));
  return {
    id: r.id,
    orderId: order.id,
    orderNumber: order.number,
    email: order.email,
    status: r.status,
    requestedByCustomer: r.requestedByCustomer,
    customerNote: r.customerNote,
    declineReason: r.declineReason,
    lines: r.lines.map((l) => ({
      orderLineId: l.orderLineId,
      title: byId.get(l.orderLineId)?.title ?? 'Item',
      variantTitle: byId.get(l.orderLineId)?.variantTitle ?? '',
      quantity: l.quantity,
      reason: l.reason,
    })),
    suggestedRefund: suggestedRefund(order, order.lines, r.lines),
    refundId: r.refundId,
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt?.toISOString() ?? null,
  };
}
