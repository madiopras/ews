import React from "react";

export const ALL_PARTNER_TYPES = [
  "guide",
  "rental",
  "homestay",
  "culinary",
  "souvenir",
  "tour_operator",
  "activity",
];

export const EMPTY_TYPE_FIELDS = {
  instagram_url: "",
  google_maps_url: "",
  guide_languages: [],
  guide_specialties: [],
  guide_license_number: "",
  guide_experience_years: 0,
  guide_max_group_size: 0,
  rental_vehicle_types: [],
  rental_service_options: [],
  rental_pickup_areas: [],
  rental_driver_available: false,
  rental_fleet_size: 0,
  accommodation_subtype: "",
  homestay_room_types: [],
  homestay_room_count: 0,
  homestay_max_guests: 0,
  homestay_facilities: [],
  homestay_checkin_info: "",
  souvenir_categories: [],
  souvenir_products: [],
  souvenir_delivery_available: false,
  souvenir_packaging_note: "",
  souvenir_shop_hours: "",
  culinary_categories: [],
  culinary_specialties: [],
  culinary_service_modes: [],
  culinary_dietary_tags: [],
  culinary_opening_info: "",
  culinary_reservation_note: "",
  tour_trip_types: [],
  tour_inclusions: [],
  tour_min_pax: 0,
  tour_max_pax: 0,
  tour_departure_hubs: [],
  tour_license_number: "",
  activity_categories: [],
  activity_difficulty: "",
  activity_duration_info: "",
  activity_equipment_included: false,
  activity_min_age: 0,
  activity_safety_note: "",
};

const RENTAL_SERVICE_PRESETS = [
  "Dengan Supir",
  "Lepas Kunci",
  "Antar-Jemput KNO",
  "Antar-Jemput Silangit",
  "Sewa Harian / Drop Off",
];

const RENTAL_PICKUP_PRESETS = [
  "Bandara KNO",
  "Kota Medan",
  "Bandara Silangit",
  "Parapat",
  "Berastagi",
  "Samosir",
];

const HOMESTAY_ROOM_PRESETS = [
  "Standard Room",
  "Deluxe Lake View",
  "Family Room",
  "Cottage / Bungalow",
  "Private Villa",
];

const HOMESTAY_FACILITY_PRESETS = [
  "WiFi",
  "Sarapan",
  "AC",
  "Air Hangat",
  "Parkir",
  "View Danau",
  "Dapur",
];

const TOUR_TYPE_PRESETS = [
  "Private Tour",
  "Open Trip",
  "Family Trip",
  "Honeymoon",
  "Corporate / Gathering",
];

const TOUR_INCLUSION_PRESETS = [
  "Transport",
  "Penginapan",
  "Makan",
  "Tiket Wisata",
  "Ferry Samosir",
  "Guide Lokal",
];

const ACTIVITY_PRESETS = [
  "Jungle Trekking Orangutan",
  "Rafting / Arung Jeram",
  "Surfing Nias",
  "Snorkeling / Diving",
  "Kapal Wisata / Kayak",
  "Camping / Glamping",
  "Workshop Budaya & Kopi",
];

