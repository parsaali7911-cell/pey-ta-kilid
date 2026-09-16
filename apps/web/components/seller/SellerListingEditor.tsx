'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiAuthed } from '@/lib/auth-client';
import { apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';
import type { WizardFacility } from '@/components/seller/SellerListingWizard';

type AttrDef = {
  id: string;
  code: string;
  dataType: string;
  required?: boolean;
  nameEn?: string;
  nameFa?: string;
  unit?: string | null;
  enumOptions?: string[] | null;
};

type ListingAttr = {
  attributeDefinition?: { code?: string; dataType?: string };
  valueString?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
};

export type EditableListing = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  uomCode?: string;
  moq?: number | null;
  leadTimeDays?: number | null;
  categoryId?: string;
  category?: { id?: string; slug?: string; name?: string; nameEn?: string; defaultUomCode?: string | null } | null;
  facility?: { id?: string; name?: string } | null;
  price?: { displayPrice?: number; currency?: string; supplierCost?: number } | null;
  attributes?: ListingAttr[];
};

/**
 * Full edit form for seller listings.
 * DRAFT/REJECTED → save as DRAFT; PUBLISHED/APPROVED → re-submit to PENDING_REVIEW.
 */
export function SellerListingEditor({
  locale,
  copy,
  listing,
  facilities,
  busy,
  setBusy,
  setError,
  setMsg,
  onSaved,
  onCancel,
}: {
  locale: Locale;
  copy: Record<string, string>;
  listing: EditableListing;
  facilities: WizardFacility[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  setMsg: (v: string) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const categoryId = listing.categoryId || listing.category?.id || '';
  const [title, setTitle] = useState(listing.title || '');
  const [description, setDescription] = useState(listing.description || '');
  const [facilityId, setFacilityId] = useState(listing.facility?.id || '');
  const [uomCode, setUomCode] = useState(
    listing.uomCode || listing.category?.defaultUomCode || 'm2',
  );
  const [moq, setMoq] = useState(String(listing.moq ?? 1));
  const [leadDays, setLeadDays] = useState(String(listing.leadTimeDays ?? 7));
  const [supplierCost, setSupplierCost] = useState(
    String(listing.price?.supplierCost ?? listing.price?.displayPrice ?? ''),
  );
  const [currency, setCurrency] = useState(listing.price?.currency || 'USD');
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [resubmit, setResubmit] = useState(
    listing.status === 'DRAFT' || listing.status === 'REJECTED',
  );

  const lockedUom = listing.category?.defaultUomCode || listing.uomCode || uomCode;
  const willReReview =
    listing.status === 'PUBLISHED' || listing.status === 'APPROVED' || resubmit;

  useEffect(() => {
    setTitle(listing.title || '');
    setDescription(listing.description || '');
    setFacilityId(listing.facility?.id || '');
    setUomCode(listing.uomCode || listing.category?.defaultUomCode || 'm2');
    setMoq(String(listing.moq ?? 1));
    setLeadDays(String(listing.leadTimeDays ?? 7));
    setSupplierCost(String(listing.price?.supplierCost ?? listing.price?.displayPrice ?? ''));
    setCurrency(listing.price?.currency || 'USD');
    setResubmit(listing.status === 'DRAFT' || listing.status === 'REJECTED');
  }, [listing]);

  useEffect(() => {
    if (!categoryId) return;
    void fetch(apiUrl(`/categories/${categoryId}/attributes`))
      .then((r) => r.json())
      .then((defs) => {
        const list = Array.isArray(defs) ? (defs as AttrDef[]) : [];
        setAttrDefs(list);
        const fromListing = new Map<string, string>();
        for (const a of listing.attributes || []) {
          const code = a.attributeDefinition?.code;
          if (!code) continue;
          if (a.valueNumber != null) fromListing.set(code, String(a.valueNumber));
          else if (a.valueBoolean != null) fromListing.set(code, a.valueBoolean ? 'true' : 'false');
          else if (a.valueString != null) fromListing.set(code, a.valueString);
        }
        const next: Record<string, string> = {};
        for (const d of list) {
          next[d.code] =
            fromListing.get(d.code) ||
            (d.dataType === 'ENUM' && Array.isArray(d.enumOptions) && d.enumOptions[0]
              ? String(d.enumOptions[0])
              : '');
        }
        setAttrValues(next);
      })
      .catch(() => {
        setAttrDefs([]);
        setAttrValues({});
      });
  }, [categoryId, listing.attributes]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(copy.seller_wizard_need_title);
      return;
    }
    for (const d of attrDefs) {
      if (d.required && !(attrValues[d.code] || '').trim()) {
        setError(`${copy.seller_wizard_need_attr}: ${d.nameFa || d.nameEn || d.code}`);
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const attributes = attrDefs
        .map((d) => {
          const raw = (attrValues[d.code] || '').trim();
          if (!raw && !d.required) return null;
          if (d.dataType === 'NUMBER') return { attributeCode: d.code, valueNumber: Number(raw) };
          if (d.dataType === 'BOOLEAN') {
            return { attributeCode: d.code, valueBoolean: raw === 'true' || raw === '1' };
          }
          return { attributeCode: d.code, valueString: raw };
        })
        .filter(Boolean);

      const updated = await apiAuthed<{ id: string; status: string }>(`/seller/listings/${listing.id}`, {
        method: 'PATCH',
        json: {
          title: title.trim(),
          description: description.trim() || undefined,
          uomCode: lockedUom,
          moq: Number(moq) || 1,
          leadTimeDays: Number(leadDays) || 7,
          facilityId: facilityId || undefined,
          attributes,
        },
      });

      if (supplierCost !== '' && Number.isFinite(Number(supplierCost))) {
        await apiAuthed(`/seller/listings/${listing.id}/price`, {
          method: 'POST',
          json: {
            supplierCost: Number(supplierCost),
            currency,
            priceType: 'EXW',
          },
        });
      }

      let status = updated.status;
      if (resubmit && (status === 'DRAFT' || status === 'REJECTED')) {
        const submitted = await apiAuthed<{ status: string }>(`/seller/listings/${listing.id}/submit`, {
          method: 'POST',
        });
        status = submitted.status;
      }

      setMsg(`${copy.seller_edit_saved}: ${status}`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel-card seller-edit" onSubmit={onSubmit} style={{ marginTop: '1rem' }}>
      <h3>
        {copy.seller_edit_title} — {listing.title}
      </h3>
      <p className="panel-muted">
        {copy.seller_edit_status}: <strong>{listing.status}</strong>
        {willReReview ? ` · ${copy.seller_edit_rereview_note}` : ''}
      </p>

      <div className="panel-form">
        <label>
          {copy.seller_listing_title} *
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          {copy.seller_listing_desc}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>

        <p className="panel-muted">{copy.seller_wizard_details_lead}</p>
        {attrDefs.length ? (
          <div className="panel-grid-2">
            {attrDefs.map((d) => (
              <label key={d.id}>
                {(locale === 'fa' ? d.nameFa || d.nameEn : d.nameEn || d.nameFa) || d.code}
                {d.required ? ' *' : ''}
                {d.unit ? ` (${d.unit})` : ''}
                {d.dataType === 'ENUM' && Array.isArray(d.enumOptions) ? (
                  <select
                    required={Boolean(d.required)}
                    value={attrValues[d.code] || ''}
                    onChange={(e) => setAttrValues((s) => ({ ...s, [d.code]: e.target.value }))}
                  >
                    <option value="">—</option>
                    {d.enumOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required={Boolean(d.required)}
                    value={attrValues[d.code] || ''}
                    onChange={(e) => setAttrValues((s) => ({ ...s, [d.code]: e.target.value }))}
                  />
                )}
              </label>
            ))}
          </div>
        ) : (
          <p className="panel-muted">{copy.seller_wizard_no_attrs}</p>
        )}

        <label>
          {copy.seller_facility_link}
          <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="">{copy.seller_no_facility}</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} — {f.address?.city}
              </option>
            ))}
          </select>
        </label>

        <div className="panel-grid-3">
          <label>
            {copy.seller_wizard_uom}
            <input value={lockedUom} readOnly disabled />
            <span className="panel-muted" style={{ fontSize: '0.85em' }}>
              {copy.seller_wizard_uom_locked}
            </span>
          </label>
          <label>
            MOQ
            <input value={moq} onChange={(e) => setMoq(e.target.value)} />
          </label>
          <label>
            {copy.listing_lead}
            <input value={leadDays} onChange={(e) => setLeadDays(e.target.value)} />
          </label>
        </div>

        <div className="panel-grid-2">
          <label>
            {copy.seller_supplier_cost}
            <input value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} />
          </label>
          <label>
            {copy.seller_currency}
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['USD', 'IRR', 'EUR', 'AED'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {listing.status === 'DRAFT' || listing.status === 'REJECTED' ? (
          <label className="panel-check">
            <input type="checkbox" checked={resubmit} onChange={(e) => setResubmit(e.target.checked)} />
            {copy.seller_edit_resubmit}
          </label>
        ) : null}
      </div>

      <div className="designer-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="mp-btn" onClick={onCancel} disabled={busy}>
          {copy.seller_edit_cancel}
        </button>
        <button type="submit" className="mp-btn mp-btn--primary" disabled={busy}>
          {copy.seller_edit_save}
        </button>
      </div>
    </form>
  );
}
