"""
GigShield ML Service - FastAPI wrapper for premium model inference.
"""

from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd

app = FastAPI(title="GigShield ML Service", version="1.0.0")

MODEL_PATH = "/app/model/premium_model.pkl"

try:
    artifact = joblib.load(MODEL_PATH)
    model = artifact["model"]
    FEATURES = artifact["features"]
    MODEL_RMSE = artifact.get("rmse", None)
    model_loaded = True
except FileNotFoundError:
    model = None
    FEATURES = []
    MODEL_RMSE = None
    model_loaded = False


class PremiumInput(BaseModel):
    age: int
    occupation_risk: int
    zone_risk: int
    health_score: int
    income: int
    claim_history: int


class PremiumOutput(BaseModel):
    predicted_premium: float
    model_version: str
    rmse: float | None


@app.get("/health")
@app.get("/ml/health")
def health():
    return {"status": "healthy", "model_loaded": model_loaded}


@app.post("/predict", response_model=PremiumOutput)
def predict_premium(input_data: PremiumInput):
    if not model_loaded:
        return PremiumOutput(
            predicted_premium=0.0,
            model_version="1.0.0",
            rmse=MODEL_RMSE
        )

    df = pd.DataFrame([input_data.model_dump()])
    prediction = model.predict(df)[0]

    return PremiumOutput(
        predicted_premium=round(float(prediction), 2),
        model_version="1.0.0",
        rmse=MODEL_RMSE
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)