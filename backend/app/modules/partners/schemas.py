"""Partner and Mitra API contracts."""

from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field

PartnerType = Literal["guide", "rental", "homestay", "culinary", "souvenir"]
PartnerMembershipRole = Literal["owner", "staff"]
PartnerWorkflowStatus = Literal[
    "draft", "pending", "needs_revision", "approved", "rejected"
]


class PartnerIn(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=120)
    type: PartnerType
    whatsapp: str = Field(
        ..., min_length=8, max_length=20
    )  # digits only, with country code e.g. 6281...
    description: str = Field(..., min_length=10, max_length=1000)
    city: str = Field(..., min_length=2, max_length=120)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default="", max_length=300)
    destination_ids: List[str] = Field(default_factory=list, max_length=100)
    service_tags: List[str] = Field(default_factory=list, max_length=20)
    image: Optional[str] = Field(default="", max_length=1000)
    culinary_categories: List[str] = Field(default_factory=list, max_length=20)
    culinary_specialties: List[str] = Field(default_factory=list, max_length=50)
    culinary_service_modes: List[str] = Field(default_factory=list, max_length=10)
    culinary_dietary_tags: List[str] = Field(default_factory=list, max_length=20)
    culinary_opening_info: str = Field(default="", max_length=300)
    culinary_reservation_note: str = Field(default="", max_length=300)


class PartnerOnboardingStartIn(BaseModel):
    type: PartnerType


class PartnerDraftIn(BaseModel):
    business_name: str = Field(default="", max_length=120)
    type: PartnerType = "guide"
    whatsapp: str = Field(default="", max_length=30)
    description: str = Field(default="", max_length=1000)
    city: str = Field(default="", max_length=120)
    email: Optional[EmailStr] = None
    address: str = Field(default="", max_length=300)
    destination_ids: List[str] = Field(default_factory=list, max_length=100)
    service_tags: List[str] = Field(default_factory=list, max_length=20)
    current_step: int = Field(default=1, ge=1, le=4)
    guide_languages: List[str] = Field(default_factory=list, max_length=20)
    guide_license_number: str = Field(default="", max_length=100)
    guide_experience_years: int = Field(default=0, ge=0, le=80)
    rental_vehicle_types: List[str] = Field(default_factory=list, max_length=30)
    rental_driver_available: bool = False
    rental_fleet_size: int = Field(default=0, ge=0, le=10000)
    homestay_room_count: int = Field(default=0, ge=0, le=10000)
    homestay_facilities: List[str] = Field(default_factory=list, max_length=30)
    homestay_checkin_info: str = Field(default="", max_length=300)
    souvenir_products: List[str] = Field(default_factory=list, max_length=50)
    souvenir_delivery_available: bool = False
    souvenir_shop_hours: str = Field(default="", max_length=200)
    culinary_categories: List[str] = Field(default_factory=list, max_length=20)
    culinary_specialties: List[str] = Field(default_factory=list, max_length=50)
    culinary_service_modes: List[str] = Field(default_factory=list, max_length=10)
    culinary_dietary_tags: List[str] = Field(default_factory=list, max_length=20)
    culinary_opening_info: str = Field(default="", max_length=300)
    culinary_reservation_note: str = Field(default="", max_length=300)


class PartnerSelfServiceIn(PartnerDraftIn):
    """Editable public profile fields after a partner has been approved."""

    current_step: int = 4


class PartnerAvailabilityIn(BaseModel):
    accepting_contacts: bool
    contact_status_note: str = Field(default="", max_length=160)


class PartnerOfferingIn(BaseModel):
    kind: Literal["service", "product"]
    name: str = Field(..., min_length=2, max_length=120)
    description: str = Field(default="", max_length=600)
    ai_tags: List[str] = Field(default_factory=list, max_length=20)
    service_areas: List[str] = Field(default_factory=list, max_length=30)
    destination_ids: List[str] = Field(default_factory=list, max_length=100)
    availability_note: str = Field(default="", max_length=240)
    is_active: bool = True


class PartnerOfferingOut(PartnerOfferingIn):
    id: str
    partner_id: str
    created_at: str
    updated_at: str


class PartnerMemberIn(BaseModel):
    email: EmailStr


class PartnerOwnerAssignIn(BaseModel):
    email: EmailStr


