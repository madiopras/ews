import React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, MapPin } from "lucide-react";
import ImageDropzone from "../../../components/ImageDropzone.jsx";
import { FormActions } from "../../../components/admin/index.js";
import { useLang } from "../../../contexts/LanguageContext.jsx";
import { CATEGORY_KEYS } from "../../../lib/i18n.js";
import useUnsavedChanges from "../../../hooks/useUnsavedChanges.js";
import { destinationSchema, destinationToForm } from "./destinationSchema.js";

function Field({ label, error, required, children, className = "", container = false }) {
  const Element = container ? "div" : "label";
  return (
    <Element className={`block ${className}`}>
      <span className="text-[12px] font-semibold text-inkSoft">
        {label}{required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
      </span>
      <span className="block mt-2">{children}</span>
      {error && <span className="block mt-1.5 text-[11px] text-red-700" role="alert">{error.message}</span>}
    </Element>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="card-flat p-4 sm:p-6">
      <div className="mb-5">
        <h2 className="font-display text-xl">{title}</h2>
        <p className="text-[12px] text-inkSoft mt-1">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export default function DestinationForm({ destination, onSubmit, onCancel, saving = false }) {
  const { t } = useLang();
  const copy = t.admin.destinationAdmin;
  const fields = t.admin.fields;
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(destinationSchema),
    defaultValues: destinationToForm(destination),
  });
  const latitude = Number(watch("latitude"));
  const longitude = Number(watch("longitude"));
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const delta = 0.02;
  const mapUrl = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - delta}%2C${latitude - delta}%2C${longitude + delta}%2C${latitude + delta}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : "";

  useUnsavedChanges(isDirty && !saving, copy.unsaved);

  const cancel = () => {
    if (!isDirty || window.confirm(copy.unsaved)) onCancel();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate data-testid="destination-form">
      <Section title={copy.basicSection} hint={copy.basicHint}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={fields.name} error={errors.name} required>
            <input {...register("name")} className="input-flat" autoFocus data-testid="destination-name" />
          </Field>
          <Field label={fields.name_en} error={errors.name_en}>
            <input {...register("name_en")} className="input-flat" />
          </Field>
          <Field label={fields.location} error={errors.location} required>
            <input {...register("location")} className="input-flat" />
          </Field>
          <Field label={fields.category} error={errors.category} required>
            <select {...register("category")} className="input-flat">
              {CATEGORY_KEYS.map((category) => <option key={category} value={category}>{t.categories[category]}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title={copy.descriptionSection} hint={copy.descriptionHint}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Field label={fields.description} error={errors.description} required>
            <textarea {...register("description")} rows={8} className="input-flat resize-y" />
          </Field>
          <Field label={fields.description_en} error={errors.description_en}>
            <textarea {...register("description_en")} rows={8} className="input-flat resize-y" />
          </Field>
        </div>
      </Section>

      <Section title={copy.editorialSection} hint={copy.editorialHint}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={fields.source_label} error={errors.source_label}>
            <input {...register("source_label")} className="input-flat" />
          </Field>
          <Field label={fields.source_url} error={errors.source_url}>
            <input {...register("source_url")} type="url" className="input-flat" placeholder="https://instagram.com/p/..." />
          </Field>
          <Field label={fields.editorial_reviewed_at} error={errors.editorial_reviewed_at}>
            <input {...register("editorial_reviewed_at")} type="date" className="input-flat" />
          </Field>
          <Field label={fields.tags} error={errors.tags}>
            <Controller
              name="tags"
              control={control}
              render={({ field }) => (
                <input
                  value={field.value.join(", ")}
                  onChange={(event) => field.onChange(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30))}
                  className="input-flat"
                  placeholder={fields.tagsPlaceholder}
                />
              )}
            />
          </Field>
        </div>
      </Section>

      <Section title={copy.mediaSection} hint={copy.mediaHint}>
        <Field label={fields.images} error={errors.images} container>
          <Controller
            name="images"
            control={control}
            render={({ field }) => <ImageDropzone value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field label={fields.video} error={errors.video} className="mt-5">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkSoft" />
            <input {...register("video")} type="url" className="input-flat pl-9" placeholder={fields.videoPlaceholder} />
          </div>
          <span className="block text-[11px] text-inkSoft mt-1.5">{fields.videoHint}</span>
        </Field>
      </Section>

      <Section title={copy.locationSection} hint={copy.locationHint}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={fields.latitude} error={errors.latitude} required>
            <input {...register("latitude", { valueAsNumber: true })} type="number" step="any" min="-90" max="90" className="input-flat" />
          </Field>
          <Field label={fields.longitude} error={errors.longitude} required>
            <input {...register("longitude", { valueAsNumber: true })} type="number" step="any" min="-180" max="180" className="input-flat" />
          </Field>
        </div>
        <div className="mt-4 rounded-xl border border-line overflow-hidden bg-line/20 min-h-[260px]">
          {hasCoordinates ? (
            <iframe
              src={mapUrl}
              title={copy.mapPreview}
              loading="lazy"
              className="w-full h-[280px] border-0"
            />
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-inkSoft text-[12px]">
              <MapPin className="w-6 h-6 mb-2" />
              {copy.locationHint}
            </div>
          )}
        </div>
      </Section>

      <Section title={copy.publishingSection} hint={copy.publishingHint}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="rounded-xl border border-line p-4 flex items-start gap-3 cursor-pointer hover:border-toba/50">
            <input {...register("is_active")} type="checkbox" className="mt-0.5 w-5 h-5 accent-[#0F3D3E]" />
            <span className="text-[13px] font-semibold">{copy.activeField}</span>
          </label>
          <label className="rounded-xl border border-line p-4 flex items-start gap-3 cursor-pointer hover:border-toba/50">
            <input {...register("featured")} type="checkbox" className="mt-0.5 w-5 h-5 accent-[#0F3D3E]" />
            <span className="text-[13px] font-semibold">{copy.featuredField}</span>
          </label>
        </div>
      </Section>

      <FormActions onCancel={cancel} saving={saving} />
    </form>
  );
}