function parseCsv(text) {
  return String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function PresetChips({ presets, selected = [], onToggle, disabled }) {
  const list = Array.isArray(selected) ? selected : [];
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {presets.map((preset) => {
        const active = list.some((item) => item.toLowerCase() === preset.toLowerCase());
        return (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => {
              const next = active
                ? list.filter((item) => item.toLowerCase() !== preset.toLowerCase())
                : [...list, preset];
              onToggle(next);
            }}
            className={`chip min-h-0 px-2.5 py-1 text-[11px] ${active ? "chip-active" : ""}`}
            aria-pressed={active}
          >
            {preset}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, wide = false, children }) {
  return (
    <label className={wide ? "sm:col-span-2 block" : "block"}>
      <span className="block text-[12px] font-semibold text-inkSoft mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function CsvField({ label, value = [], onChange, disabled, placeholder = "", wide = false, presets = null }) {
  const arr = Array.isArray(value) ? value : parseCsv(value);
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="block">
        <span className="block text-[12px] font-semibold text-inkSoft mb-1.5">{label}</span>
        <input
          disabled={disabled}
          className="input-flat"
          value={arr.join(", ")}
          placeholder={placeholder}
          onChange={(event) => onChange(parseCsv(event.target.value))}
        />
      </label>
      {presets && (
        <PresetChips presets={presets} selected={arr} onToggle={onChange} disabled={disabled} />
      )}
    </div>
  );
}

export default function PartnerTypeFields({
  type,
  values,
  onChange,
  disabled = false,
  includeSocialLinks = true,
  includePrivateLicense = true,
  lang = "id",
}) {
  const isEn = lang === "en";
  const set = (key, val) => onChange(key, val);

  return (
    <>
      {type === "rental" && (
        <>
          <CsvField
            label={isEn ? "Vehicle fleet types (comma separated)" : "Jenis armada kendaraan (pisahkan koma)"}
            value={values.rental_vehicle_types}
            onChange={(val) => set("rental_vehicle_types", val)}
            disabled={disabled}
            placeholder="Avanza, Innova Reborn, Hiace 14 Seat, Fortuner, Motor"
            wide
          />
          <CsvField
            label={isEn ? "Service options" : "Opsi layanan rental"}
            value={values.rental_service_options}
            onChange={(val) => set("rental_service_options", val)}
            disabled={disabled}
            placeholder="Dengan Supir, Lepas Kunci, Antar-Jemput KNO"
            presets={RENTAL_SERVICE_PRESETS}
            wide
          />
          <CsvField
            label={isEn ? "Pickup & drop-off areas" : "Area jemput & antar"}
            value={values.rental_pickup_areas}
            onChange={(val) => set("rental_pickup_areas", val)}
            disabled={disabled}
            placeholder="Bandara KNO, Kota Medan, Bandara Silangit, Parapat"
            presets={RENTAL_PICKUP_PRESETS}
            wide
          />
          <Field label={isEn ? "Fleet size (units)" : "Jumlah unit armada"}>
            <input
              disabled={disabled}
              type="number"
              min="0"
              className="input-flat"
              value={values.rental_fleet_size ?? 0}
              onChange={(event) => set("rental_fleet_size", Math.max(0, Number(event.target.value) || 0))}
            />
          </Field>
          <label className="flex items-center gap-3 min-h-[44px] self-end">
            <input
              disabled={disabled}
              type="checkbox"
              className="h-4 w-4 accent-toba"
              checked={Boolean(values.rental_driver_available)}
              onChange={(event) => set("rental_driver_available", event.target.checked)}
            />
            <span className="text-[13px]">
              {isEn ? "Experienced local driver available" : "Tersedia supir lokal berpengalaman"}
            </span>
          </label>
        </>
      )}

      {type === "homestay" && (
        <>
          <Field label={isEn ? "Accommodation type" : "Jenis penginapan"}>
            <select
              disabled={disabled}
              className="input-flat"
              value={values.accommodation_subtype || ""}
              onChange={(event) => set("accommodation_subtype", event.target.value)}
            >
              <option value="">{isEn ? "Select subtype (optional)" : "Pilih sub-tipe (opsional)"}</option>
              <option value="homestay">Homestay</option>
              <option value="hotel">Hotel</option>
              <option value="villa">Villa</option>
              <option value="resort">Resort</option>
              <option value="glamping">Glamping</option>
            </select>
          </Field>
          <Field label={isEn ? "Total rooms / units" : "Jumlah kamar / unit"}>
            <input
              disabled={disabled}
              type="number"
              min="0"
              className="input-flat"
              value={values.homestay_room_count ?? 0}
              onChange={(event) => set("homestay_room_count", Math.max(0, Number(event.target.value) || 0))}
            />
          </Field>
          <Field label={isEn ? "Max guests capacity" : "Kapasitas maks. tamu"}>
            <input
              disabled={disabled}
              type="number"
              min="0"
              className="input-flat"
              value={values.homestay_max_guests ?? 0}
              onChange={(event) => set("homestay_max_guests", Math.max(0, Number(event.target.value) || 0))}
            />
          </Field>
          <Field label={isEn ? "Check-in & check-out policy" : "Info check-in & check-out"}>
            <input
              disabled={disabled}
              className="input-flat"
              placeholder="Check-in 14:00, Check-out 12:00"
              value={values.homestay_checkin_info || ""}
              onChange={(event) => set("homestay_checkin_info", event.target.value)}
            />
          </Field>
          <CsvField
            label={isEn ? "Room types available" : "Jenis kamar yang tersedia"}
            value={values.homestay_room_types}
            onChange={(val) => set("homestay_room_types", val)}
            disabled={disabled}
            placeholder="Standard, Deluxe Lake View, Family Room, Cottage"
            presets={HOMESTAY_ROOM_PRESETS}
            wide
          />
          <CsvField
            label={isEn ? "Facilities" : "Fasilitas penginapan"}
            value={values.homestay_facilities}
            onChange={(val) => set("homestay_facilities", val)}
            disabled={disabled}
            placeholder="WiFi, Sarapan, AC, View Danau, Parkir"
            presets={HOMESTAY_FACILITY_PRESETS}
            wide
          />
        </>
      )}

      {type === "guide" && (
        <>
          <CsvField
            label={isEn ? "Languages spoken" : "Bahasa yang dikuasai"}
            value={values.guide_languages}
            onChange={(val) => set("guide_languages", val)}
            disabled={disabled}
            placeholder="Indonesia, English, Mandarin, Batak"
          />
          <CsvField
            label={isEn ? "Guide specialties" : "Spesialisasi pemandu"}
            value={values.guide_specialties}
            onChange={(val) => set("guide_specialties", val)}
            disabled={disabled}
            placeholder="Budaya Batak, Fotografi, Trekking, Ramah Lansia"
          />
          <Field label={isEn ? "Years of experience" : "Pengalaman (tahun)"}>
            <input
              disabled={disabled}
              type="number"
              min="0"
              className="input-flat"
              value={values.guide_experience_years ?? 0}
              onChange={(event) => set("guide_experience_years", Math.max(0, Number(event.target.value) || 0))}
            />
          </Field>
          <Field label={isEn ? "Max group size (pax)" : "Kapasitas maks. rombongan (orang)"}>
            <input
              disabled={disabled}
              type="number"
              min="0"
              className="input-flat"
              value={values.guide_max_group_size ?? 0}
              onChange={(event) => set("guide_max_group_size", Math.max(0, Number(event.target.value) || 0))}
            />
          </Field>
          {includePrivateLicense && (
            <Field
              label={
                isEn
                  ? "License / HPI number (private; public shows Licensed badge)"
                  : "Nomor lisensi / HPI (privat; publik tampil badge Berlisensi)"
              }
              wide
            >
              <input
                disabled={disabled}
                className="input-flat"
                value={values.guide_license_number || ""}
                onChange={(event) => set("guide_license_number", event.target.value)}
              />
            </Field>
          )}
        </>
      )}

      {type === "culinary" && (
        <>
          <CsvField
            label={isEn ? "Culinary categories" : "Kategori kuliner"}
            value={values.culinary_categories}
            onChange={(val) => set("culinary_categories", val)}
            disabled={disabled}
            placeholder="Kopi, Rumah Makan, Kuliner Khas Batak"
          />
          <CsvField
            label={isEn ? "Signature food/drinks" : "Makanan/minuman khas"}
            value={values.culinary_specialties}
            onChange={(val) => set("culinary_specialties", val)}
            disabled={disabled}
            placeholder="Arsik, Soto Medan, Kopi Sidikalang"
          />
          <CsvField
            label={isEn ? "Service modes" : "Mode layanan"}
            value={values.culinary_service_modes}
            onChange={(val) => set("culinary_service_modes", val)}
            disabled={disabled}
            placeholder="Dine-in, Takeaway, Delivery"
          />
          <CsvField
            label={isEn ? "Dietary tags" : "Info diet / halal"}
            value={values.culinary_dietary_tags}
            onChange={(val) => set("culinary_dietary_tags", val)}
            disabled={disabled}
            placeholder="Halal, Vegetarian, Ramah Keluarga"
          />
          <Field label={isEn ? "Opening hours" : "Jam operasional"} wide>
            <input
              disabled={disabled}
              className="input-flat"
              value={values.culinary_opening_info || ""}
              onChange={(event) => set("culinary_opening_info", event.target.value)}
            />
          </Field>
          <Field label={isEn ? "Reservation note" : "Catatan reservasi"} wide>
            <input
              disabled={disabled}
              className="input-flat"
              value={values.culinary_reservation_note || ""}
              onChange={(event) => set("culinary_reservation_note", event.target.value)}
            />
          </Field>
        </>
      )}

      {type === "souvenir" && (
        <>
          <CsvField
            label={isEn ? "Souvenir categories" : "Kategori oleh-oleh"}
            value={values.souvenir_categories}
            onChange={(val) => set("souvenir_categories", val)}
            disabled={disabled}
            placeholder="Kue & Makanan Khas, Kopi Sumut, Ulos & Tenun, Kerajinan"
          />
          <CsvField
            label={isEn ? "Featured products" : "Produk unggulan"}
            value={values.souvenir_products}
            onChange={(val) => set("souvenir_products", val)}
            disabled={disabled}
            placeholder="Bika Ambon, Bolu Meranti, Kopi Mandailing, Ulos"
          />
          <Field label={isEn ? "Shop hours" : "Jam buka toko"}>
            <input
              disabled={disabled}
              className="input-flat"
              value={values.souvenir_shop_hours || ""}
              onChange={(event) => set("souvenir_shop_hours", event.target.value)}
            />
          </Field>
          <Field label={isEn ? "Travel packaging note" : "Catatan kemasan perjalanan / pesawat"}>
            <input
              disabled={disabled}
              className="input-flat"
              placeholder={isEn ? "Cabin-safe box, vacuum sealed" : "Kemasan dus aman kabin / bagasi"}
              value={values.souvenir_packaging_note || ""}
              onChange={(event) => set("souvenir_packaging_note", event.target.value)}
            />
          </Field>
          <label className="sm:col-span-2 flex items-center gap-3 min-h-[44px]">
            <input
              disabled={disabled}
              type="checkbox"
              className="h-4 w-4 accent-toba"
              checked={Boolean(values.souvenir_delivery_available)}
              onChange={(event) => set("souvenir_delivery_available", event.target.checked)}
            />
            <span className="text-[13px]">
              {isEn ? "Delivery / hotel drop-off available" : "Tersedia pengiriman / antar ke hotel & bandara"}
            </span>
          </label>
        </>
      )}

      {type === "tour_operator" && (
        <>
          <CsvField
            label={isEn ? "Trip types (required)" : "Jenis paket wisata (wajib)"}
            value={values.tour_trip_types}
            onChange={(val) => set("tour_trip_types", val)}
            disabled={disabled}
            placeholder="Private Tour, Open Trip, Honeymoon, Family"
            presets={TOUR_TYPE_PRESETS}
            wide
          />
          <CsvField
            label={isEn ? "Standard inclusions (required)" : "Fasilitas termasuk dalam paket (wajib)"}
            value={values.tour_inclusions}
            onChange={(val) => set("tour_inclusions", val)}
            disabled={disabled}
            placeholder="Transport, Penginapan, Makan, Tiket Wisata, Ferry"
            presets={TOUR_INCLUSION_PRESETS}
            wide
          />
          <CsvField
            label={isEn ? "Departure hubs" : "Titik keberangkatan"}
            value={values.tour_departure_hubs}
            onChange={(val) => set("tour_departure_hubs", val)}
            disabled={disabled}
            placeholder="Medan, Bandara KNO, Bandara Silangit, Parapat"
            presets={RENTAL_PICKUP_PRESETS}
            wide
          />
          <Field label={isEn ? "Min participants (pax)" : "Minimal peserta (orang)"}>
            <input
              disabled={disabled}
              type="number"
              min="0"
              className="input-flat"
              value={values.tour_min_pax ?? 0}
              onChange={(event) => set("tour_min_pax", Math.max(0, Number(event.target.value) || 0))}
            />
          </Field>
          <Field label={isEn ? "Max participants (pax)" : "Maksimal peserta (orang)"}>
            <input
              disabled={disabled}
              type="number"
              min="0"
              className="input-flat"
              value={values.tour_max_pax ?? 0}
              onChange={(event) => set("tour_max_pax", Math.max(0, Number(event.target.value) || 0))}
            />
          </Field>
          {includePrivateLicense && (
            <Field
              label={
                isEn
                  ? "Travel license / ASITA number (private; public shows Licensed badge)"
                  : "Nomor izin usaha wisata / ASITA (privat; publik tampil badge Berlisensi)"
              }
              wide
            >
              <input
                disabled={disabled}
                className="input-flat"
                value={values.tour_license_number || ""}
                onChange={(event) => set("tour_license_number", event.target.value)}
              />
            </Field>
          )}
        </>
      )}

      {type === "activity" && (
        <>
          <CsvField
            label={isEn ? "Activity categories (required)" : "Kategori aktivitas & petualangan (wajib)"}
            value={values.activity_categories}
            onChange={(val) => set("activity_categories", val)}
            disabled={disabled}
            placeholder="Jungle Trekking Orangutan, Rafting, Surfing, Kapal Wisata"
            presets={ACTIVITY_PRESETS}
            wide
          />
          <Field label={isEn ? "Difficulty level" : "Tingkat kesulitan"}>
            <select
              disabled={disabled}
              className="input-flat"
              value={values.activity_difficulty || ""}
              onChange={(event) => set("activity_difficulty", event.target.value)}
            >
              <option value="">{isEn ? "Select difficulty (optional)" : "Pilih tingkat kesulitan (opsional)"}</option>
              <option value="beginner">{isEn ? "Beginner / Family friendly" : "Pemula / Ramah keluarga"}</option>
              <option value="moderate">{isEn ? "Moderate" : "Menengah"}</option>
              <option value="challenging">{isEn ? "Challenging / Adventure" : "Menantang / Petualangan"}</option>
            </select>
          </Field>
          <Field label={isEn ? "Typical duration" : "Estimasi durasi aktivitas"}>
            <input
              disabled={disabled}
              className="input-flat"
              placeholder={isEn ? "3-4 hours / Full day" : "3-4 jam / Seharian"}
              value={values.activity_duration_info || ""}
              onChange={(event) => set("activity_duration_info", event.target.value)}
            />
          </Field>
          <Field label={isEn ? "Minimum age (years, 0 = all ages)" : "Usia minimal (tahun, 0 = semua usia)"}>
            <input
              disabled={disabled}
              type="number"
              min="0"
              max="100"
              className="input-flat"
              value={values.activity_min_age ?? 0}
              onChange={(event) => set("activity_min_age", Math.max(0, Number(event.target.value) || 0))}
            />
          </Field>
          <label className="flex items-center gap-3 min-h-[44px] self-end">
            <input
              disabled={disabled}
              type="checkbox"
              className="h-4 w-4 accent-toba"
              checked={Boolean(values.activity_equipment_included)}
              onChange={(event) => set("activity_equipment_included", event.target.checked)}
            />
            <span className="text-[13px]">
              {isEn ? "Safety gear & equipment included" : "Perlengkapan & alat keselamatan sudah termasuk"}
            </span>
          </label>
          <Field label={isEn ? "Safety & preparation note" : "Catatan keselamatan & persiapan"} wide>
            <input
              disabled={disabled}
              className="input-flat"
              placeholder={isEn ? "Bring trekking shoes and dry bag" : "Bawa sepatu trekking & pakaian ganti"}
              value={values.activity_safety_note || ""}
              onChange={(event) => set("activity_safety_note", event.target.value)}
            />
          </Field>
        </>
      )}

      {includeSocialLinks && (
        <>
          <Field label="Instagram URL (opsional)">
            <input
              disabled={disabled}
              type="url"
              className="input-flat"
              placeholder="https://instagram.com/usahaanda"
              value={values.instagram_url || ""}
              onChange={(event) => set("instagram_url", event.target.value)}
            />
          </Field>
          <Field label="Google Maps URL (opsional)">
            <input
              disabled={disabled}
              type="url"
              className="input-flat"
              placeholder="https://maps.google.com/?q=..."
              value={values.google_maps_url || ""}
              onChange={(event) => set("google_maps_url", event.target.value)}
            />
          </Field>
        </>
      )}
    </>
  );
}
