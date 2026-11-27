"""
Django ORM Models for Land Acquisition Delay Prediction & Preliminary Soil Surface Inspection.
Database: PostgreSQL (Production) / SQLite3 (Development)
"""
from django.db import models
from django.contrib.auth.models import User


class InfrastructureProject(models.Model):
    SECTOR_CHOICES = [
        ("Highway", "Highway"),
        ("Railway", "Railway"),
        ("Industrial Corridor", "Industrial Corridor"),
        ("Logistics Park", "Logistics Park"),
        ("Power Transmission", "Power Transmission"),
    ]
    RISK_TIER_CHOICES = [
        ("Low", "Low"),
        ("Medium", "Medium"),
        ("High", "High"),
        ("Critical", "Critical"),
    ]

    code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    sector = models.CharField(max_length=40, choices=SECTOR_CHOICES)
    state_region = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    implementing_agency = models.CharField(max_length=160)

    total_area_hectares = models.DecimalField(max_digits=10, decimal_places=2)
    acquired_area_hectares = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    budget_crores_inr = models.DecimalField(max_digits=12, decimal_places=2)

    start_date = models.DateField()
    scheduled_completion_date = models.DateField()
    latitude = models.FloatField(default=20.5937)
    longitude = models.FloatField(default=78.9629)

    # Aggregated Feature Inputs for Scikit-Learn Delay Predictor
    total_parcels = models.PositiveIntegerField(default=1)
    ownership_verified_pct = models.FloatField(default=0.0)
    documentation_complete_pct = models.FloatField(default=0.0)
    compensation_disbursed_pct = models.FloatField(default=0.0)
    active_legal_disputes_count = models.PositiveIntegerField(default=0)
    pending_clearances_count = models.PositiveIntegerField(default=0)
    overdue_milestones_count = models.PositiveIntegerField(default=0)
    avg_settlement_lag_days = models.PositiveIntegerField(default=30)
    affected_households_count = models.PositiveIntegerField(default=10)

    # Cached ML Prediction Outputs
    delay_probability = models.FloatField(default=0.0)
    risk_tier = models.CharField(max_length=16, choices=RISK_TIER_CHOICES, default="Low")
    predicted_delay_days = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-delay_probability", "code"]

    def __str__(self):
        return f"{self.code} — {self.name} ({self.risk_tier})"


class LandParcel(models.Model):
    OWNERSHIP_CHOICES = [
        ("Verified", "Verified"),
        ("Disputed", "Disputed"),
        ("Pending Mutation", "Pending Mutation"),
        ("Encumbered", "Encumbered"),
    ]
    COMPENSATION_CHOICES = [
        ("Disbursed", "Disbursed"),
        ("Pending Award", "Pending Award"),
        ("Under Arbitration", "Under Arbitration"),
        ("Escrow Deposited", "Escrow Deposited"),
    ]

    project = models.ForeignKey(InfrastructureProject, related_name="parcels", on_delete=models.CASCADE)
    parcel_id = models.CharField(max_length=40, unique=True)
    survey_number = models.CharField(max_length=64)
    village = models.CharField(max_length=120)
    area_hectares = models.DecimalField(max_digits=8, decimal_places=2)
    ownership_status = models.CharField(max_length=32, choices=OWNERSHIP_CHOICES, default="Pending Mutation")
    title_doc_completeness = models.FloatField(default=50.0)
    compensation_assessed_lakhs = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    compensation_paid_lakhs = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    compensation_status = models.CharField(max_length=32, choices=COMPENSATION_CHOICES, default="Pending Award")
    has_court_stay_order = models.BooleanField(default=False)
    latitude = models.FloatField()
    longitude = models.FloatField()


class AcquisitionMilestone(models.Model):
    STATUS_CHOICES = [
        ("Completed", "Completed"),
        ("In Progress", "In Progress"),
        ("Overdue", "Overdue"),
        ("Pending", "Pending"),
    ]

    project = models.ForeignKey(InfrastructureProject, related_name="milestones", on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    statutory_section = models.CharField(max_length=100)
    due_date = models.DateField()
    completed_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="Pending")


class SoilImageInspection(models.Model):
    """
    Stores uploaded field survey photographs and preliminary OpenCV surface observations.
    NOTE: Visual observations are explicitly flagged as preliminary non-laboratory indicators.
    """
    project = models.ForeignKey(InfrastructureProject, related_name="soil_inspections", on_delete=models.CASCADE)
    parcel = models.ForeignKey(LandParcel, null=True, blank=True, on_delete=models.SET_NULL)
    image = models.ImageField(upload_to="soil_surveys/%Y/%m/")
    dominant_rgb_hex = models.CharField(max_length=16)
    apparent_color_class = models.CharField(max_length=120)
    surface_texture_class = models.CharField(max_length=120)
    vegetation_cover_pct = models.FloatField()
    moisture_indicator_index = models.FloatField()
    rock_edge_density_pct = models.FloatField()
    visual_confidence_pct = models.FloatField()
    observations_json = models.JSONField(default=dict)
    suitability_notes_json = models.JSONField(default=list)
    scientific_disclaimer_acknowledged = models.BooleanField(default=True)
    analyzed_at = models.DateTimeField(auto_now_add=True)
