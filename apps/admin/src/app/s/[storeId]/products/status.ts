import type { ProductStatus } from '@repo/contracts';
import type { BadgeTone } from '@/components/ui';

export function statusTone(status: ProductStatus): BadgeTone {
  return status === 'ACTIVE' ? 'green' : status === 'DRAFT' ? 'yellow' : 'gray';
}
