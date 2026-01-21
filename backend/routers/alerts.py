from fastapi import APIRouter, HTTPException, Path
import logging

from models import FDAAlertResponse
from services.alert_service import get_fda_alerts

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{drug_name}", response_model=FDAAlertResponse)
async def get_alerts_endpoint(
    drug_name: str = Path(
        ...,
        min_length=1,
        max_length=100,
        description="Drug name to check for FDA alerts"
    )
):
    """Get FDA alerts and recalls for a drug"""
    try:
        result = await get_fda_alerts(drug_name)
        return result
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to fetch FDA alerts for %s", drug_name)
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch FDA alerts from upstream service"
        )