class PartnerMemberOut(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    status: str
    created_at: str


class PartnerGalleryOut(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    uploaded_at: str
    uploaded_by: str
    url: str


class PartnerOut(BaseModel):
    id: str
    business_name: str
    type: PartnerType
    whatsapp: str
    description: str
    city: str
    email: Optional[str] = None
    address: str = ""
    destination_ids: List[str]
    service_tags: List[str] = Field(default_factory=list)
    image: Optional[str] = ""
    status: str
    created_at: str
    updated_at: str = ""
    is_premium: bool = False
    premium_until: Optional[str] = None
    is_active: bool = True
    accepting_contacts: bool = True


class PartnerPublicOut(BaseModel):
    """Safe public listing DTO: no owner, member, document, email, or street address."""

    id: str
    business_name: str
    type: PartnerType
    whatsapp: Optional[str] = None
    description: str
    city: str
    destination_ids: List[str] = Field(default_factory=list)
    service_tags: List[str] = Field(default_factory=list)
    image: str = ""
    is_premium: bool = False
    promotional_disclosure: Optional[str] = None
    accepting_contacts: bool = True


class PartnerPublicDetailOut(PartnerPublicOut):
    gallery: List[PartnerGalleryOut] = Field(default_factory=list)
    offerings: List[PartnerOfferingOut] = Field(default_factory=list)
    destinations: List[dict] = Field(default_factory=list)
    type_details: dict = Field(default_factory=dict)
    last_profile_reviewed_at: Optional[str] = None


class VerificationDocumentOut(BaseModel):
    id: str
    document_type: str
    filename: str
    content_type: str
    size: int
    uploaded_at: str
    uploaded_by: str


class PartnerAdminOut(PartnerOut):
    verification_documents: List[VerificationDocumentOut] = Field(default_factory=list)
    approval_history: List[dict] = Field(default_factory=list)
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    owner_user_id: str = ""
    ownership_status: str = "unclaimed"
    gallery: List[PartnerGalleryOut] = Field(default_factory=list)
    submitted_at: Optional[str] = None
    review_due_at: Optional[str] = None
    revision_note: str = ""
    current_step: int = 1
    guide_languages: List[str] = Field(default_factory=list)
    guide_license_number: str = ""
    guide_experience_years: int = 0
    rental_vehicle_types: List[str] = Field(default_factory=list)
    rental_driver_available: bool = False
    rental_fleet_size: int = 0
    homestay_room_count: int = 0
    homestay_facilities: List[str] = Field(default_factory=list)
    homestay_checkin_info: str = ""
    souvenir_products: List[str] = Field(default_factory=list)
    souvenir_delivery_available: bool = False
    souvenir_shop_hours: str = ""
    culinary_categories: List[str] = Field(default_factory=list)
    culinary_specialties: List[str] = Field(default_factory=list)
    culinary_service_modes: List[str] = Field(default_factory=list)
    culinary_dietary_tags: List[str] = Field(default_factory=list)
    culinary_opening_info: str = ""
    culinary_reservation_note: str = ""
    contact_status_note: str = ""
    profile_completeness: int = 0
    completeness_missing: List[str] = Field(default_factory=list)
    last_profile_reviewed_at: Optional[str] = None
    freshness_due_at: Optional[str] = None


class PartnerWorkspaceOut(PartnerAdminOut):
    membership_role: str
    members: List[PartnerMemberOut] = Field(default_factory=list)


class PartnerAdminListItem(PartnerOut):
    documents_count: int = 0
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None


class PartnerAdminPage(BaseModel):
    items: List[PartnerAdminListItem]
    total: int
    page: int
    page_size: int
    pages: int


class PartnerStatusIn(BaseModel):
    status: Literal["approved", "rejected", "needs_revision", "pending"]
    revision_note: str = Field(default="", max_length=1000)


class PartnerAnalyticsEventIn(BaseModel):
    model_config = {"extra": "forbid"}

    event_id: str = Field(..., min_length=16, max_length=80)
    event_type: Literal[
        "directory_impression",
        "ai_impression",
        "profile_click",
        "profile_view",
        "whatsapp_click",
    ]
    partner_id: str
    source: Literal["planner", "directory", "partner_detail", "destination"]
    destination_id: Optional[str] = None
    anonymous_session_id: str = Field(..., min_length=16, max_length=80)
    placement: Optional[Literal["organic", "featured"]] = None
    relevance_score: Optional[int] = Field(default=None, ge=0, le=100)
    match_factor_codes: List[
        Literal[
            "destination_coverage",
            "requested_service_type",
            "service_tag_match",
            "multi_destination_coverage",
        ]
    ] = Field(default_factory=list, max_length=4)
