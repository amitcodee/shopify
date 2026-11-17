import type { ReactNode } from 'react';
import type { PlatformContact } from './public-api';

/** True when the operator has filled in any part of their legal identity. */
export function hasBusinessDetails(c: PlatformContact): boolean {
  return Boolean(c.legalName || c.registeredAddress || c.gstin || c.supportPhone);
}

/** True when a Grievance Officer is named. */
export function hasGrievanceOfficer(c: PlatformContact): boolean {
  return Boolean(c.grievanceOfficerName || c.grievanceOfficerEmail);
}

const linkClass = 'font-semibold text-mk-fg underline underline-offset-4 break-all';

/**
 * The operator's legal name, registered address, GSTIN, phone and Grievance Officer, as a
 * definition list. Renders nothing when none of it is set (the platform admin fills it in).
 */
export function BusinessDetails({
  contact,
  grievance = true,
  className = '',
}: {
  contact: PlatformContact;
  /** Include the Grievance Officer rows. */
  grievance?: boolean;
  className?: string;
}) {
  const rows: { label: string; value: ReactNode }[] = [];
  if (contact.legalName) rows.push({ label: 'Operated by', value: contact.legalName });
  if (contact.registeredAddress)
    rows.push({
      label: 'Registered address',
      value: <span className="whitespace-pre-line">{contact.registeredAddress}</span>,
    });
  if (contact.gstin) rows.push({ label: 'GSTIN', value: contact.gstin });
  if (contact.supportPhone)
    rows.push({
      label: 'Phone',
      value: (
        <a href={`tel:${contact.supportPhone.replace(/[^\d+]/g, '')}`} className={linkClass}>
          {contact.supportPhone}
        </a>
      ),
    });
  if (contact.supportEmail)
    rows.push({
      label: 'Email',
      value: (
        <a href={`mailto:${contact.supportEmail}`} className={linkClass}>
          {contact.supportEmail}
        </a>
      ),
    });
  if (grievance && contact.grievanceOfficerName)
    rows.push({ label: 'Grievance Officer', value: contact.grievanceOfficerName });
  if (grievance && contact.grievanceOfficerEmail)
    rows.push({
      label: 'Grievance email',
      value: (
        <a href={`mailto:${contact.grievanceOfficerEmail}`} className={linkClass}>
          {contact.grievanceOfficerEmail}
        </a>
      ),
    });
  if (rows.length === 0) return null;
  return (
    <dl className={`grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr] ${className}`}>
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-mk-dim">{r.label}</dt>
          <dd className="text-mk-fg">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
