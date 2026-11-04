import type { DnsRecordStatus, Domain, DomainCheck } from '@repo/contracts';
import { CopyButton } from '@/components/copy-button';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { Icon, type IconName } from '@/components/icons';
import { Alert, Badge, type BadgeTone, Card, EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { addDomainAction, domainAction } from '../commerce-actions';
import { SmallAction } from '../small-action';

const storefrontPattern = process.env.STOREFRONT_PUBLIC_URL ?? 'http://{subdomain}.localhost:3200';

const STATUS: Record<DnsRecordStatus, { label: string; tone: BadgeTone; icon: IconName }> = {
  found: { label: 'Found', tone: 'green', icon: 'checkCircle' },
  missing: { label: 'Not found yet', tone: 'yellow', icon: 'clock' },
  wrong: { label: 'Different value', tone: 'red', icon: 'warning' },
};

/** Where the DNS editor lives at common hosts. Only menu paths, the records are the same. */
const GUIDES: { name: string; steps: string[] }[] = [
  {
    name: 'GoDaddy',
    steps: [
      'Sign in and open My Products → your domain → DNS.',
      'Choose Add New Record and enter the type, name and value below.',
      'Save. Remove any older record with the same name first.',
    ],
  },
  {
    name: 'Namecheap',
    steps: [
      'Open Domain List → Manage → Advanced DNS.',
      'Choose Add New Record. Namecheap calls the name "Host".',
      'Save with the green check mark.',
    ],
  },
  {
    name: 'Hostinger',
    steps: [
      'Open Domains → your domain → DNS / Nameservers.',
      'Under Manage DNS records choose the type, then enter the name and value.',
      'Choose Add Record.',
    ],
  },
  {
    name: 'Cloudflare',
    steps: [
      'Open your domain → DNS → Records → Add record.',
      'Enter the type, name and value.',
      'Set the proxy status to "DNS only" (grey cloud), so we can issue your SSL certificate.',
    ],
  },
  {
    name: 'Other providers',
    steps: [
      'Find the DNS settings where you bought the domain, or wherever its nameservers point.',
      'Add each record below. Some providers want the full name instead of the short one.',
      'Save and wait a few minutes. Changes can take up to a few hours to spread.',
    ],
  },
];

function RecordRow({
  type,
  host,
  value,
  status,
  purpose,
  found,
}: {
  type: string;
  host: string;
  value: string;
  status: DnsRecordStatus | null;
  purpose: string;
  found: string[];
}) {
  const state = status ? STATUS[status] : null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-900">{purpose}</p>
        {state ? <Badge tone={state.tone}>{state.label}</Badge> : null}
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <dt className="text-xs text-slate-500">Type</dt>
          <dd className="mt-1 font-mono font-semibold text-slate-900">{type}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Name / Host</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="min-w-0 break-all text-slate-900">{host}</code>
            <CopyButton value={host} label={`${type} name`} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-slate-500">Value / Points to</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="min-w-0 break-all text-slate-900">{value}</code>
            <CopyButton value={value} label={`${type} value`} />
          </dd>
        </div>
      </dl>
      {status === 'wrong' && found.length > 0 ? (
        <p className="mt-2 text-xs text-red-700">
          DNS currently answers: <code className="break-all">{found.join(', ')}</code>. Replace it
          with the value above.
        </p>
      ) : null}
    </div>
  );
}

