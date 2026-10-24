import type { Paginated, PlatformUser } from '@repo/contracts';
import {
  Badge,
  formatDateTime,
  inputClass,
  PageHeader,
  Pagination,
  Table,
  Td,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { SmallAction } from '../../s/[storeId]/settings/small-action';
import { setUserDisabledAction } from '../actions';

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const [me, users] = await Promise.all([
    getCurrentUser(),
    api<Paginated<PlatformUser>>('/platform/users', { query: { q, page: Number(page) || 1 } }),
  ]);
  const canAct = me.platformRole === 'SUPER_ADMIN';

  return (
    <>
      <PageHeader title="Users" />
      <form action="/platform/users" className="mb-4">
        <label htmlFor="user-search" className="sr-only">
          Search users
        </label>
        <input
          id="user-search"
          name="q"
          defaultValue={q}
          placeholder="Name or email"
          className={`${inputClass} w-full sm:w-72`}
        />
      </form>
      <Table head={['User', 'Role', 'Stores', 'Joined', 'Status', '']}>
        {users.items.map((u) => (
          <tr key={u.id}>
            <Td>
              <p className="font-medium text-slate-900">{u.name}</p>
              <p className="text-xs text-slate-500">{u.email}</p>
            </Td>
            <Td>
              {u.platformRole === 'NONE' ? (
                'Merchant'
              ) : (
                <Badge tone="red">{u.platformRole.replace('_', ' ').toLowerCase()}</Badge>
              )}
            </Td>
            <Td>{u.stores}</Td>
            <Td>{formatDateTime(u.createdAt)}</Td>
            <Td>
              {u.disabled ? <Badge tone="red">Disabled</Badge> : <Badge tone="green">Active</Badge>}
            </Td>
            <Td>
              {canAct && u.id !== me.id ? (
                <SmallAction
                  action={setUserDisabledAction.bind(null, u.id, !u.disabled)}
                  label={u.disabled ? 'Enable' : 'Disable'}
                  danger={!u.disabled}
                />
              ) : null}
            </Td>
          </tr>
        ))}
      </Table>
      <Pagination
        page={users.page}
        pageSize={users.pageSize}
        total={users.total}
        hrefFor={(n) =>
          `/platform/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`
        }
      />
    </>
  );
}
