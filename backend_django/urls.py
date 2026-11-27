"""
Django URL Configuration & ModelForms (`urls.py` & `forms.py`)
"""
from django.urls import path
from django import forms
from .models import InfrastructureProject, SoilImageInspection
from . import views


class InfrastructureProjectForm(forms.ModelForm):
    class Meta:
        model = InfrastructureProject
        fields = [
            "code", "name", "sector", "state_region", "district",
            "implementing_agency", "total_area_hectares", "acquired_area_hectares",
            "budget_crores_inr", "start_date", "scheduled_completion_date",
            "total_parcels", "ownership_verified_pct", "documentation_complete_pct",
            "compensation_disbursed_pct", "active_legal_disputes_count",
            "pending_clearances_count", "overdue_milestones_count",
        ]


class SoilImageUploadForm(forms.ModelForm):
    class Meta:
        model = SoilImageInspection
        fields = ["project", "parcel", "image", "scientific_disclaimer_acknowledged"]


urlpatterns = [
    path("api/dashboard/summary/", views.dashboard_summary_api, name="dashboard_summary"),
    path("api/projects/<int:project_id>/predict/", views.run_delay_prediction_api, name="predict_delay"),
    path("api/projects/<int:project_id>/soil-cv/", views.upload_and_analyze_soil_image, name="soil_cv_analyze"),
    path("api/reports/export-csv/", views.export_projects_csv, name="export_projects_csv"),
]
