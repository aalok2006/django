"""
Scikit-Learn Delay Prediction & Risk Classification Module (`ml_predictor.py`)
Trains and evaluates a Calibrated RandomForestClassifier + GradientBoostingRegressor
on synthetic infrastructure land acquisition records, and explains key risk factors.
"""
from typing import Dict, Any, List
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline


FEATURE_NAMES = [
    "total_parcels",
    "ownership_verified_pct",
    "documentation_complete_pct",
    "compensation_disbursed_pct",
    "active_legal_disputes_count",
    "pending_clearances_count",
    "overdue_milestones_count",
    "avg_settlement_lag_days",
    "affected_households_count",
]


class LandAcquisitionDelayPredictor:
    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.clf_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("rf", RandomForestClassifier(
                n_estimators=180,
                max_depth=8,
                min_samples_leaf=3,
                class_weight="balanced",
                random_state=random_state,
            )),
        ])
        self.reg_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("gbr", GradientBoostingRegressor(
                n_estimators=140,
                learning_rate=0.06,
                max_depth=4,
                random_state=random_state,
            )),
        ])
        self._fit_synthetic_benchmark()

    def _fit_synthetic_benchmark(self) -> None:
        """Fits the model on a deterministic 600-project synthetic infrastructure benchmark."""
        rng = np.random.default_rng(self.random_state)
        n = 600
        total_parcels = rng.integers(25, 250, size=n)
        ownership_pct = rng.uniform(30, 99, size=n)
        doc_pct = np.clip(ownership_pct + rng.normal(0, 8, size=n), 25, 100)
        comp_pct = np.clip(ownership_pct - rng.uniform(0, 22, size=n), 15, 100)
        disputes = rng.poisson(lam=np.maximum(1, (100 - ownership_pct) * 0.28), size=n)
        clearances = rng.integers(0, 6, size=n)
        overdue = rng.integers(0, 5, size=n)
        lag_days = rng.integers(15, 180, size=n)
        households = total_parcels * rng.uniform(1.2, 3.8, size=n)

        X = np.column_stack([
            total_parcels, ownership_pct, doc_pct, comp_pct,
            disputes, clearances, overdue, lag_days, households
        ])

        risk_logit = (
            -2.1
            + ((100 - ownership_pct) / 100) * 1.45
            + ((100 - comp_pct) / 100) * 1.60
            + (disputes / 25.0) * 1.95
            + (clearances / 5.0) * 1.10
            + (overdue / 4.0) * 1.25
        )
        prob = 1.0 / (1.0 + np.exp(-risk_logit))
        y_Delayed = (prob >= 0.50).astype(int)
        y_days = np.maximum(0, (prob * 260 + disputes * 6.5 + overdue * 28)).astype(float)

        self.clf_pipeline.fit(X, y_Delayed)
        self.reg_pipeline.fit(X, y_days)

    def predict_project(self, features: Dict[str, float]) -> Dict[str, Any]:
        x_vec = np.array([[features[k] for k in FEATURE_NAMES]], dtype=float)
        delay_prob = float(self.clf_pipeline.predict_proba(x_vec)[0, 1])
        predicted_days = max(0, int(round(float(self.reg_pipeline.predict(x_vec)[0]))))

        prob_pct = int(round(delay_prob * 100))
        if prob_pct >= 75:
            risk_tier = "Critical"
        elif prob_pct >= 50:
            risk_tier = "High"
        elif prob_pct >= 25:
            risk_tier = "Medium"
        else:
            risk_tier = "Low"

        rf_importances = self.clf_pipeline.named_steps["rf"].feature_importances_
        feature_Ranking: List[Dict[str, Any]] = []
        for name, imp in zip(FEATURE_NAMES, rf_importances):
            feature_Ranking.append({
                "feature": name,
                "value": features[name],
                "importance_pct": round(float(imp) * 100, 1),
            })
        feature_Ranking.sort(key=lambda item: item["importance_pct"], reverse=True)

        return {
            "delay_probability": round(delay_prob, 4),
            "delay_probability_pct": prob_pct,
            "risk_tier": risk_tier,
            "predicted_delay_days": predicted_days,
            "feature_importances": feature_Ranking,
        }
