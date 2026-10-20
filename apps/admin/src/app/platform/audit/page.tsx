import type { Paginated, PlatformAuditEntry } from '@repo/contracts';
import {
  Badge,
  EmptyState,
  formatDateTime,
  PageHeader,
  Pagination,
  Table,
  Td,
} from '@/components/ui';
import { api } from '@/lib/api';

export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Number((await searchParams).page) || 1;
  const log = await api<Paginated<PlatformAuditEntry>>('/platform/audit-logs', {
    query: { page, pageSize: 50 },
  });
  return (
    <>
      <PageHeader
        title="Platform audit log"
        description="Every platform-admin action, append-only."
      />
      {log.items.length === 0 ? (
        <EmptyState title="No platform actions yet" />
      ) : (
        <>
          <Table head={['When', 'Admin', 'Action', 'Target', 'Details']}>
            {log.items.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                <Td>{e.actor?.email ?? '—'}</Td>
                <Td>
                  <Badge tone="indigo">{e.action}</Badge>
                </Td>
                <Td className="text-xs">
                  {e.targetType}
                  {e.targetId ? ` · ${e.targetId.slice(0, 8)}` : ''}
                </Td>
                <Td>
                  {e.data ? (
                    <code className="block max-w-md truncate text-xs text-slate-500">
                      {JSON.stringify(e.data)}
                    </code>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={log.page}
            pageSize={log.pageSize}
            total={log.total}
            hrefFor={(n) => `/platform/audit?page=${n}`}
          />
        </>
      )}
    </>
  );
}
