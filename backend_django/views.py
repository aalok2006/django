"""
Django Views & REST Endpoints (`views.py`)
Provides CRUD operations for Infrastructure Projects, Delay Prediction execution,
OpenCV Land/Soil Photograph upload & analysis, and CSV Report Exports.
"""
import csv
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from .models import InfrastructureProject, SoilImageInspection
from .ml_predictor import LandAcquisitionDelayPredictor
from .opencv_soil_analyzer import analyze_land_photograph

predictor = LandAcquisitionDelayPredictor()


@require_http_methods(["GET"])
def dashboard_summary_api(request):
    projects = InfrastructureProject.objects.all()
    total = projects.count()
    high_or_critical = projects.filter(risk_tier__in=["High", "Critical"]).count()
    total_disputes = sum(p.active_legal_disputes_count for p in projects)
    pending_clearances = sum(p.pending_clearances_count for p in projects)

    return JsonResponse({
        "total_projects": total,
        "high_risk_projects": high_or_critical,
        "total_legal_disputes": total_disputes,
        "pending_approvals": pending_clearances,
    })


@login_required
@require_http_methods(["POST"])
def run_delay_prediction_api(request, project_id: int):
    project = InfrastructureProject.objects.get(pk=project_id)
    features = {
        "total_parcels": project.total_parcels,
        "ownership_verified_pct": project.ownership_verified_pct,
        "documentation_complete_pct": project.documentation_complete_pct,
        "compensation_disbursed_pct": project.compensation_disbursed_pct,
        "active_legal_disputes_count": project.active_legal_disputes_count,
        "pending_clearances_count": project.pending_clearances_count,
        "overdue_milestones_count": project.overdue_milestones_count,
        "avg_settlement_lag_days": project.avg_settlement_lag_days,
        "affected_households_count": project.affected_households_count,
    }
    result = predictor.predict_project(features)
    project.delay_probability = result["delay_probability"]
    project.risk_tier = result["risk_tier"]
    project.predicted_delay_days = result["predicted_delay_days"]
    project.save(update_fields=["delay_probability", "risk_tier", "predicted_delay_days", "updated_at"])
    return JsonResponse(result)


@login_required
@require_http_methods(["POST"])
def upload_and_analyze_soil_image(request, project_id: int):
    project = InfrastructureProject.objects.get(pk=project_id)
    uploaded_file = request.FILES.get("soil_image")
    if not uploaded_file:
        return JsonResponse({"error": "No image file uploaded."}, status=400)

    inspection = SoilImageInspection.objects.create(
        project=project,
        image=uploaded_file,
        dominant_rgb_hex="#000000",
        apparent_color_class="Pending",
        surface_texture_class="Pending",
        vegetation_cover_pct=0.0,
        moisture_indicator_index=0.0,
        rock_edge_density_pct=0.0,
        visual_confidence_pct=85.0,
    )
    cv_metrics = analyze_land_photograph(inspection.image.path)
    inspection.dominant_rgb_hex = cv_metrics["dominant_rgb_hex"]
    inspection.vegetation_cover_pct = cv_metrics["vegetation_cover_pct"]
    inspection.moisture_indicator_index = cv_metrics["moisture_indicator_index"]
    inspection.rock_edge_density_pct = cv_metrics["rock_edge_density_pct"]
    inspection.observations_json = cv_metrics
    inspection.save()
    return JsonResponse(cv_metrics)


@require_http_methods(["GET"])
def export_projects_csv(request):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="land_acquisition_delay_report.csv"'
    writer = csv.writer(response)
    writer.writerow([
        "Code", "Project Name", "Sector", "State", "Total Area (Ha)",
        "Acquired (Ha)", "Ownership Verified (%)", "Compensation Disbursed (%)",
        "Legal Disputes", "Delay Probability (%)", "Risk Tier", "Predicted Delay (Days)"
    ])
    for p in InfrastructureProject.objects.all():
        writer.writerow([
            p.code, p.name, p.sector, p.state_region, p.total_area_hectares,
            p.acquired_area_hectares, p.ownership_verified_pct, p.compensation_disbursed_pct,
            p.active_legal_disputes_count, round(p.delay_probability * 100),
            p.risk_tier, p.predicted_delay_days
        ])
    return response
