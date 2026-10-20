import { PERMISSIONS, type StaffList } from '@repo/contracts';
import { ActionForm, Field, SelectField, SubmitButton } from '@/components/form';
import { Badge, Card, formatDateTime, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser, getStore } from '@/lib/session';
import { InviteResult } from './invite-result';
import {
  inviteStaffAction,
  removeMemberAction,
  revokeInvitationAction,
  updateMemberAction,
} from './actions';

const STAFF_GRANTABLE = PERMISSIONS.filter((p) => p !== 'staff:manage' && p !== 'billing:manage');

function PermissionChecklist({ name, selected }: { name: string; selected: string[] }) {
  return (
    <fieldset className="grid grid-cols-2 gap-1">
      <legend className="mb-1 text-xs font-medium text-slate-500">
        Permissions (staff role only)
      </legend>
      {STAFF_GRANTABLE.map((p) => (
        <label key={p} className="flex items-center gap-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            name={name}
            value={p}
            defaultChecked={selected.includes(p)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          {p}
        </label>
      ))}
    </fieldset>
  );
}

export default async function StaffPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, user, staff] = await Promise.all([
    getStore(storeId),
    getCurrentUser(),
    api<StaffList>(`/admin/stores/${storeId}/staff`),
  ]);
  const canManage = store.permissions.includes('staff:manage');

  return (
    <div className="space-y-6">
      <Card title="Members" description="People who can sign in to this store's admin.">
        <Table head={['Name', 'Role', canManage ? 'Access' : '']}>
          {staff.members.map((member) => (
            <tr key={member.id}>
              <Td>
                <p className="font-medium text-slate-900">
                  {member.name}{' '}
                  {member.userId === user.id ? (
                    <span className="text-xs text-slate-400">(you)</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </Td>
              <Td>
                <Badge tone={member.role === 'OWNER' ? 'indigo' : 'gray'}>
                  {member.role.toLowerCase()}
                </Badge>
              </Td>
              <Td>
                {canManage && member.role !== 'OWNER' ? (
                  <div className="space-y-3">
                    <ActionForm
                      action={updateMemberAction.bind(null, storeId, member.id)}
                      className="space-y-2"
                    >
                      <SelectField
                        name="role"
                        label="Role"
                        defaultValue={member.role}
                        options={[
                          { value: 'ADMIN', label: 'Admin (everything except staff & billing)' },
                          { value: 'STAFF', label: 'Staff (selected permissions)' },
                        ]}
                      />
                      <PermissionChecklist name="permissions" selected={member.permissions} />
                      <SubmitButton variant="secondary">Update access</SubmitButton>
                    </ActionForm>
                    <form action={removeMemberAction.bind(null, storeId, member.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Remove from store
                      </button>
                    </form>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      {canManage ? (
        <Card title="Invite staff" description="They receive an email with a link to join.">
          <InviteResult action={inviteStaffAction.bind(null, storeId)}>
            <Field name="email" label="Email" type="email" required />
            <SelectField
              name="role"
              label="Role"
              defaultValue="STAFF"
              options={[
                { value: 'STAFF', label: 'Staff (selected permissions)' },
                { value: 'ADMIN', label: 'Admin' },
              ]}
            />
            <PermissionChecklist name="permissions" selected={['products:read', 'orders:read']} />
            <SubmitButton>Send invitation</SubmitButton>
          </InviteResult>
        </Card>
      ) : null}

      {staff.invitations.length > 0 ? (
        <Card title="Pending invitations">
          <Table head={['Email', 'Role', 'Expires', '']}>
            {staff.invitations.map((invite) => (
              <tr key={invite.id}>
                <Td>{invite.email}</Td>
                <Td>{invite.role.toLowerCase()}</Td>
                <Td>{formatDateTime(invite.expiresAt)}</Td>
                <Td>
                  {canManage ? (
                    <form action={revokeInvitationAction.bind(null, storeId, invite.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Revoke
                      </button>
                    </form>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
