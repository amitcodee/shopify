import { findThemeTemplate } from '@repo/contracts';
import type { ReactNode } from 'react';
import type { MockKind } from './features-data';
import { Icon } from './icons';
import { TemplateThumb } from './template-thumb';

/** Decorative product illustrations drawn in HTML/CSS for the feature pages. */

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 shadow-indigo-950/10 ring-slate-900/10">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="flex gap-1">
          <span className="size-2 rounded-full bg-rose-300" />
          <span className="size-2 rounded-full bg-amber-300" />
          <span className="size-2 rounded-full bg-emerald-300" />
        </span>
        <span className="ml-2 truncate text-xs font-medium text-slate-500">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'green' | 'amber' | 'slate' | 'indigo';
  children: ReactNode;
}) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 text-sm ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
    >
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-slate-500">
        <tr>
          {head.map((h) => (
            <th key={h} className="pb-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="py-2.5 pr-2 text-slate-700">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const MOCKS: Record<MockKind, () => ReactNode> = {
  storefront: () => {
    const t = findThemeTemplate('beauty-split');
    return (
      <div className="relative pb-10">
        <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-slate-900/10">
          {t ? <TemplateThumb template={t} tiles={4} className="sm:[zoom:1.3]" /> : null}
        </div>
        <div className="absolute right-4 bottom-0 w-44 rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-900/10">
          <p className="text-[11px] font-medium text-slate-500">Theme</p>
          <div className="mt-2 flex gap-1.5">
            {['#831843', '#db2777', '#fffafb', '#fdf2f8'].map((c) => (
              <span
                key={c}
                className="size-6 rounded-full ring-1 ring-slate-200"
                style={{ background: c }}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-600">Serif headings · Large corners</p>
        </div>
      </div>
    );
  },
  checkout: () => (
    <Frame title="Checkout">
      <div className="grid gap-5 sm:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Contact & delivery</p>
          {['Email', 'Address', 'City'].map((f) => (
            <div
              key={f}
              className="rounded-lg px-3 py-2 text-xs text-slate-400 ring-1 ring-slate-200"
            >
              {f}
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-xs ring-1 ring-indigo-300">
            <span>Standard shipping</span>
            <span>$5.00</span>
          </div>
        </div>
        <div className="space-y-2.5 rounded-xl bg-slate-50 p-4">
          <Row k="Subtotal" v="$80.00" />
          <Row k="Discount · WELCOME10" v="−$8.00" />
          <Row k="Shipping" v="$5.00" />
          <Row k="Tax" v="$6.18" />
          <div className="border-t border-slate-200 pt-2.5">
            <Row k="Total" v="$83.18" strong />
          </div>
          <div className="rounded-lg bg-slate-900 py-2 text-center text-xs font-semibold text-white">
            Pay now
          </div>
        </div>
      </div>
    </Frame>
  ),
  payments: () => (
    <Frame title="Settings · Payments">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Payouts account</p>
        <Badge tone="green">Active</Badge>
      </div>
      <div className="mt-4 space-y-2 rounded-xl p-4 ring-1 ring-slate-200">
        <Row k="Provider" v="Stripe" />
        <Row k="Payments" v="Enabled" />
        <Row k="Payouts" v="Enabled" />
      </div>
      <p className="mt-5 text-xs font-semibold text-slate-500 uppercase">Last 30 days</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          ['Gross sales', '$4,210'],
          ['Refunds', '$120'],
          ['Net', '$3,968'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-[11px] text-slate-500">{k}</p>
            <p className="text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>
    </Frame>
  ),
  inventory: () => (
    <Frame title="Inventory">
      <Table
        head={['Variant', 'SKU', 'Main', 'Warehouse']}
        rows={[
          ['Linen shirt · S', 'LS-S', '12', '30'],
          ['Linen shirt · M', 'LS-M', '4', '18'],
          [
            'Linen shirt · L',
            'LS-L',
            <span key="l" className="font-semibold text-amber-700">
              2
            </span>,
            '0',
          ],
          ['Canvas tote', 'CT-1', '48', '120'],
        ]}
      />
      <div className="mt-4 flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
        <span>Transfer 10 × Linen shirt · L</span>
        <span>Warehouse → Main</span>
      </div>
    </Frame>
  ),
  orders: () => (
    <Frame title="Order #1042">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="green">Paid</Badge>
        <Badge tone="amber">Unfulfilled</Badge>
        <span className="ml-auto text-xs font-medium text-indigo-600">Print packing slip</span>
      </div>
      <div className="mt-4 space-y-2.5 rounded-xl p-4 ring-1 ring-slate-200">
        <p className="text-sm font-semibold">Fulfill order</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
            UPS
          </div>
          <div className="rounded-lg px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
            1Z 999 AA1
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 py-2 text-center text-xs font-semibold text-white">
          Mark as fulfilled
        </div>
      </div>
      <ol className="mt-4 space-y-2 border-l-2 border-indigo-200 pl-4 text-xs text-slate-600">
        <li>Payment captured</li>
        <li>Confirmation email sent</li>
        <li className="text-slate-400">Return requested · awaiting review</li>
      </ol>
    </Frame>
  ),
  marketing: () => (
    <Frame title="Discounts">
      <Table
        head={['Code', 'Type', 'Used', 'Status']}
        rows={[
          [
            'SPRING15',
            '15% off',
            '38 / 100',
            <Badge key="a" tone="green">
              Active
            </Badge>,
          ],
          [
            'FREESHIP',
            'Free shipping',
            '112',
            <Badge key="b" tone="green">
              Active
            </Badge>,
          ],
          [
            'SUMMER20',
            '20% off',
            '0',
            <Badge key="c" tone="indigo">
              Scheduled
            </Badge>,
          ],
          [
            'WINTER10',
            '$10 off',
            '200 / 200',
            <Badge key="d" tone="slate">
              Used up
            </Badge>,
          ],
        ]}
      />
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs">
        <p className="font-semibold text-slate-900">Segment · Spent over $200</p>
        <p className="mt-1 text-slate-500">Accepts email marketing · Export CSV</p>
      </div>
    </Frame>
  ),
  analytics: () => {
    const bars = [32, 45, 38, 60, 52, 70, 64, 82, 74, 90, 68, 96];
    return (
      <Frame title="Overview">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Net sales (30d)', '$12,480'],
            ['Orders', '214'],
            ['Avg. order value', '$58.32'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[10px] text-slate-500 sm:text-[11px]">{k}</p>
              <p className="text-sm font-bold">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs font-semibold text-slate-700">Net sales by day</p>
        <div className="mt-2 flex h-28 items-end gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-indigo-500 to-violet-400"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-4">
          <Table
            head={['Top products', 'Units', 'Revenue']}
            rows={[
              ['Linen shirt', '64', '$3,520'],
              ['Canvas tote', '41', '$1,230'],
            ]}
          />
        </div>
      </Frame>
    );
  },
  currencies: () => (
    <Frame title="Settings · Currencies">
      <p className="text-sm font-semibold">Selling in other currencies</p>
      <div className="mt-3 space-y-2">
        {[
          ['EUR', '0.92', 'Charm (18.99)', true],
          ['GBP', '0.79', 'Whole units (19.00)', true],
          ['INR', '83.10', 'Whole units (19.00)', true],
          ['JPY', '149.5', 'Exact', false],
        ].map(([code, rate, rounding, on]) => (
          <div
            key={code as string}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs ring-1 ring-slate-200"
          >
            <span
              className={`flex size-4 items-center justify-center rounded text-[10px] text-white ${on ? 'bg-indigo-600' : 'ring-1 ring-slate-300'}`}
            >
              {on ? '✓' : ''}
            </span>
            <span className="w-9 font-semibold">{code}</span>
            <span className="text-slate-500">{rate}</span>
            <span className="ml-auto truncate text-slate-500">{rounding}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
        <span className="text-slate-500">Linen shirt</span>
        <span className="font-semibold">$55.00 · €50.99 · £43.00</span>
      </div>
    </Frame>
  ),
  staff: () => (
    <Frame title="Settings · Staff">
      <div className="space-y-2.5">
        {[
          ['owner@yourstore.com', 'Owner', 'indigo'],
          ['ops@yourstore.com', 'Admin', 'slate'],
          ['packing@yourstore.com', 'Staff · orders', 'slate'],
        ].map(([email, role, tone]) => (
          <div
            key={email}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 ring-slate-200"
          >
            <span className="truncate text-xs">{email}</span>
            <Badge tone={tone as 'indigo' | 'slate'}>{role}</Badge>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lock" className="size-4 text-indigo-600" />
          Two-factor authentication
          <span className="ml-auto">
            <Badge tone="green">On</Badge>
          </span>
        </p>
        <div className="mt-3 flex gap-1.5">
          {[3, 9, 1, 7, 0, 4].map((d, i) => (
            <span
              key={i}
              className="flex h-9 flex-1 items-center justify-center rounded-md bg-white font-mono font-semibold ring-1 ring-slate-200"
            >
              {d}
            </span>
          ))}
        </div>
      </div>
    </Frame>
  ),
  code: () => (
    <div className="overflow-hidden rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-slate-400">
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300">
          POST
        </span>
        https://example.com/hooks
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-6 text-slate-300">
        <code>
          <span className="text-slate-500">{'// headers'}</span>
          {'\n'}
          <span className="text-violet-300">x-commerce-topic</span>: orders/paid{'\n'}
          <span className="text-violet-300">x-commerce-hmac-sha256</span>: 3q2+7w…{'\n\n'}
          <span className="text-slate-500">{'// body'}</span>
          {'\n'}
          {'{\n  '}
          <span className="text-sky-300">&quot;id&quot;</span>
          {': '}
          <span className="text-amber-200">&quot;0193…&quot;</span>
          {',\n  '}
          <span className="text-sky-300">&quot;number&quot;</span>
          {': '}
          <span className="text-emerald-300">1042</span>
          {',\n  '}
          <span className="text-sky-300">&quot;total&quot;</span>
          {': '}
          <span className="text-emerald-300">8318</span>
          {',\n  '}
          <span className="text-sky-300">&quot;currency&quot;</span>
          {': '}
          <span className="text-amber-200">&quot;USD&quot;</span>
          {'\n}'}
        </code>
      </pre>
    </div>
  ),
  domains: () => (
    <Frame title="Settings · Domains">
      <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 ring-slate-200">
        <span className="truncate text-sm font-medium">shop.yourbrand.com</span>
        <span className="flex gap-1.5">
          <Badge tone="green">Verified</Badge>
          <Badge tone="indigo">Primary</Badge>
        </span>
      </div>
      <p className="mt-4 text-xs text-slate-500">Add these records at your DNS provider:</p>
      <div className="mt-2 overflow-x-auto">
        <Table
          head={['Type', 'Name', 'Value']}
          rows={[
            ['TXT', '_shop-verification.shop…', '7f3a…'],
            ['CNAME', 'shop.yourbrand.com', 'your platform host'],
          ]}
        />
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
        <Icon name="lock" className="size-4" />
        HTTPS certificate active
      </div>
    </Frame>
  ),
};

export function FeatureMock({ kind }: { kind: MockKind }) {
  return <div aria-hidden="true">{MOCKS[kind]()}</div>;
}
