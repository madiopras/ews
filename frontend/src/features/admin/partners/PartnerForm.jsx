import React, { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import ImageDropzone from "../../../components/ImageDropzone.jsx";
import { FormActions } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import useUnsavedChanges from "../../../hooks/useUnsavedChanges.js";
import { PARTNER_TYPES, partnerSchema, partnerToForm } from "./partnerSchema.js";

function Field({ label, error, required, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[12px] font-semibold text-inkSoft">
        {label}{required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
      </span>
      <span className="block mt-2">{children}</span>
      {error && <span className="block mt-1.5 text-[11px] text-red-700" role="alert">{error.message}</span>}
    </label>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="card-flat p-4 sm:p-6">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-[12px] text-inkSoft mt-1 mb-5">{hint}</p>
      {children}
    </section>
  );
}

export default function PartnerForm({ partner, destinations = [], destinationsLoading = false, onSubmit, onCancel, saving = false }) {
  const { t } = useLang();
  const copy = t.admin.partnerAdmin;
  const fields = t.admin.partnerForm;
  const [destinationSearch, setDestinationSearch] = useState("");
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(partnerSchema), defaultValues: partnerToForm(partner) });
  const visibleDestinations = useMemo(() => {
    const query = destinationSearch.trim().toLowerCase();
    if (!query) return destinations;
    return destinations.filter((item) => `${item.name} ${item.location}`.toLowerCase().includes(query));
  }, [destinationSearch, destinations]);

  useUnsavedChanges(isDirty && !saving, copy.unsaved);
  const cancel = () => {
    if (!isDirty || window.confirm(copy.unsaved)) onCancel();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate data-testid="partner-form">
      <Section title={copy.profileSection} hint={copy.profileHint}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={fields.businessName} error={errors.business_name} required>
            <input {...register("business_name")} className="input-flat" autoFocus data-testid="partner-business-name" />
          </Field>
          <Field label={fields.type} error={errors.type} required>
            <select {...register("type")} className="input-flat">
              {PARTNER_TYPES.map((type) => <option key={type} value={type}>{t.partners.types[type]}</option>)}
            </select>
          </Field>
          <Field label="WhatsApp" error={errors.whatsapp} required>
            <input {...register("whatsapp")} inputMode="tel" className="input-flat" placeholder="6281234567890" />
          </Field>
          <Field label="Email" error={errors.email}>
            <input {...register("email")} type="email" className="input-flat" />
          </Field>
          <Field label={fields.city} error={errors.city} required>
            <input {...register("city")} className="input-flat" />
          </Field>
          <Field label={fields.address} error={errors.address}>
            <input {...register("address")} className="input-flat" />
          </Field>
          <Field label={fields.description} error={errors.description} required className="md:col-span-2">
            <textarea {...register("description")} rows={6} className="input-flat resize-y" />
          </Field>
          <Field label={fields.serviceTags} error={errors.service_tags} className="md:col-span-2">
            <Controller
              name="service_tags"
              control={control}
              render={({ field }) => (
                <input
                  value={field.value.join(", ")}
                  onChange={(event) => field.onChange(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20))}
                  className="input-flat"
                  placeholder={fields.serviceTagsPlaceholder}
                />
              )}
            />
          </Field>
        </div>
      </Section>

      <Section title={copy.coverageSection} hint={copy.coverageHint}>
        <div className="relative max-w-md mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkSoft" />
          <input value={destinationSearch} onChange={(event) => setDestinationSearch(event.target.value)} className="input-flat pl-9" placeholder={copy.destinationSearch} />
        </div>
        <Controller
          name="destination_ids"
          control={control}
          render={({ field }) => (
            <div>
              <div className="text-[11px] text-inkSoft mb-2">{field.value.length} {copy.selectedDestinations}</div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-line p-3 flex flex-wrap gap-2 bg-cream/40">
                {destinationsLoading ? <span className="text-[12px] text-inkSoft">{t.common.loading}</span>
                  : visibleDestinations.length === 0 ? <span className="text-[12px] text-inkSoft">{copy.noDestinations}</span>
                  : visibleDestinations.map((destination) => {
                    const selected = field.value.includes(destination.id);
                    return (
                      <button
                        key={destination.id}
                        type="button"
                        onClick={() => field.onChange(selected ? field.value.filter((id) => id !== destination.id) : [...field.value, destination.id])}
                        className={`chip ${selected ? "chip-active" : ""}`}
                        aria-pressed={selected}
                      >
                        {destination.name}
                      </button>
                    );
                  })}
              </div>
              {errors.destination_ids && <span className="block mt-1.5 text-[11px] text-red-700">{errors.destination_ids.message}</span>}
            </div>
          )}
        />
      </Section>

      <Section title={copy.imageSection} hint={copy.imageHint}>
        <Controller
          name="image"
          control={control}
          render={({ field }) => <ImageDropzone value={field.value ? [field.value] : []} onChange={(images) => field.onChange(images[0] || "")} maxImages={1} />}
        />
        {errors.image && <span className="block mt-1.5 text-[11px] text-red-700">{errors.image.message}</span>}
      </Section>

      <FormActions onCancel={cancel} saving={saving} />
    </form>
  );
}
