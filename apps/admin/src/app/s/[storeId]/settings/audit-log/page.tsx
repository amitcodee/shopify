import type { AuditLogEntry, Paginated } from '@repo/contracts';
import { Badge, EmptyState, formatDateTime, Pagination, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { storeId } = await params;
  const page = Number((await searchParams).page ?? '1') || 1;
  const log = await api<Paginated<AuditLogEntry>>(`/admin/stores/${storeId}/audit-logs`, {
    query: { page, pageSize: 50 },
  });

  if (log.items.length === 0) return <EmptyState title="No activity yet" />;

  return (
    <>
      <Table head={['When', 'Who', 'Action', 'Details']}>
        {log.items.map((entry) => (
          <tr key={entry.id}>
            <Td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</Td>
            <Td>
              {entry.actor ? entry.actor.name : <span className="text-slate-400">System</span>}
            </Td>
            <Td>
              <Badge tone="indigo">{entry.action}</Badge>
            </Td>
            <Td>
              {entry.data ? (
                <code className="block max-w-md truncate text-xs text-slate-500">
                  {JSON.stringify(entry.data)}
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
        hrefFor={(p) => `/s/${storeId}/settings/audit-log?page=${p}`}
      />
    </>
  );
}
