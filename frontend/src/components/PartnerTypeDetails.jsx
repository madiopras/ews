import React from "react";
import { Award, ExternalLink, MapPinned } from "lucide-react";

function ChipGroup({ label, values }) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-inkSoft">{label}</h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="chip min-h-0 px-2.5 py-1 text-[11px]">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatItem({ label, value }) {
  if (value === null || value === undefined || value === "" || value === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-cream/60 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-inkSoft">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

const SUBTYPE_LABELS = {
  homestay: { id: "Homestay Lokal", en: "Local Homestay" },
  hotel: { id: "Hotel", en: "Hotel" },
  villa: { id: "Villa", en: "Villa" },
  resort: { id: "Resort", en: "Resort" },
  glamping: { id: "Glamping", en: "Glamping" },
};

const DIFFICULTY_LABELS = {
  beginner: { id: "Pemula / Ramah Keluarga", en: "Beginner / Family Friendly" },
  moderate: { id: "Menengah", en: "Moderate" },
  challenging: { id: "Menantang / Petualangan", en: "Challenging / Adventure" },
};

export default function PartnerTypeDetails({ partner, lang = "id" }) {
  const details = partner?.type_details || {};
  const isEn = lang === "en";
  const type = partner?.type;

  const headingByType = {
    rental: isEn ? "Fleet & Rental Service Details" : "Detail Armada & Layanan Rental",
    homestay: isEn ? "Rooms & Accommodation Details" : "Detail Kamar & Penginapan",
    guide: isEn ? "Guide Credentials & Specialties" : "Keahlian & Profil Pemandu",
    culinary: isEn ? "Culinary Details" : "Detail Kuliner",
    souvenir: isEn ? "Products & Packaging Details" : "Detail Produk & Pengiriman",
    tour_operator: isEn ? "Tour Packages & Inclusions" : "Detail Paket Wisata & Fasilitas",
    activity: isEn ? "Activity & Safety Information" : "Detail Aktivitas & Keselamatan",
  };

  let content = null;

  if (type === "rental") {
    const hasData =
      details.rental_vehicle_types?.length ||
      details.rental_service_options?.length ||
      details.rental_pickup_areas?.length ||
      details.rental_fleet_size > 0 ||
      details.rental_driver_available;
    if (hasData) {
      content = (
        <div className="mt-3 space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatItem
              label={isEn ? "Fleet Size" : "Jumlah Armada"}
              value={details.rental_fleet_size > 0 ? `${details.rental_fleet_size} ${isEn ? "units" : "unit"}` : null}
            />
            <StatItem
              label={isEn ? "Local Driver" : "Supir Lokal"}
              value={details.rental_driver_available ? (isEn ? "Available" : "Tersedia") : null}
            />
          </div>
          <ChipGroup label={isEn ? "Vehicle Types" : "Pilihan Armada"} values={details.rental_vehicle_types} />
          <ChipGroup label={isEn ? "Service Options" : "Opsi Layanan"} values={details.rental_service_options} />
          <ChipGroup label={isEn ? "Pickup & Drop-off Areas" : "Area Jemput & Antar"} values={details.rental_pickup_areas} />
        </div>
      );
    }
  } else if (type === "homestay") {
    const subtype = SUBTYPE_LABELS[details.accommodation_subtype]?.[isEn ? "en" : "id"];
    const hasData =
      subtype ||
      details.homestay_room_types?.length ||
      details.homestay_facilities?.length ||
      details.homestay_room_count > 0 ||
      details.homestay_max_guests > 0 ||
      details.homestay_checkin_info;
    if (hasData) {
      content = (
        <div className="mt-3 space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatItem label={isEn ? "Property Type" : "Jenis Penginapan"} value={subtype} />
            <StatItem
              label={isEn ? "Total Rooms" : "Jumlah Kamar"}
              value={details.homestay_room_count > 0 ? `${details.homestay_room_count} ${isEn ? "rooms" : "kamar"}` : null}
            />
            <StatItem
              label={isEn ? "Max Guests" : "Kapasitas Tamu"}
              value={details.homestay_max_guests > 0 ? `${details.homestay_max_guests} ${isEn ? "guests" : "orang"}` : null}
            />
          </div>
          <ChipGroup label={isEn ? "Room Types" : "Pilihan Tipe Kamar"} values={details.homestay_room_types} />
          <ChipGroup label={isEn ? "Facilities" : "Fasilitas"} values={details.homestay_facilities} />
          {details.homestay_checkin_info && (
            <p className="text-sm text-inkSoft">
              <strong className="text-ink">{isEn ? "Check-in / Check-out" : "Info Check-in / Check-out"}:</strong>{" "}
              {details.homestay_checkin_info}
            </p>
          )}
        </div>
      );
    }
  } else if (type === "guide") {
    const hasData =
      details.guide_languages?.length ||
      details.guide_specialties?.length ||
      details.guide_experience_years > 0 ||
      details.guide_max_group_size > 0 ||
      details.has_license;
    if (hasData) {
      content = (
        <div className="mt-3 space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatItem
              label={isEn ? "Experience" : "Pengalaman"}
              value={details.guide_experience_years > 0 ? `${details.guide_experience_years} ${isEn ? "years" : "tahun"}` : null}
            />
            <StatItem
              label={isEn ? "Max Group" : "Maks. Rombongan"}
              value={details.guide_max_group_size > 0 ? `${details.guide_max_group_size} ${isEn ? "pax" : "orang"}` : null}
            />
          </div>
          <ChipGroup label={isEn ? "Languages" : "Bahasa"} values={details.guide_languages} />
          <ChipGroup label={isEn ? "Specialties" : "Spesialisasi"} values={details.guide_specialties} />
        </div>
      );
    }
  } else if (type === "culinary") {
    const hasData =
      details.culinary_categories?.length ||
      details.culinary_specialties?.length ||
      details.culinary_service_modes?.length ||
      details.culinary_dietary_tags?.length ||
      details.culinary_opening_info ||
      details.culinary_reservation_note;
    if (hasData) {
      content = (
        <div className="mt-3 space-y-3" data-testid="culinary-public-details">
          <ChipGroup label={isEn ? "Categories" : "Kategori"} values={details.culinary_categories} />
          <ChipGroup label={isEn ? "Signature Dishes" : "Menu Unggulan"} values={details.culinary_specialties} />
          <ChipGroup label={isEn ? "Service Modes" : "Mode Layanan"} values={details.culinary_service_modes} />
          <ChipGroup label={isEn ? "Dietary Info" : "Info Diet"} values={details.culinary_dietary_tags} />
          {details.culinary_opening_info && (
            <p className="text-sm text-inkSoft">
              <strong className="text-ink">{isEn ? "Opening hours" : "Jam buka"}:</strong> {details.culinary_opening_info}
            </p>
          )}
          {details.culinary_reservation_note && (
            <p className="text-sm text-inkSoft">
              <strong className="text-ink">{isEn ? "Reservation" : "Reservasi"}:</strong> {details.culinary_reservation_note}
            </p>
          )}
        </div>
      );
    }
  } else if (type === "souvenir") {
    const hasData =
      details.souvenir_categories?.length ||
      details.souvenir_products?.length ||
      details.souvenir_delivery_available ||
      details.souvenir_packaging_note ||
      details.souvenir_shop_hours;
    if (hasData) {
      content = (
        <div className="mt-3 space-y-3.5">
          {details.souvenir_delivery_available && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <StatItem
                label={isEn ? "Delivery" : "Pengiriman"}
                value={isEn ? "Hotel / Airport Drop-off" : "Tersedia Pengiriman"}
              />
            </div>
          )}
          <ChipGroup label={isEn ? "Categories" : "Kategori"} values={details.souvenir_categories} />
          <ChipGroup label={isEn ? "Featured Products" : "Produk Unggulan"} values={details.souvenir_products} />
          {details.souvenir_shop_hours && (
            <p className="text-sm text-inkSoft">
              <strong className="text-ink">{isEn ? "Shop hours" : "Jam buka"}:</strong> {details.souvenir_shop_hours}
            </p>
          )}
          {details.souvenir_packaging_note && (
            <p className="text-sm text-inkSoft">
              <strong className="text-ink">{isEn ? "Travel packaging" : "Kemasan perjalanan"}:</strong>{" "}
              {details.souvenir_packaging_note}
            </p>
          )}
        </div>
      );
    }
  } else if (type === "tour_operator") {
    const hasData =
      details.tour_trip_types?.length ||
      details.tour_inclusions?.length ||
      details.tour_departure_hubs?.length ||
      details.tour_min_pax > 0 ||
      details.tour_max_pax > 0 ||
      details.has_license;
    if (hasData) {
      const paxRange =
        details.tour_min_pax > 0 && details.tour_max_pax > 0
          ? `${details.tour_min_pax}–${details.tour_max_pax} ${isEn ? "pax" : "orang"}`
          : details.tour_min_pax > 0
            ? `Min. ${details.tour_min_pax} ${isEn ? "pax" : "orang"}`
            : details.tour_max_pax > 0
              ? `Maks. ${details.tour_max_pax} ${isEn ? "pax" : "orang"}`
              : null;
      content = (
        <div className="mt-3 space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatItem label={isEn ? "Group Size" : "Kapasitas Peserta"} value={paxRange} />
          </div>
          <ChipGroup label={isEn ? "Trip Types" : "Jenis Paket"} values={details.tour_trip_types} />
          <ChipGroup label={isEn ? "Included in Packages" : "Fasilitas Termasuk"} values={details.tour_inclusions} />
          <ChipGroup label={isEn ? "Departure Hubs" : "Titik Keberangkatan"} values={details.tour_departure_hubs} />
        </div>
      );
    }
  } else if (type === "activity") {
    const difficulty = DIFFICULTY_LABELS[details.activity_difficulty]?.[isEn ? "en" : "id"];
    const hasData =
      details.activity_categories?.length ||
      difficulty ||
      details.activity_duration_info ||
      details.activity_equipment_included ||
      details.activity_min_age > 0 ||
      details.activity_safety_note;
    if (hasData) {
      content = (
        <div className="mt-3 space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatItem label={isEn ? "Difficulty" : "Tingkat Kesulitan"} value={difficulty} />
            <StatItem label={isEn ? "Duration" : "Durasi"} value={details.activity_duration_info} />
            <StatItem
              label={isEn ? "Min. Age" : "Usia Minimal"}
              value={details.activity_min_age > 0 ? `${details.activity_min_age}+ ${isEn ? "yrs" : "thn"}` : null}
            />
            <StatItem
              label={isEn ? "Equipment" : "Perlengkapan"}
              value={details.activity_equipment_included ? (isEn ? "Included" : "Sudah Termasuk") : null}
            />
          </div>
          <ChipGroup label={isEn ? "Activities" : "Pilihan Aktivitas"} values={details.activity_categories} />
          {details.activity_safety_note && (
            <p className="text-sm text-inkSoft">
              <strong className="text-ink">{isEn ? "Safety & preparation" : "Catatan keselamatan"}:</strong>{" "}
              {details.activity_safety_note}
            </p>
          )}
        </div>
      );
    }
  }

  const hasSocial = Boolean(partner?.instagram_url || partner?.google_maps_url);
  if (!content && !hasSocial && !details.has_license) return null;

  return (
    <section className="mt-5 border-t border-line pt-5" data-testid="partner-type-public-details">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl text-ink">{headingByType[type] || (isEn ? "Business Details" : "Detail Usaha")}</h2>
        {details.has_license && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
            data-testid="partner-licensed-badge"
          >
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            {isEn ? "Licensed" : "Berlisensi"}
          </span>
        )}
      </div>

      {content}

      {hasSocial && (
        <div className="mt-4 flex flex-wrap gap-2.5 pt-3 border-t border-line/60">
          {partner.instagram_url && (
            <a
              href={partner.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline text-xs min-h-[40px]"
              data-testid="partner-instagram-link"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Instagram
            </a>
          )}
          {partner.google_maps_url && (
            <a
              href={partner.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline text-xs min-h-[40px]"
              data-testid="partner-maps-link"
            >
              <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
              Google Maps
            </a>
          )}
        </div>
      )}
    </section>
  );
}