function DomainCard({
  storeId,
  domain: d,
  check,
  canEdit,
}: {
  storeId: string;
  domain: Domain;
  check: DomainCheck | null;
  canEdit: boolean;
}) {
  const liveChecked = check !== null && !check.simulated;
  const routed = liveChecked && check.routing.status === 'found';
  return (
    <li className="space-y-4 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Icon name="globe" className="h-4 w-4 text-slate-500" />
          <span className="font-medium break-all text-slate-900">{d.hostname}</span>
          {d.verified ? (
            <Badge tone="green">Ownership verified</Badge>
          ) : (
            <Badge tone="yellow">Waiting for DNS</Badge>
          )}
          {d.isPrimary ? <Badge tone="indigo">Primary</Badge> : null}
          {liveChecked && d.verified ? (
            routed ? (
              <Badge tone="green">Connected</Badge>
            ) : (
              <Badge tone="yellow">Not pointing here yet</Badge>
            )
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-4">
            {!d.verified ? (
              <SmallAction
                action={domainAction.bind(null, storeId, d.id, 'verify')}
                label="Check and verify"
              />
            ) : null}
            {d.verified && !d.isPrimary ? (
              <SmallAction
                action={domainAction.bind(null, storeId, d.id, 'primary')}
                label="Make primary"
              />
            ) : null}
            <SmallAction
              action={domainAction.bind(null, storeId, d.id, 'remove')}
              label="Remove"
              danger
            />
          </div>
        ) : null}
      </div>

      {!d.verified || !routed ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3 sm:p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Add these records where you manage {d.zone}
            </h3>
            <p className="mt-0.5 text-[13px] text-slate-600">
              {check?.dnsProvider
                ? `Your DNS is hosted at ${check.dnsProvider}, so add them there.`
                : 'You keep your domain where it is. You only add these records.'}
            </p>
          </div>
          {!d.verified ? (
            <RecordRow
              type={d.verificationRecord.type}
              host={d.verificationRecord.host}
              value={d.verificationRecord.value}
              purpose="1. Prove you own the domain"
              status={liveChecked ? check.verification.status : null}
              found={check?.verification.found ?? []}
            />
          ) : null}
          <RecordRow
            type={d.routingRecord.type}
            host={d.routingRecord.host}
            value={d.routingRecord.value}
            purpose={`${d.verified ? '' : '2. '}Send visitors to your store`}
            status={liveChecked ? check.routing.status : null}
            found={check?.routing.found ?? []}
          />
          {d.routingRecord.type === 'ALIAS' ? (
            <p className="text-xs text-slate-600">
              {d.hostname} is a bare domain, so most providers do not allow a CNAME. Use their
              ALIAS, ANAME or CNAME flattening record. If yours has none, connect www.{d.hostname}{' '}
              instead.
            </p>
          ) : null}
          {liveChecked && check.nameservers.length > 0 ? (
            <p className="text-xs break-all text-slate-500">
              Nameservers: {check.nameservers.join(', ')}
            </p>
          ) : null}
          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-slate-900">
              Step-by-step for your DNS provider
            </summary>
            <div className="grid gap-4 border-t border-slate-200 p-3 sm:grid-cols-2">
              {GUIDES.map((guide) => (
                <div key={guide.name}>
                  <h4
                    className={`text-[13px] font-semibold ${
                      guide.name === check?.dnsProvider
                        ? 'text-slate-900 underline'
                        : 'text-slate-800'
                    }`}
                  >
                    {guide.name}
                  </h4>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs leading-5 text-slate-600">
                    {guide.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}
    </li>
  );
}

export default async function DomainsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, domains] = await Promise.all([
    getStore(storeId),
    api<Domain[]>(`/admin/stores/${storeId}/domains`),
  ]);
  const canEdit = store.permissions.includes('settings:write');
  const checks = await Promise.all(
    domains.map((d) =>
      api<DomainCheck>(`/admin/stores/${storeId}/domains/${d.id}/check`).catch(() => null),
    ),
  );
  const simulated = checks.some((c) => c?.simulated);

  return (
    <div className="space-y-6">
      <Card title="Store address" description="Always available, even with custom domains.">
        <p className="font-mono text-sm">
          {storefrontPattern.replace('{subdomain}', store.subdomain)}
        </p>
      </Card>

      <Card
        title="Connect your own domain"
        description="Already have a domain? Keep it where you bought it. Add two DNS records and your store opens on it."
      >
        {simulated ? (
          <div className="mb-4">
            <Alert tone="info">
              Local mode: DNS is not looked up here, and Verify always succeeds. Set
              DNS_VERIFIER=dns on the API to check real records.
            </Alert>
          </div>
        ) : null}
        {domains.length === 0 ? (
          <EmptyState title="No domains connected yet" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {domains.map((d, i) => (
              <DomainCard
                key={d.id}
                storeId={storeId}
                domain={d}
                check={checks[i] ?? null}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <ActionForm
              action={addDomainAction.bind(null, storeId)}
              className="flex max-w-xl flex-wrap items-end gap-3"
            >
              <div className="flex-1">
                <Field
                  name="hostname"
                  label="Domain you own"
                  placeholder="www.example.com"
                  hint="Use www.example.com or shop.example.com for the simplest setup."
                  required
                />
              </div>
              <SubmitButton variant="secondary">Add domain</SubmitButton>
            </ActionForm>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
